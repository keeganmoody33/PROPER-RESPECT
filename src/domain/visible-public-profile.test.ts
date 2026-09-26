import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import { ProductCard } from "@/components/product-card";
import { projectVisiblePublicProfile } from "./visible-public-profile";
import type { ActivityModule, PublicProfile } from "./public-profile";

const common = {
  attributionScope: "WORKSPACE" as const, capturedAt: "2026-09-21T13:14:15.000Z",
  freshness: "STALE" as const, provenanceLabel: "Captured workspace evidence",
  period: { start: "2026-09-01", end: "2026-09-21", label: "HIDDEN_PERIOD_LABEL" },
};
const activities: ActivityModule[] = [
  { ...common, kind: "contributionCalendar", total: 123456, memberSince: "2020-05-17", days: [{ date: "2026-09-02", count: 123456, level: 4 }] },
  { ...common, kind: "headlineMetrics", primary: { label: "Words", value: 123456.789, unit: "words" }, supporting: [{ label: "Speed", value: 12.345, unit: "WPM" }] },
  { ...common, kind: "timeSeries", label: "Trend", unit: "records", points: [{ date: "2026-09-02", value: 123456.789 }] },
  { ...common, kind: "artifactCollection", total: 123456, artifacts: [{ title: "Published article", url: "https://example.com/article", label: "HIDDEN_ARTIFACT_LABEL" }] },
  { ...common, kind: "reviewActivity", reviews: 123456, bugsCaught: 12345, severity: [{ label: "High", count: 42 }], points: [{ date: "2026-08-01", value: 987654321 }] },
  { ...common, kind: "codingActivity", primary: { label: "Tokens", value: 123456.789 }, supporting: [{ label: "Output", value: 12.345 }], days: [{ date: "2026-09-02", count: 123456, level: 4 }] },
];
function profile(activity?: ActivityModule): PublicProfile {
  return {
    handle: "person", displayName: "Person", bio: "Public bio", avatarUrl: "https://example.com/HIDDEN_AVATAR",
    profileLinks: [{ label: "Website", url: "https://example.com/" }], preferredLinkUrl: "https://example.com/HIDDEN_UNMATCHED_LINK",
    cards: [{ product: { name: "Example", slug: "hidden-slug", domain: "hidden-domain.example", description: "Public description", logoUrl: "https://example.com/HIDDEN_LOGO" },
      status: "ACTIVE", goTo: true, headline: "Public headline", note: "Public note", startedAt: "2025-01-03", activity,
      cost: { amount: 12.34567, currency: "USD", basis: "ESTIMATE", cadence: "MONTHLY", asOf: "2026-09-21", period: { start: "2026-09-01", end: "2026-09-21" } },
      primaryLink: { type: "AFFILIATE", label: "Visit example", url: "https://example.com/buy" },
    }],
  };
}

for (const activity of activities) it(`projects only visible ${activity.kind} values and caveats`, () => {
  const original = profile(activity);
  const result = projectVisiblePublicProfile(original);
  const text = load(renderToStaticMarkup(createElement(ProductCard, { card: original.cards[0], index: 0, goTo: true }))).text();
  const projected = result.cards[0].activity!;
  expect(projected).toMatchObject({ capturedOn: "2026-09-21", freshness: "STALE", attributionScope: "WORKSPACE", provenanceLabel: common.provenanceLabel, period: { start: "2026-09-01", end: "2026-09-21" } });
  expect(text).toContain(projected.provenanceLabel);
  expect(text).toContain(projected.capturedOn);
  function checkDisplayedValues(value: unknown): void {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (key === "displayValue" || key === "coverageNote" || key === "memberSinceYear") expect(text).toContain(child);
      else checkDisplayedValues(child);
    }
  }
  checkDisplayedValues(projected);
  const serialized = JSON.stringify(result);
  expect(serialized).not.toMatch(/HIDDEN_|hidden-slug|hidden-domain|13:14:15|2020-05-17|987654321|"level"/);
  expect(result.cards[0].cost).toEqual({ displayAmount: "$12.35", basis: "ESTIMATE", cadence: "MONTHLY", asOf: "2026-09-21", period: { start: "2026-09-01", end: "2026-09-21" } });
  expect(text).toContain(result.cards[0].cost!.displayAmount);
  expect(result.cards[0].primaryLink?.disclosure).toBe("Affiliate link");
  expect(result.nameLink).toBeUndefined();
  if (projected.kind === "headlineMetrics" || projected.kind === "codingActivity") expect(projected.primary.displayValue).toBe("123.5K");
  if (projected.kind === "timeSeries") expect(projected.points).toEqual([{ date: "2026-09-02", value: 123456.789 }]);
  if (projected.kind === "reviewActivity") expect(projected).not.toHaveProperty("points");
});

describe("visitor identity and missing evidence", () => {
  it("exposes only a matched name link and never references the source arrays", () => {
    const source = profile(); source.preferredLinkUrl = source.profileLinks![0].url;
    const result = projectVisiblePublicProfile(source);
    expect(result.nameLink).toBe(source.preferredLinkUrl);
    source.profileLinks![0].label = "Later private edit";
    expect(result.profileLinks[0].label).toBe("Website");
  });
  it("uses visitor fallbacks and leaves absent cost/activity absent", () => {
    const source = profile(); source.cards[0].headline = ""; source.cards[0].note = "";
    delete source.cards[0].cost; delete source.cards[0].startedAt;
    const result = projectVisiblePublicProfile(source).cards[0];
    expect(result.headline).toBe("Relationship note not supplied.");
    expect(result.note).toBe(result.headline);
    expect(result.startDateNote).toBe("Start date not supplied");
    expect(result).not.toHaveProperty("cost"); expect(result).not.toHaveProperty("activity");
  });
  it("labels missing periods and empty activity without inventing zero values", () => {
    for (const activity of [
      { ...common, kind: "contributionCalendar" as const, total: 0, days: [] },
      { ...common, kind: "timeSeries" as const, label: "Trend", points: [] },
      { ...common, kind: "artifactCollection" as const, total: 0, artifacts: [] },
    ]) {
      const result = projectVisiblePublicProfile(profile({ ...activity, period: undefined })).cards[0].activity!;
      expect(result.note).toBe("Measurement period not supplied");
      expect(result).toHaveProperty("emptyNote");
      expect(result).not.toHaveProperty("period");
    }
  });
  it("explains an empty published collection", () => {
    expect(projectVisiblePublicProfile({ ...profile(), cards: [] })).toMatchObject({ cards: [], emptyNote: "No published products yet. Draft and private records stay off this page." });
  });
});

it("keeps sparse daily coverage and no-period boundaries identical to the card", () => {
  for (const period of [undefined, { start: "2026-09-01", end: "2026-09-05" }]) {
    const activity: ActivityModule = { ...common, period, kind: "contributionCalendar", total: 2, days: [
      { date: "2026-09-02", count: 1, level: 1 }, { date: "2026-09-04", count: 1, level: 1 },
    ] };
    const source = profile(activity);
    const projected = projectVisiblePublicProfile(source).cards[0].activity!;
    expect(projected.kind).toBe("contributionCalendar");
    if (projected.kind !== "contributionCalendar") throw new Error("Unexpected projection");
    const text = load(renderToStaticMarkup(createElement(ProductCard, { card: source.cards[0], index: 0 }))).text();
    expect(projected.coverageNote).toBe(`${period ? "3 days have" : "1 day has"} no supplied count; blank spaces are not zero activity.`);
    expect(projected.suppliedRange).toBe("Daily counts: 2026-09-02 – 2026-09-04");
    expect(text).toContain(projected.coverageNote);
    expect(text).toContain(projected.suppliedRange);
  }
});

it("omits unrendered labels and units from an empty time series", () => {
  const source = profile({ ...common, kind: "timeSeries", label: "HIDDEN_EMPTY_LABEL", unit: "HIDDEN_EMPTY_UNIT", points: [] });
  const projected = projectVisiblePublicProfile(source);
  const text = load(renderToStaticMarkup(createElement(ProductCard, { card: source.cards[0], index: 0 }))).text();
  expect(text).toContain("No observations supplied");
  expect(text).not.toMatch(/HIDDEN_EMPTY_/);
  expect(JSON.stringify(projected)).not.toMatch(/HIDDEN_EMPTY_/);
  expect(projected.cards[0].activity).toMatchObject({ kind: "timeSeries", points: [], emptyNote: "No observations supplied" });
});

it("carries a card's work-sample link as its visible label and URL, and drops a stored link that isn't https", () => {
  const url = "https://www.loom.com/share/e5b8c04bca094dd8a5507925ab887002";
  const base = profile();
  const withLink = { ...base, cards: [{ ...base.cards[0], usageLink: { url, label: "TUTORIAL" as const } }] };
  expect(projectVisiblePublicProfile(withLink).cards[0].usageLink).toEqual({ label: "Tutorial", url });
  const tampered = { ...base, cards: [{ ...base.cards[0], usageLink: { url: "javascript:alert(1)", label: "DEMO" as const } }] };
  expect(projectVisiblePublicProfile(tampered).cards[0]).not.toHaveProperty("usageLink");
  expect(projectVisiblePublicProfile(base).cards[0]).not.toHaveProperty("usageLink");
});

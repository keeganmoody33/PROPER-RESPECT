import { load } from "cheerio";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ProductCard } from "../../components/product-card";
import type { PrivateUsageCard } from "../domain/private-usage-card";
import type { PublicProfile } from "../domain/public-profile";

const exactCount = "123456789012345678901234567890";
const exactUsd = "12345678901234567890.000000000001";
const card: PublicProfile["cards"][number] = {
  product: { name: "Claude Code", slug: "claude-code", domain: "claude.com", description: "Synthetic card fixture." },
  status: "TESTING", headline: "A synthetic local preview", note: "No owner usage validated.",
};
const usage: PrivateUsageCard = {
  version: "private-usage-card-v1", productSlug: "claude-code", connection: "unavailable", replays: 1, hasConflicts: false,
  rows: [{ sample: "synthetic", model: "claude-haiku-4-5-20251001", sourceVersion: "2.1.214", capturedAt: "2026-09-24T12:00:00.000Z",
    period: { start: "2026-09-24T10:00:00.000Z", end: "2026-09-24T11:00:00.000Z", timezone: "UTC" }, status: "measured",
    counts: [{ label: "Input tokens", value: exactCount }, { label: "Output tokens", value: "0" }, { label: "Cache read tokens", value: null }],
    sourceEstimateUsd: exactUsd, apiEquivalent: { kind: "unpriced", reasons: ["No explicit synthetic valuation scenario."] }, billed: "unknown", reasons: ["Gap in supplied observations."] }],
  observations: [{ sample: "synthetic", model: "claude-haiku-4-5-20251001", sourceVersion: "2.1.214", capturedAt: "2026-09-24T12:00:00.000Z",
    period: { start: "2026-09-24T10:00:00.000Z", end: "2026-09-24T11:00:00.000Z", timezone: "UTC" }, status: "source-observation", temporality: "delta",
    counts: [{ label: "Input tokens", value: "7" }], sourceEstimateUsd: "0", reasons: [] }],
};

function render(overrides: Partial<ComponentProps<typeof ProductCard>> = {}) {
  return load(renderToStaticMarkup(createElement(ProductCard, { card, index: 0, audience: "owner", privateUsage: usage, ...overrides })));
}

test("private owner details preserve every exact count and decimal with distinct zero and unknown", () => {
  const $ = render();
  const rows = $(".private-usage-rows");
  expect(rows.text()).toContain(exactCount);
  expect(rows.text()).toContain(exactUsd);
  expect(rows.find(".private-usage-counts dd").map((_, el) => $(el).text()).get()).toEqual([exactCount, "0", "Unknown"]);
  expect(rows.find(".private-usage-costs").text()).toContain("Source estimate (USD)");
  expect(rows.find(".private-usage-costs").text()).toContain("API-equivalent estimate (USD)Unpriced");
  expect(rows.find(".private-usage-costs").text()).toContain("Billed (USD)Unknown");
  expect(rows.text()).toContain("Gap in supplied observations.");
});

test("front and details mark local usage private, synthetic, unavailable and not publishable", () => {
  const $ = render();
  expect($(".card-front .private-usage-preview").text()).toContain("Private local snapshot");
  expect($(".private-usage-preview").text()).toContain("Synthetic");
  expect($(".private-usage-details").text()).toContain("Not connected");
  expect($(".private-usage-details").text()).toContain("not publishable");
  expect($(".private-usage-details").text()).toContain("not validated");
  expect($(".activity-placeholder")).toHaveLength(0);
  expect($(".private-usage-details").text()).not.toContain("Fresh");
  expect($("button").text()).not.toContain("Connect");
});

test("period, capture and original observations retain separate labels", () => {
  const $ = render();
  expect($(".private-usage-rows").text()).toContain("Observation period");
  expect($(".private-usage-rows").text()).toContain("2026-09-24T10:00:00.000Z");
  expect($(".private-usage-rows").text()).toContain("Captured");
  expect($(".private-usage-rows").text()).toContain("2026-09-24T12:00:00.000Z");
  expect($("details.private-usage-observations summary").text()).toContain("Source observations");
  expect($("details.private-usage-observations").attr("open")).toBeUndefined();
  expect($(".private-usage-observations .private-usage-counts dd").text()).toBe("7");
  expect($(".private-usage-details").text()).toContain("not additive");
});

test.each(["baseline", "conflict", "account-snapshot"] as const)("%s is not represented as measured usage", (status) => {
  const $ = render({ privateUsage: { ...usage, rows: [{ ...usage.rows[0], status }] } });
  const details = $(".private-usage-rows").text();
  if (status === "baseline") expect(details).toContain("not measured increments");
  if (status === "conflict") expect(details).toContain("not measured usage");
  if (status === "account-snapshot") expect(details).toContain("not an observed usage interval");
});

test("API-equivalent pricing stays synthetic and distinct from source estimates and bills", () => {
  const $ = render({ privateUsage: { ...usage, rows: [{ ...usage.rows[0], apiEquivalent: {
    kind: "synthetic-api-equivalent", exactUsd: "0.000000000001", rateVersion: "synthetic-rate", rateSource: "https://example.com/rates",
  } }] } });
  expect($(".private-usage-costs").text()).toContain(exactUsd);
  expect($(".private-usage-costs").text()).toContain("0.000000000001");
  expect($(".private-usage-details").text()).toContain("counterfactual");
  expect($(".private-usage-costs").text()).toContain("Billed (USD)Unknown");
});

test.each([
  { audience: "visitor" as const },
  { audience: undefined },
  { displayMode: "brand-preview" as const },
  { card: { ...card, product: { ...card.product, slug: "another-tool" } } },
  { card: { ...card, product: { ...card.product, domain: "other.example.com" } } },
])("private props cannot render through a visitor, brand preview or mismatched identity: %j", (overrides) => {
  const $ = render(overrides);
  expect($(".private-usage-preview, .private-usage-details")).toHaveLength(0);
  expect($.text()).not.toContain(exactCount);
  expect($.text()).not.toContain(exactUsd);
});

test("invalid runtime projections fail closed rather than partially displaying", () => {
  const invalid = { ...usage, accountAlias: "DO_NOT_RENDER_PRIVATE_ALIAS" };
  const $ = render({ privateUsage: invalid });
  expect($(".private-usage-preview, .private-usage-details")).toHaveLength(0);
  expect($.text()).not.toContain("DO_NOT_RENDER_PRIVATE_ALIAS");
});

test("omitting private usage leaves ordinary owner cards and existing subscription cost intact", () => {
  const $ = render({ privateUsage: undefined, card: { ...card, cost: { amount: 20, currency: "USD", cadence: "MONTHLY", basis: "OWNER_REPORTED", asOf: "2026-09-24" } } });
  expect($(".private-usage-preview, .private-usage-details")).toHaveLength(0);
  expect($(".activity-placeholder").text()).toBe("Add a usage snapshot or describe your history.");
  expect($(".card-back").text()).toContain("Owner-reported cost: $20.00/month");
});

test("Codex account snapshots render only on the matching canonical card and stay unpriced", () => {
  const codex: PrivateUsageCard = { ...usage, productSlug: "codex", observations: [], rows: [{ ...usage.rows[0],
    sample: "origin-unverified", status: "account-snapshot", period: null, model: null,
    counts: [{ label: "Lifetime tokens (account snapshot)", value: exactCount }], sourceEstimateUsd: null,
    apiEquivalent: { kind: "unpriced", reasons: ["Missing model/category split/period/tier."] },
  }] };
  const $ = render({ privateUsage: codex, card: { ...card, product: { ...card.product, name: "Codex", slug: "codex", domain: "openai.com" } } });
  expect($(".private-usage-details").text()).toContain("Origin unverified");
  expect($(".private-usage-details").text()).toContain("Account totals remain unpriced");
  expect($(".private-usage-counts dd").text()).toBe(exactCount);
  expect($(".private-usage-meta").text()).toContain("Observation periodUnknown");
  expect($(".private-usage-costs").text()).toContain("API-equivalent estimate (USD)Unpriced");
  const mismatched = render({ privateUsage: codex });
  expect(mismatched(".private-usage-details")).toHaveLength(0);
});

test("multiple rows retain independent estimates and mixed sample designations", () => {
  const $ = render({ privateUsage: { ...usage, rows: [usage.rows[0], { ...usage.rows[0], sample: "owner-supplied-unverified", sourceEstimateUsd: "0" }] } });
  expect($(".private-usage-rows > section")).toHaveLength(2);
  expect($(".private-usage-preview").text()).toContain("Synthetic · Owner-supplied · unverified");
  expect($(".private-usage-preview").text()).toContain("2 independent coverage rows · not additive");
  expect($(".private-usage-rows .private-usage-costs").eq(0).text()).toContain(exactUsd);
  expect($(".private-usage-rows .private-usage-costs").eq(1).text()).toContain("Source estimate (USD)0");
});


test.each(["delta", "cumulative"] as const)("%s source observations expose their measurement basis", (temporality) => {
  const $ = render({ privateUsage: { ...usage, observations: [{ ...usage.observations[0], temporality }] } });
  const observations = $(".private-usage-observations");
  expect(observations.find(".private-usage-counts dd").text()).toBe("7");
  expect(observations.text()).toContain(temporality === "cumulative"
    ? "Cumulative source reading · not measured increments"
    : "Delta source observation · not an additional usage interval");
});

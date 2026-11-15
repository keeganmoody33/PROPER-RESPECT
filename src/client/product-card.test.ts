import { readFileSync } from "node:fs";
import { load } from "cheerio";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ProductCard } from "../../components/product-card";
import { ProductBrandDetails } from "../../components/product-brand-details";
import type { ActivityModule, PublicProfile } from "../domain/public-profile";
import { productBrandSnapshotSchema, type ProductBrandSnapshot } from "../domain/product-brand";

type Card = PublicProfile["cards"][number];

const baseCard: Card = {
  product: {
    name: "Example Product",
    slug: "example-product",
    domain: "example.com",
    description: "A synthetic product for rendering checks.",
  },
  status: "TESTING",
  headline: "An owner-approved observation.",
  note: "Synthetic card evidence.",
  primaryLink: {
    type: "CANONICAL",
    url: "https://example.com",
    label: "Visit Example Product",
  },
};

const brand: ProductBrandSnapshot = {
  schemaVersion: 1,
  provider: "context.dev",
  adapterVersion: "context-brand/v1",
  productSlug: "example-product",
  canonicalDomain: "example.com",
  retrievalId: "brand-render-test",
  retrievedAt: "2026-09-17T12:00:00.000Z",
  partial: false,
  logos: [
    { url: "https://example.com/light.svg", mode: "light", type: "logo" },
    { url: "https://example.com/dark.svg", mode: "dark", type: "logo" },
  ],
  colors: [{ hex: "#FF0000" }, { hex: "#FFFFFF" }],
  fonts: [{ family: "Example Sans", uses: ["body"], fallbacks: ["sans-serif"] }],
  receipts: [{ endpoint: "brand", status: "ok" }],
  responseHash: "a".repeat(64),
};

function renderCard(overrides: Partial<Card> = {}) {
  return load(renderToStaticMarkup(createElement(ProductCard, {
    card: { ...baseCard, ...overrides },
    index: 0,
  })));
}

test("a card's work-sample link sits on the back under the owner's label, and not on the front", () => {
  const url = "https://www.loom.com/share/e5b8c04bca094dd8a5507925ab887002";
  const $ = renderCard({ usageLink: { url, label: "TUTORIAL" } });
  const link = $(".card-back a.usage-link");
  expect(link.attr("href")).toBe(url);
  expect(link.attr("target")).toBe("_blank");
  expect(link.attr("rel")).toBe("noopener noreferrer");
  expect(link.text()).toBe("Tutorial ↗loom.com");
  expect(link.attr("aria-label")).toBe("Tutorial, on loom.com (opens in a new tab)");
  expect($(".card-front .usage-link")).toHaveLength(0);
  expect($("iframe")).toHaveLength(0);
});

test("a stored work-sample link that isn't https never renders", () => {
  const $ = renderCard({ usageLink: { url: "javascript:alert(1)", label: "DEMO" } });
  expect($(".usage-link")).toHaveLength(0);
});

test.each([
  { name: "Wispr Flow", slug: "wisprflow", domain: "wisprflow.ai", path: "/product-assets/wisprflow/2026-09-21/app-icon.jpg" },
  { name: "Clay", slug: "clay", domain: "clay.com", path: "/product-assets/clay/2026-09-21/app-icon.png" },
])("$name uses the reviewed app icon even when a card has no logo or an old favicon", ({ path, ...product }) => {
  for (const logoUrl of [undefined, "/old-32px-favicon.png"]) {
    const $ = renderCard({ product: { ...product, description: "Synthetic product", logoUrl } });
    expect($(".product-logo img").attr("src")).toBe(path);
    expect($(".product-logo").attr("data-logo-layout")).toBe("app-icon");
    expect($(".product-logo img").attr("width")).toBe("512");
    expect($(".product-logo img").attr("height")).toBe("512");
  }
});

test("an optional headline falls back to the saved owner explanation on the compact front", () => {
  const card = renderCard({ headline: "", note: "Essential for an occasional workflow." });
  expect(card(".card-headline").text()).toBe("Essential for an occasional workflow.");
  expect(card(".card-headline").text()).not.toContain("not supplied");
});

test("an owner-described product without a website needs neither an invented link nor telemetry", () => {
  const card = renderCard({ product: { ...baseCard.product, domain: "" }, primaryLink: undefined, activity: undefined });
  // The only link left is the site's own explanation of evidence.
  expect(card("a").not(".evidence-link")).toHaveLength(0);
  expect(card(".card-headline").text()).toBe(baseCard.headline);
  expect(card(".activity-placeholder")).toHaveLength(0);
});

test("the back of a card links to how evidence works; a brand preview doesn't", () => {
  const link = renderCard()(".card-back a.evidence-link");
  expect(link).toHaveLength(1);
  expect(link.attr("href")).toBe("/about/methodology");
  expect(link.text()).toBe("How evidence works");
  const preview = load(renderToStaticMarkup(createElement(ProductCard, { card: baseCard, index: 0, displayMode: "brand-preview" })));
  expect(preview("a.evidence-link")).toHaveLength(0);
});

test("a brand preview makes no owner relationship or activity claim", () => {
  const $ = load(renderToStaticMarkup(createElement(ProductCard, { card: baseCard, index: 0, displayMode: "brand-preview" })));
  expect($(".card-title .eyebrow").text()).toBe("Brand preview");
  expect($(".activity-placeholder").text()).toBe("No personal activity is included in this brand preview.");
  expect($.text()).not.toContain(baseCard.headline);
});

test.each(["headlineMetrics", "codingActivity"] as const)(
  "%s preserves supplied supporting metric units without adding units to counts",
  (kind) => {
    const $ = renderCard({
      activity: {
        kind,
        attributionScope: "PERSONAL",
        capturedAt: "2026-09-17T12:00:00.000Z",
        freshness: "FRESH",
        provenanceLabel: "Synthetic owner-approved evidence",
        primary: { label: "Recorded activity", value: 120 },
        supporting: [
          { label: "Average speed", value: 147.3, unit: "WPM" },
          { label: "Sessions", value: 8 },
          { label: "Time saved", value: 23, unit: "hours" },
        ],
      },
    });

    expect($(".metric-row > div").toArray().map((metric) => ({
      value: $(metric).find("strong").text(),
      label: $(metric).find("span").text(),
    }))).toEqual([
      { value: "147.3", label: "Average speed · WPM" },
      { value: "8", label: "Sessions" },
      { value: "23", label: "Time saved · hours" },
    ]);
  },
);

test.each([["ACTIVE", "Using"], ["TESTING", "Testing"], ["ARCHIVED", "Used before"]] as const)(
  "%s without a level or start date falls back to %s and implies no duration",
  (status, words) => {
    const $ = renderCard({ status });

    expect($(".card-title .eyebrow").text()).toBe(words);
    expect($(".status-row").text()).toContain(words);
  },
);

test("uses a retained brand logo for the actual dark card surface without changing evidence", () => {
  const $ = renderCard({ product: { ...baseCard.product, brand } });

  expect($(".product-logo img").attr("src")).toBe("https://example.com/dark.svg");
  expect($(".product-logo").attr("data-logo-mode")).toBe("dark");
  expect($(".card-title .eyebrow").text()).toBe("Testing");
  expect($(".activity-placeholder")).toHaveLength(0);
  expect($(".card-headline").text()).toBe(baseCard.headline);
  expect($(".product-card").attr("style") ?? "").not.toContain("#FF0000");
});

test.each(["owner", "visitor"] as const)("%s cards use retained branding without exposing retrieval diagnostics", (audience) => {
  const $ = load(renderToStaticMarkup(createElement(ProductCard, {
    card: { ...baseCard, product: { ...baseCard.product, brand } }, index: 0, audience,
  })));
  expect($(".product-logo img").attr("src")).toBe("https://example.com/dark.svg");
  expect($(".card-brand-provenance")).toHaveLength(0);
  expect($.text()).not.toContain(brand.provider);
  expect($.text()).not.toContain(brand.retrievalId);
  expect($.text()).not.toContain(brand.responseHash);
  expect($(".card-back blockquote").text()).toBe(baseCard.note);
});

test("uses explicit readable styleguide roles and chooses a logo for that surface", () => {
  const $ = renderCard({ product: { ...baseCard.product, brand: {
    ...brand,
    styleguide: {
      mode: "light",
      colors: { background: "#FFFFFF", text: "#111111", accent: "#123456" },
    },
  } } });

  expect($(".product-card").attr("style")).toContain("--brand-card-background:#FFFFFF");
  expect($(".product-card").attr("style")).toContain("--brand-card-text:#111111");
  expect($(".product-card").attr("style")).toContain("--brand-card-accent:#123456");
  expect($(".product-logo img").attr("src")).toBe("https://example.com/light.svg");
});

test("draws a branded card's edge and button from the product's stored card and button values", () => {
  const $ = renderCard({ product: { ...baseCard.product, brand: {
    ...brand, schemaVersion: 2, fontLinks: [],
    styleguide: {
      mode: "light", colors: { background: "#f9f9f9", text: "#262626", accent: "#ff4c00" },
      components: { card: { border: "#9aa0a6", radiusPx: 8 }, buttonPrimary: { background: "#ff4c00", text: "#ffffff", radiusPx: 20, weight: 450 } },
    },
  } } });
  const style = $(".product-card").attr("style") ?? "";
  for (const rule of ["--brand-card-border:#9aa0a6", "--brand-card-radius:8px", "--brand-card-button-fill:#ff4c00", "--brand-card-button-text:#262626", "--brand-card-button-radius:20px", "--brand-card-button-weight:450"]) {
    expect(style).toContain(rule);
  }
});

test("an unbranded card's button keeps its bold weight", () => {
  // The base .card-button rule is 700; only a stored brand weight may change it.
  expect(readFileSync("app/globals.css", "utf8")).toContain("font-weight: var(--brand-card-button-weight, 700);");
});

test("gives a branded card a border that shows when its brand stored none, and leaves an unbranded card to the default edge", () => {
  const branded = renderCard({ product: { ...baseCard.product, brand: { ...brand, styleguide: { mode: "light", colors: { background: "#FFFFFF", text: "#111111" } } } } });
  expect(branded(".product-card").attr("style")).toContain("--brand-card-border:#cbcbcb");
  expect(branded(".product-card").attr("style")).not.toContain("--brand-card-button-fill");
  expect(renderCard()(".product-card").attr("style") ?? "").not.toContain("--brand-card-border");
});

test.each([
  { productSlug: "different-product" },
  { canonicalDomain: "different.example.com" },
])("does not borrow a brand snapshot from another canonical identity: %j", (mismatch) => {
  const $ = renderCard({ product: { ...baseCard.product, brand: { ...brand, ...mismatch } } });

  expect($(".product-logo img")).toHaveLength(0);
  expect($(".card-front .product-logo").text()).toBe("EP");
  expect($(".product-card").attr("style") ?? "").toBe("");
});

test("keeps existing product logos and initials available when no brand logo was returned", () => {
  const product = { ...baseCard.product, brand: { ...brand, logos: [] } };
  const withLogo = renderCard({ product: { ...product, logoUrl: "https://example.com/canonical.png" } });
  const withInitials = renderCard({ product });

  expect(withLogo(".product-logo img").attr("src")).toBe("https://example.com/canonical.png");
  expect(withLogo(".product-logo").attr("data-logo-provider")).toBeUndefined();
  expect(withInitials(".card-front .product-logo").text()).toBe("EP");
});

test("identifies an opposite-mode logo so it receives its explicit matching backing", () => {
  const $ = renderCard({ product: { ...baseCard.product, brand: {
    ...brand,
    logos: [brand.logos[0]],
  } } });

  expect($(".product-logo img").attr("src")).toBe("https://example.com/light.svg");
  expect($(".product-logo").attr("data-logo-mode")).toBe("light");
});

test.each([
  { background: "#FFFFFF", text: "#FFFFEE", accent: "#111111" },
  { background: "#FFFFFF00", text: "#111111", accent: "#111111" },
])("retains readable defaults for unreadable or translucent styleguide colors: %j", (colors) => {
  const $ = renderCard({ product: { ...baseCard.product, brand: {
    ...brand,
    styleguide: { mode: "light", colors },
  } } });

  expect($(".product-card").attr("style") ?? "").toBe("");
  expect($(".product-logo img").attr("src")).toBe("https://example.com/dark.svg");
});

test("palette ordering never supplies semantic card colors", () => {
  const first = renderCard({ product: { ...baseCard.product, brand } });
  const second = renderCard({ product: { ...baseCard.product, brand: {
    ...brand,
    colors: [...brand.colors].reverse(),
  } } });

  expect(first(".product-card").attr("style") ?? "").toBe("");
  expect(second(".product-card").attr("style") ?? "").toBe("");
});

test("brand metadata leaves the owner-approved activity, relationship and headline intact", () => {
  const activity: Card["activity"] = {
    kind: "headlineMetrics",
    attributionScope: "PERSONAL",
    capturedAt: "2026-09-17T12:00:00.000Z",
    freshness: "FRESH",
    provenanceLabel: "Synthetic owner-approved evidence",
    period: { start: "2026-09-01", end: "2026-09-15" },
    primary: { label: "Recorded activity", value: 120 },
    supporting: [{ label: "Average speed", value: 147.3, unit: "WPM" }],
  };
  const withoutBrand = renderCard({ activity, startedAt: "2024-06-03" });
  const withBrand = renderCard({ activity, startedAt: "2024-06-03", product: { ...baseCard.product, brand } });

  expect(withBrand(".activity-module").html()).toBe(withoutBrand(".activity-module").html());
  expect(withBrand(".card-title .eyebrow").text()).toBe(withoutBrand(".card-title .eyebrow").text());
  expect(withBrand(".card-headline").text()).toBe(withoutBrand(".card-headline").text());
});

test("brand Details retain provenance, palette and font names without loading external CSS or fonts", () => {
  const $ = load(renderToStaticMarkup(createElement(ProductBrandDetails, { snapshot: brand })));

  expect($(".brand-provenance").text()).toContain(brand.provider);
  expect($(".brand-provenance").text()).toContain(brand.canonicalDomain);
  expect($(".brand-provenance").text()).toContain(brand.adapterVersion);
  expect($(".brand-provenance").text()).toContain(brand.retrievalId);
  expect($(".brand-provenance").text()).toContain(brand.responseHash);
  expect($("time").attr("datetime")).toBe(brand.retrievedAt);
  expect($(".brand-palette li").toArray().map((item) => $(item).text())).toEqual(["#FF0000", "#FFFFFF"]);
  expect($(".brand-fonts").text()).toContain("Example Sans");
  expect($(".product-brand-details").text()).toContain("does not verify account ownership or product use");
  expect($("link, style, script")).toHaveLength(0);
});

test("missing optional brand fields remain inspectable without making the card incomplete", () => {
  const emptyBrand: ProductBrandSnapshot = {
    ...brand,
    logos: [], colors: [], fonts: [], partial: true,
    receipts: [
      { endpoint: "brand", status: "ok", partial: true },
      { endpoint: "fonts", status: "unavailable", httpStatus: 404 },
      { endpoint: "styleguide", status: "error", httpStatus: 503 },
    ],
  };
  const card = renderCard({ product: { ...baseCard.product, brand: emptyBrand } });
  const $ = load(renderToStaticMarkup(createElement(ProductBrandDetails, { snapshot: emptyBrand })));

  expect(card(".card-front .product-logo").text()).toBe("EP");
  expect(card(".card-front .card-title h2").text()).toBe(baseCard.product.name);
  expect($("section").text()).toContain("No brand logo returned");
  expect($("section").text()).toContain("No palette returned");
  expect($("section").text()).toContain("No fonts returned");
  expect($("section").text()).toContain("No styleguide returned");
  expect($(".brand-receipts").text()).toContain("fonts: unavailable · HTTP 404");
  expect($(".brand-receipts").text()).toContain("styleguide: error · HTTP 503");
});

test.each([["ACTIVE", "Using · since 2024"], ["TESTING", "Testing · since 2024"], ["ARCHIVED", "Used before · started 2024"]] as const)(
  "%s without a level retains the supplied relationship start year",
  (status, topLine) => {
    const $ = renderCard({ status, startedAt: "2024-06-03" });

    expect($(".card-title .eyebrow").text()).toBe(topLine);
  },
);

test.each([
  ["TRIED_NOT_ADOPTED", "ARCHIVED", "Tried, didn't adopt"],
  ["STOPPED", "ARCHIVED", "Stopped using · started 2022"],
  ["PAUSED", "ARCHIVED", "Paused · started 2022"],
  ["OCCASIONAL", "ACTIVE", "Occasionally · since 2022"],
  ["TESTING", "TESTING", "Testing · since 2022"],
  ["WEEKLY", "ACTIVE", "Weekly · since 2022"],
  ["DAILY", "ACTIVE", "Daily · since 2022"],
] as const)("level %s shows its own label on the top line", (level, status, line) => {
  const $ = renderCard({ status, level, startedAt: "2022-04-05" });

  expect($(".card-title .eyebrow").text()).toBe(line);
  expect($(".product-card").text()).not.toContain("ARCHIVED");
});

test("a go-to card keeps its go-to badge whatever its level", () => {
  const $ = load(renderToStaticMarkup(createElement(ProductCard, {
    card: { ...baseCard, status: "ACTIVE", level: "OCCASIONAL", startedAt: "2023-01-01" }, index: 0, goTo: true,
  })));

  expect($(".card-title .eyebrow").text()).toBe("Occasionally · since 2023");
  expect($(".card-footer .card-go-to").text()).toBe("Owner-selected go-to");
  expect($(".card-back .card-go-to").text()).toBe("Owner-selected go-to");
});

const activityEvidence = {
  attributionScope: "PERSONAL" as const,
  capturedAt: "2026-09-18T12:00:00.000Z",
  freshness: "STALE" as const,
  provenanceLabel: "Synthetic owner-approved evidence",
  period: { start: "2026-09-01", end: "2026-09-15" },
};

const activityExamples: ActivityModule[] = [
  { ...activityEvidence, kind: "contributionCalendar", total: 37, days: [{ date: "2026-09-15", count: 3, level: 2 }] },
  { ...activityEvidence, kind: "headlineMetrics", primary: { label: "Words recorded", value: 120 }, supporting: [{ label: "Sessions", value: 8 }] },
  { ...activityEvidence, kind: "timeSeries", label: "Minutes recorded", unit: "min", points: [{ date: "2026-09-15", value: 45 }] },
  { ...activityEvidence, kind: "artifactCollection", total: 2, artifacts: [{ title: "Synthetic notebook", url: "https://example.com/notebook" }] },
  { ...activityEvidence, kind: "reviewActivity", reviews: 17, bugsCaught: 3, severity: [{ label: "High", count: 2 }], points: [] },
  { ...activityEvidence, kind: "codingActivity", primary: { label: "Changes recorded", value: 72 }, supporting: [{ label: "Sessions", value: 5 }] },
];

for (const audience of ["owner", "visitor"] as const) {
  test.each(activityExamples)(`${audience}: $kind presents a successful capture as a dated snapshot, not an ongoing update`, (example) => {
    const activity = { ...example, freshness: "FRESH" as const };
    const $ = load(renderToStaticMarkup(createElement(ProductCard, {
      card: { ...baseCard, status: "ARCHIVED", activity }, index: 0, audience,
    })));

    const meta = $(".activity-meta");
    expect(meta.text()).not.toContain("Updated");
    expect(meta.text()).toContain("Snapshot recorded 18 Sep 2026");
    expect(meta.text()).toContain("1 Sep 2026 to 15 Sep 2026");
    expect(meta.text()).toContain(activity.provenanceLabel);
    expect($(".status-row").text()).toContain("Used before");
    expect($(".product-card").text()).not.toContain("ARCHIVED");
  });
}

test.each([
  ["STALE", "last updated 18 Sep 2026"],
  ["ERROR", "last updated 18 Sep 2026 · refresh failed"],
] as const)("%s says on the front when it was last updated, and keeps its status word on the back", (freshness, front) => {
  const $ = renderCard({ activity: { ...activityExamples[0], freshness } });

  expect($(".card-front [data-freshness]").text()).toBe(` · ${front}`);
  expect($(".card-front").text()).not.toContain(freshness.toLowerCase() === "stale" ? "stale" : "error");
  expect($(".activity-meta [data-freshness]").text()).toBe(freshness.toLowerCase());
  expect($(".activity-meta").text()).toContain("Snapshot recorded 18 Sep 2026");
  expect($(".status-row").text()).toContain("Testing");
});

test("the compact front leads with the owner relationship and leaves full evidence on its reverse", () => {
  const $ = renderCard({ activity: activityExamples[1] });
  const front = $(".card-front");

  expect(front.find(".card-headline").text()).toBe(baseCard.headline);
  expect(front.text().indexOf(baseCard.headline)).toBeLessThan(front.text().indexOf("120"));
  expect(front.find(".metric-row, .activity-calendar, .activity-bars, .activity-meta")).toHaveLength(0);
  expect(front.find(".card-activity-preview").text()).toContain("120");
  expect(front.find(".card-activity-coverage").text()).toBe("1–15 Sep 2026 · last updated 18 Sep 2026");
  expect($(".card-back").text()).toContain(baseCard.note);
});

test("the reverse is a native in-card disclosure with one active face, not a modal", () => {
  const $ = renderCard();
  const trigger = $(".card-button");
  const back = $(".card-back");

  expect($("dialog, [aria-modal]")).toHaveLength(0);
  expect(trigger.attr("aria-expanded")).toBe("false");
  expect(trigger.attr("aria-controls")).toBe(back.attr("id"));
  expect(back.attr("hidden")).toBeDefined();
  expect(back.attr("role")).toBe("region");
  expect(back.attr("aria-labelledby")).toBe(back.find("h2").attr("id"));
  expect($(".card-front").attr("aria-hidden")).toBe("false");
  expect(back.find(".close-button").text()).toBe("Close details");
});

test("two cards for the same product keep independent disclosure targets", () => {
  const $ = load(renderToStaticMarkup(createElement("div", null,
    createElement(ProductCard, { card: baseCard, index: 0 }),
    createElement(ProductCard, { card: baseCard, index: 0 }),
  )));
  const targets = $(".card-button").toArray().map((button) => $(button).attr("aria-controls"));

  expect(targets.every(Boolean)).toBe(true);
  expect(new Set(targets).size).toBe(2);
});

test("a missing relationship date and missing activity coverage stay explicit", () => {
  const $ = renderCard({ activity: { ...activityExamples[1], period: undefined } });

  expect($(".card-back .relationship-date").text()).toBe("Start date not supplied");
  expect($(".card-front").text()).toContain("Measurement period not supplied");
  expect($(".card-back .activity-meta").text()).toContain("Measurement period not supplied");
});

test.each(activityExamples)("$kind keeps the complete supplied activity and provenance on the reverse", (activity) => {
  const $ = renderCard({ activity });
  const reverse = $(".card-back");

  expect(reverse.find(".activity-module")).toHaveLength(1);
  expect(reverse.find(".activity-meta").text()).toContain(activity.provenanceLabel);
  expect(reverse.find(".activity-meta").text()).toContain("personal activity");
  expect(reverse.find(".activity-meta").text()).toContain("1 Sep 2026 to 15 Sep 2026");
  expect(reverse.find(".activity-meta").text()).toContain("Snapshot recorded 18 Sep 2026");
});

test("an empty time series does not turn missing observations into zero activity", () => {
  const $ = renderCard({ activity: { ...activityEvidence, kind: "timeSeries", label: "Minutes recorded", points: [] } });

  expect($(".card-activity-preview").text()).toContain("No data points supplied");
  expect($(".card-back .activity-module").text()).toContain("No data points supplied");
  expect($(".activity-hero strong")).toHaveLength(0);
  expect($(".activity-bars")).toHaveLength(0);
});

test("a recorded zero remains distinct from an empty time series", () => {
  const $ = renderCard({ activity: { ...activityEvidence, kind: "timeSeries", label: "Minutes recorded", points: [{ date: "2026-09-15", value: 0 }] } });

  expect($(".card-activity-preview strong").text()).toBe("0");
  // The back doesn't repeat the front's number.
  expect($(".card-back .activity-hero")).toHaveLength(0);
});

test("a supplied time series draws its bars on the front, and the back says where they came from without drawing them again", () => {
  const $ = renderCard({
    activity: {
      ...activityEvidence,
      kind: "timeSeries",
      label: "Minutes recorded",
      unit: "min",
      points: [{ date: "2026-09-15", value: 45 }],
    },
  });

  expect($(".card-front .activity-bars > span")).toHaveLength(1);
  expect($(".card-front .activity-bars > span").attr("title")).toBe("15 Sep 2026: 45 min");
  expect($(".card-front .activity-bars").attr("role")).toBe("img");
  expect($(".card-front .activity-bars").attr("aria-label")).toBe("Minutes recorded trend");
  expect($(".card-front .card-activity-preview strong").text()).toBe("45");
  expect($(".card-front .card-activity-coverage").text()).toContain("Sep 2026");
  // What a visitor reads; the screen-reader table of bars keeps each bar's exact dates.
  expect($(".card-front .card-activity-preview > p").text()).not.toMatch(/observation|personal activity|\d{4}-\d{2}-\d{2}/);
  expect($(".card-front .usage-chart-log, .card-front .blueprint-dim")).toHaveLength(0);
  // The back doesn't draw the chart again: it says where the series came from, in one plain line, without a score.
  expect($(".card-back .activity-bars, .card-back .usage-chart")).toHaveLength(0);
  expect($(".card-back .activity-summary").text()).toBe("Synthetic owner-approved evidence · the owner's own use · 1–15 Sep 2026 · last updated 18 Sep 2026");
  expect($(".card-back").text()).not.toMatch(/score|rank/i);
});

test("brand preview exposes brand provenance without exposing any supplied personal evidence", () => {
  const card = { ...baseCard, product: { ...baseCard.product, brand }, startedAt: "2024-06-03", activity: activityExamples[1] };
  const $ = load(renderToStaticMarkup(createElement(ProductCard, { card, index: 0, displayMode: "brand-preview" })));

  expect($.text()).not.toContain(baseCard.headline);
  expect($.text()).not.toContain(baseCard.note);
  expect($.text()).not.toContain("2024-06-03");
  expect($.text()).not.toContain(activityEvidence.provenanceLabel);
  expect($(".card-back .product-brand-details .brand-provenance").text()).toContain(brand.responseHash);
});

const fontBrand: ProductBrandSnapshot = {
  ...brand,
  schemaVersion: 2,
  colors: brand.colors.map((color) => ({ ...color, hex: color.hex.toLowerCase() })),
  fontLinks: [{ family: "Example Sans", source: "fonts", type: "custom", files: [{ url: "https://example.com/example-sans.woff2", weight: 400, format: "woff2" }] }],
  styleguide: {
    mode: "dark", colors: {},
    typography: { body: { family: "Example Sans", fallbacks: ["sans-serif"], weight: 400 } },
  },
};

test("a matching retained font is scoped to the card and leaves its relationship copy intact", () => {
  productBrandSnapshotSchema.parse(fontBrand);
  const $ = renderCard({ product: { ...baseCard.product, brand: fontBrand } });

  expect($(".product-card").attr("style") ?? "").toContain("--brand-card-body-font:");
  expect($(".product-card style[data-product-brand-fonts]").text()).toContain("https://example.com/example-sans.woff2");
  expect($(".card-headline").text()).toBe(baseCard.headline);
});

test("a card nobody can see yet keeps its brand's layout but fetches none of its fonts or logo", () => {
  const card = { ...baseCard, product: { ...baseCard.product, brand: fontBrand } };
  const $ = load(renderToStaticMarkup(createElement(ProductCard, { card, index: 0, deferBrandAssets: true })));

  expect($(".product-card").attr("style") ?? "").toContain("--brand-card-body-font:");
  expect($("style")).toHaveLength(0);
  expect($("img")).toHaveLength(0);
  expect($(".card-front .product-logo").text()).toBe("EP");
});

test("a mismatched identity cannot load another product's retained fonts", () => {
  const $ = renderCard({ product: { ...baseCard.product, brand: { ...fontBrand, canonicalDomain: "another.example.com" } } });

  expect($(".product-card").attr("style") ?? "").not.toContain("--brand-card-body-font");
  expect($("style[data-product-brand-fonts]")).toHaveLength(0);
});

test.each(["ACTIVE", "TESTING", "ARCHIVED"] as const)(
  "an unconfirmed %s discovery does not assert a relationship, start date, or go-to decision",
  (status) => {
    const card = { ...baseCard, status, startedAt: "2024-06-03" };
    const $ = load(renderToStaticMarkup(createElement(ProductCard, { card, index: 0, relationshipConfirmed: false, goTo: true })));

    expect($(".card-title .eyebrow").text()).toBe("Private discovery");
    expect($(".card-footer > span").text()).toBe("Needs your review");
    expect($(".card-back .status-row").text()).toContain("Private discovery");
    expect($(".card-back .relationship-date").text()).toBe("Relationship not confirmed");
    expect($.text().toLowerCase()).not.toContain(status.toLowerCase());
    expect($.text()).not.toContain("2024-06-03");
    expect($.text()).not.toContain("since");
    expect($.text()).not.toContain("Owner-selected go-to");
  },
);

test("unconfirmed discoveries keep supplied measurements and provenance visibly unreviewed", () => {
  const activity = { ...activityExamples[1], provenanceLabel: "Synthetic imported evidence" };
  const $ = load(renderToStaticMarkup(createElement(ProductCard, {
    card: { ...baseCard, activity }, index: 0, relationshipConfirmed: false,
  })));

  expect($(".card-activity-preview").text()).toContain("Unreviewed evidence");
  expect($(".card-activity-preview strong").text()).toBe("120");
  expect($(".card-activity-coverage").text()).toBe("1–15 Sep 2026 · last updated 18 Sep 2026");
  expect($(".card-back .activity-meta").text()).toContain("1 Sep 2026 to 15 Sep 2026");
  expect($(".card-back").text()).toContain("Unreviewed evidence");
  expect($(".card-back .activity-meta").text()).toContain(activity.provenanceLabel);
  // The back keeps the supporting numbers the compact front leaves out, not the front's 120 again.
  expect($(".card-back .metric-row").text()).toBe("8Sessions");
});

test("the go-to designation requires an explicit prop for a confirmed relationship", () => {
  const $ = load(renderToStaticMarkup(createElement(ProductCard, {
    card: baseCard, index: 0, relationshipConfirmed: true, goTo: true,
  })));

  expect($(".card-title .eyebrow").text()).toBe("Testing");
  expect($(".card-footer > span").text()).toBe("Owner-selected go-to");
  expect($.text()).not.toContain("Unreviewed evidence");
  const ordinary = renderCard();
  expect(ordinary(".card-title .eyebrow").text()).toBe("Testing");
  expect(ordinary(".card-footer > span").text()).toBe("Relationship & evidence");
});

test("brand preview suppresses private discovery and go-to state", () => {
  const $ = load(renderToStaticMarkup(createElement(ProductCard, {
    card: { ...baseCard, activity: activityExamples[1] }, index: 0,
    displayMode: "brand-preview", relationshipConfirmed: false, goTo: true,
  })));

  expect($(".card-title .eyebrow").text()).toBe("Brand preview");
  expect($(".card-footer > span").text()).toBe("Brand identity");
  expect($.text()).not.toContain("Private discovery");
  expect($.text()).not.toContain("Needs your review");
  expect($.text()).not.toContain("Owner-selected go-to");
  expect($.text()).not.toContain("Unreviewed evidence");
  expect($(".activity-module, .card-activity-preview")).toHaveLength(0);
});

test("only the private card offers an activity next step when no snapshot is selected", () => {
  const $ = load(renderToStaticMarkup(createElement(ProductCard, {
    card: baseCard, index: 0, audience: "owner",
  })));
  expect($(".activity-placeholder").text()).toBe("Add a usage snapshot or describe your history.");
  expect($(".activity-module, .card-activity-preview")).toHaveLength(0);
  expect($.text()).not.toContain("does not require activity tracking");
});

test("a contribution calendar renders only supplied days and never relabels contributions as commits", () => {
  const $ = renderCard({ activity: activityExamples[0] });
  for (const side of [".card-front"]) {
    const days = $(`${side} .activity-calendar span`);
    expect(days).toHaveLength(1);
    expect(days.attr("title")).toBe("15 Sep 2026: 3 contributions");
    // The days are drawn for sight; a screen reader gets the calendar's one-line summary instead.
    expect($(`${side} .contribution-calendar .contribution-summary`).text()).toBe("3 contributions from 15 Sep 2026 to 15 Sep 2026, on 1 of 1 days; the most in a day was 3, on 15 Sep 2026.");
    expect(days.attr("data-date")).toBe("2026-09-15");
  }
  // It leads with the one day it draws; the stored 37 disagrees, so it stands apart, named as reported.
  expect($(".card-front .card-activity-preview > p").first().text()).toBe("3 contributions");
  expect($(".card-front .card-activity-reported").text()).toBe("37 contributions · as reported");
  // The back doesn't draw the calendar again.
  expect($(".card-back .activity-calendar")).toHaveLength(0);
  expect($.text()).not.toContain("commits");
});


test.each([
  { start: "2026-09-01", end: "2026-09-25", missing: 4, weeks: 4 },
  { start: "2026-09-05", end: "2026-09-30", missing: 5, weeks: 5 },
  { start: "2026-09-01", end: "2026-09-30", missing: 9, weeks: 5 },
])("a contribution calendar retains boundary gaps from $start to $end", ({ start, end, missing, weeks }) => {
  const days = Array.from({ length: 21 }, (_, index) => ({
    date: `2026-09-${String(index + 5).padStart(2, "0")}`, count: 1, level: 1,
  }));
  const $ = renderCard({ activity: { ...activityEvidence, kind: "contributionCalendar", total: 21, period: { start, end }, days } });
  for (const side of [".card-front"]) {
    expect($(`${side} .activity-calendar span`)).toHaveLength(21);
    expect($(`${side} .activity-calendar`).attr("style")).toContain(`repeat(${weeks}, var(--contribution-cell))`);
    expect($(`${side} .contribution-gap`).text()).toBe(`${missing} days have no supplied count; blank spaces are not zero activity.`);
    expect($(`${side} .contribution-range`).text()).toBe("Daily counts: 5 Sep 2026 – 25 Sep 2026");
    expect($(`${side} [data-date="2026-09-01"], ${side} [data-date="2026-09-30"]`)).toHaveLength(0);
  }
});

test("a contribution calendar positions supplied days after missing initial weeks", () => {
  const $ = renderCard({ activity: { ...activityEvidence, kind: "contributionCalendar", total: 1,
    period: { start: "2026-09-01", end: "2026-09-30" }, days: [{ date: "2026-09-15", count: 1, level: 1 }],
  } });
  for (const side of [".card-front"]) {
    expect($(`${side} [data-date="2026-09-15"]`).attr("style")).toContain("grid-column:3");
    expect($(`${side} .contribution-gap`).text()).toContain("29 days have no supplied count");
  }
});

test.each([
  undefined,
  { start: "2026-09-30", end: "2026-09-01" },
  { start: "2026-09-16", end: "2026-09-30" },
  { start: "2026-09-01", end: "2026-09-14" },
  { start: "invalid", end: "2026-09-30" },
  { start: "2026-09-01", end: "2026-09-31" },
])("a contribution calendar falls back to supplied dates when period %j cannot enclose them", (period) => {
  const $ = renderCard({ activity: { ...activityEvidence, kind: "contributionCalendar", total: 1, period,
    days: [{ date: "2026-09-15", count: 0, level: 0 }, { date: "2026-09-17", count: 1, level: 1 }],
  } });
  for (const side of [".card-front"]) {
    expect($(`${side} .activity-calendar span`)).toHaveLength(2);
    expect($(`${side} .activity-calendar`).attr("style")).toContain("repeat(1, var(--contribution-cell))");
    expect($(`${side} [data-date="2026-09-15"]`).attr("style")).toContain("grid-column:1");
    expect($(`${side} .contribution-gap`).text()).toContain("1 day has no supplied count");
    expect($(`${side} .contribution-range`).text()).toBe("Daily counts: 15 Sep 2026 – 17 Sep 2026");
  }
});

test("a contribution calendar with a period but no supplied days remains explicitly empty", () => {
  const $ = renderCard({ activity: { ...activityEvidence, kind: "contributionCalendar", total: 0, days: [] } });
  expect($(".activity-calendar span")).toHaveLength(0);
  for (const side of [".card-front"]) {
    expect($(`${side} .activity-empty`).text()).toBe("No daily contribution counts supplied");
  }
});

test("calendar month labels follow UTC week columns across a year boundary", () => {
  const $ = renderCard({ activity: { ...activityEvidence, kind: "contributionCalendar", total: 2,
    period: { start: "2025-12-28", end: "2026-02-01" },
    days: [{ date: "2025-12-28", count: 1, level: 1 }, { date: "2026-01-01", count: 0, level: 0 }, { date: "2026-02-01", count: 1, level: 1 }],
  } });
  const labels = $(".card-front .contribution-months span");
  expect(labels.map((_, label) => $(label).text()).get()).toEqual(["Jan", "Feb"]);
  expect(labels.first().attr("style")).toContain("grid-column:1");
  expect(labels.last().attr("style")).toContain("grid-column:6");
});

test("sparse multi-year captures derive month labels only from supplied dates", () => {
  const $ = renderCard({ activity: { ...activityEvidence, kind: "contributionCalendar", total: 4,
    period: { start: "2000-01-01", end: "2026-09-30" },
    days: [{ date: "2000-01-01", count: 0, level: 0 }, { date: "2026-09-30", count: 4, level: 3 }],
  } });
  expect($(".card-front .activity-calendar span")).toHaveLength(2);
  expect($(".card-front .contribution-months span")).toHaveLength(2);
  expect($(".card-front .contribution-gap").text()).toContain("blank spaces are not zero activity");
});


test.each(["AFFILIATE", "REFERRAL"] as const)("%s destinations remain visibly disclosed on both card faces", (type) => {
  const $ = renderCard({ primaryLink: { type, url: "https://example.com/owner-selected", label: "Visit Example Product" } });
  const disclosure = type === "AFFILIATE" ? "Affiliate link" : "Referral link";
  expect($(".card-front .card-link-disclosure").text()).toBe(disclosure);
  expect($(".card-back .card-link-disclosure").text()).toBe(disclosure);
  expect($(".card-visit").attr("aria-label")).toContain(disclosure);
  for (const element of $(".card-visit, .outbound-link").toArray()) {
    expect($(element).attr("href")).toBe("https://example.com/owner-selected");
    expect($(element).attr("rel")).toBe("noopener noreferrer sponsored");
  }
});

test.each([["CANONICAL", "Direct link"], ["AFFILIATE", "Affiliate link"], ["REFERRAL", "Referral link"], ["INVITE", "Invite link"]] as const)(
  "the back names a %s link as %s, apart from the level",
  (type, words) => {
    const $ = renderCard({ level: "STOPPED", status: "ARCHIVED", primaryLink: { type, url: "https://example.com/owner-selected", label: "Visit Example Product" } });
    expect($(".card-back .status-row").text()).toBe(`Stopped using · ${words}`);
  },
);

test("published numbers say how they were recorded on the back, where every row is shown in full", () => {
  const row = {
    metric: "enriched", value: "2140000", unit: "rows", period: { kind: "date", start: "2023-03-01", end: "2026-08-31", timezone: "UTC" },
    scope: "WORKSPACE", coverage: "COMPLETE", temporality: "CUMULATIVE", aggregation: "NON_ADDITIVE", capturedAt: "2026-09-01T00:00:00.000Z",
    status: "measured", identityBasis: "OWNER_SUPPLIED", activityActor: "UNKNOWN", sample: "synthetic", derivation: "SOURCE_REPORTED",
  } as const;
  const $ = renderCard({ measurements: [row, { ...row, metric: "built", value: "86", unit: "tables" }] });
  // An invented sample claims no source and no coverage; a date reads plainly, with the exact value in its markup.
  const recorded = ["Scope: workspace", "cumulative · Do not add to other views", "Synthetic sample. Not real account activity.", "Captured 1 Sep 2026"];
  expect(recorded.filter(text => $(".card-front").text().includes(text))).toEqual([]);
  expect($(".card-back .usage-measurement-measurement").toArray().map(element => recorded.filter(text => $(element).text().includes(text)).length)).toEqual([recorded.length, recorded.length]);
  // The front is one row of numbers, each named by what it counts; the disclosures and exact periods are on the back.
  expect($(".card-front .usage-measurement-stats li").map((_, item) => $(item).text()).get()).toEqual([
    "2,140,000rows enriched", "86tables built",
  ]);
  expect($(".card-front .usage-measurement-public").text()).not.toMatch(/Synthetic sample|Owner-supplied evidence|more reported measurements/);
  // One period for both numbers, said once at the head of the note.
  expect($(".card-front .usage-measurement-note").text()).toBe("Mar 2023 – Aug 2026 · Sample numbers · how each was measured is in Details");
  expect($(".card-back .usage-measurement-measurement").first().text()).toContain("1 Mar 2023 to 31 Aug 2026 · UTC");
  expect($(".card-back").text()).toContain("Synthetic sample. Not real account activity.");
  expect($(".card-back").text()).toContain("Owner-supplied evidence. Account identity is not authenticated. Activity actor is unknown.");
  expect($(".card-back .usage-measurement-value").toArray().map(value => $(value).text())).toEqual(["2,140,000", "86"]);
});

const leads = {
  caption: "Lead list, sample rows",
  columns: ["Company", { label: "Domain", droppable: true }, { label: "Work email", enriched: true }, { label: "Status", enriched: true }],
  rows: [
    [{ text: "Northwind Labs" }, { text: "northwindlabs.example" }, { text: "a.lindqvist@northwindlabs.example", state: "filled" }, { text: "Enriched", state: "filled" }],
    [{ text: "Quillon Health" }, { text: "quillon.example" }, { text: "Finding…", state: "pending", fillsIn: { text: "d.reyes@quillon.example", state: "filled" } },
      { text: "Running", state: "pending", fillsIn: { text: "Enriched", state: "filled" } }],
  ],
} as const;

test("a table preview draws as a real table on the front: a caption, column headers, each row named by its first cell", () => {
  const $ = load(renderToStaticMarkup(createElement(ProductCard, { card: baseCard, index: 0, tablePreview: leads })));
  const box = $(".card-front .card-table-preview");
  expect([box.attr("role"), box.attr("tabindex"), box.attr("aria-labelledby")]).toEqual(["region", "0", box.find("caption").attr("id")]);
  expect(box.find("caption").text()).toBe("Lead list, sample rows");
  // An enriched column's header is marked for its tint; a droppable column's cells are marked so a narrow card leaves them out.
  const marks = (cell: Parameters<typeof $>[0]) => ["data-enriched", "data-droppable"].filter(name => $(cell).attr(name) !== undefined).join("+") || "-";
  expect(box.find("thead th").map((_, cell) => `${$(cell).attr("scope")}:${$(cell).text()}:${marks(cell)}`).get()).toEqual([
    "col:Company:-", "col:Domain:data-droppable", "col:Work email:data-enriched", "col:Status:data-enriched",
  ]);
  // The row still running is drawn pending until the card is shown; it fills in on the visitor's screen, not on the server.
  expect(box.find("tbody tr").map((_, row) => $(row).children().map((_, cell) => `${cell.tagName}/${$(cell).attr("data-state") ?? "-"}/${marks(cell)}/${$(cell).text()}`).get().join(" | ")).get()).toEqual([
    "th/-/-/Northwind Labs | td/-/data-droppable/northwindlabs.example | td/filled/-/a.lindqvist@northwindlabs.example | td/filled/-/Enriched",
    "th/-/-/Quillon Health | td/-/data-droppable/quillon.example | td/pending/-/Finding… | td/pending/-/Running",
  ]);
  // The back draws the whole table: every column, none dropped on a narrow card.
  expect($(".card-back .card-table-preview").attr("data-full")).toBe("");
});

test("a table preview past its caps, or on a brand preview, is not drawn", () => {
  const tooWide = { ...leads, columns: ["A", "B", "C", "D", "E"], rows: [["a", "b", "c", "d", "e"].map(text => ({ text }))] };
  expect(load(renderToStaticMarkup(createElement(ProductCard, { card: baseCard, index: 0, tablePreview: tooWide })))(".card-table-preview")).toHaveLength(0);
  expect(load(renderToStaticMarkup(createElement(ProductCard, { card: baseCard, index: 0, tablePreview: leads, displayMode: "brand-preview" })))(".card-table-preview")).toHaveLength(0);
});

test("a hint names what the back holds in the footer, and describes the Details button with it", () => {
  const $ = load(renderToStaticMarkup(createElement(ProductCard, { card: baseCard, index: 0, backHint: "Numbers and a work sample inside" })));
  const hint = $(".card-footer > span");
  expect(hint.text()).toBe("Numbers and a work sample inside");
  expect($(".card-button").attr("aria-describedby")).toBe(hint.attr("id"));
  const plain = renderCard();
  expect(plain(".card-footer > span").text()).toBe("Relationship & evidence");
  expect(plain(".card-button").attr("aria-describedby")).toBeUndefined();
});

test("a canonical destination receives no invented affiliate disclosure", () => {
  const $ = renderCard();
  expect($(".card-link-disclosure")).toHaveLength(0);
  expect($(".card-visit").attr("rel")).toBe("noopener noreferrer");
});

test.each([
  ["claude-code", "claude.com", "Claude Code"],
  ["codex", "openai.com", "Codex"],
])("known %s card renders retained image instead of initials", (slug, domain, name) => {
  const $ = renderCard({ product: { ...baseCard.product, slug, domain, name } });
  expect($(".product-logo img").attr("src")).toBe(`/product-assets/${slug}/2026-09-24/app-icon.png`);
  expect($(".product-logo").text()).toBe("");
});

test("unknown product retains its initials fallback", () => {
  const $ = renderCard();
  expect($(".product-logo img")).toHaveLength(0);
  expect($(".card-front .product-logo").text()).toBe("EP");
});

test.each(["javascript:alert(1)", "data:text/html,x", "https://user:pass@example.com/"])("a %s primary link renders its label as plain text, never as a link", url => {
  const card: Card = { ...baseCard, primaryLink: { type: "CANONICAL", url, label: "Visit Example Product" } };
  const html = renderToStaticMarkup(createElement(ProductCard, { card, index: 0 }));
  const $ = load(html);
  expect(html).not.toContain(url);
  expect($("a").filter((_, element) => $(element).text().includes("Visit Example Product"))).toHaveLength(0);
  expect($.root().text()).toContain("Visit Example Product");
});

test.each(["javascript:alert(1)", "data:text/html,x", "ftp://x.example/file", "https://user:pass@example.com/"])("a %s artifact renders its title as plain text, never as a link", url => {
  const $ = renderCard({ activity: {
    kind: "artifactCollection", attributionScope: "PERSONAL", capturedAt: "2026-09-21T00:00:00.000Z", freshness: "FRESH",
    provenanceLabel: "Synthetic artifacts", total: 2,
    artifacts: [{ title: "Bad artifact", url }, { title: "Good artifact", url: "https://example.com/good" }],
  } });
  expect($("a").filter((_, element) => $(element).attr("href") === url)).toHaveLength(0);
  expect($("a").filter((_, element) => $(element).text().includes("Bad artifact"))).toHaveLength(0);
  // The front links the good one; the back lists every work, the one it couldn't link as text.
  expect($(".card-back .artifact-list li").map((_, item) => $(item).text()).get()).toEqual(["Bad artifact", "Good artifact ↗"]);
  expect($(".card-front .card-artifact-links a").filter((_, element) => $(element).attr("href") === "https://example.com/good")).toHaveLength(1);
});

test("the front lists what the product does for the owner after the headline, in the product's order", () => {
  const $ = renderCard({ product: { ...baseCard.product, slug: "clay" }, uses: { picks: ["sync-crm", "retired-choice", "enrich-leads"], other: "score inbound leads" } });
  const uses = $(".card-front .card-uses");
  expect(uses.attr("aria-label")).toBe("What I use it for");
  expect(uses.prev().text()).toBe("I use it to");
  expect(uses.find("li").map((_, item) => $(item).text()).get())
    .toEqual(["enrich lead and account lists", "keep my CRM records filled in", "score inbound leads"]);
  expect(uses.parent().prev().hasClass("card-headline")).toBe(true);
  expect($(".card-back .card-uses").length).toBe(0);
});

test.each([
  ["PAUSED", "ARCHIVED", "I used it to", "What I used it for"],
  ["STOPPED", "ARCHIVED", "I used it to", "What I used it for"],
  ["TRIED_NOT_ADOPTED", "ARCHIVED", "I use it to", "What I use it for"],
  ["DAILY", "ACTIVE", "I use it to", "What I use it for"],
] as const)("a %s card's uses read in the right tense", (level, status, lead, label) => {
  const $ = renderCard({ level, status, product: { ...baseCard.product, slug: "clay" }, uses: { picks: ["enrich-leads"] } });
  expect([$(".card-uses-lead").text(), $(".card-uses").attr("aria-label")]).toEqual([lead, label]);
});

test("a paused or stopped card says why on its front, under the headline; a card still in use keeps its note on the back", () => {
  const paused = renderCard({ level: "PAUSED", status: "ARCHIVED", note: "Paused while my nightly jobs move to plain cron." });
  expect(paused(".card-front .card-headline + .card-reason").text()).toBe("Paused while my nightly jobs move to plain cron.");
  expect(paused(".card-back blockquote").text()).toBe("Paused while my nightly jobs move to plain cron.");
  expect(renderCard({ level: "DAILY", status: "ACTIVE" })(".card-front .card-reason")).toHaveLength(0);
  expect(renderCard({ level: "STOPPED", status: "ARCHIVED", note: baseCard.headline })(".card-front .card-reason")).toHaveLength(0);
});

test("a published cost shows on the front in a few words, with the full record kept on the back", () => {
  const $ = renderCard({ cost: { amount: 5, currency: "USD", cadence: "MONTHLY", basis: "OWNER_REPORTED", asOf: "2026-09-01" } });
  expect($(".card-front .card-cost").text()).toBe("Costs $5/month · owner-reported");
  expect($(".card-front .card-cost").next().hasClass("card-footer")).toBe(true);
  expect($(".card-back").text()).toContain("Owner-reported cost: $5/month · as of 1 Sep 2026");
  expect(renderCard()(".card-cost")).toHaveLength(0);
});

test("a card without known uses, or a brand preview, shows no uses", () => {
  const clay = { ...baseCard.product, slug: "clay" };
  expect(renderCard({ product: clay })(".card-uses").length).toBe(0);
  expect(renderCard({ product: clay, uses: { picks: ["retired-choice"] } })(".card-uses").length).toBe(0);
  expect(renderCard({ product: clay, uses: { picks: [], other: "   " } })(".card-uses").length).toBe(0);
  const preview = load(renderToStaticMarkup(createElement(ProductCard, {
    card: { ...baseCard, product: clay, uses: { picks: ["enrich-leads"] } }, index: 0, displayMode: "brand-preview",
  })));
  expect(preview(".card-uses").length).toBe(0);
  expect(preview.text()).not.toContain("I use it to");
});

test("a card names the surface its brand draws, so its contribution calendar can follow it", () => {
  const light = { ...brand, styleguide: { mode: "light" as const, colors: { background: "#ffffff", text: "#111111" } } };
  const dark = { ...brand, styleguide: { mode: "dark" as const, colors: { background: "#0c0e13", text: "#f8fafc" } } };
  const surface = (product: Card["product"]) => renderCard({ product }).root().find("article.product-card").attr("data-surface");
  expect(surface({ ...baseCard.product, brand: light })).toBe("light");
  expect(surface({ ...baseCard.product, brand: dark })).toBe("dark");
  expect(surface(baseCard.product)).toBe("dark");
});

test("coding activity with days draws one bar per day on the front; without days the front has no chart", () => {
  const days = [{ date: "2026-09-14", count: 2, level: 1 }, { date: "2026-09-15", count: 6, level: 4 }];
  const coding = { ...activityEvidence, kind: "codingActivity" as const, primary: { label: "Sessions", value: 8 }, supporting: [] };
  const $ = renderCard({ activity: { ...coding, days } });

  expect($(".card-front .activity-bars > span").toArray().map(bar => $(bar).attr("title"))).toEqual(["14 Sep 2026: 2", "15 Sep 2026: 6"]);
  expect($(".card-front .activity-bars").attr("aria-label")).toBe("Coding activity trend");
  expect($(".card-front .card-activity-preview strong").text()).toBe("8");
  expect(renderCard({ activity: coding })(".card-front .activity-bars")).toHaveLength(0);
});

test("bars take the card's chart colour, then its accent, then its text", () => {
  expect(readFileSync("app/globals.css", "utf8")).toContain("background: var(--brand-card-chart, var(--brand-card-accent, currentColor));");
});

const WORDMARK_WIDTH = 400;
const WORDMARK_HEIGHT = 100;
const lightSurface = { mode: "light" as const, colors: { background: "#FFFFFF", text: "#111111" } };

test("a brand with only a wordmark for its surface draws it in place of the name, and keeps the name for screen readers", () => {
  const logos = brand.logos.map(logo => ({ ...logo, width: WORDMARK_WIDTH, height: WORDMARK_HEIGHT }));
  const $ = renderCard({ product: { ...baseCard.product, brand: { ...brand, logos, styleguide: lightSurface } } });

  expect($(".card-topline > .product-logo")).toHaveLength(0);
  expect($(".card-title .product-logo").attr("data-logo-layout")).toBe("wordmark");
  expect($(".card-title .product-logo").attr("aria-hidden")).toBe("true");
  expect($(".card-title .product-logo img").attr("src")).toBe("https://example.com/light.svg");
  expect($(".card-title h2").attr("class")).toBe("card-product-name");
  expect($(".card-front .card-title h2").text()).toBe("Example Product");
});

test("a logo the provider didn't classify sits in the square slot beside the visible name, however wide", () => {
  const logos = brand.logos.map(logo => ({ ...logo, type: "unknown" as const, width: WORDMARK_WIDTH, height: WORDMARK_HEIGHT }));
  const $ = renderCard({ product: { ...baseCard.product, brand: { ...brand, logos, styleguide: lightSurface } } });

  expect($(".card-topline > .product-logo img").attr("src")).toBe("https://example.com/light.svg");
  expect($(".card-title .product-logo")).toHaveLength(0);
  expect($(".card-title h2").attr("class")).toBeUndefined();
});

test("an icon for the card's surface sits in the square slot beside the visible name", () => {
  const icon = { url: "https://example.com/icon.svg", mode: "unknown" as const, type: "icon" as const, width: 64, height: 64 };
  const $ = renderCard({ product: { ...baseCard.product, brand: { ...brand, logos: [...brand.logos, icon], styleguide: { mode: "light", colors: { background: "#FFFFFF", text: "#111111" } } } } });

  expect($(".card-topline > .product-logo img").attr("src")).toBe("https://example.com/icon.svg");
  expect($(".card-topline > .product-logo").attr("data-logo-layout")).toBeUndefined();
  expect($(".card-title .product-logo")).toHaveLength(0);
  expect($(".card-title h2").attr("class")).toBeUndefined();
});

test("a logo the brand provider hosts loads from this site, and other logos load from where they are", () => {
  const hosted = { url: "https://media.brand.dev/f895934e-e887-4c7d-ab99-3f7ae465499f.png", mode: "unknown" as const, type: "icon" as const, width: 144, height: 144 };
  const branded = renderCard({ product: { ...baseCard.product, brand: { ...brand, logos: [hosted] } } });
  expect(branded(".product-logo img").attr("src")).toBe("/api/brand-images/f895934e-e887-4c7d-ab99-3f7ae465499f.png");
  expect(renderCard({ product: { ...baseCard.product, brand } })(".product-logo img").attr("src")).toBe("https://example.com/dark.svg");
});

test("a card reads a measured site file only beside the brand it was measured for", async () => {
  const { HOMEPAGE_BRANDS, HOMEPAGE_SITE_TRAITS } = await import("../data/homepage-brands");
  const spider = { ...baseCard, product: { name: "Spider", slug: "spider", domain: "spider.cloud", description: "Crawler.", brand: HOMEPAGE_BRANDS.spider } };
  const style = (siteTraits?: typeof HOMEPAGE_SITE_TRAITS[string]) => load(renderToStaticMarkup(createElement(ProductCard, { card: spider, index: 0, siteTraits })))("article").attr("style") ?? "";
  expect(style(HOMEPAGE_SITE_TRAITS.spider)).toContain("--brand-card-radius:0px");
  expect(style(HOMEPAGE_SITE_TRAITS.docker)).toContain("--brand-card-radius:8px");
  expect(style()).toContain("--brand-card-radius:8px");
});

test("a measured site's signature colour reaches the card's link glyph", async () => {
  const { HOMEPAGE_BRANDS, HOMEPAGE_SITE_TRAITS } = await import("../data/homepage-brands");
  const spider = { ...baseCard, product: { name: "Spider", slug: "spider", domain: "spider.cloud", description: "Crawler.", brand: HOMEPAGE_BRANDS.spider } };
  const style = (siteTraits?: typeof HOMEPAGE_SITE_TRAITS[string]) => load(renderToStaticMarkup(createElement(ProductCard, { card: spider, index: 0, siteTraits })))("article").attr("style") ?? "";
  expect(style(HOMEPAGE_SITE_TRAITS.spider)).toContain("--brand-card-accent:#3bde77");
  expect(style()).toContain("--brand-card-accent:#24c45c");
});

test("a card whose site's heading sits on a full-bleed colour marks itself for the hero band; others do not", async () => {
  const { HOMEPAGE_BRANDS, HOMEPAGE_SITE_TRAITS } = await import("../data/homepage-brands");
  const render = (slug: string, domain: string, withSite = true) => load(renderToStaticMarkup(createElement(ProductCard, {
    card: { ...baseCard, product: { name: slug, slug, domain, description: "Example.", brand: HOMEPAGE_BRANDS[slug] } }, index: 0, siteTraits: withSite ? HOMEPAGE_SITE_TRAITS[slug] : undefined,
  })))("article");
  expect([render("clay", "clay.com").attr("data-band"), render("docker", "docker.com").attr("data-band"), render("clay", "clay.com", false).attr("data-band")]).toEqual(["", "", undefined]);
  expect(render("clay", "clay.com").attr("style")).toContain("--brand-card-band:#035d44;--brand-card-band-text:#ffffff");
});

test("a time series leads with its period's total, or its peak once the card is paused, on the front only", () => {
  const weekly = { ...activityEvidence, kind: "timeSeries" as const, label: "workflow runs", unit: "per week", points: [312, 341, 0].map((value, index) => ({ date: `2026-08-${String(3 + index * 7).padStart(2, "0")}`, value })) };
  const hero = (card: Partial<typeof baseCard>, countsPerPeriod = true) => {
    const $ = load(renderToStaticMarkup(createElement(ProductCard, { card: { ...baseCard, ...card }, index: 0, expandedActivity: true, countsPerPeriod })));
    return [$(".card-front .card-activity-preview > p").first().text(), $(".card-back .activity-hero").text()];
  };
  expect(hero({ activity: weekly })).toEqual(["653 workflow runs over 3 weeks", ""]);
  // A stored card can't say its points are counts, so it reads its latest week.
  expect(hero({ activity: weekly }, false)).toEqual(["0 workflow runs · per week · as of 17 Aug 2026", ""]);
  expect(hero({ activity: weekly, level: "PAUSED", status: "ARCHIVED" })).toEqual(["341 workflow runs a week at its peak", ""]);
});

const CLOUDFLARE_LAST_WEEK = 48_360;

test("a card shown in full reads its activity number with thousands separators, never as raw digits", () => {
  const card = { ...baseCard, activity: { ...activityEvidence, kind: "timeSeries" as const, label: "requests served", unit: "per week", points: [{ date: "2026-08-24", value: CLOUDFLARE_LAST_WEEK }] } };
  const $ = load(renderToStaticMarkup(createElement(ProductCard, { card, index: 0, expandedActivity: true })));
  expect($(".card-front .card-activity-preview > p strong").text()).toBe("48,360");
});

/** The R03 bad links beside good ones: more good links than the front has room for. */
const FRONT_ARTIFACTS = [
  { title: "Run a script", url: "javascript:alert(1)" },
  { title: "Compose apps", url: "https://example.com/compose" },
  { title: "Inline page", url: "data:text/html,x" },
  { title: "File mirror", url: "ftp://example.com/mirror" },
  { title: "Signed-in image", url: "https://user:pass@example.com/image" },
  { title: "Postgres image", url: "https://example.com/postgres" },
  { title: "Build guide", url: "http://example.com/build" },
  { title: "Fourth good link", url: "https://example.com/fourth" },
];

test("an artifact collection's front names its count and links up to three of its works, dropping a bad link quietly", () => {
  const $ = renderCard({ activity: { ...activityEvidence, kind: "artifactCollection", total: FRONT_ARTIFACTS.length, artifacts: FRONT_ARTIFACTS } });
  const front = $(".card-front .card-activity-preview");
  // Eight stored, three linked on the front: the count says how many it shows.
  expect(front.children("p").first().text()).toBe("8 linked works · 3 shown");
  expect(front.find(".card-artifact-links a").toArray().map(link => [$(link).text(), $(link).attr("href"), $(link).attr("target"), $(link).attr("rel")])).toEqual([
    ["Compose apps ↗", "https://example.com/compose", "_blank", "noopener noreferrer"],
    ["Postgres image ↗", "https://example.com/postgres", "_blank", "noopener noreferrer"],
    ["Build guide ↗", "http://example.com/build", "_blank", "noopener noreferrer"],
  ]);
  expect(["Run a script", "Inline page", "File mirror", "Signed-in image", "Fourth good link"].filter(title => front.text().includes(title))).toEqual([]);
});

const BUSY_WEEK = 48_360;

test("a chart's bars are also a table a screen reader can read, outside the chart's image", () => {
  const $ = renderCard({ activity: { ...activityEvidence, kind: "timeSeries", label: "Requests served", unit: "per week", points: [{ date: "2026-08-17", value: 45 }, { date: "2026-08-24", value: BUSY_WEEK }] } });
  const table = $(".card-front .usage-chart > .visually-hidden > table");
  expect(table.find("caption").text()).toBe("Requests served, one row per bar");
  expect(table.find("tr").toArray().map(row => $(row).children().toArray().map(cell => $(cell).text()))).toEqual([
    ["From", "To", "Value"],
    // A weekly bar runs from its first day to its seventh, in plain dates.
    ["17 Aug 2026", "23 Aug 2026", "45 per week"],
    ["24 Aug 2026", "30 Aug 2026", "48,360 per week"],
  ]);
  expect($(".card-front .activity-bars table")).toHaveLength(0);
});

test("the back is the same branded object, shorter: its logo and name, plain provenance lines, and every exact record folded under How this was measured", () => {
  const measured = {
    metric: "enriched", value: "38400", unit: "rows", period: { kind: "date", start: "2023-03-01", end: "2026-08-31", timezone: "UTC" },
    scope: "WORKSPACE", coverage: "COMPLETE", temporality: "CUMULATIVE", aggregation: "NON_ADDITIVE", capturedAt: "2026-09-01T00:00:00.000Z",
    status: "measured", identityBasis: "OWNER_SUPPLIED", activityActor: "UNKNOWN", sample: "synthetic", derivation: "SOURCE_REPORTED",
  } as const;
  const $ = renderCard({ startedAt: "2023-01-01", activity: activityExamples[2], measurements: [measured],
    cost: { amount: 149, currency: "USD", cadence: "MONTHLY", basis: "OWNER_REPORTED", asOf: "2026-09-01" } });
  const back = $(".card-back");
  expect(back.find(".card-back-topline .product-logo").text()).toBe("EP");
  expect(back.find(".card-back-topline h2").text()).toBe("Example Product");
  // Plain words outside the disclosure.
  expect(back.find(".relationship-date").text()).toBe("Since 2023");
  expect(back.text()).toContain("Owner-reported cost: $149/month · as of 1 Sep 2026");
  // The front shows the one number, so the back doesn't say it again; its record is in the disclosure.
  expect(back.find(".usage-measurement-lines")).toHaveLength(0);
  // Folded, not removed: the panel is closed and holds the exact start date, the activity's stored record and how each number was recorded.
  const panel = back.find(".card-provenance [data-slot=collapsible-panel]");
  expect([back.find(".card-provenance-trigger").text(), back.find(".card-provenance-trigger").attr("aria-expanded"), panel.attr("hidden")]).toEqual(["How this was measured", "false", "hidden"]);
  expect(["Relationship started 1 Jan 2023", "personal activity", "1 Sep 2026 to 15 Sep 2026", "stale", "Snapshot recorded 18 Sep 2026", "1 Mar 2023 to 31 Aug 2026 · UTC",
    "Captured 1 Sep 2026", "Synthetic sample. Not real account activity.", "Owner-supplied evidence. Account identity is not authenticated. Activity actor is unknown."]
    .filter(text => !panel.text().includes(text))).toEqual([]);
  // Outside the panel, no raw date or status word.
  panel.remove();
  expect(back.text()).not.toMatch(/\d{4}-\d{2}-\d{2}|stale|observ/i);
});

test("a daily chart's screen-reader table has one Date column, since each bar is one day", () => {
  const $ = renderCard({ activity: { ...activityEvidence, kind: "timeSeries", label: "Requests served", unit: "per day", points: [{ date: "2026-08-01", value: 3 }, { date: "2026-08-02", value: 5 }] } });
  const table = $(".card-front .usage-chart > .visually-hidden > table");
  expect(table.find("tr").toArray().map(row => $(row).children().toArray().map(cell => $(cell).text()))).toEqual([
    ["Date", "Value"], ["1 Aug 2026", "3 per day"], ["2 Aug 2026", "5 per day"],
  ]);
});

test("a card read today ages a fresh snapshot past 30 days, and never shows a price dated after today as current", () => {
  const card = { ...baseCard, activity: { ...activityEvidence, freshness: "FRESH" as const, capturedAt: "2026-07-26T18:00:00.000Z", kind: "headlineMetrics" as const, primary: { label: "words", value: 12 }, supporting: [] },
    cost: { amount: 5, currency: "USD", cadence: "MONTHLY" as const, basis: "OWNER_REPORTED" as const, asOf: "2027-01-01" } };
  const $ = load(renderToStaticMarkup(createElement(ProductCard, { card, index: 0, today: "2026-11-14" })));
  expect($(".card-front .card-activity-coverage").text()).toBe("1–15 Sep 2026 · last updated 26 Jul 2026");
  expect($(".card-front .card-cost")).toHaveLength(0);
  expect($(".card-back").text()).toContain("Owner-reported cost: $5/month · dated 1 Jan 2027, after today");
  // A day inside the 30 keeps a fresh snapshot quiet.
  const recent = load(renderToStaticMarkup(createElement(ProductCard, { card, index: 0, today: "2026-08-01" })));
  expect(recent(".card-front .card-activity-coverage").text()).toBe("1–15 Sep 2026");
});

test("a weekly series' back lists each week by its first day under one caption, so a narrow card fits more columns", () => {
  const weekly = { ...activityEvidence, kind: "timeSeries" as const, label: "pages scraped", unit: "per week", points: [{ date: "2026-08-17", value: 880 }, { date: "2026-08-24", value: 1100 }] };
  const $ = load(renderToStaticMarkup(createElement(ProductCard, { card: { ...baseCard, activity: weekly }, index: 0 })));
  expect($(".card-back .card-back-values-caption").text()).toBe("Each week, from the day it starts");
  expect($(".card-back .card-back-values li").map((_, item) => $(item).text()).get()).toEqual(["17 Aug880", "24 Aug1,100"]);
});

test("a hyphenated word on a card never breaks at its hyphen: \"go-to-market\" and \"(awesome-compose)\" each stay on one line", () => {
  const card = { ...baseCard, product: { ...baseCard.product, description: "A go-to-market tool." },
    activity: { ...activityEvidence, kind: "artifactCollection" as const, total: 1, artifacts: [{ title: "Sample apps (awesome-compose)", url: "https://example.com/a" }] } };
  const $ = load(renderToStaticMarkup(createElement(ProductCard, { card, index: 0 })));
  expect($(".card-back .whole-word").map((_, word) => $(word).text()).get()).toEqual(["go-to-market", "(awesome-compose)"]);
  expect($(".card-front .card-artifact-links .whole-word").text()).toBe("(awesome-compose)");
  expect($(".card-front .card-artifact-links a").text()).toBe("Sample apps (awesome-compose) ↗");
});

test("a calendar's back lists each month's contributions, and its front gives a screen reader the same months as a table", () => {
  const days = [{ date: "2026-07-30", count: 3, level: 2 }, { date: "2026-07-31", count: 0, level: 0 }, { date: "2026-08-01", count: 5, level: 3 }];
  const $ = renderCard({ activity: { ...activityEvidence, period: { start: "2026-07-30", end: "2026-08-01" }, kind: "contributionCalendar", total: 8, days } });
  expect($(".card-back .card-back-values-caption").text()).toBe("Contributions each month");
  expect($(".card-back .card-back-values li").map((_, item) => $(item).text()).get()).toEqual(["Jul 20263", "Aug 20265"]);
  expect($(".card-back .card-back-busiest").text()).toBe("The busiest month was Aug 2026, with 5 contributions on 1 of its 1 days.");
  const table = $(".card-front .contribution-calendar .visually-hidden table");
  expect(table.find("caption").text()).toBe("Contributions each month");
  expect(table.find("thead th").map((_, cell) => $(cell).text()).get()).toEqual(["Month", "Contributions", "Days with any"]);
  expect(table.find("tbody tr").map((_, row) => $(row).find("th[scope=row], td").map((__, cell) => $(cell).text()).get().join("|")).get())
    .toEqual(["Jul 2026|3|1 of 2", "Aug 2026|5|1 of 1"]);
});

test("coding activity's back lists the active days in each week its bars cover, counting days rather than adding up an unnamed count", () => {
  const days = Array.from({ length: 9 }, (_, index) => ({ date: `2026-08-${String(index + 1).padStart(2, "0")}`, count: index % 3 === 0 ? 0 : 4, level: 2 }));
  const $ = renderCard({ activity: { ...activityEvidence, kind: "codingActivity", primary: { label: "active days", value: 6 }, supporting: [], days } });
  expect($(".card-back .card-back-values-caption").text()).toBe("Active days each week, from the day it starts");
  expect($(".card-back .card-back-values li").map((_, item) => $(item).text()).get()).toEqual(["1 Aug4 of 7", "8 Aug2 of 2"]);
});

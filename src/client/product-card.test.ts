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

test("an optional headline falls back to the saved owner explanation on the compact front", () => {
  const card = renderCard({ headline: "", note: "Essential for an occasional workflow." });
  expect(card(".card-headline").text()).toBe("Essential for an occasional workflow.");
  expect(card(".card-headline").text()).not.toContain("not supplied");
});

test("an owner-described product without a website needs neither an invented link nor telemetry", () => {
  const card = renderCard({ product: { ...baseCard.product, domain: "" }, primaryLink: undefined, activity: undefined });
  expect(card("a")).toHaveLength(0);
  expect(card(".card-headline").text()).toBe(baseCard.headline);
  expect(card(".activity-placeholder")).toHaveLength(0);
});

test("a brand preview makes no owner relationship or activity claim", () => {
  const $ = load(renderToStaticMarkup(createElement(ProductCard, { card: baseCard, index: 0, displayMode: "brand-preview" })));
  expect($(".card-title .eyebrow").text()).toBe("BRAND PREVIEW");
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

test.each(["ACTIVE", "TESTING", "ARCHIVED"] as const)(
  "%s without a start date does not imply an unsupported usage relationship or duration",
  (status) => {
    const $ = renderCard({ status });

    expect($(".card-title .eyebrow").text()).toBe(status);
  },
);

test("uses a retained brand logo for the actual dark card surface without changing evidence", () => {
  const $ = renderCard({ product: { ...baseCard.product, brand } });

  expect($(".product-logo img").attr("src")).toBe("https://example.com/dark.svg");
  expect($(".product-logo").attr("data-logo-mode")).toBe("dark");
  expect($(".card-title .eyebrow").text()).toBe("TESTING");
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

test.each([
  { productSlug: "different-product" },
  { canonicalDomain: "different.example.com" },
])("does not borrow a brand snapshot from another canonical identity: %j", (mismatch) => {
  const $ = renderCard({ product: { ...baseCard.product, brand: { ...brand, ...mismatch } } });

  expect($(".product-logo img")).toHaveLength(0);
  expect($(".product-logo").text()).toBe("EP");
  expect($(".product-card").attr("style") ?? "").toBe("");
});

test("keeps existing product logos and initials available when no brand logo was returned", () => {
  const product = { ...baseCard.product, brand: { ...brand, logos: [] } };
  const withLogo = renderCard({ product: { ...product, logoUrl: "https://example.com/canonical.png" } });
  const withInitials = renderCard({ product });

  expect(withLogo(".product-logo img").attr("src")).toBe("https://example.com/canonical.png");
  expect(withLogo(".product-logo").attr("data-logo-provider")).toBeUndefined();
  expect(withInitials(".product-logo").text()).toBe("EP");
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

  expect(card(".product-logo").text()).toBe("EP");
  expect(card(".card-title h2").text()).toBe(baseCard.product.name);
  expect($("section").text()).toContain("No brand logo returned");
  expect($("section").text()).toContain("No palette returned");
  expect($("section").text()).toContain("No fonts returned");
  expect($("section").text()).toContain("No styleguide returned");
  expect($(".brand-receipts").text()).toContain("fonts: unavailable · HTTP 404");
  expect($(".brand-receipts").text()).toContain("styleguide: error · HTTP 503");
});

test.each(["ACTIVE", "TESTING", "ARCHIVED"] as const)(
  "%s retains the supplied relationship start year",
  (status) => {
    const $ = renderCard({ status, startedAt: "2024-06-03" });

    expect($(".card-title .eyebrow").text()).toBe(`${status} · SINCE 2024`);
  },
);

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

test("the compact front leads with the owner relationship and leaves full evidence on its reverse", () => {
  const $ = renderCard({ activity: activityExamples[1] });
  const front = $(".card-front");

  expect(front.find(".card-headline").text()).toBe(baseCard.headline);
  expect(front.text().indexOf(baseCard.headline)).toBeLessThan(front.text().indexOf("120"));
  expect(front.find(".metric-row, .activity-calendar, .activity-bars, .activity-meta")).toHaveLength(0);
  expect(front.find(".card-activity-preview").text()).toContain("120");
  expect(front.find(".card-activity-preview").text()).toContain("2026-09-01 to 2026-09-15");
  expect(front.find(".card-activity-preview").text()).toContain("stale");
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
  expect(reverse.find(".activity-meta").text()).toContain("2026-09-01 to 2026-09-15");
  expect(reverse.find(".activity-meta").text()).toContain("Snapshot recorded 2026-09-18");
});

test("an empty time series does not turn missing observations into zero activity", () => {
  const $ = renderCard({ activity: { ...activityEvidence, kind: "timeSeries", label: "Minutes recorded", points: [] } });

  expect($(".card-activity-preview").text()).toContain("No observations supplied");
  expect($(".card-back .activity-module").text()).toContain("No observations supplied");
  expect($(".activity-hero strong")).toHaveLength(0);
  expect($(".activity-bars")).toHaveLength(0);
});

test("a recorded zero remains distinct from an empty time series", () => {
  const $ = renderCard({ activity: { ...activityEvidence, kind: "timeSeries", label: "Minutes recorded", points: [{ date: "2026-09-15", value: 0 }] } });

  expect($(".card-activity-preview strong").text()).toBe("0");
  expect($(".card-back .activity-hero strong").text()).toBe("0");
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

    expect($(".card-title .eyebrow").text()).toBe("PRIVATE DISCOVERY");
    expect($(".card-footer > span").text()).toBe("Needs your review");
    expect($(".card-back .status-row").text()).toContain("PRIVATE DISCOVERY");
    expect($(".card-back .relationship-date").text()).toBe("Relationship not confirmed");
    expect($.text()).not.toContain(status);
    expect($.text()).not.toContain("2024-06-03");
    expect($.text()).not.toContain("SINCE");
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
  expect($(".card-activity-preview").text()).toContain("2026-09-01 to 2026-09-15");
  expect($(".card-back").text()).toContain("Unreviewed evidence");
  expect($(".card-back .activity-meta").text()).toContain(activity.provenanceLabel);
  expect($(".card-back .activity-hero strong").text()).toBe("120");
});

test("the go-to designation requires an explicit prop for a confirmed relationship", () => {
  const $ = load(renderToStaticMarkup(createElement(ProductCard, {
    card: baseCard, index: 0, relationshipConfirmed: true, goTo: true,
  })));

  expect($(".card-title .eyebrow").text()).toBe("TESTING");
  expect($(".card-footer > span").text()).toBe("Owner-selected go-to");
  expect($.text()).not.toContain("Unreviewed evidence");
  const ordinary = renderCard();
  expect(ordinary(".card-title .eyebrow").text()).toBe("TESTING");
  expect(ordinary(".card-footer > span").text()).toBe("Relationship & evidence");
});

test("brand preview suppresses private discovery and go-to state", () => {
  const $ = load(renderToStaticMarkup(createElement(ProductCard, {
    card: { ...baseCard, activity: activityExamples[1] }, index: 0,
    displayMode: "brand-preview", relationshipConfirmed: false, goTo: true,
  })));

  expect($(".card-title .eyebrow").text()).toBe("BRAND PREVIEW");
  expect($(".card-footer > span").text()).toBe("Brand identity");
  expect($.text()).not.toContain("PRIVATE DISCOVERY");
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
  expect($(".activity-calendar span")).toHaveLength(1);
  expect($(".activity-calendar span").attr("title")).toBe("2026-09-15: 3 contributions");
  expect($(".activity-hero").text()).toBe("37contributions");
  expect($.text()).not.toContain("commits");
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

test("a canonical destination receives no invented affiliate disclosure", () => {
  const $ = renderCard();
  expect($(".card-link-disclosure")).toHaveLength(0);
  expect($(".card-visit").attr("rel")).toBe("noopener noreferrer");
});

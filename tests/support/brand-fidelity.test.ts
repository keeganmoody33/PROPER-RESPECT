import { describe, expect, it } from "vitest";
import { compareBrand, type BrandCapture } from "./brand-fidelity";
import spiderSite from "./fixtures/brand-fidelity/spider-site.json";
import spiderCard from "./fixtures/brand-fidelity/spider-card-ebafdc2.json";

// Recorded by scripts/brand-fidelity.mjs on 2026-11-14: spider.cloud at 1440px, and the homepage Spider card at ebafdc2's styles.
const site = spiderSite as BrandCapture, card = spiderCard as BrandCapture;
const results = (rows: ReturnType<typeof compareBrand>) => Object.fromEntries(rows.map(row => [row.trait, row.reason ? `${row.result}: ${row.reason}` : row.result]));

describe("compareBrand", () => {
  it("finds the traits where the Spider card misses spider.cloud", () => {
    expect(results(compareBrand(site, card))).toEqual({
      surface: "passed",
      text: "failed: OKLab distance 0.275 > 0.05",
      headingFamily: "passed",
      bodyFamily: "passed",
      buttonFill: "passed",
      buttonText: "passed",
      buttonRadius: "passed",
      buttonFamily: "failed: Berkeley (monospace) vs Inter Variable (sans-serif)",
      buttonCase: "passed",
      buttonTracking: "failed: 0.140em vs 0.000em",
      accent: "failed: OKLab distance 0.224 > 0.05",
      panelRadius: "failed: square vs slightly rounded",
      chipRadius: "passed",
      labelMono: "failed: true vs false",
      labelCase: "passed",
      labelTracking: "failed: 0.140em vs 0.000em",
    });
  });

  it("marks every trait untested when the site blocked the capture, saying why", () => {
    const rows = compareBrand({ ...site, blocked: "HTTP 403" }, card);
    expect(new Set(rows.map(row => `${row.result}: ${row.reason}`))).toEqual(new Set(["untested: site capture blocked: HTTP 403"]));
  });

  it("holds the card's chips to the site's buttons, and passes radii of the same class", () => {
    const sitePill = { px: 40, heightPx: 40 } as const, cardPill = { px: 12, heightPx: 22 } as const;
    const chips = compareBrand(
      { ...site, traits: { buttonRadius: { value: sitePill, method: "recorded" } } },
      { ...card, traits: { chipRadius: { value: cardPill, method: "recorded" } } },
    ).find(row => row.trait === "chipRadius");
    expect(chips).toMatchObject({ result: "passed", site: "40px pill", card: "12px pill" });
  });
});

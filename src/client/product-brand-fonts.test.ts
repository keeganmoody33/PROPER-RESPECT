import { load } from "cheerio";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductBrandFonts, productBrandTypography } from "../../components/product-brand-fonts";
import { ProductBrandDetails } from "../../components/product-brand-details";
import { normalizeProductBrand } from "../domain/product-brand";
import wisprReceipt from "../../docs/verification/fixtures/2026-09-17-context-brands/wisprflow.json";

const snapshot = normalizeProductBrand({
  productSlug: "example", canonicalDomain: "example.com", retrievalId: "font-render-2026-09-18", retrievedAt: "2026-09-18T12:00:00.000Z", responseHash: "a".repeat(64),
}, {
  brand: { status: "ok", brand: { domain: "example.com", logos: [], colors: [] } },
  fonts: { status: "ok", domain: "example.com", fonts: [{ font: "Eb garamond", uses: ["heading"], fallbacks: ["serif"] }, { font: "Figtree", uses: ["body"], fallbacks: ["sans-serif"] }], fontLinks: {
    "Eb garamond": { type: "google", category: "serif", files: { "400": "https://fonts.gstatic.com/garamond.woff2" } },
    Figtree: { type: "custom", files: { "400": "https://assets.example.com/figtree.woff2", "600": "https://assets.example.com/figtree-semibold.woff2" } },
  } },
  styleguide: { status: "ok", domain: "example.com", styleguide: { mode: "light", colors: {}, typography: {
    headings: { h1: { fontFamily: "EB Garamond", fontFallbacks: ["EB Garamond", "serif"], fontWeight: 400, lineHeight: "1.1", letterSpacing: "-0.02em" } },
    p: { fontFamily: "Figtree", fontFallbacks: ["Figtree", "sans-serif"], fontWeight: 400, lineHeight: "1.5", letterSpacing: "normal" },
  } } },
});

describe("retained card typography", () => {
  it("emits only namespaced font faces for explicit roles, with swap and fallback stacks", () => {
    const $ = load(renderToStaticMarkup(createElement(ProductBrandFonts, { snapshot })));
    const css = $("style").text();
    const style = productBrandTypography(snapshot);
    expect($("script, link")).toHaveLength(0);
    expect(css.match(/@font-face/g)).toHaveLength(3);
    expect(css).toContain('url("https://fonts.gstatic.com/garamond.woff2") format("woff2")');
    expect(css).toContain("font-display:swap");
    const details = renderToStaticMarkup(createElement(ProductBrandDetails, { snapshot }));
    expect(details).toContain("Retained font files are available for card typography");
    expect(css).not.toContain('font-family:"EB Garamond"');
    expect(css).not.toMatch(/body\s*\{|html\s*\{|@import|api\.context\.dev/);
    expect(style["--brand-card-heading-font"]).toMatch(/^"PRBrand-example-[a-f0-9]+-heading", "EB Garamond", serif/);
    expect(style["--brand-card-body-font"]).toContain('"Figtree", sans-serif');
    expect(style).toMatchObject({ "--brand-card-heading-weight": "400", "--brand-card-heading-leading": "1.1", "--brand-card-heading-tracking": "-0.02em", "--brand-card-body-leading": "1.5" });
  });

  it("leaves legacy snapshots unchanged and keeps usable fallbacks when files are unavailable", () => {
    expect(renderToStaticMarkup(createElement(ProductBrandFonts, { snapshot: wisprReceipt.snapshot as typeof snapshot }))).toBe("");
    expect(productBrandTypography(wisprReceipt.snapshot as typeof snapshot)).toEqual({});
    const missing = { ...snapshot, fontLinks: [] };
    expect(renderToStaticMarkup(createElement(ProductBrandDetails, { snapshot: missing }))).toContain("No retained font files are available");
    expect(renderToStaticMarkup(createElement(ProductBrandFonts, { snapshot: missing }))).toBe("");
    expect(productBrandTypography(missing)["--brand-card-body-font"]).toContain('"Figtree", sans-serif');
    expect(productBrandTypography(missing)["--brand-card-heading-font"]).toContain('"EB Garamond", serif');
  });

  it("keeps unrelated families unloaded and separate retrievals isolated", () => {
    if (snapshot.schemaVersion !== 2) throw new Error("Expected version 2.");
    const withUnused = { ...snapshot, fontLinks: [...snapshot.fontLinks, { ...snapshot.fontLinks[0], family: "Unused Font", files: [{ ...snapshot.fontLinks[0].files[0], url: "https://assets.example.com/unused.woff2" }] }] };
    const css = renderToStaticMarkup(createElement(ProductBrandFonts, { snapshot: withUnused }));
    expect(css).not.toContain("unused.woff2");
    expect(productBrandTypography({ ...snapshot, responseHash: "b".repeat(64) })["--brand-card-body-font"]).not.toEqual(productBrandTypography(snapshot)["--brand-card-body-font"]);
  });

  it("rejects unsafe retained snapshots at the render boundary", () => {
    if (snapshot.schemaVersion !== 2) throw new Error("Expected version 2.");
    const unsafe = { ...snapshot, fontLinks: [{ ...snapshot.fontLinks[0], files: [{ ...snapshot.fontLinks[0].files[0], url: 'https://assets.example.com/font.woff2?q=</style><script>alert(1)</script>' }] }] };
    expect(renderToStaticMarkup(createElement(ProductBrandFonts, { snapshot: unsafe }))).toBe("");
    expect(productBrandTypography(unsafe)).toEqual({});
  });
});

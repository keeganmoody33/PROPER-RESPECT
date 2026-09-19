import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { load } from "cheerio";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductCard } from "../../components/product-card";
import { canonicalCatalogProduct } from "./discovery";
import { productBrandSnapshotSchema } from "./product-brand";
import {
  verifiedProductAssets,
  selectVerifiedProductLogo,
  verifiedProductFontFaces,
  verifiedProductTypography,
} from "./verified-product-assets";

const product = { slug: "github-copilot", domain: "github.com", name: "GitHub Copilot", description: "Synthetic Copilot card." };
const assets = verifiedProductAssets(product)!;

describe("verified official product assets", () => {
  it("requires the exact canonical product and domain without matching a parent or sibling", () => {
    expect(assets.productSlug).toBe(canonicalCatalogProduct(product.slug)?.slug);
    expect(assets.canonicalDomain).toBe(canonicalCatalogProduct(product.slug)?.domain);
    for (const identity of [
      { slug: "github", domain: "github.com" },
      { slug: "github-copilot", domain: "copilot.microsoft.com" },
      { slug: "manual-github-copilot", domain: "github.com" },
      { slug: "notebooklm", domain: "notebooklm.google.com" },
      { slug: "devin-desktop", domain: "devin.ai" },
    ]) expect(verifiedProductAssets(identity)).toBeUndefined();
    expect(assets.provider).toBe("official-vendor");
    expect(productBrandSnapshotSchema.safeParse(assets).success).toBe(false);
  });

  it("retains exact reviewed bytes and independently inspectable source provenance", () => {
    const retained = [...assets.logos, ...assets.typography.files, assets.typography.license];
    for (const file of retained) {
      const bytes = readFileSync(new URL(`../../public${file.path}`, import.meta.url));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(file.sha256);
    }
    const manifest = JSON.parse(readFileSync(new URL(`../../public${assets.manifestPath}`, import.meta.url), "utf8"));
    expect(manifest).toEqual(assets);
    expect(readFileSync(new URL(`../../public${assets.typography.license.path}`, import.meta.url), "utf8")).toContain("SIL OPEN FONT LICENSE Version 1.1");
    expect(assets.logoSource.archiveUrl).toBe("https://brand.github.com/GitHub_Logos.zip");
    for (const font of assets.typography.files) expect(font.sourceUrl).toContain(assets.typography.sourceRevision);
  });

  it("selects the complete surface-specific wordmark and returns no image after failure", () => {
    for (const surface of ["light", "dark"] as const) {
      const logo = selectVerifiedProductLogo(assets, surface)!;
      expect(logo.archiveMember).toContain("GitHub_Copilot_Lockup_");
      expect(logo.width / logo.height).toBeCloseTo(734 / 95);
      expect(selectVerifiedProductLogo(assets, surface, [logo.path])).toBeUndefined();
    }
  });

  it("serves font files locally with a card-specific family and usable fallbacks", () => {
    const css = verifiedProductFontFaces(assets);
    expect(css).not.toContain("https:");
    expect(css).not.toContain("@import");
    expect(css.match(/@font-face/g)).toHaveLength(3);
    expect(css).toContain("font-display:swap");
    const typography = verifiedProductTypography(assets);
    expect(typography["--brand-card-body-font"]).toBe(typography["--brand-card-heading-font"]);
    expect(typography["--brand-card-body-font"]).toContain("Arial, Helvetica, sans-serif");
  });

  it("renders official provenance and accessible product naming without manufacturing evidence", () => {
    const $ = load(renderToStaticMarkup(createElement(ProductCard, {
      card: { product, status: "TESTING", headline: "", note: "Supplied owner note." }, index: 0,
    })));
    expect($(".card-title h2").text()).toBe("GitHub Copilot");
    expect($(".product-logo").attr("data-logo-provider")).toBe("official-vendor");
    expect($(".product-logo img").attr("src")).toBe(selectVerifiedProductLogo(assets, "dark")?.path);
    expect($(".product-logo img").attr("width")).toBe("734");
    expect($(".product-logo img").attr("height")).toBe("95");
    expect($("a[href='" + assets.manifestPath + "']")).toHaveLength(1);
    expect($(".card-headline").text()).toBe("Supplied owner note.");
    expect($.text()).not.toContain("Context.dev");
    expect($(".card-activity-preview")).toHaveLength(0);
  });
});

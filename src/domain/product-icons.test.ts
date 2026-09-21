import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import icons from "../../public/product-assets/2026-09-21-product-icons.json";
import { officialProductIcon } from "./product-icons";

test("reviewed icons require exact product identity and preserve original bytes", () => {
  for (const icon of icons) {
    const product = { slug: icon.productSlug, domain: icon.canonicalDomain };
    expect(officialProductIcon(product)).toEqual(icon);
    expect(officialProductIcon({ ...product, slug: `manual-${product.slug}` })).toBeUndefined();
    expect(officialProductIcon({ ...product, domain: `other.${product.domain}` })).toBeUndefined();
    const bytes = readFileSync(new URL(`../../public${icon.path}`, import.meta.url));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(icon.sha256);
    expect(icon.width).toBeGreaterThanOrEqual(48 * 3);
    expect(icon.height).toBeGreaterThanOrEqual(48 * 3);
  }
});

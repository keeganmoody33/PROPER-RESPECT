import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import icons from "../../public/product-assets/2026-09-21-product-icons.json";
import exactIcons from "../../public/product-assets/2026-09-22-product-icons.json";
import { officialProductIcon } from "./product-icons";

test("reviewed icons require exact product identity and preserve original bytes", () => {
  for (const icon of [...icons, ...exactIcons]) {
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

test("NotebookLM and Devin Desktop use exact-product icons without parent or sibling substitution", () => {
  expect(officialProductIcon({ slug: "notebooklm", domain: "notebooklm.google.com" })?.path).toBe("/product-assets/notebooklm/2026-09-22/app-icon.png");
  expect(officialProductIcon({ slug: "devin-desktop", domain: "devin.ai" })?.path).toBe("/product-assets/devin-desktop/2026-09-22/app-icon.png");
  for (const product of [
    { slug: "notebooklm", domain: "google.com" },
    { slug: "google", domain: "notebooklm.google.com" },
    { slug: "devin", domain: "devin.ai" },
    { slug: "windsurf", domain: "windsurf.com" },
    { slug: "devin-desktop", domain: "cognition.ai" },
  ]) expect(officialProductIcon(product)).toBeUndefined();
});

test("Devin Desktop PNG is the unchanged embedded payload of the retained official app icon", () => {
  const entry = exactIcons.find(icon => icon.productSlug === "devin-desktop")!;
  const icns = readFileSync(new URL(`../../public${entry.sourceAssetPath}`, import.meta.url));
  expect(createHash("sha256").update(icns).digest("hex")).toBe(entry.sourceAssetSha256);
  expect(icns.subarray(0, 4).toString()).toBe("icns");
  let embedded: Buffer | undefined;
  for (let offset = 8; offset < icns.length;) {
    const length = icns.readUInt32BE(offset + 4);
    if (icns.subarray(offset, offset + 4).toString() === "ic10") embedded = icns.subarray(offset + 8, offset + length);
    offset += length;
  }
  expect(embedded).toEqual(readFileSync(new URL(`../../public${entry.path}`, import.meta.url)));
});

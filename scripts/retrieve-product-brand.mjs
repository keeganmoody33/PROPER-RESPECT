#!/usr/bin/env node
// Operator verification, not a card-render path. Never writes to a backend.
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { canonicalCatalogProduct } from "../src/domain/discovery.ts";
import { retrieveProductBrand } from "../src/server/context-brand.ts";
import { readRetainedBrandReceipt } from "../src/server/retained-brand-receipt.ts";

const [slug, outputDirectory] = process.argv.slice(2);
if (!slug || !outputDirectory) {
  console.error("Usage: node --env-file=.env.local --experimental-strip-types scripts/retrieve-product-brand.mjs PRODUCT_SLUG OUTPUT_DIRECTORY");
  process.exit(1);
}
const product = canonicalCatalogProduct(slug);
if (!product) { console.error("A verified canonical catalog product is required."); process.exit(1); }
const output = resolve(outputDirectory);
const receiptPath = join(output, `${product.slug}.json`);
// Replays reuse the exact retained receipt; a refresh requires a new directory.
if (existsSync(receiptPath)) {
  try { await readRetainedBrandReceipt(output, product.slug); }
  catch {
    console.error("Existing receipt does not match canonical identity or response hash."); process.exit(1);
  }
  console.log(`Retained brand receipt already exists for ${product.slug}; no provider request made.`);
  process.exit(0);
}
try {
  const result = await retrieveProductBrand({ productSlug: product.slug, canonicalDomain: product.domain }, { apiKey: process.env.CONTEXT_DEV_API_KEY ?? "" });
  mkdirSync(output, { recursive: true, mode: 0o700 });
  writeFileSync(receiptPath, JSON.stringify({
    kind: "BRAND_PRESENTATION_ONLY", product,
    request: { provider: "context.dev", method: "POST", endpoint: "https://api.context.dev/v1/brand/retrieve", body: { type: "by_domain", domain: product.domain }, authentication: "REDACTED", optionalEndpoints: ["/v1/web/fonts", "/v1/web/styleguide"] },
    ...result,
  }, null, 2) + "\n", { mode: 0o600, flag: "wx" });
  console.log(`Retained brand receipt: ${receiptPath}`);
  console.log(`Available: ${result.snapshot.logos.length} logos, ${result.snapshot.colors.length} colors, ${result.snapshot.fonts.length} fonts, styleguide ${Boolean(result.snapshot.styleguide)}; partial ${result.snapshot.partial}. No owner evidence or backend state changed.`);
} catch {
  // Even a provider or filesystem exception must not reveal credential-bearing data.
  console.error("Brand retrieval or retention failed. No snapshot was written; check local configuration and provider access.");
  process.exit(1);
}

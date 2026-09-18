import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { canonicalCatalogProduct } from "../domain/discovery.ts";
import { productBrandSnapshotSchema } from "../domain/product-brand.ts";

/** Local verification receipts contain public brand data only, never owner evidence. */
export async function readRetainedBrandReceipt(directory: string, slug: string) {
  const product = canonicalCatalogProduct(slug);
  if (!product) throw new Error("Verified canonical product required.");
  const bytes = await readFile(join(directory, `${product.slug}.json`));
  if (bytes.length > 524_288) throw new Error("Brand receipt too large.");
  const receipt = JSON.parse(bytes.toString("utf8"));
  const snapshot = productBrandSnapshotSchema.parse(receipt.snapshot);
  const responseHash = createHash("sha256").update(JSON.stringify(receipt.response)).digest("hex");
  if (receipt.kind !== "BRAND_PRESENTATION_ONLY" || snapshot.productSlug !== product.slug || snapshot.canonicalDomain !== product.domain || snapshot.responseHash !== responseHash) throw new Error("Brand receipt identity or hash mismatch.");
  return { product, snapshot };
}

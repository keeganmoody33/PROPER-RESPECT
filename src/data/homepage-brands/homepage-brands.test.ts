import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { productBrandEligibility } from "@/convex/productBrands";
import { CONTEXT_BRAND_ADAPTER_VERSION, productBrandSnapshotSchema } from "@/src/domain/product-brand";
import { directoryEntry } from "@/src/domain/product-directory";
import { HOMEPAGE_BRANDS } from "./index";

const DIRECTORY = join(process.cwd(), "src/data/homepage-brands");
const files = readdirSync(DIRECTORY).filter(name => name.endsWith(".json")).sort();

test("every committed homepage brand is loaded by the index", () => {
  expect(files).toEqual([
    "clay.json", "cloudflare.json", "context-dev.json", "docker.json", "elicit.json", "exa.json",
    "firecrawl.json", "github.json", "n8n.json", "open-places.json", "porkbun.json", "spider.json",
  ]);
  expect(Object.keys(HOMEPAGE_BRANDS).sort()).toEqual(files.map(name => name.replace(".json", "")));
});

test("each committed snapshot parses with the current schema and was normalized by the current adapter", () => {
  const problems = files.flatMap(name => {
    const parsed = productBrandSnapshotSchema.safeParse(JSON.parse(readFileSync(join(DIRECTORY, name), "utf8")));
    if (!parsed.success) return [`${name}: does not parse`];
    // A newer adapter reads more of the provider response; rerun scripts/pull-homepage-brands.mjs with fresh pulls.
    return parsed.data.adapterVersion === CONTEXT_BRAND_ADAPTER_VERSION ? [] : [`${name}: adapter ${parsed.data.adapterVersion}`];
  });
  expect(problems).toEqual([]);
});

test("each snapshot names its own product's listed domain, and that product passes the brand gate", () => {
  const identities = Object.entries(HOMEPAGE_BRANDS).map(([slug, brand]) => {
    const entry = directoryEntry(slug)!;
    return [slug, brand.productSlug === slug, brand.canonicalDomain === entry.domain, productBrandEligibility({ slug, name: entry.name, domain: entry.domain })];
  });
  expect(identities.filter(([, sameSlug, sameDomain, refusal]) => !sameSlug || !sameDomain || refusal !== null)).toEqual([]);
  expect(HOMEPAGE_BRANDS.firecrawl.canonicalDomain).toBe("firecrawl.dev");
  expect(HOMEPAGE_BRANDS["open-places"].canonicalDomain).toBe("openplaces.practicebase.io");
});

test("Claude Code and Grok Bot get no brand: their listed domains belong to a parent company", () => {
  expect(productBrandEligibility({ slug: "claude-code", name: "Claude Code", domain: "claude.com" })).toBe("PRODUCT_IDENTITY_REQUIRED");
  expect(productBrandEligibility({ slug: "grok-bot", name: "Grok Bot", domain: "x.ai" })).toBe("PRODUCT_IDENTITY_REQUIRED");
  expect(Object.keys(HOMEPAGE_BRANDS)).not.toEqual(expect.arrayContaining(["claude-code"]));
  expect(Object.keys(HOMEPAGE_BRANDS)).not.toEqual(expect.arrayContaining(["grok-bot"]));
});

test("the pull had no fonts endpoint to call, so each snapshot records that request as failed", () => {
  const fontReceipts = Object.values(HOMEPAGE_BRANDS).map(brand => brand.receipts.find(receipt => receipt.endpoint === "fonts")?.status);
  expect(new Set(fontReceipts)).toEqual(new Set(["error"]));
});

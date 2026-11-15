import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { productBrandEligibility } from "@/convex/productBrands";
import { CONTEXT_BRAND_ADAPTER_VERSION, productBrandSnapshotSchema } from "@/src/domain/product-brand";
import { directoryEntry } from "@/src/domain/product-directory";
import { HOMEPAGE_BRANDS, HOMEPAGE_SITE_TRAITS } from "./index";
import { SITE_ONLY_PAGES } from "./site-only";

const DIRECTORY = join(process.cwd(), "src/data/homepage-brands");
/** The width every site was measured at. */
const DESKTOP_WIDTH = 1440;
const files = readdirSync(DIRECTORY).filter(name => name.endsWith(".json") && !name.endsWith(".site.json")).sort();
const siteFiles = readdirSync(DIRECTORY).filter(name => name.endsWith(".site.json")).sort();

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

test("every example has a measured site file, loaded by the index, but Porkbun and Grok Bot, whose sites blocked the measurement", () => {
  expect(siteFiles).toEqual([
    "claude-code.site.json", "clay.site.json", "cloudflare.site.json", "context-dev.site.json", "docker.site.json", "elicit.site.json", "exa.site.json",
    "firecrawl.site.json", "github.site.json", "n8n.site.json", "open-places.site.json", "spider.site.json",
  ]);
  expect(Object.keys(HOMEPAGE_SITE_TRAITS).sort()).toEqual(siteFiles.map(name => name.replace(".site.json", "")));
  expect(Object.keys(HOMEPAGE_SITE_TRAITS)).not.toEqual(expect.arrayContaining(["porkbun"]));
  expect(Object.keys(HOMEPAGE_SITE_TRAITS)).not.toEqual(expect.arrayContaining(["grok-bot"]));
});

test("each site file measured its own product's page at desktop width: a stored brand's domain root, else its listed product page", () => {
  const page = (slug: string) => HOMEPAGE_BRANDS[slug] ? { domain: HOMEPAGE_BRANDS[slug].canonicalDomain, url: `https://${HOMEPAGE_BRANDS[slug].canonicalDomain}/` }
    : SITE_ONLY_PAGES.map(only => ({ slug: only.productSlug, domain: only.canonicalDomain, url: only.url })).find(only => only.slug === slug);
  const wrong = Object.entries(HOMEPAGE_SITE_TRAITS).filter(([slug, site]) => site.productSlug !== slug || site.canonicalDomain !== page(slug)?.domain
    || site.canonicalDomain !== directoryEntry(slug)?.domain || site.url !== page(slug)?.url || site.viewport.width !== DESKTOP_WIDTH);
  expect(wrong.map(([slug]) => slug)).toEqual([]);
  expect(HOMEPAGE_SITE_TRAITS["claude-code"].url).toBe("https://claude.com/product/claude-code");
  expect(HOMEPAGE_SITE_TRAITS.spider.traits.signature).toEqual({ value: "#3bde77", from: "heading highlight" });
  // Clay's green hero runs flush to the page edge: a square slab.
  expect(HOMEPAGE_SITE_TRAITS.clay.traits.hero).toEqual({ value: { kind: "colour", hex: "#035d44", radiusPx: 0 }, from: "backdrop behind the first heading" });
});

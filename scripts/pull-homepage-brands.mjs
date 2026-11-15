#!/usr/bin/env node
// Builds the homepage's committed brand snapshots from saved Context.dev responses.
// No provider request and no key: the saved responses are replayed through the same
// retrieveProductBrand a stored card brand comes from, so each file is what retention would keep.
//
// Usage: node --experimental-strip-types scripts/pull-homepage-brands.mjs RAW_DIRECTORY
// RAW_DIRECTORY holds one <slug>.json per product: { slug, fetchedAt, brand, styleguide },
// where brand and styleguide are the MCP tool results for brand-retrieve-unified and web-styleguide.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { directoryDomainOwner, directoryEntry } from "../src/domain/product-directory.ts";
import { retrieveProductBrand } from "../src/server/context-brand.ts";

const OUTPUT = resolve("src/data/homepage-brands");
// The adapter refuses an empty key. This one is never sent anywhere: the fetcher below answers every request.
const REPLAY_KEY = "offline-replay";

const rawDirectory = process.argv[2];
if (!rawDirectory) {
  console.error("Usage: node --experimental-strip-types scripts/pull-homepage-brands.mjs RAW_DIRECTORY");
  process.exit(1);
}

/** The MCP tools return the same JSON bodies the REST endpoints do. There is no MCP tool for /v1/web/fonts, so that request fails and its receipt reads "error". */
function replayFetcher(saved) {
  return async (url) => {
    const { pathname } = new URL(url);
    const body = pathname.endsWith("/brand/retrieve") ? saved.brand : pathname.endsWith("/web/styleguide") ? saved.styleguide : undefined;
    if (!body) throw new Error(`No saved response for ${pathname}`);
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  };
}

/** The gate convex/productBrands.ts applies before any fetch: the product must own its listed domain. */
function eligible(entry) {
  return entry.slug !== "notebooklm" && directoryDomainOwner(entry.domain)?.slug === entry.slug;
}

const files = readdirSync(rawDirectory).filter(name => name.endsWith(".json")).sort();
mkdirSync(OUTPUT, { recursive: true });
const results = await Promise.all(files.map(async (name) => {
  const saved = JSON.parse(readFileSync(join(rawDirectory, name), "utf8"));
  const entry = directoryEntry(saved.slug);
  if (!entry) return `${saved.slug}: not in the directory`;
  if (!eligible(entry)) return `${saved.slug}: refused, ${entry.domain} is not this product's own domain`;
  try {
    const { snapshot } = await retrieveProductBrand(
      { productSlug: entry.slug, canonicalDomain: entry.domain, retrievalId: saved.brand.request_id, retrievedAt: saved.fetchedAt },
      { apiKey: REPLAY_KEY, fetcher: replayFetcher(saved), expectedNames: entry.evidence ? undefined : [entry.name, ...entry.aliases] },
    );
    writeFileSync(join(OUTPUT, `${entry.slug}.json`), `${JSON.stringify(snapshot, null, 2)}\n`);
    return `${entry.slug}: ${snapshot.logos.length} logos, ${snapshot.colors.length} colours, ${snapshot.fontLinks.length} font links, partial ${snapshot.partial}`;
  } catch (error) {
    return `${saved.slug}: refused, ${error instanceof Error ? error.message : "unknown error"}`;
  }
}));
console.log(results.join("\n"));

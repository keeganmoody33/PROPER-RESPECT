#!/usr/bin/env node
// The second pull step for the homepage examples: after scripts/pull-homepage-brands.mjs has stored each
// product's provider brand, measure the product's own site and store what it adds beside the brand as
// src/data/homepage-brands/<slug>.site.json.
//
// Usage: node --experimental-strip-types scripts/pull-homepage-site-traits.mjs [--measure]
//
// A saved measurement in .artifacts/brand-fidelity/reference/<slug>.json (the one the fidelity check uses)
// is read when present, so a rerun is offline and gives the same files byte for byte. Only with --measure
// is a site with no saved measurement opened, through scripts/brand-site-measure.mjs. A site that blocked
// automation gets no file and is not asked again.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { brandSiteTraitsFromMeasurement } from "../src/domain/brand-site-traits.ts";
import { DESKTOP } from "./brand-site-measure.mjs";

const BRANDS = resolve("src/data/homepage-brands");
const SAVED = resolve(".artifacts/brand-fidelity/reference");
const measure = process.argv.includes("--measure");

// Only a product with a stored brand is measured: the brand gate has already refused the rest (Claude Code
// and Grok Bot list a parent company's domain), and a parent company's site is never measured for them.
const snapshots = readdirSync(BRANDS).filter(name => name.endsWith(".json") && !name.endsWith(".site.json")).sort()
  .map(name => JSON.parse(readFileSync(join(BRANDS, name), "utf8")));

async function savedOrMeasured(snapshot) {
  const path = join(SAVED, `${snapshot.productSlug}.json`);
  if (existsSync(path)) return JSON.parse(readFileSync(path, "utf8"));
  if (!measure) return undefined;
  const [{ chromium }, { captureSite }] = await Promise.all([import("playwright"), import("./brand-site-measure.mjs")]);
  mkdirSync(SAVED, { recursive: true });
  const browser = await chromium.launch();
  try {
    const capture = await captureSite(browser, { slug: snapshot.productSlug, name: snapshot.productSlug, url: `https://${snapshot.canonicalDomain}/` }, SAVED);
    writeFileSync(path, `${JSON.stringify(capture, null, 2)}\n`);
    return capture;
  } finally { await browser.close(); }
}

const results = [];
for (const snapshot of snapshots) {
  const slug = snapshot.productSlug, output = join(BRANDS, `${slug}.site.json`);
  const capture = await savedOrMeasured(snapshot);
  if (!capture) { results.push(`${slug}: no saved measurement; rerun with --measure`); continue; }
  if (capture.blocked || !capture.site) {
    rmSync(output, { force: true });
    results.push(`${slug}: no site file, the site blocked automation (${capture.blocked ?? "nothing measured"}) on ${capture.capturedAt.slice(0, 10)}`);
    continue;
  }
  const traits = brandSiteTraitsFromMeasurement({
    productSlug: slug, canonicalDomain: snapshot.canonicalDomain, measuredAt: capture.capturedAt, url: capture.url, viewport: capture.viewport ?? DESKTOP,
  }, capture.site);
  writeFileSync(output, `${JSON.stringify(traits, null, 2)}\n`);
  results.push(`${slug}: ${Object.keys(traits.traits).length} traits measured ${traits.measuredAt}`);
}
console.log(results.join("\n"));

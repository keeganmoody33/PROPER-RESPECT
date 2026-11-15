#!/usr/bin/env node
// The second pull step for the homepage examples: after scripts/pull-homepage-brands.mjs has stored each
// product's provider brand, measure the product's own site and store what it adds beside the brand as
// src/data/homepage-brands/<slug>.site.json.
//
// Usage: node --experimental-strip-types scripts/pull-homepage-site-traits.mjs [--measure | --logos]
//
// A saved measurement in .artifacts/brand-fidelity/reference/<slug>.json (the one the fidelity check uses)
// is read when present, so a rerun is offline and gives the same files byte for byte. Only with --measure
// is a site with no saved measurement opened, through scripts/brand-site-measure.mjs. With --measure or --logos
// the inks of the snapshot's own stored logo files are read for a saved measurement that has none (only their
// colours are kept, never the files); --logos opens no site. A site that blocked automation gets no file and
// is not asked again.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { brandSiteTraitsFromMeasurement } from "../src/domain/brand-site-traits.ts";
import { DESKTOP, pageTexture } from "./brand-site-measure.mjs";
import { oklabDistance } from "../src/domain/oklab.ts";

const BRANDS = resolve("src/data/homepage-brands");
const SAVED = resolve(".artifacts/brand-fidelity/reference");
const measure = process.argv.includes("--measure"), readLogos = measure || process.argv.includes("--logos");

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

/** A drawn pixel is at least this opaque; colours this close in OKLab are one ink; a logo is read at most this wide. */
const OPAQUE = 200, SAME_INK = 0.05, RASTER_WIDTH = 400, MAX_INKS = 6, FETCH_TIMEOUT_MS = 20_000;
const hexOf = (red, green, blue) => `#${[red, green, blue].map(value => value.toString(16).padStart(2, "0")).join("")}`;

/** The commonest colours of one stored logo file and the share of its drawn pixels each covers. An SVG's currentColor draws black, as in an <img>. */
async function inksOf(logo) {
  const { default: sharp } = await import("sharp");
  const response = await fetch(logo.url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`${logo.url}: HTTP ${response.status}`);
  const { data, info } = await sharp(Buffer.from(await response.arrayBuffer()), { density: 144 }).resize({ width: Math.min(RASTER_WIDTH, logo.width), withoutEnlargement: false })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const counts = new Map();
  for (let at = 0; at < data.length; at += info.channels) {
    if (data[at + 3] < OPAQUE) continue;
    const hex = hexOf(data[at], data[at + 1], data[at + 2]);
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const clusters = [];
  for (const [hex, count] of [...counts].sort((a, b) => b[1] - a[1])) {
    const cluster = clusters.find(candidate => oklabDistance(candidate.hex, hex) <= SAME_INK);
    if (cluster) cluster.count += count; else clusters.push({ hex, count });
  }
  return clusters.sort((a, b) => b.count - a.count).slice(0, MAX_INKS).map(({ hex, count }) => ({ hex, share: Math.round((count / total) * 1000) / 1000 }));
}

/** Each stored logo's kind, size and inks, kept in the saved capture so a rerun stays offline. */
async function logoInks(snapshot, capture, path) {
  if (capture.site.logoInks || !readLogos) return;
  capture.site.logoInks = [];
  for (const logo of snapshot.logos) {
    try { capture.site.logoInks.push({ mode: logo.mode, type: logo.type, width: logo.width, height: logo.height, inks: await inksOf(logo) }); }
    catch (error) { console.error(`${snapshot.productSlug}: logo not read (${error.message})`); }
  }
  writeFileSync(path, `${JSON.stringify(capture, null, 2)}\n`);
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
  await logoInks(snapshot, capture, join(SAVED, `${slug}.json`));
  // A capture from before the margins were read for a texture reads them from its own saved screenshot, offline.
  if (capture.site.texture === undefined && existsSync(join(SAVED, `${slug}-1440.png`))) {
    capture.site.texture = (await pageTexture(join(SAVED, `${slug}-1440.png`), capture.site.surface)) ?? null;
    writeFileSync(join(SAVED, `${slug}.json`), `${JSON.stringify(capture, null, 2)}\n`);
  }
  const traits = brandSiteTraitsFromMeasurement({
    productSlug: slug, canonicalDomain: snapshot.canonicalDomain, measuredAt: capture.capturedAt, url: capture.url, viewport: capture.viewport ?? DESKTOP,
  }, capture.site);
  writeFileSync(output, `${JSON.stringify(traits, null, 2)}\n`);
  results.push(`${slug}: ${Object.keys(traits.traits).length} traits measured ${traits.measuredAt}`);
}
console.log(results.join("\n"));

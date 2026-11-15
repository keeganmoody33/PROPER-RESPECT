#!/usr/bin/env node
// Puts each homepage example card next to its product's own site and measures both the same way.
// A dev tool: it opens public sites, so it never runs in CI or npm test.
//
//   node scripts/brand-fidelity.mjs reference [--only spider,exa]
//   node scripts/brand-fidelity.mjs build
//   node scripts/brand-fidelity.mjs card --base http://127.0.0.1:3100 --label before [--only ...]
//   node scripts/brand-fidelity.mjs compare --label before
//   node scripts/brand-fidelity.mjs pairs --label after
//
// Output goes to .artifacts/brand-fidelity/ (git-ignored).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import { assertionsMarkdown, compareBrand } from "../tests/support/brand-fidelity.ts";
import { captureSite, DESKTOP, PAGE_HELPERS, PHONE } from "./brand-site-measure.mjs";
import { SITE_ONLY_PAGES } from "../src/data/homepage-brands/site-only.ts";

const ROOT = resolve(".artifacts/brand-fidelity");
const BRANDS_DIR = resolve("src/data/homepage-brands");
const BUILD_STAMP = resolve(".next/brand-fidelity-build.json");
const NAMES = {
  github: "GitHub", firecrawl: "Firecrawl", exa: "Exa", cloudflare: "Cloudflare", porkbun: "Porkbun", spider: "Spider",
  docker: "Docker", "open-places": "Open Places", elicit: "Elicit", "context-dev": "Context.dev", n8n: "n8n", clay: "Clay",
};
const WIDTHS = { desktop: DESKTOP, phone: PHONE };
const NAVIGATION_TIMEOUT_MS = 45_000;

const args = process.argv.slice(2);
const command = args[0];
const option = (name) => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
const only = option("only")?.split(",");
// The stored brands, measured at their domain's root, and the examples with no stored brand, measured at their own product page.
const brands = [
  ...readdirSync(BRANDS_DIR).filter(file => file.endsWith(".json") && !file.endsWith(".site.json")).map(file => JSON.parse(readFileSync(join(BRANDS_DIR, file), "utf8")))
    .map(snapshot => ({ slug: snapshot.productSlug, name: NAMES[snapshot.productSlug], url: `https://${snapshot.canonicalDomain}/` })),
  ...SITE_ONLY_PAGES.map(page => ({ slug: page.productSlug, name: page.name, url: page.url })),
].filter(brand => brand.name && (!only || only.includes(brand.slug)));
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const write = (path, value) => { mkdirSync(resolve(path, ".."), { recursive: true }); writeFileSync(path, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`); };

/** Runs in the page: the same traits read from one homepage example card. */
function measureCard(card) {
  const f = window.__fidelity, traits = {};
  const set = (name, value, method) => { traits[name] = value === undefined ? { untested: method } : { value, method }; };
  const part = selector => card.querySelector(selector);
  const style = getComputedStyle(card);
  set("surface", f.color(style.backgroundColor), "card background-color");
  set("text", f.color(style.color), "card color");
  const familyOf = (element, label) => { if (!element) return set(label, undefined, "element absent"); const family = f.family(getComputedStyle(element).fontFamily); set(label, { family: family.name, generic: f.monospace(getComputedStyle(element).fontFamily, getComputedStyle(element).fontWeight) ? "monospace" : family.generic }, "font-family"); };
  familyOf(part(".card-title h2"), "headingFamily");
  familyOf(part(".card-headline"), "bodyFamily");
  const button = part(".card-button");
  if (button) {
    const buttonStyle = getComputedStyle(button);
    set("buttonFill", f.color(buttonStyle.backgroundColor), ".card-button background-color");
    set("buttonText", f.color(buttonStyle.color), ".card-button color");
    set("buttonRadius", f.radius(button), ".card-button border-top-left-radius");
    familyOf(button, "buttonFamily");
    set("buttonCase", f.textCase(button), ".card-button text-transform");
    set("buttonTracking", f.tracking(button), ".card-button letter-spacing / font-size");
  }
  const bar = part(".activity-bars span") ?? part('.contribution-grid span[data-level="4"]') ?? part('.activity-calendar span[data-level="4"]');
  // An outlined bar (a brand that draws in lines) is drawn in its border; a filled one in its background.
  const outlined = bar && parseFloat(getComputedStyle(bar).borderTopWidth) > 0;
  set("accent", bar ? f.color(outlined ? getComputedStyle(bar).borderTopColor : getComputedStyle(bar).backgroundColor) : undefined, bar ? `chart mark ${outlined ? "border-top-color" : "background-color"}` : "no chart");
  set("panelRadius", { px: f.radius(card).px }, "card border-top-left-radius");
  const chip = part(".card-uses li");
  set("chipRadius", chip ? f.radius(chip) : undefined, chip ? ".card-uses li border-top-left-radius" : "no chips");
  const eyebrow = part(".card-title .eyebrow");
  if (eyebrow) {
    const eyebrowStyle = getComputedStyle(eyebrow);
    set("labelMono", f.monospace(eyebrowStyle.fontFamily, eyebrowStyle.fontWeight), ".card-title .eyebrow monospace by equal glyph widths");
    set("labelCase", f.textCase(eyebrow), ".card-title .eyebrow text-transform");
    set("labelTracking", f.tracking(eyebrow), ".card-title .eyebrow letter-spacing / font-size");
  }
  const visit = part(".card-visit");
  return { traits, notes: { border: f.color(style.borderTopColor), visitGlyph: visit ? f.color(getComputedStyle(visit).color) : null } };
}

async function reference() {
  const browser = await chromium.launch();
  try {
    for (const brand of brands) {
      const saved = join(ROOT, "reference", `${brand.slug}.json`);
      // A site that blocked automation is not asked again.
      if (existsSync(saved) && JSON.parse(readFileSync(saved, "utf8")).blocked) { console.log(`${brand.slug}: skipped, blocked before`); continue; }
      const capture = await captureSite(browser, brand, join(ROOT, "reference"));
      write(saved, capture);
      console.log(`${brand.slug}: ${capture.blocked ? `blocked (${capture.blocked})` : `${Object.keys(capture.traits).length} traits`}`);
    }
  } finally { await browser.close(); }
}

function serverProof(base) {
  const { port } = new URL(base);
  const pid = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], { encoding: "utf8" }).trim().split("\n")[0];
  const cwd = execFileSync("lsof", ["-a", "-p", pid, "-d", "cwd", "-Fn"], { encoding: "utf8" }).split("\n").find(line => line.startsWith("n"))?.slice(1);
  const commandLine = execFileSync("ps", ["-p", pid, "-o", "args="], { encoding: "utf8" }).trim();
  if (cwd !== process.cwd()) throw new Error(`Port ${port} is served from ${cwd}, not this checkout (${process.cwd()}).`);
  const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim();
  // A production server serves what `build` built; that build must be of this commit, from a clean tree.
  const built = existsSync(BUILD_STAMP) && commandLine.startsWith("next-server") ? JSON.parse(readFileSync(BUILD_STAMP, "utf8")) : undefined;
  if (built && (built.commit !== commit || built.uncommittedChanges !== "none")) throw new Error(`The build on port ${port} is of ${built.commit} (${built.uncommittedChanges}), not ${commit}.`);
  return { port, pid, cwd, command: commandLine, commit, uncommittedChanges: dirty || "none", build: built ?? "not a stamped production build" };
}

/** Builds the app for capture: the same fixture environment as the e2e server, so no dev-mode overlay is drawn, then stamps the commit built. */
function build() {
  const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim();
  if (dirty) throw new Error(`Commit first: a capture build must be of a commit.\n${dirty}`);
  execFileSync("npx", ["next", "build"], { stdio: "inherit", env: { ...process.env, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "", CLERK_SECRET_KEY: "", NEXT_PUBLIC_CONVEX_URL: "", PUBLIC_SITE_ORIGIN: "https://public.example" } });
  write(BUILD_STAMP, { commit, uncommittedChanges: "none", builtAt: new Date().toISOString() });
  console.log(`built ${commit}; serve it with: npx next start -p PORT -H 127.0.0.1 (with the same four variables empty and PUBLIC_SITE_ORIGIN set)`);
}

async function card() {
  const base = option("base"), label = option("label");
  if (!base || !label) throw new Error("card needs --base and --label");
  const proof = serverProof(base);
  write(join(ROOT, label, "server.json"), proof);
  const browser = await chromium.launch();
  try {
    for (const [kind, viewport] of Object.entries(WIDTHS)) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: "reduce" });
      const page = await context.newPage();
      await page.goto(base, { waitUntil: "load", timeout: NAVIGATION_TIMEOUT_MS });
      const carousel = page.getByRole("region", { name: "Product usage examples" });
      await carousel.getByRole("button", { name: "Pause slideshow" }).click({ timeout: 2_000 }).catch(() => undefined);
      // Every brand's toggle is in the chooser once the examples behind More examples are shown.
      await carousel.getByRole("button", { name: "More examples" }).click({ timeout: 2_000 }).catch(() => undefined);
      for (const brand of brands) {
        await carousel.getByRole("button", { name: brand.name, exact: true }).click();
        const article = carousel.getByRole("article", { name: `${brand.name} card` });
        await article.waitFor();
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(800);
        await article.screenshot({ path: join(ROOT, label, "card", `${brand.slug}-${viewport.width}.png`) });
        if (kind === "desktop") {
          await page.evaluate(PAGE_HELPERS);
          const measured = await article.evaluate(measureCard);
          write(join(ROOT, label, "card", `${brand.slug}.json`), { slug: brand.slug, name: brand.name, url: base, capturedAt: new Date().toISOString(), commit, ...measured });
        }
      }
      await context.close();
    }
  } finally { await browser.close(); }
  console.log(`cards captured from ${base} (pid ${proof.pid}, ${proof.cwd}) at ${commit}`);
}

function compare() {
  const label = option("label");
  const read = path => JSON.parse(readFileSync(path, "utf8"));
  const pairs = brands.filter(brand => existsSync(join(ROOT, "reference", `${brand.slug}.json`)) && existsSync(join(ROOT, label, "card", `${brand.slug}.json`)))
    .map(brand => ({ site: read(join(ROOT, "reference", `${brand.slug}.json`)), card: read(join(ROOT, label, "card", `${brand.slug}.json`)) }));
  const rows = pairs.flatMap(({ site, card }) => compareBrand(site, card));
  const cardCommit = pairs[0]?.card.commit ?? commit;
  write(join(ROOT, label, "rows.json"), rows);
  write(join(ROOT, label, "assertions.md"), assertionsMarkdown({ title: `Brand fidelity, ${label}`, commit: cardCommit, rows, sites: pairs.map(pair => pair.site) }));
  console.log(`${label}: ${rows.filter(row => row.result === "passed").length} passed, ${rows.filter(row => row.result === "failed").length} failed, ${rows.filter(row => row.result === "untested").length} untested`);
}

const PAIR_GAP = 24, PAIR_LABEL = 36, PAIR_SITE_WIDTH = { 1440: 960, 390: 390 };
const BACKDROP = { r: 128, g: 128, b: 128, alpha: 1 };

async function pairs() {
  const label = option("label");
  mkdirSync(join(ROOT, label, "pairs"), { recursive: true });
  for (const brand of brands) for (const width of [1440, 390]) {
    const sitePath = join(ROOT, "reference", `${brand.slug}-${width}.png`), cardPath = join(ROOT, label, "card", `${brand.slug}-${width}.png`);
    const referencePath = join(ROOT, "reference", `${brand.slug}.json`);
    const blocked = existsSync(referencePath) ? JSON.parse(readFileSync(referencePath, "utf8")).blocked : undefined;
    if (!existsSync(cardPath) || (!blocked && !existsSync(sitePath))) continue;
    const cardImage = await sharp(cardPath).toBuffer({ resolveWithObject: true });
    const cardCommit = JSON.parse(readFileSync(join(ROOT, label, "card", `${brand.slug}.json`), "utf8")).commit;
    // A site that answered with a block page is never shown: the card stands alone, captioned with why.
    if (blocked) {
      const note = `<svg width="${Math.max(cardImage.info.width, PAIR_SITE_WIDTH[1440])}" height="${PAIR_LABEL * 2}"><text x="4" y="24" font-family="Helvetica, Arial, sans-serif" font-size="18" fill="#fff">${brand.name}: no site beside it. ${brand.url} answered automation with ${blocked.replaceAll('"', "")}.</text><text x="4" y="58" font-family="Helvetica, Arial, sans-serif" font-size="18" fill="#fff">card only @ ${cardCommit.slice(0, 7)}, ${width}px</text></svg>`;
      await sharp({ create: { width: Math.max(cardImage.info.width, PAIR_SITE_WIDTH[1440]), height: cardImage.info.height + PAIR_LABEL * 2, channels: 4, background: BACKDROP } })
        .composite([{ input: Buffer.from(note), top: 0, left: 0 }, { input: cardImage.data, top: PAIR_LABEL * 2, left: 0 }])
        .png({ compressionLevel: 9, palette: true }).toFile(join(ROOT, label, "pairs", `${brand.slug}-${width}.png`));
      continue;
    }
    const site = await sharp(sitePath).resize({ width: PAIR_SITE_WIDTH[width] }).toBuffer({ resolveWithObject: true });
    const height = Math.max(site.info.height, cardImage.info.height) + PAIR_LABEL;
    const total = site.info.width + PAIR_GAP + cardImage.info.width;
    const caption = `<svg width="${total}" height="${PAIR_LABEL}"><text x="4" y="24" font-family="Helvetica, Arial, sans-serif" font-size="18" fill="#fff">${brand.name} site (${brand.url}) at ${width}px</text><text x="${site.info.width + PAIR_GAP + 4}" y="24" font-family="Helvetica, Arial, sans-serif" font-size="18" fill="#fff">card @ ${cardCommit.slice(0, 7)}</text></svg>`;
    await sharp({ create: { width: total, height, channels: 4, background: BACKDROP } })
      .composite([{ input: Buffer.from(caption), top: 0, left: 0 }, { input: site.data, top: PAIR_LABEL, left: 0 }, { input: cardImage.data, top: PAIR_LABEL, left: site.info.width + PAIR_GAP }])
      .png({ compressionLevel: 9, palette: true }).toFile(join(ROOT, label, "pairs", `${brand.slug}-${width}.png`));
  }
  console.log(`pairs written to ${join(ROOT, label, "pairs")}`);
}

const COMMANDS = { reference, build, card, compare, pairs };
if (!COMMANDS[command]) { console.error("Usage: node scripts/brand-fidelity.mjs reference|build|card|compare|pairs [--base URL] [--label NAME] [--only a,b]"); process.exit(1); }
mkdirSync(join(ROOT, "reference"), { recursive: true });
await COMMANDS[command]();

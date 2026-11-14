#!/usr/bin/env node
// Puts each homepage example card next to its product's own site and measures both the same way.
// A dev tool: it opens public sites, so it never runs in CI or npm test.
//
//   node scripts/brand-fidelity.mjs reference [--only spider,exa]
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
import { oklchChroma } from "../src/domain/oklab.ts";

const ROOT = resolve(".artifacts/brand-fidelity");
const BRANDS_DIR = resolve("src/data/homepage-brands");
const NAMES = {
  github: "GitHub", firecrawl: "Firecrawl", exa: "Exa", cloudflare: "Cloudflare", porkbun: "Porkbun", spider: "Spider",
  docker: "Docker", "open-places": "Open Places", elicit: "Elicit", "context-dev": "Context.dev", n8n: "n8n", clay: "Clay",
};
const WIDTHS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
const NAVIGATION_TIMEOUT_MS = 45_000;
const SETTLE_MS = 2_500;
/** Below this OKLCH chroma a colour is a grey for the purpose of picking a site's accent. */
const NEUTRAL_CHROMA = 0.04;
/** A site "uses monospace, uppercase labels" when at least this share of its small labels are. */
const LABEL_SHARE = 0.3;

const args = process.argv.slice(2);
const command = args[0];
const option = (name) => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
const only = option("only")?.split(",");
const brands = readdirSync(BRANDS_DIR).filter(file => file.endsWith(".json")).map(file => JSON.parse(readFileSync(join(BRANDS_DIR, file), "utf8")))
  .map(snapshot => ({ slug: snapshot.productSlug, name: NAMES[snapshot.productSlug], url: `https://${snapshot.canonicalDomain}/` }))
  .filter(brand => brand.name && (!only || only.includes(brand.slug)));
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const write = (path, value) => { mkdirSync(resolve(path, ".."), { recursive: true }); writeFileSync(path, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`); };

/** Runs in the page. Every CSS colour, whatever syntax the site authored it in, is read back through a canvas as sRGB. */
const PAGE_HELPERS = () => {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  window.__fidelity = {
    color(css) {
      if (!css || css === "transparent") return { transparent: true };
      context.clearRect(0, 0, 1, 1); context.fillStyle = "#000"; context.fillStyle = css; context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      if (a < 128) return { transparent: true };
      return { hex: `#${[r, g, b].map(v => v.toString(16).padStart(2, "0")).join("")}` };
    },
    visible(element) {
      const box = element.getBoundingClientRect(), style = getComputedStyle(element);
      return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth
        && style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity) > 0.05;
    },
    family(stack) {
      const families = stack.split(",").map(item => item.trim().replace(/^["']|["']$/g, ""));
      const name = families.find(item => !item.startsWith("PRBrand-")) ?? families[0];
      const generic = families.find(item => ["serif", "sans-serif", "monospace", "ui-monospace", "ui-serif", "ui-sans-serif", "system-ui"].includes(item.toLowerCase()));
      return { name, generic: generic ? generic.replace(/^ui-/, "").replace("system-ui", "sans-serif") : "unknown" };
    },
    monospace(stack, weight) {
      context.font = `${weight} 16px ${stack}`;
      return Math.abs(context.measureText("iiiiii").width - context.measureText("MMMMMM").width) < 1;
    },
    textHolder(element) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, { acceptNode: node => (node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP) });
      return walker.nextNode()?.parentElement ?? element;
    },
    chroma(hex) {
      const linear = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255).map(unit => (unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4));
      const lms = [[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566], [0.0883024619, 0.2817188376, 0.6299787005]]
        .map(row => Math.cbrt(row.reduce((sum, weight, index) => sum + weight * linear[index], 0)));
      const a = 1.9779984951 * lms[0] - 2.428592205 * lms[1] + 0.4505937099 * lms[2], b = 0.0259040371 * lms[0] + 0.7827717662 * lms[1] - 0.808675766 * lms[2];
      return Math.hypot(a, b);
    },
    contrast(first, second) {
      const luminance = hex => [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255)
        .map(unit => (unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4)).reduce((sum, value, index) => sum + [0.2126, 0.7152, 0.0722][index] * value, 0);
      const [high, low] = [luminance(first), luminance(second)].sort((a, b) => b - a);
      return (high + 0.05) / (low + 0.05);
    },
    radius(element) {
      const style = getComputedStyle(element), raw = style.borderTopLeftRadius, height = element.getBoundingClientRect().height;
      const px = raw.endsWith("%") ? (parseFloat(raw) / 100) * height : parseFloat(raw) || 0;
      return { px: Math.round(Math.min(px, height) * 100) / 100, heightPx: Math.round(height * 100) / 100 };
    },
    tracking(element) {
      const style = getComputedStyle(element);
      return style.letterSpacing === "normal" ? 0 : Math.round((parseFloat(style.letterSpacing) / parseFloat(style.fontSize)) * 1000) / 1000;
    },
    textCase(element) {
      const style = getComputedStyle(element), text = element.innerText.trim(), letters = text.replace(/[^\p{L}]/gu, "");
      return style.textTransform === "uppercase" || (letters.length >= 2 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()) ? "uppercase" : "as written";
    },
  };
};

/** Runs in the page: the raw traits of a product's own site, each with how it was located. */
function measureSite({ labelShare, neutralChroma }) {
  const f = window.__fidelity, all = selector => [...document.querySelectorAll(selector)].filter(f.visible);
  const traits = {}, notes = {};
  const set = (name, value, method) => { traits[name] = value === undefined ? { untested: method } : { value, method }; };
  const opaque = element => { for (let node = element; node; node = node.parentElement) { const color = f.color(getComputedStyle(node).backgroundColor); if (!color.transparent) return color; } return undefined; };
  const canvasColor = [document.body, document.documentElement].map(element => f.color(getComputedStyle(element).backgroundColor).hex).find(Boolean);
  const margins = [[0.02, 0.5], [0.98, 0.5], [0.02, 0.95]].map(([x, y]) => opaque(document.elementFromPoint(innerWidth * x, innerHeight * y))?.hex).filter(Boolean);
  const pageBackground = canvasColor ?? margins.sort((a, b) => margins.filter(v => v === b).length - margins.filter(v => v === a).length)[0] ?? "#ffffff";
  set("surface", { hex: pageBackground }, canvasColor ? "background-color of <body>, else <html>" : "most common opaque background behind three page-margin points (no opaque <body> or <html>)");
  const inChrome = element => Boolean(element.closest("header, nav, [role=banner], [role=navigation]"));
  const ownText = element => [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent.trim()).join(" ").trim();
  const prose = all("p").find(p => !inChrome(p) && p.innerText.trim().length >= 20)
    ?? all("div, span").find(element => !inChrome(element) && !element.closest("h1, h2, h3, a, button") && ownText(element).length >= 20);
  const proseMethod = "the first visible <p> with 20+ characters outside header/nav, else the first div/span with 20+ characters of its own text outside headings, links and header/nav";
  set("text", prose ? f.color(getComputedStyle(prose).color) : undefined, prose ? `colour of ${proseMethod}` : "no visible body text outside header/nav");
  if (prose) { const family = f.family(getComputedStyle(prose).fontFamily); set("bodyFamily", { family: family.name, generic: family.generic }, `font-family of ${proseMethod}`); }
  else set("bodyFamily", undefined, "no visible body text outside header/nav");
  const heading = all("h1")[0];
  if (heading) { const family = f.family(getComputedStyle(heading).fontFamily); set("headingFamily", { family: family.name, generic: family.generic }, "font-family of the first visible <h1>"); }
  else set("headingFamily", undefined, "no visible <h1> in the first viewport");

  const backdrop = element => (element.parentElement && opaque(element.parentElement)?.hex) ?? pageBackground;
  const candidates = all("a, button, [role=button], input[type=submit]").filter(element => {
    const box = element.getBoundingClientRect(), text = (element.innerText || element.value || "").trim();
    return box.width >= 60 && box.width <= 500 && box.height >= 28 && box.height <= 90 && text.length >= 2 && text.length <= 40 && text.split(/\s+/).length <= 6;
  }).map(element => {
    const style = getComputedStyle(element), fill = f.color(style.backgroundColor), border = f.color(style.borderTopColor);
    const behind = backdrop(element);
    return { element, style, fill, behind, outlined: parseFloat(style.borderTopWidth) >= 1 && !border.transparent && border.hex !== fill.hex && border.hex !== behind };
  }).sort((a, b) => Number(inChrome(a.element)) - Number(inChrome(b.element)) || a.element.getBoundingClientRect().top - b.element.getBoundingClientRect().top);
  const standOff = candidate => (candidate.fill.hex ? f.contrast(candidate.fill.hex, candidate.behind) : 1);
  const filled = candidates.filter(candidate => candidate.fill.hex && candidate.fill.hex !== candidate.behind);
  const outside = filled.filter(candidate => !inChrome(candidate.element));
  const pool = outside.length ? outside : filled, branded = pool.filter(candidate => f.chroma(candidate.fill.hex) >= neutralChroma);
  const primary = (branded.length ? branded : pool).reduce((best, candidate) => (!best || standOff(candidate) > standOff(best) ? candidate : best), undefined);
  const secondary = candidates.find(candidate => candidate !== primary && (candidate.outlined || (candidate.fill.hex && candidate.fill.hex !== candidate.behind)));
  const buttonMethod = "visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast)";
  if (primary) {
    const { element } = primary, labelled = f.textHolder(element), style = getComputedStyle(labelled), family = f.family(style.fontFamily);
    set("buttonFill", primary.fill, `${buttonMethod}: background-color ("${element.innerText.trim().slice(0, 30)}")`);
    set("buttonText", f.color(style.color), `${buttonMethod}: color of the element holding its label text`);
    set("buttonRadius", f.radius(element), `${buttonMethod}: border-top-left-radius`);
    set("buttonFamily", { family: family.name, generic: f.monospace(style.fontFamily, style.fontWeight) ? "monospace" : family.generic }, `${buttonMethod}: font-family (monospace by equal glyph widths)`);
    set("buttonCase", f.textCase(labelled), `${buttonMethod}: text-transform, or the label written in capitals`);
    set("buttonTracking", f.tracking(labelled), `${buttonMethod}: letter-spacing / font-size`);
  } else for (const name of ["buttonFill", "buttonText", "buttonRadius", "buttonFamily", "buttonCase", "buttonTracking"]) set(name, undefined, "no filled call-to-action in the first viewport");
  notes.secondary = secondary ? { text: secondary.element.innerText.trim().slice(0, 30), fill: secondary.fill, outlined: secondary.outlined, radius: f.radius(secondary.element), color: f.color(secondary.style.color).hex } : null;

  const accentCandidates = [];
  if (primary?.fill.hex) accentCandidates.push({ hex: primary.fill.hex, source: "primary call-to-action fill" });
  for (const link of all("a")) { const color = f.color(getComputedStyle(link).color); if (color.hex) accentCandidates.push({ hex: color.hex, source: "link text" }); }
  if (heading) {
    const base = f.color(getComputedStyle(heading).color).hex;
    for (const part of heading.querySelectorAll("*")) { const color = f.color(getComputedStyle(part).color); if (color.hex && color.hex !== base) accentCandidates.push({ hex: color.hex, source: "highlighted heading text" }); }
  }
  const logo = document.querySelector("header svg, nav svg, a[href='/'] svg");
  if (logo) for (const shape of logo.querySelectorAll("path, rect, circle, polygon")) {
    const style = getComputedStyle(shape);
    for (const paint of [style.fill, style.stroke]) { const color = f.color(paint); if (color.hex) accentCandidates.push({ hex: color.hex, source: "logo (inline svg in header)" }); }
  }
  notes.accentCandidates = accentCandidates;

  const radii = elements => elements.map(element => f.radius(element).px).sort((a, b) => a - b);
  const panels = all("div, section, article, aside, li, form, input, textarea, select").filter(element => {
    const box = element.getBoundingClientRect(), style = getComputedStyle(element);
    if (box.width * box.height < 4000 || box.width > innerWidth * 0.9 || candidates.some(candidate => candidate.element === element)) return false;
    const border = f.color(style.borderTopColor), fill = f.color(style.backgroundColor);
    return (parseFloat(style.borderTopWidth) >= 1 && border.hex && border.hex !== pageBackground) || (fill.hex && fill.hex !== pageBackground);
  });
  const panelRadii = radii(panels);
  if (panelRadii.length) set("panelRadius", { px: panelRadii[Math.floor(panelRadii.length / 2)] }, `median border-top-left-radius of ${panelRadii.length} visible bordered or filled boxes (4000px²+, under 90% of the width, not buttons)`);
  else set("panelRadius", undefined, "no bordered or filled box in the first viewport");
  notes.panelRadii = panelRadii;

  const labels = all("a, span, p, li, button, div, small, label").filter(element => {
    const own = [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent.trim()).join(" ").trim();
    return own.length >= 2 && own.length <= 30 && parseFloat(getComputedStyle(element).fontSize) <= 14;
  });
  if (labels.length) {
    const mono = labels.filter(element => f.monospace(getComputedStyle(element).fontFamily, getComputedStyle(element).fontWeight)).length;
    const upper = labels.filter(element => f.textCase(element) === "uppercase");
    const trackings = (upper.length ? upper : labels).map(element => f.tracking(element)).sort((a, b) => a - b);
    const method = `${labels.length} visible elements with 2-30 characters of their own text at 14px or smaller`;
    set("labelMono", mono / labels.length >= labelShare, `${method}: ${mono} monospace by equal glyph widths (share >= ${labelShare})`);
    set("labelCase", upper.length / labels.length >= labelShare ? "uppercase" : "as written", `${method}: ${upper.length} uppercase (share >= ${labelShare})`);
    set("labelTracking", trackings[Math.floor(trackings.length / 2)], `${method}: median letter-spacing / font-size of the ${upper.length ? "uppercase ones" : "labels"}`);
    notes.labelSamples = labels.slice(0, 12).map(element => element.innerText.trim().slice(0, 24));
  } else for (const name of ["labelMono", "labelCase", "labelTracking"]) set(name, undefined, "no small labels in the first viewport");
  return { traits, notes };
}

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
  set("accent", bar ? f.color(getComputedStyle(bar).backgroundColor) : undefined, bar ? "chart mark background-color" : "no chart");
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

// A challenge or block page's title. Matches "Just a moment..." and "Access denied"; leaves "Spider: The fastest web crawler" alone.
// https://regex101.com/?regex=just%20a%20moment%7Cattention%20required%7Caccess%20denied%7Cverify%20you%20are%20human%7Ccaptcha&flags=i&testString=Just%20a%20moment...%0AAccess%20denied%0ASpider
const CHALLENGE_TITLE = /just a moment|attention required|access denied|verify you are human|captcha/i;
// A cookie control we may press: plain decline or reject, nothing that grants consent. Matches "Reject all"; not "Accept" or "Manage".
// https://regex101.com/?regex=%5E%28decline%7Creject%29%28%20all%29%3F%24&flags=i&testString=Reject%20all%0AAccept%0AManage
const DECLINE = /^(decline|reject)( all)?$/i;

/** The browser's own link colours (unvisited, visited): a link left in them carries no brand. */
const UNSTYLED_LINK_COLORS = new Set(["#0000ee", "#551a8b"]);

function pickAccent(candidates) {
  const scored = candidates.filter(candidate => !(candidate.source === "link text" && UNSTYLED_LINK_COLORS.has(candidate.hex))).map(candidate => ({ ...candidate, chroma: oklchChroma(candidate.hex) })).filter(candidate => candidate.chroma >= NEUTRAL_CHROMA);
  return scored.sort((a, b) => b.chroma - a.chroma)[0];
}

async function reference() {
  const browser = await chromium.launch();
  try {
    for (const brand of brands) {
      const capture = { slug: brand.slug, name: brand.name, url: brand.url, capturedAt: new Date().toISOString(), traits: {} };
      for (const [kind, viewport] of Object.entries(WIDTHS)) {
        const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: "en-US" });
        const page = await context.newPage();
        try {
          const response = await page.goto(brand.url, { waitUntil: "load", timeout: NAVIGATION_TIMEOUT_MS });
          await page.waitForTimeout(SETTLE_MS);
          const title = await page.title();
          if ((response && response.status() >= 400) || CHALLENGE_TITLE.test(title)) { capture.blocked = `HTTP ${response?.status()} "${title}"`; }
          const decline = page.getByRole("button", { name: DECLINE });
          if (await decline.count()) { await decline.first().click({ timeout: 3_000 }).catch(() => undefined); capture.cookieDeclined = true; await page.waitForTimeout(500); }
          await page.evaluate(() => document.fonts.ready);
          await page.screenshot({ path: join(ROOT, "reference", `${brand.slug}-${viewport.width}.png`) });
          if (kind === "desktop" && !capture.blocked) {
            await page.evaluate(PAGE_HELPERS);
            const measured = await page.evaluate(measureSite, { labelShare: LABEL_SHARE, neutralChroma: NEUTRAL_CHROMA });
            capture.traits = measured.traits;
            capture.notes = measured.notes;
            const accent = pickAccent(measured.notes.accentCandidates);
            capture.traits.accent = accent
              ? { value: { hex: accent.hex, source: accent.source }, method: `most chromatic colour (OKLCH chroma ${accent.chroma.toFixed(3)}, greys under ${NEUTRAL_CHROMA} excluded) among the primary call-to-action fill, visible link text (not the browser's default link blue or purple), h1 descendants in another colour and inline-svg logo paint` }
              : { untested: "no chromatic colour on the primary call-to-action, links, heading highlights or an inline svg logo" };
            capture.finalUrl = page.url();
          }
        } catch (error) {
          capture.blocked ??= `navigation failed: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`;
        } finally { await context.close(); }
      }
      write(join(ROOT, "reference", `${brand.slug}.json`), capture);
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
  return { port, pid, cwd, command: commandLine, commit, uncommittedChanges: dirty || "none" };
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
    if (!existsSync(sitePath) || !existsSync(cardPath)) continue;
    const site = await sharp(sitePath).resize({ width: PAIR_SITE_WIDTH[width] }).toBuffer({ resolveWithObject: true });
    const cardImage = await sharp(cardPath).toBuffer({ resolveWithObject: true });
    const height = Math.max(site.info.height, cardImage.info.height) + PAIR_LABEL;
    const total = site.info.width + PAIR_GAP + cardImage.info.width;
    const caption = `<svg width="${total}" height="${PAIR_LABEL}"><text x="4" y="24" font-family="Helvetica, Arial, sans-serif" font-size="18" fill="#fff">${brand.name} site (${brand.url}) at ${width}px</text><text x="${site.info.width + PAIR_GAP + 4}" y="24" font-family="Helvetica, Arial, sans-serif" font-size="18" fill="#fff">card @ ${commit.slice(0, 7)}</text></svg>`;
    await sharp({ create: { width: total, height, channels: 4, background: BACKDROP } })
      .composite([{ input: Buffer.from(caption), top: 0, left: 0 }, { input: site.data, top: PAIR_LABEL, left: 0 }, { input: cardImage.data, top: PAIR_LABEL, left: site.info.width + PAIR_GAP }])
      .png({ compressionLevel: 9, palette: true }).toFile(join(ROOT, label, "pairs", `${brand.slug}-${width}.png`));
  }
  console.log(`pairs written to ${join(ROOT, label, "pairs")}`);
}

const COMMANDS = { reference, card, compare, pairs };
if (!COMMANDS[command]) { console.error("Usage: node scripts/brand-fidelity.mjs reference|card|compare|pairs [--base URL] [--label NAME] [--only a,b]"); process.exit(1); }
mkdirSync(join(ROOT, "reference"), { recursive: true });
await COMMANDS[command]();

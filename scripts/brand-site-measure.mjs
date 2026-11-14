// Measures a product's own site in a browser. One measurer serves both the fidelity check
// (scripts/brand-fidelity.mjs) and the homepage pull (scripts/pull-homepage-site-traits.mjs).
// It opens public sites, so it never runs in CI or npm test. The caller supplies the browser.
import { join } from "node:path";
import sharp from "sharp";
import { oklabDistance, oklchChroma } from "../src/domain/oklab.ts";

export const DESKTOP = { width: 1440, height: 900 };
export const PHONE = { width: 390, height: 844 };
const NAVIGATION_TIMEOUT_MS = 45_000;
const SETTLE_MS = 2_500;
const DECLINE_TIMEOUT_MS = 3_000;
const AFTER_DECLINE_MS = 500;
/** Below this OKLCH chroma a colour is a grey for the purpose of picking a site's accent. */
export const NEUTRAL_CHROMA = 0.04;
/** A site "uses monospace, uppercase labels" when at least this share of its small labels are. */
export const LABEL_SHARE = 0.3;
/** A backdrop at least this share of the viewport wide is full-bleed. */
const FULL_BLEED_SHARE = 0.9;
/** The hero is a colour when at least this share of the pixels beside its heading are that colour (OKLab within 0.05, the fidelity tolerance). */
const HERO_COLOUR_SHARE = 0.5;
const HERO_COLOUR_DISTANCE = 0.05;
/** Pixels of margin left around the heading box when sampling what is beside it. */
const HEADING_MARGIN_PX = 8;
const RGB_CHANNELS = 3, HEX_RADIX = 16, HEX_DIGITS = 2;

// A challenge or block page's title. Matches "Just a moment..." and "Access denied"; leaves "Spider: The fastest web crawler" alone.
// https://regex101.com/?regex=just%20a%20moment%7Cattention%20required%7Caccess%20denied%7Cverify%20you%20are%20human%7Ccaptcha&flags=i&testString=Just%20a%20moment...%0AAccess%20denied%0ASpider
const CHALLENGE_TITLE = /just a moment|attention required|access denied|verify you are human|captcha/i;
// A cookie control we may press: plain decline or reject, nothing that grants consent. Matches "Reject all"; not "Accept" or "Manage".
// https://regex101.com/?regex=%5E%28decline%7Creject%29%28%20all%29%3F%24&flags=i&testString=Reject%20all%0AAccept%0AManage
const DECLINE = /^(decline|reject)( all)?$/i;

/** Runs in the page. Every CSS colour, whatever syntax the site authored it in, is read back through a canvas as sRGB. */
export const PAGE_HELPERS = () => {
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
      // Text typed in capitals counts from four letters: "US" and "API" are abbreviations, not a choice of case.
      return style.textTransform === "uppercase" || (letters.length >= 4 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()) ? "uppercase" : "as written";
    },
  };
};

/**
 * Runs in the page: the raw traits of a product's own site, each with how it was located. `traits` feed the fidelity
 * check; `site` is the raw input the homepage pull turns into a stored site-traits file.
 */
export function measureSite({ labelShare, neutralChroma }) {
  const f = window.__fidelity, all = selector => [...document.querySelectorAll(selector)].filter(f.visible);
  const traits = {}, notes = {}, site = {};
  const set = (name, value, method) => { traits[name] = value === undefined ? { untested: method } : { value, method }; };
  const opaque = element => { for (let node = element; node; node = node.parentElement) { const color = f.color(getComputedStyle(node).backgroundColor); if (!color.transparent) return { ...color, node }; } return undefined; };
  const canvasColor = [document.body, document.documentElement].map(element => f.color(getComputedStyle(element).backgroundColor).hex).find(Boolean);
  const margins = [[0.02, 0.5], [0.98, 0.5], [0.02, 0.95]].map(([x, y]) => opaque(document.elementFromPoint(innerWidth * x, innerHeight * y))?.hex).filter(Boolean);
  const pageBackground = canvasColor ?? margins.sort((a, b) => margins.filter(v => v === b).length - margins.filter(v => v === a).length)[0] ?? "#ffffff";
  set("surface", { hex: pageBackground }, canvasColor ? "background-color of <body>, else <html>" : "most common opaque background behind three page-margin points (no opaque <body> or <html>)");
  site.surface = pageBackground;
  const inChrome = element => Boolean(element.closest("header, nav, [role=banner], [role=navigation]"));
  const ownText = element => [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent.trim()).join(" ").trim();

  // The site's text colour: of the colours carrying 20+ characters of plain text straight on the page background,
  // the one that stands off it most. A muted subtitle is by design the weaker one.
  const onSurface = new Map();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const holder = node.parentElement, characters = node.textContent.trim().length;
    if (!characters || !holder || !f.visible(holder) || inChrome(holder) || holder.closest("a, button, [role=button]")) continue;
    if ((opaque(holder)?.hex ?? pageBackground) !== pageBackground) continue;
    const color = f.color(getComputedStyle(holder).color).hex;
    if (color) onSurface.set(color, (onSurface.get(color) ?? 0) + characters);
  }
  const textMethod = "of the text colours carrying 20+ characters of visible text straight on the page background (outside header/nav, links and buttons), the one with the highest WCAG contrast against that background";
  const textColor = [...onSurface].filter(([, characters]) => characters >= 20).map(([hex]) => hex)
    .reduce((best, hex) => (!best || f.contrast(hex, pageBackground) > f.contrast(best, pageBackground) ? hex : best), undefined);
  set("text", textColor ? { hex: textColor } : undefined, textColor ? textMethod : "no 20+ characters of plain text straight on the page background");
  site.text = textColor;
  notes.textOnSurface = Object.fromEntries(onSurface);

  const prose = all("p").find(p => !inChrome(p) && p.innerText.trim().length >= 20)
    ?? all("div, span").find(element => !inChrome(element) && !element.closest("h1, h2, h3, a, button") && ownText(element).length >= 20);
  const proseMethod = "the first visible <p> with 20+ characters outside header/nav, else the first div/span with 20+ characters of its own text outside headings, links and header/nav";
  const fontOf = element => { const family = f.family(getComputedStyle(element).fontFamily); return { family: family.name, generic: family.generic }; };
  if (prose) { set("bodyFamily", fontOf(prose), `font-family of ${proseMethod}`); site.bodyFont = fontOf(prose); }
  else set("bodyFamily", undefined, "no visible body text outside header/nav");
  const heading = all("h1")[0];
  if (heading) { set("headingFamily", fontOf(heading), "font-family of the first visible <h1>"); site.headingFont = fontOf(heading); }
  else set("headingFamily", undefined, "no visible <h1> in the first viewport");

  const backdrop = element => (element.parentElement && opaque(element.parentElement)?.hex) ?? pageBackground;
  const candidates = all("a, button, [role=button], input[type=submit]").filter(element => {
    const box = element.getBoundingClientRect(), text = (element.innerText || element.value || "").trim();
    return box.width >= 60 && box.width <= 500 && box.height >= 28 && box.height <= 90 && text.length >= 2 && text.length <= 40 && text.split(/\s+/).length <= 6;
  }).map(element => {
    const style = getComputedStyle(element), fill = f.color(style.backgroundColor), border = f.color(style.borderTopColor);
    const behind = backdrop(element);
    return { element, style, fill, border, behind, outlined: parseFloat(style.borderTopWidth) >= 1 && !border.transparent && border.hex !== fill.hex && border.hex !== behind };
  }).sort((a, b) => Number(inChrome(a.element)) - Number(inChrome(b.element)) || a.element.getBoundingClientRect().top - b.element.getBoundingClientRect().top);
  const standOff = candidate => (candidate.fill.hex ? f.contrast(candidate.fill.hex, candidate.behind) : 1);
  const filled = candidates.filter(candidate => candidate.fill.hex && candidate.fill.hex !== candidate.behind);
  const outside = filled.filter(candidate => !inChrome(candidate.element));
  const pool = outside.length ? outside : filled, branded = pool.filter(candidate => f.chroma(candidate.fill.hex) >= neutralChroma);
  const primary = (branded.length ? branded : pool).reduce((best, candidate) => (!best || standOff(candidate) > standOff(best) ? candidate : best), undefined);
  const secondary = candidates.find(candidate => candidate !== primary && (candidate.outlined || (candidate.fill.hex && candidate.fill.hex !== candidate.behind)));
  const buttonMethod = "visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast)";
  const buttonFont = style => { const family = f.family(style.fontFamily); return { family: family.name, generic: f.monospace(style.fontFamily, style.fontWeight) ? "monospace" : family.generic }; };
  const buttonTraits = candidate => {
    const labelled = f.textHolder(candidate.element), style = getComputedStyle(labelled), radius = f.radius(candidate.element);
    return {
      text: candidate.element.innerText.trim().slice(0, 30), fill: candidate.fill.hex, label: f.color(style.color).hex, border: candidate.outlined ? candidate.border.hex : undefined,
      radiusPx: radius.px, heightPx: radius.heightPx, font: buttonFont(style), case: f.textCase(labelled), trackingEm: f.tracking(labelled),
    };
  };
  if (primary) {
    const measured = buttonTraits(primary);
    set("buttonFill", primary.fill, `${buttonMethod}: background-color ("${measured.text}")`);
    set("buttonText", { hex: measured.label }, `${buttonMethod}: color of the element holding its label text`);
    set("buttonRadius", { px: measured.radiusPx, heightPx: measured.heightPx }, `${buttonMethod}: border-top-left-radius`);
    set("buttonFamily", measured.font, `${buttonMethod}: font-family (monospace by equal glyph widths)`);
    set("buttonCase", measured.case, `${buttonMethod}: text-transform, or the label written in capitals`);
    set("buttonTracking", measured.trackingEm, `${buttonMethod}: letter-spacing / font-size`);
    site.primaryButton = measured;
  } else for (const name of ["buttonFill", "buttonText", "buttonRadius", "buttonFamily", "buttonCase", "buttonTracking"]) set(name, undefined, "no filled call-to-action in the first viewport");
  if (secondary) site.secondaryButton = buttonTraits(secondary);
  notes.secondary = secondary ? { text: secondary.element.innerText.trim().slice(0, 30), fill: secondary.fill, outlined: secondary.outlined, radius: f.radius(secondary.element), color: f.color(secondary.style.color).hex } : null;

  const accentCandidates = [];
  if (primary?.fill.hex) accentCandidates.push({ hex: primary.fill.hex, source: "primary call-to-action fill" });
  for (const link of all("a")) { const color = f.color(getComputedStyle(link).color); if (color.hex) accentCandidates.push({ hex: color.hex, source: "link text" }); }
  const highlights = [];
  if (heading) {
    const base = f.color(getComputedStyle(heading).color).hex;
    for (const part of heading.querySelectorAll("*")) { const color = f.color(getComputedStyle(part).color); if (color.hex && color.hex !== base) highlights.push(color.hex); }
  }
  for (const hex of highlights) accentCandidates.push({ hex, source: "highlighted heading text" });
  const logoPaint = [];
  const logo = document.querySelector("header svg, nav svg, a[href='/'] svg");
  if (logo) for (const shape of logo.querySelectorAll("path, rect, circle, polygon")) {
    const style = getComputedStyle(shape);
    for (const paint of [style.fill, style.stroke]) { const color = f.color(paint); if (color.hex) logoPaint.push(color.hex); }
  }
  for (const hex of logoPaint) accentCandidates.push({ hex, source: "logo (inline svg in header)" });
  notes.accentCandidates = accentCandidates;
  // The signature colour's candidates are the brief's list: the call-to-action, heading highlights and logo. The hero's colour joins in Node, once its pixels are read.
  site.signatureCandidates = [
    ...(primary?.fill.hex ? [{ hex: primary.fill.hex, from: "primary call-to-action" }] : []),
    ...highlights.map(hex => ({ hex, from: "heading highlight" })),
    ...logoPaint.map(hex => ({ hex, from: "logo" })),
  ];

  // The backdrop behind the first heading: its nearest ancestor with an opaque background, unless that is the page itself.
  if (heading) {
    const behind = opaque(heading), box = heading.getBoundingClientRect();
    const own = behind && behind.node !== document.body && behind.node !== document.documentElement && behind.hex !== pageBackground;
    const area = own ? behind.node.getBoundingClientRect() : undefined;
    site.hero = own
      ? { hex: behind.hex, widthShare: Math.round((area.width / innerWidth) * 1000) / 1000, heading: { x: box.left, y: box.top, width: box.width, height: box.height } }
      : { hex: undefined, widthShare: 0 };
  }

  const radii = elements => elements.map(element => f.radius(element).px).sort((a, b) => a - b);
  const panels = all("div, section, article, aside, li, form, input, textarea, select").filter(element => {
    const box = element.getBoundingClientRect(), style = getComputedStyle(element);
    if (box.width * box.height < 4000 || box.width > innerWidth * 0.9 || candidates.some(candidate => candidate.element === element)) return false;
    const border = f.color(style.borderTopColor), fill = f.color(style.backgroundColor);
    return (parseFloat(style.borderTopWidth) >= 1 && border.hex && border.hex !== pageBackground) || (fill.hex && fill.hex !== pageBackground);
  });
  const panelRadii = radii(panels);
  if (panelRadii.length) {
    const median = panelRadii[Math.floor(panelRadii.length / 2)];
    set("panelRadius", { px: median }, `median border-top-left-radius of ${panelRadii.length} visible bordered or filled boxes (4000px²+, under 90% of the width, not buttons)`);
    site.panelRadiusPx = median;
  } else set("panelRadius", undefined, "no bordered or filled box in the first viewport");
  notes.panelRadii = panelRadii;

  const labels = all("a, span, p, li, button, div, small, label").filter(element => {
    const own = [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent.trim()).join(" ").trim();
    return own.length >= 2 && own.length <= 30 && parseFloat(getComputedStyle(element).fontSize) <= 14;
  });
  if (labels.length) {
    const monospaced = labels.filter(element => f.monospace(getComputedStyle(element).fontFamily, getComputedStyle(element).fontWeight));
    const upper = labels.filter(element => f.textCase(element) === "uppercase");
    const method = `${labels.length} visible elements with 2-30 characters of their own text at 14px or smaller`;
    const mono = monospaced.length / labels.length >= labelShare, labelCase = upper.length / labels.length >= labelShare ? "uppercase" : "as written";
    // The letter-spacing of the labels set in the case the site's labels are counted as.
    const trackings = labels.filter(element => f.textCase(element) === labelCase).map(element => f.tracking(element)).sort((a, b) => a - b);
    const tracking = trackings[Math.floor(trackings.length / 2)];
    set("labelMono", mono, `${method}: ${monospaced.length} monospace by equal glyph widths (share >= ${labelShare})`);
    set("labelCase", labelCase, `${method}: ${upper.length} uppercase (share >= ${labelShare})`);
    set("labelTracking", tracking, `${method}: median letter-spacing / font-size of the ${labelCase === "uppercase" ? "uppercase ones" : "ones as written"}`);
    // The family most of the labels are set in: among the monospace ones when the labels count as monospace.
    const counted = (mono ? monospaced : labels).map(element => f.family(getComputedStyle(element).fontFamily))
      .reduce((counts, family) => counts.set(family.name, { family, count: (counts.get(family.name)?.count ?? 0) + 1 }), new Map());
    const common = [...counted.values()].sort((a, b) => b.count - a.count)[0].family;
    site.labels = { font: { family: common.name, generic: mono ? "monospace" : common.generic }, case: labelCase, trackingEm: tracking };
    notes.labelSamples = labels.slice(0, 12).map(element => element.innerText.trim().slice(0, 24));
  } else for (const name of ["labelMono", "labelCase", "labelTracking"]) set(name, undefined, "no small labels in the first viewport");
  return { traits, notes, site };
}

/** The browser's own link colours (unvisited, visited): a link left in them carries no brand. */
const UNSTYLED_LINK_COLORS = new Set(["#0000ee", "#551a8b"]);

export function pickAccent(candidates) {
  const scored = candidates.filter(candidate => !(candidate.source === "link text" && UNSTYLED_LINK_COLORS.has(candidate.hex))).map(candidate => ({ ...candidate, chroma: oklchChroma(candidate.hex) })).filter(candidate => candidate.chroma >= NEUTRAL_CHROMA);
  return scored.sort((a, b) => b.chroma - a.chroma)[0];
}

const hexOf = (red, green, blue) => `#${[red, green, blue].map(value => value.toString(HEX_RADIX).padStart(HEX_DIGITS, "0")).join("")}`;

/**
 * Whether a full-bleed backdrop reads as a colour or as an image, from the screenshot: the share of pixels in the
 * heading's band of the page, beside the heading itself, that are the backdrop's colour.
 */
async function heroKind(screenshot, hero) {
  const { data, info } = await sharp(screenshot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const top = Math.max(0, Math.round(hero.heading.y)), bottom = Math.min(info.height, Math.round(hero.heading.y + hero.heading.height));
  const left = Math.round(hero.heading.x) - HEADING_MARGIN_PX, right = Math.round(hero.heading.x + hero.heading.width) + HEADING_MARGIN_PX;
  const columns = Array.from({ length: info.width }, (_, x) => x).filter(x => x < left || x > right);
  const rows = Array.from({ length: Math.max(0, bottom - top) }, (_, offset) => top + offset);
  const samples = rows.flatMap(y => columns.map(x => (y * info.width + x) * RGB_CHANNELS));
  const matching = samples.filter(at => oklabDistance(hexOf(data[at], data[at + 1], data[at + 2]), hero.hex) <= HERO_COLOUR_DISTANCE).length;
  const share = samples.length ? Math.round((matching / samples.length) * 1000) / 1000 : 0;
  return { kind: share >= HERO_COLOUR_SHARE ? "colour" : "image", colourShare: share };
}

/**
 * Opens one product's site at desktop and phone widths, screenshots both into `directory`, and measures it at desktop.
 * Sends the page request and nothing else of its own; a cookie banner is dismissed only through a plain decline control.
 */
export async function captureSite(browser, brand, directory) {
  const capture = { slug: brand.slug, name: brand.name, url: brand.url, capturedAt: new Date().toISOString(), viewport: DESKTOP, traits: {} };
  for (const viewport of [DESKTOP, PHONE]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: "en-US" });
    const page = await context.newPage();
    try {
      const response = await page.goto(brand.url, { waitUntil: "load", timeout: NAVIGATION_TIMEOUT_MS });
      await page.waitForTimeout(SETTLE_MS);
      const title = await page.title();
      if ((response && response.status() >= 400) || CHALLENGE_TITLE.test(title)) capture.blocked = `HTTP ${response?.status()} "${title}"`;
      const decline = page.getByRole("button", { name: DECLINE });
      if (await decline.count()) { await decline.first().click({ timeout: DECLINE_TIMEOUT_MS }).catch(() => undefined); capture.cookieDeclined = true; await page.waitForTimeout(AFTER_DECLINE_MS); }
      await page.evaluate(() => document.fonts.ready);
      const screenshot = await page.screenshot({ path: join(directory, `${brand.slug}-${viewport.width}.png`) });
      if (viewport === DESKTOP && !capture.blocked) {
        await page.evaluate(PAGE_HELPERS);
        const measured = await page.evaluate(measureSite, { labelShare: LABEL_SHARE, neutralChroma: NEUTRAL_CHROMA });
        capture.traits = measured.traits;
        capture.notes = measured.notes;
        capture.site = measured.site;
        const hero = measured.site.hero;
        if (hero?.hex && hero.widthShare >= FULL_BLEED_SHARE) Object.assign(hero, { fullBleed: true }, await heroKind(screenshot, hero));
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
  return capture;
}

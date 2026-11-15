import { expect, test } from "vitest";
import { brandSiteTraitsFromMeasurement, brandSiteTraitsSchema, signatureColour, type SiteMeasurement } from "./brand-site-traits";

/** Spider's measured 2026-11-14: a 48px-tall square button, labels tracked 0.14em, at a 1440x900 viewport. */
const DESKTOP_WIDTH = 1440, DESKTOP_HEIGHT = 900, SPIDER_TRACKING_EM = 0.14, SPIDER_BUTTON_HEIGHT_PX = 48;
/** A 21px radius on a 42px-tall button is a pill; a 3em letter-spacing and a -4px radius are out of range. */
const PILL_RADIUS_PX = 21, PILL_HEIGHT_PX = 42, OUT_OF_RANGE_TRACKING_EM = 3, NEGATIVE_RADIUS_PX = -4;
const META = { productSlug: "spider", canonicalDomain: "spider.cloud", measuredAt: "2026-11-14T18:00:00.000Z", url: "https://spider.cloud/", viewport: { width: DESKTOP_WIDTH, height: DESKTOP_HEIGHT } };
const SPIDER: SiteMeasurement = {
  surface: "#0c0e13", text: "#f8fafc",
  headingFont: { family: "Fraunces Variable", generic: "serif" }, bodyFont: { family: "Inter Variable", generic: "sans-serif" },
  labels: { font: { family: "Berkeley", generic: "monospace" }, case: "uppercase", trackingEm: SPIDER_TRACKING_EM },
  primaryButton: { fill: "#f8fafc", label: "#0c0e13", radiusPx: 0, heightPx: SPIDER_BUTTON_HEIGHT_PX, font: { family: "Berkeley", generic: "monospace" }, case: "uppercase", trackingEm: SPIDER_TRACKING_EM },
  secondaryButton: { label: "#94a3b8", border: "#414a58", radiusPx: 0, heightPx: SPIDER_BUTTON_HEIGHT_PX, font: { family: "Berkeley", generic: "monospace" }, case: "uppercase", trackingEm: SPIDER_TRACKING_EM },
  panelRadiusPx: 0,
  signatureCandidates: [{ hex: "#f8fafc", from: "primary call-to-action" }, { hex: "#3bde77", from: "heading highlight" }, { hex: "#24c45c", from: "logo" }],
  hero: { hex: undefined, fullBleed: false },
};

test("a page measurement becomes a stored file of typed traits, each with where it was found", () => {
  expect(brandSiteTraitsFromMeasurement(META, SPIDER)).toEqual({
    schemaVersion: 1, ...META,
    traits: {
      surface: { value: "#0c0e13", from: "page background" },
      text: { value: "#f8fafc", from: "text on the page background" },
      headingFont: { value: { family: "Fraunces Variable", generic: "serif" }, from: "first heading" },
      bodyFont: { value: { family: "Inter Variable", generic: "sans-serif" }, from: "first paragraph" },
      labelFont: { value: { family: "Berkeley", generic: "monospace" }, from: "small labels" },
      labelCase: { value: "uppercase", from: "small labels" },
      labelTrackingEm: { value: SPIDER_TRACKING_EM, from: "small labels" },
      primaryButton: { value: { fill: "#f8fafc", text: "#0c0e13", radius: { px: 0, pill: false }, font: { family: "Berkeley", generic: "monospace" }, case: "uppercase", trackingEm: SPIDER_TRACKING_EM }, from: "primary call-to-action" },
      secondaryButton: { value: { text: "#94a3b8", border: "#414a58", radius: { px: 0, pill: false }, font: { family: "Berkeley", generic: "monospace" }, case: "uppercase", trackingEm: SPIDER_TRACKING_EM }, from: "secondary call-to-action" },
      panelRadiusPx: { value: 0, from: "bordered panels" },
      signature: { value: "#3bde77", from: "heading highlight" },
      hero: { value: { kind: "none" }, from: "backdrop behind the first heading" },
    },
  });
});

test("a value that is not a plain colour, number, name or enumeration is dropped alone", () => {
  const traits = brandSiteTraitsFromMeasurement(META, {
    surface: "rgb(0, 0, 0)", text: "#F8FAFC", labels: { font: { family: "Inter\", sans-serif; x: url(a)", generic: "sans-serif" }, case: "constructor", trackingEm: OUT_OF_RANGE_TRACKING_EM },
    primaryButton: { fill: "javascript:alert(1)", label: "#000000", radiusPx: PILL_RADIUS_PX, heightPx: PILL_HEIGHT_PX }, panelRadiusPx: NEGATIVE_RADIUS_PX,
  }).traits;
  expect(traits).toEqual({
    text: { value: "#f8fafc", from: "text on the page background" },
    labelFont: { value: { generic: "sans-serif" }, from: "small labels" },
    primaryButton: { value: { text: "#000000", radius: { px: PILL_RADIUS_PX, pill: true } }, from: "primary call-to-action" },
  });
});

test("a full-bleed colour hero is stored with its colour and can be the signature; a narrower backdrop is no hero", () => {
  const clay = brandSiteTraitsFromMeasurement({ ...META, productSlug: "clay", canonicalDomain: "clay.com", url: "https://clay.com/" }, {
    signatureCandidates: [{ hex: "#000000", from: "logo" }], hero: { hex: "#035d44", fullBleed: true, kind: "colour" },
  }).traits;
  expect(clay.hero).toEqual({ value: { kind: "colour", hex: "#035d44" }, from: "backdrop behind the first heading" });
  expect(clay.signature).toEqual({ value: "#035d44", from: "hero" });
  expect(brandSiteTraitsFromMeasurement(META, { hero: { hex: "#0f1117", fullBleed: false } }).traits.hero).toEqual({ value: { kind: "none" }, from: "backdrop behind the first heading" });
  expect(brandSiteTraitsFromMeasurement(META, { hero: { hex: "#035d44", fullBleed: true, kind: "image" } }).traits).toEqual({ hero: { value: { kind: "image", hex: "#035d44" }, from: "backdrop behind the first heading" } });
});

test("the signature is the most colourful candidate, greys never count and the earlier of two equals wins", () => {
  expect(signatureColour([{ hex: "#cbd810", from: "primary call-to-action" }, { hex: "#035d44", from: "hero" }])).toEqual({ hex: "#cbd810", from: "primary call-to-action" });
  expect(signatureColour([{ hex: "#94a3b8", from: "primary call-to-action" }, { hex: "#ffffff", from: "logo" }])).toBe(undefined);
  expect(signatureColour([{ hex: "#2560ff", from: "primary call-to-action" }, { hex: "#2560ff", from: "logo" }])).toEqual({ hex: "#2560ff", from: "primary call-to-action" });
});

test("a stored file must name the root of its own canonical domain and nothing else", () => {
  const file = brandSiteTraitsFromMeasurement(META, {});
  expect(brandSiteTraitsSchema.safeParse({ ...file, url: "https://spider.cloud/pricing" }).success).toBe(false);
  expect(brandSiteTraitsSchema.safeParse({ ...file, url: "http://spider.cloud/" }).success).toBe(false);
  expect(brandSiteTraitsSchema.safeParse({ ...file, traits: { css: "color: red" } }).success).toBe(false);
  expect(brandSiteTraitsSchema.safeParse(file).success).toBe(true);
});

/** Cloudflare's orange hero is a rounded slab inset from the page edge; Clay's runs flush. */
const INSET_HERO_RADIUS_PX = 12;
test("a colour hero keeps the radius of its slab, so an inset, rounded hero reads apart from a flush one", () => {
  const traits = (hero: SiteMeasurement["hero"]) => brandSiteTraitsFromMeasurement(META, { hero }).traits.hero?.value;
  expect(traits({ hex: "#ff5e1f", widthShare: 0.989, kind: "colour", radiusPx: INSET_HERO_RADIUS_PX })).toEqual({ kind: "colour", hex: "#ff5e1f", radiusPx: INSET_HERO_RADIUS_PX });
  expect(traits({ hex: "#035d44", widthShare: 1, kind: "colour", radiusPx: 0 })).toEqual({ kind: "colour", hex: "#035d44", radiusPx: 0 });
  expect(traits({ hex: "#035d44", widthShare: 1, kind: "colour", radiusPx: NEGATIVE_RADIUS_PX })).toEqual({ kind: "colour", hex: "#035d44" });
});

/** Panel areas in square pixels: many small square-cornered boxes, and fewer big rounded cards. */
const SMALL_BOX_AREA = 30_000, CARD_AREA = 90_000, DOCKER_CARD_RADIUS_PX = 18, DOCKER_TILE_RADIUS_PX = 10;
test("a site's panel radius is the one its panels cover the most area with, so a few big cards outweigh many small boxes", () => {
  const radius = (raw: SiteMeasurement) => brandSiteTraitsFromMeasurement(META, raw).traits.panelRadiusPx?.value;
  expect(radius({ panels: [
    ...Array.from({ length: 6 }, () => ({ px: 0, area: SMALL_BOX_AREA })),
    ...Array.from({ length: 3 }, () => ({ px: DOCKER_CARD_RADIUS_PX, area: CARD_AREA })),
    { px: DOCKER_TILE_RADIUS_PX, area: SMALL_BOX_AREA },
  ] })).toBe(DOCKER_CARD_RADIUS_PX);
  // An older capture with only the modal radius keeps it.
  expect(radius({ panelRadiusPx: 0 })).toBe(0);
});

/** Firecrawl's page is ruled into 101px columns by tall 1px lines in #ededed, from x = 63 to 1377. */
const FIRECRAWL_RULES = [63, 164, 265, 366, 1074, 1175, 1276, 1377] as const;
const FIRECRAWL_PITCH_PX = 101;
test("a page ruled into even columns by tall lines stores that grid as its surface pattern", () => {
  const pattern = (raw: SiteMeasurement) => brandSiteTraitsFromMeasurement(META, raw).traits.surfacePattern;
  const rules = FIRECRAWL_RULES.map(x => ({ x, hex: "#EDEDED" }));
  expect(pattern({ verticalRules: rules })).toEqual({ value: { kind: "grid", pitchPx: FIRECRAWL_PITCH_PX, line: "#ededed" }, from: "ruled columns" });
  // Two lines framing a column are a frame, not a grid; a gradient pattern, where there is one, wins.
  expect(pattern({ verticalRules: [{ x: 164, hex: "#ededed" }, { x: 1276, hex: "#ededed" }] })).toBeUndefined();
  expect(pattern({ verticalRules: rules, surfacePattern: { kind: "dots", pitchPx: 8, line: "#dddddd" } })?.from).toBe("second large surface");
});

/** Areas in square pixels, as measured 2026-11-15: n8n's dark band far down its page and its light second surface; Docker's terminal panel. */
const N8N_DARK_BAND = 2_692_853, N8N_LIGHT_SURFACE = 952_440, DOCKER_PANEL = 608_278, FIRST_SCREEN_PANEL = 200_000;
const OPEN_PLACES_SIDEBAR = 139_000, OPEN_PLACES_MAP = 125_000, OPEN_PLACES_WHITE_TABLES = 551_805, OPEN_PLACES_WHITE_SLIVER = 546;
test("the second surface is the one the first screen shows most of; a dark band far down a light page is no inverse panel, one in the first screen or under a dark hero is; a sidebar menu is chrome", () => {
  const second = (raw: SiteMeasurement) => { const traits = brandSiteTraitsFromMeasurement(META, { surface: "#fafafa", text: "#161616", ...raw }).traits; return [traits.panelFill?.value, traits.inversePanel?.value.fill]; };
  expect(second({ surfaces: [
    { hex: "#212121", area: N8N_DARK_BAND, firstScreenArea: 0, chromeArea: 0, ink: "#fafafa" },
    { hex: "#f0f0f0", area: N8N_LIGHT_SURFACE, firstScreenArea: 0, chromeArea: 0 },
  ] })).toEqual(["#f0f0f0", undefined]);
  expect(second({ surfaces: [{ hex: "#212121", area: N8N_DARK_BAND, firstScreenArea: FIRST_SCREEN_PANEL, chromeArea: 0, ink: "#fafafa" }] })).toEqual([undefined, "#212121"]);
  expect(brandSiteTraitsFromMeasurement(META, {
    surface: "#f9fafb", text: "#000000", hero: { hex: "#0f1117", widthShare: 1, kind: "colour" },
    surfaces: [{ hex: "#0e1217", area: DOCKER_PANEL, firstScreenArea: 0, chromeArea: 0, ink: "#d6dce6" }],
  }).traits.inversePanel?.value).toEqual({ fill: "#0e1217", text: "#d6dce6" });
  expect(brandSiteTraitsFromMeasurement(META, { surface: "#f7f5ef", text: "#23261f", surfaces: [
    { hex: "#ffffff", area: OPEN_PLACES_SIDEBAR, firstScreenArea: OPEN_PLACES_SIDEBAR, chromeArea: OPEN_PLACES_SIDEBAR },
    { hex: "#eef6e3", area: OPEN_PLACES_MAP, firstScreenArea: OPEN_PLACES_MAP, chromeArea: 0 },
  ] }).traits.panelFill?.value).toBe("#eef6e3");
  // Open Places, measured 2026-11-15: its white tables cover more of the page, but its pale green map panel is what the first screen shows.
  expect(brandSiteTraitsFromMeasurement(META, { surface: "#f7f5ef", text: "#23261f", surfaces: [
    { hex: "#ffffff", area: OPEN_PLACES_WHITE_TABLES, firstScreenArea: OPEN_PLACES_WHITE_SLIVER, chromeArea: 0 },
    { hex: "#eef6e3", area: OPEN_PLACES_MAP, firstScreenArea: OPEN_PLACES_MAP, chromeArea: 0 },
  ] }).traits.panelFill?.value).toBe("#eef6e3");
});

/** Open Places' 591 is 52px on a yellow highlight in its first screen; a 64px figure sits far down; a 12.5px caption figure is no number. */
const SMALL_FIGURE_PX = 12.5, OPEN_PLACES_FIGURE_PX = 52, FAR_FIGURE_PX = 64, FIRST_SCREEN_TOP = 380, FAR_TOP = 2_400, CAPTION_TOP = 90;
test("the site's number is its largest figure of 20px or more in the first screen, else anywhere, with the highlight that hugs it", () => {
  const number = (figures: SiteMeasurement["figures"]) => {
    const traits = brandSiteTraitsFromMeasurement(META, { figures }).traits;
    return [traits.numberColour?.value, traits.numberBackdrop?.value, traits.numberFont?.value.generic];
  };
  expect(number([
    { sizePx: FAR_FIGURE_PX, colour: "#676b5f", top: FAR_TOP, font: { generic: "sans-serif" } },
    { sizePx: OPEN_PLACES_FIGURE_PX, colour: "#5c480a", top: FIRST_SCREEN_TOP, font: { family: "Geist Mono", generic: "monospace" }, backdrop: "#f7e7a1" },
    { sizePx: SMALL_FIGURE_PX, colour: "#676b5f", top: CAPTION_TOP, font: { generic: "sans-serif" } },
  ])).toEqual(["#5c480a", "#f7e7a1", "monospace"]);
  expect(number([{ sizePx: FAR_FIGURE_PX, colour: "#000000", top: FAR_TOP, font: { generic: "sans-serif" } }, { sizePx: SMALL_FIGURE_PX, colour: "#2560ff", top: CAPTION_TOP, font: { generic: "sans-serif" } }]))
    .toEqual(["#000000", undefined, "sans-serif"]);
  expect(number([{ sizePx: SMALL_FIGURE_PX, colour: "#676b5f", top: CAPTION_TOP, font: { generic: "sans-serif" } }])).toEqual([undefined, undefined, undefined]);
});

/** Spider, measured 2026-11-15: nine white-outlined links and buttons, and nine lines of 20% white between its parts. */
const SPIDER_RULE_COUNT = 9;
test("the page's rule is its commonest layout border: outlined links and buttons are controls, not rules", () => {
  expect(brandSiteTraitsFromMeasurement(META, { ruleCensus: [
    { style: "solid", hex: "#f8fafc", kind: "control", count: SPIDER_RULE_COUNT },
    { style: "solid", hex: "#3a3c41", kind: "layout", count: SPIDER_RULE_COUNT },
  ] }).traits.rule?.value).toEqual({ style: "solid", hex: "#3a3c41" });
});

const N8N_DOT_PITCH_PX = 24;
test("a pattern found only below the first screen is not the site's surface pattern", () => {
  expect(brandSiteTraitsFromMeasurement(META, { surfacePattern: { kind: "dots", pitchPx: N8N_DOT_PITCH_PX, line: "#303030", firstScreen: false } }).traits.surfacePattern).toBeUndefined();
  expect(brandSiteTraitsFromMeasurement(META, { surfacePattern: { kind: "dots", pitchPx: N8N_DOT_PITCH_PX, line: "#e4e4e4", firstScreen: true } }).traits.surfacePattern?.value)
    .toEqual({ kind: "dots", pitchPx: N8N_DOT_PITCH_PX, line: "#e4e4e4" });
});

const BUTTON_AREA_PX = 5_000, DOTS_AREA_PX = 120.4, DOTS_AREA_ROUNDED_PX = 120;
test("the first screen's fills are kept largest first, so a card can tell a brand that fills boxes in its colour from one that draws lines in it", () => {
  expect(brandSiteTraitsFromMeasurement(META, { fills: [{ hex: "#3bde77", areaPx: DOTS_AREA_PX }, { hex: "#F8FAFC", areaPx: BUTTON_AREA_PX }, { hex: "green", areaPx: 9 }] }).traits.fills)
    .toEqual({ value: [{ hex: "#f8fafc", areaPx: BUTTON_AREA_PX }, { hex: "#3bde77", areaPx: DOTS_AREA_ROUNDED_PX }], from: "first screen" });
});

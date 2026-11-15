import { z } from "zod";
import { contrast } from "./wcag-contrast.ts";
import { oklabDistance, oklchChroma } from "./oklab.ts";
import { canonicalBrandDomainSchema } from "./product-brand.ts";

/**
 * What measuring a product's own site adds to its provider brand: the label and button type, corners, the colour the
 * site is known by and the hero behind its heading. Hex colours, pixel and em numbers, family names and enumerations
 * only, each with where on the page it was found. Nothing here is CSS, a URL or markup.
 */
export const BRAND_SITE_TRAITS_VERSION = 1;

// A lowercase six-digit hex colour. Accepts "#3bde77"; rejects "#3BDE77", "#3bde7780" and "green".
// https://regex101.com/?regex=%5E%23%5B0-9a-f%5D%7B6%7D%24&testString=%233bde77%0A%233BDE77%0A%233bde7780
const HEX = /^#[0-9a-f]{6}$/;
// A font family name: letters, digits, spaces, hyphens and underscores. Accepts "n8n Baumer Mono"; rejects "Inter, sans-serif" and "a\"b".
// https://regex101.com/?regex=%5E%5B%5Cp%7BL%7D%5Cp%7BN%7D%20_-%5D%2B%24&flags=u&testString=n8n%20Baumer%20Mono%0AInter%2C%20sans-serif
const FAMILY = /^[\p{L}\p{N} _-]+$/u;
const MAX_FAMILY_LENGTH = 100;
// A product slug: lowercase words joined by single hyphens. Accepts "open-places"; rejects "Open-Places" and "open--places".
// https://regex101.com/?regex=%5E%5Ba-z0-9%5D%2B%28%3F%3A-%5Ba-z0-9%5D%2B%29*%24&testString=open-places%0AOpen-Places%0Aopen--places
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** A pill's radius is the browser's huge computed value; anything rounder than this is the same pill. */
const MAX_PX = 9_999;
const MIN_TRACKING_EM = -0.2, MAX_TRACKING_EM = 0.5;
const MAX_VIEWPORT_PX = 4_096;
const PX_PLACES = 100, EM_PLACES = 1_000;
/** A radius at least this share of the element's height, less a pixel, draws a pill. The fidelity check's own rule. */
const PILL_HEIGHT_SHARE = 0.5, PILL_SLACK_PX = 1;
/** At or under this OKLCH chroma a colour is a grey, the threshold brand-kit uses for an accent. */
export const SIGNATURE_MIN_CHROMA = 0.045;

const hexSchema = z.string().regex(HEX);
const pxSchema = z.number().min(0).max(MAX_PX);
const emSchema = z.number().min(MIN_TRACKING_EM).max(MAX_TRACKING_EM);
const fontSchema = z.object({
  family: z.string().min(1).max(MAX_FAMILY_LENGTH).regex(FAMILY).optional(),
  generic: z.enum(["monospace", "sans-serif", "serif"]),
}).strict();
const caseSchema = z.enum(["as typed", "uppercase"]);
const radiusSchema = z.object({ px: pxSchema, pill: z.boolean() }).strict();
const buttonSchema = z.object({
  fill: hexSchema.optional(), text: hexSchema.optional(), border: hexSchema.optional(), radius: radiusSchema.optional(),
  font: fontSchema.optional(), case: caseSchema.optional(), trackingEm: emSchema.optional(),
}).strict();
const heroSchema = z.discriminatedUnion("kind", [
  /** `radiusPx` is the slab's corner: 0 runs flush to the page, more is a rounded slab inset from it. */
  z.object({ kind: z.literal("colour"), hex: hexSchema, radiusPx: pxSchema.optional() }).strict(),
  z.object({ kind: z.literal("image"), hex: hexSchema }).strict(),
  z.object({ kind: z.literal("none") }).strict(),
]);
const SIGNATURE_SOURCES = ["primary call-to-action", "heading highlight", "hero", "logo"] as const;
/** The largest a surface pattern's cell can be and still read as a pattern on a card: two cells across a 330px phone card. */
const MAX_PATTERN_PITCH_PX = 165;
const patternSchema = z.object({ kind: z.enum(["grid", "dots"]), pitchPx: z.number().int().min(2).max(MAX_PATTERN_PITCH_PX), line: hexSchema }).strict();
const inversePanelSchema = z.object({ fill: hexSchema, text: hexSchema, border: hexSchema.optional(), radiusPx: pxSchema.optional() }).strict();
const ruleSchema = z.object({ style: z.enum(["solid", "dashed"]), hex: hexSchema }).strict();
/** The most fills kept: enough for a page's buttons, panels and bands. */
const MAX_FILLS = 12;
const fillSchema = z.object({ hex: hexSchema, areaPx: z.number().int().min(0).max(MAX_VIEWPORT_PX * MAX_VIEWPORT_PX) }).strict();
/** A stored logo's inks: its few commonest colours and the share of its drawn pixels each covers, keyed by the logo's kind and size. */
const MAX_LOGO_INKS = 6, MAX_LOGOS = 32, MAX_LOGO_PX = 10_000;
const logoInksSchema = z.object({
  mode: z.enum(["light", "dark", "unknown"]), type: z.enum(["logo", "icon", "unknown"]),
  width: z.number().int().positive().max(MAX_LOGO_PX), height: z.number().int().positive().max(MAX_LOGO_PX),
  inks: z.array(z.object({ hex: hexSchema, share: z.number().min(0).max(1) }).strict()).min(1).max(MAX_LOGO_INKS),
}).strict();
const located = <Value extends z.ZodType, From extends readonly [string, ...string[]]>(value: Value, from: From) =>
  z.object({ value, from: z.enum(from) }).strict();

const traitsSchema = z.object({
  surface: located(hexSchema, ["page background"]).optional(),
  text: located(hexSchema, ["text on the page background"]).optional(),
  headingFont: located(fontSchema, ["first heading"]).optional(),
  bodyFont: located(fontSchema, ["first paragraph"]).optional(),
  labelFont: located(fontSchema, ["small labels"]).optional(),
  labelCase: located(caseSchema, ["small labels"]).optional(),
  labelTrackingEm: located(emSchema, ["small labels"]).optional(),
  primaryButton: located(buttonSchema, ["primary call-to-action"]).optional(),
  secondaryButton: located(buttonSchema, ["secondary call-to-action"]).optional(),
  panelRadiusPx: located(pxSchema, ["bordered panels"]).optional(),
  signature: located(hexSchema, SIGNATURE_SOURCES).optional(),
  hero: located(heroSchema, ["backdrop behind the first heading"]).optional(),
  numberFont: located(fontSchema, ["largest number"]).optional(),
  numberColour: located(hexSchema, ["largest number"]).optional(),
  /** The highlight drawn tight behind the site's largest number (Open Places' yellow), when it has one. */
  numberBackdrop: located(hexSchema, ["largest number"]).optional(),
  /** The colours filled behind things in the first screen, by the area they cover there, largest first. */
  fills: located(z.array(fillSchema).max(MAX_FILLS), ["first screen"]).optional(),
  /** What each of the brand's stored logo files is drawn in, measured from the files the snapshot names. */
  logoInks: located(z.array(logoInksSchema).max(MAX_LOGOS), ["stored logos"]).optional(),
  panelFill: located(hexSchema, ["second large surface"]).optional(),
  surfacePattern: located(patternSchema, ["second large surface", "ruled columns"]).optional(),
  inversePanel: located(inversePanelSchema, ["dark panel"]).optional(),
  rule: located(ruleSchema, ["most common border"]).optional(),
  mutedText: located(hexSchema, ["secondary text on the page background"]).optional(),
}).strict();

export const brandSiteTraitsSchema = z.object({
  schemaVersion: z.literal(BRAND_SITE_TRAITS_VERSION),
  productSlug: z.string().regex(SLUG).max(MAX_FAMILY_LENGTH),
  canonicalDomain: canonicalBrandDomainSchema,
  // Defer Zod's circular ISO module initialization in the server/client bundle, as product-brand does.
  measuredAt: z.lazy(() => z.iso.datetime()),
  /** The page measured: always the root of the product's canonical domain. */
  url: z.string(),
  viewport: z.object({ width: z.number().int().positive().max(MAX_VIEWPORT_PX), height: z.number().int().positive().max(MAX_VIEWPORT_PX) }).strict(),
  traits: traitsSchema,
}).strict().refine(file => file.url === `https://${file.canonicalDomain}/`, { message: "url must be the canonical domain's root", path: ["url"] });

export type BrandSiteTraits = z.infer<typeof brandSiteTraitsSchema>;
export type SiteTraits = BrandSiteTraits["traits"];
export type SiteButton = z.infer<typeof buttonSchema>;
export type SiteFont = z.infer<typeof fontSchema>;
export type SiteHero = z.infer<typeof heroSchema>;
export type SiteLogoInks = z.infer<typeof logoInksSchema>;

/** The raw `site` object scripts/brand-site-measure.mjs reads off a page. Nothing in it is trusted until parsed below. */
type RawFont = { family?: unknown; generic?: unknown };
type RawButton = { fill?: unknown; label?: unknown; border?: unknown; radiusPx?: unknown; heightPx?: unknown; font?: RawFont; case?: unknown; trackingEm?: unknown };
export type SiteMeasurement = {
  surface?: unknown; text?: unknown; headingFont?: RawFont; bodyFont?: RawFont;
  labels?: { font?: RawFont; case?: unknown; trackingEm?: unknown };
  primaryButton?: RawButton; secondaryButton?: RawButton; panelRadiusPx?: unknown;
  signatureCandidates?: readonly { hex?: unknown; from?: unknown }[];
  /** A backdrop's width as a share of the viewport, and of the frame it sits in; or `fullBleed` from an older capture. */
  hero?: { hex?: unknown; fullBleed?: unknown; widthShare?: unknown; frameShare?: unknown; kind?: unknown; radiusPx?: unknown };
  /** Every bordered or shadowed panel's corner and area; an older capture has only their modal radius as `panelRadiusPx`. */
  panels?: readonly { px?: unknown; area?: unknown }[];
  /** Tall vertical lines in the first screen: a border's x position and colour. */
  verticalRules?: readonly { x?: unknown; hex?: unknown }[];
  /** The page's text colour, else its body's: what a second surface's text is read against. */
  pageText?: unknown;
  /** Every figure on the page with its size, colour, face, top in the viewport and tight highlight; an older capture has only `number`. */
  figures?: readonly { sizePx?: unknown; colour?: unknown; top?: unknown; font?: RawFont; backdrop?: unknown }[];
  number?: { font?: RawFont; colour?: unknown };
  /** Large filled boxes by colour, with how much shows in the first screen and is chrome; an older capture has only `panelFill` or `inversePanel`. */
  surfaces?: readonly { hex?: unknown; area?: unknown; firstScreenArea?: unknown; chromeArea?: unknown; ink?: unknown; border?: unknown; radiusPx?: unknown }[];
  panelFill?: unknown;
  /** `firstScreen` false: the pattern was found only below the first screen. */
  surfacePattern?: { kind?: unknown; pitchPx?: unknown; line?: unknown; firstScreen?: unknown };
  inversePanel?: { fill?: unknown; text?: unknown; border?: unknown; radiusPx?: unknown };
  fills?: readonly { hex?: unknown; areaPx?: unknown }[];
  /** Borders by style, colour and whether they edge a control or the layout; an older capture has only `rule`. */
  ruleCensus?: readonly { style?: unknown; hex?: unknown; kind?: unknown; count?: unknown }[];
  /** Each stored logo's kind, size and commonest colours, read from the snapshot's own files by the homepage pull. */
  logoInks?: readonly { mode?: unknown; type?: unknown; width?: unknown; height?: unknown; inks?: readonly { hex?: unknown; share?: unknown }[] }[];
  rule?: { style?: unknown; hex?: unknown };
  mutedText?: unknown;
};
export type SiteMeasurementMeta = Pick<BrandSiteTraits, "productSlug" | "canonicalDomain" | "measuredAt" | "url" | "viewport">;

const rounded = (value: unknown, places: number) => (typeof value === "number" && Number.isFinite(value) ? Math.round(value * places) / places : undefined);
/** The value when it parses, else nothing: one unreadable trait drops alone and never costs the others. */
function kept<Schema extends z.ZodType>(schema: Schema, value: unknown): z.infer<Schema> | undefined {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
/** Leaves out the keys whose value is undefined, so a file only ever holds what was measured. */
function defined<Shape extends Record<string, unknown>>(shape: Shape): Partial<Shape> {
  return Object.fromEntries(Object.entries(shape).filter(([, value]) => value !== undefined)) as Partial<Shape>;
}
const hex = (value: unknown) => kept(hexSchema, typeof value === "string" ? value.toLowerCase() : value);
/** The measurer says "as written"; a stored file says "as typed". */
const CASES: Readonly<Record<string, z.infer<typeof caseSchema>>> = { uppercase: "uppercase", "as written": "as typed", "as typed": "as typed" };
const caseOf = (value: unknown) => (typeof value === "string" && Object.hasOwn(CASES, value) ? CASES[value] : undefined);
function font(raw: RawFont | undefined): SiteFont | undefined {
  if (!raw) return undefined;
  const generic = kept(fontSchema.shape.generic, raw.generic);
  return generic ? defined({ family: kept(fontSchema.shape.family, raw.family), generic }) as SiteFont : undefined;
}
function button(raw: RawButton | undefined): SiteButton | undefined {
  if (!raw) return undefined;
  const px = kept(pxSchema, rounded(raw.radiusPx, PX_PLACES)), height = rounded(raw.heightPx, PX_PLACES);
  const radius = px === undefined ? undefined : { px, pill: height !== undefined && px >= height * PILL_HEIGHT_SHARE - PILL_SLACK_PX };
  const value = defined({
    fill: hex(raw.fill), text: hex(raw.label), border: hex(raw.border), radius, font: font(raw.font),
    case: caseOf(raw.case), trackingEm: kept(emSchema, rounded(raw.trackingEm, EM_PLACES)),
  });
  return Object.keys(value).length ? value : undefined;
}
/** A heading's backdrop is full-bleed at this share of the viewport, or of the frame it sits in (a ruled page column, say). */
export const FULL_BLEED_SHARE = 0.8;
const spans = (share: unknown) => typeof share === "number" && share >= FULL_BLEED_SHARE;
function hero(raw: SiteMeasurement["hero"]): SiteHero | undefined {
  if (!raw) return undefined;
  const backdrop = hex(raw.hex);
  if (!backdrop || !(raw.fullBleed === true || spans(raw.widthShare) || spans(raw.frameShare))) return { kind: "none" };
  if (raw.kind === "image") return { kind: "image", hex: backdrop };
  return raw.kind === "colour" ? defined({ kind: "colour" as const, hex: backdrop, radiusPx: kept(pxSchema, rounded(raw.radiusPx, PX_PLACES)) }) as SiteHero : undefined;
}

/** The corner most of the panels' area is drawn with: a few big rounded cards outweigh many small square boxes. */
function panelRadius(raw: SiteMeasurement) {
  if (!raw.panels?.length) return kept(pxSchema, rounded(raw.panelRadiusPx, PX_PLACES));
  const areas = new Map<number, number>();
  for (const panel of raw.panels) {
    const px = kept(pxSchema, Math.round(Number(panel.px))), area = typeof panel.area === "number" && Number.isFinite(panel.area) ? panel.area : 0;
    if (px !== undefined) areas.set(px, (areas.get(px) ?? 0) + area);
  }
  return [...areas].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0];
}

/** A grid needs this many even gaps between its lines; two lines are a frame. */
const MIN_GRID_GAPS = 3;
/** Lines this close are one line drawn twice (a box's right edge and the next box's left). */
const SAME_LINE_PX = 2;
/** A page ruled into even columns by tall lines: the commonest gap between neighbouring lines, in their commonest colour. */
function ruledColumns(raw: SiteMeasurement["verticalRules"]) {
  const rules = (raw ?? []).flatMap(rule => {
    const colour = hex(rule.hex), x = typeof rule.x === "number" && Number.isFinite(rule.x) ? Math.round(rule.x) : undefined;
    return colour && x !== undefined ? [{ x, hex: colour }] : [];
  }).sort((a, b) => a.x - b.x).filter((rule, index, sorted) => index === 0 || rule.x - sorted[index - 1].x > SAME_LINE_PX);
  const gaps = rules.slice(1).map((rule, index) => rule.x - rules[index].x);
  const counts = gaps.reduce((tally, gap) => tally.set(gap, (tally.get(gap) ?? 0) + 1), new Map<number, number>());
  const [pitchPx, count] = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0] ?? [];
  if (pitchPx === undefined || count < MIN_GRID_GAPS) return undefined;
  const colours = rules.reduce((tally, rule) => tally.set(rule.hex, (tally.get(rule.hex) ?? 0) + 1), new Map<string, number>());
  const line = [...colours].sort((a, b) => b[1] - a[1])[0][0];
  return kept(patternSchema, { kind: "grid", pitchPx, line });
}
function surfacePattern(raw: SiteMeasurement) {
  const { firstScreen, ...measured } = raw.surfacePattern ?? {};
  // A pattern found only below the first screen (n8n's dots on a dark band far down) is not the surface the site introduces itself on.
  const drawn = firstScreen === false ? undefined : kept(patternSchema, raw.surfacePattern && { ...measured, line: typeof measured.line === "string" ? measured.line.toLowerCase() : measured.line });
  if (drawn) return { value: drawn, from: "second large surface" as const };
  const ruled = ruledColumns(raw.verticalRules);
  return ruled && { value: ruled, from: "ruled columns" as const };
}
const finite = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

/** A figure set clearly larger than body text: a smaller one is a caption's number (Open Places' 12.5px counts), not the site's big one. */
const LARGE_FIGURE_PX = 20;
/**
 * The site's big number: the largest figure in the first screen, where the site introduces itself, else the largest anywhere,
 * of those set at least 20px. With its face, its colour and the highlight drawn tight behind it.
 */
function bigNumber(raw: SiteMeasurement, viewportHeight: number) {
  if (!raw.figures) return raw.number && { font: font(raw.number.font), colour: hex(raw.number.colour), backdrop: undefined };
  const large = raw.figures.filter(figure => (finite(figure.sizePx) ?? 0) >= LARGE_FIGURE_PX);
  const biggest = (figures: typeof large) => figures.reduce<typeof large[number] | undefined>((best, figure) => (!best || Number(figure.sizePx) > Number(best.sizePx) ? figure : best), undefined);
  const chosen = biggest(large.filter(figure => (finite(figure.top) ?? Infinity) < viewportHeight)) ?? biggest(large);
  return chosen && { font: font(chosen.font), colour: hex(chosen.colour), backdrop: hex(chosen.backdrop) };
}

/**
 * A surface is visibly off the page at this contrast, so white on #f9fafb is not one; or, as a tint of another hue at nearly the
 * page's lightness, at this OKLab distance (Open Places' pale green map panel on its cream page is 0.022).
 */
const MIN_SURFACE_STEP = 1.05, MIN_SURFACE_TINT = 0.02;
/** At or over this OKLCH chroma a fill is a colour (an orange block), not a surface data sits on: the measurer's own threshold. */
const SURFACE_MAX_CHROMA = 0.04;
/** A box of 220x120px: this much of a dark surface must show in the first screen for it to speak for the site. */
const MIN_FIRST_SCREEN_AREA = 220 * 120;
const BODY_TEXT_CONTRAST = 4.5;
/**
 * The site's second surface: of its large near-neutral boxes off the page and the hero, and mostly not chrome (a sidebar menu), the
 * one the first screen shows most of, then the one covering most of the page. A fill the page's text can't be read on is a dark inverse panel, and it counts only where the first screen
 * already shows dark, in that panel or in a dark hero: a dark band far down a light page is not how the site looks.
 */
function secondSurface(raw: SiteMeasurement, heroHex: string | undefined): { panelFill?: string; inversePanel?: unknown } {
  if (!raw.surfaces) return { panelFill: hex(raw.panelFill), inversePanel: raw.inversePanel && defined({ fill: hex(raw.inversePanel.fill), text: hex(raw.inversePanel.text), border: hex(raw.inversePanel.border), radiusPx: kept(pxSchema, rounded(raw.inversePanel.radiusPx, PX_PLACES)) }) };
  const page = hex(raw.surface), text = hex(raw.pageText) ?? hex(raw.text);
  const darkHero = heroHex !== undefined && text !== undefined && contrast(text, heroHex) < BODY_TEXT_CONTRAST;
  const shown = (surface: typeof raw.surfaces[number]) => finite(surface.firstScreenArea) ?? 0;
  for (const surface of [...raw.surfaces].sort((a, b) => shown(b) - shown(a) || (finite(b.area) ?? 0) - (finite(a.area) ?? 0))) {
    const fill = hex(surface.hex), area = finite(surface.area) ?? 0;
    if (!fill || !page || fill === heroHex || oklchChroma(fill) >= SURFACE_MAX_CHROMA) continue;
    if (contrast(fill, page) < MIN_SURFACE_STEP && oklabDistance(fill, page) < MIN_SURFACE_TINT) continue;
    if ((finite(surface.chromeArea) ?? 0) * 2 > area) continue;
    if (!text || contrast(text, fill) >= BODY_TEXT_CONTRAST) return { panelFill: fill };
    if (!darkHero && (finite(surface.firstScreenArea) ?? 0) < MIN_FIRST_SCREEN_AREA) continue;
    return { inversePanel: defined({ fill, text: hex(surface.ink), border: hex(surface.border), radiusPx: kept(pxSchema, rounded(surface.radiusPx, PX_PLACES)) }) };
  }
  return {};
}

/** The page's rule: its commonest layout border, since a run of outlined links and buttons is a control's edge, not a rule; else its commonest border. */
function pageRule(raw: SiteMeasurement) {
  if (!raw.ruleCensus) return kept(ruleSchema, raw.rule && { style: raw.rule.style, hex: hex(raw.rule.hex) });
  const rules = [...raw.ruleCensus].sort((a, b) => (finite(b.count) ?? 0) - (finite(a.count) ?? 0));
  const chosen = rules.find(rule => rule.kind === "layout") ?? rules[0];
  return kept(ruleSchema, chosen && { style: chosen.style, hex: hex(chosen.hex) });
}

function firstScreenFills(raw: SiteMeasurement) {
  const fills = (raw.fills ?? []).flatMap(fill => {
    const parsed = kept(fillSchema, { hex: hex(fill.hex), areaPx: Math.round(finite(fill.areaPx) ?? -1) });
    return parsed ? [parsed] : [];
  }).sort((a, b) => b.areaPx - a.areaPx).slice(0, MAX_FILLS);
  return fills.length ? fills : undefined;
}

const SHARE_PLACES = 1_000;
function storedLogoInks(raw: SiteMeasurement) {
  const logos = (raw.logoInks ?? []).flatMap(logo => {
    const inks = (logo.inks ?? []).flatMap(ink => {
      const parsed = kept(logoInksSchema.shape.inks.element, { hex: hex(ink.hex), share: rounded(ink.share, SHARE_PLACES) });
      return parsed ? [parsed] : [];
    }).sort((a, b) => b.share - a.share).slice(0, MAX_LOGO_INKS);
    const parsed = kept(logoInksSchema, { mode: logo.mode, type: logo.type, width: logo.width, height: logo.height, inks });
    return parsed ? [parsed] : [];
  }).slice(0, MAX_LOGOS);
  return logos.length ? logos : undefined;
}

const at = <Value, From extends string>(value: Value | undefined, from: From) => (value === undefined ? undefined : { value, from });

/** The site's signature colour: the most colourful of its call-to-action, heading highlights, colour hero and logo. Earlier candidates win ties. */
export function signatureColour(candidates: readonly { hex: string; from: typeof SIGNATURE_SOURCES[number] }[]) {
  return candidates.filter(candidate => oklchChroma(candidate.hex) > SIGNATURE_MIN_CHROMA)
    .reduce<typeof candidates[number] | undefined>((best, candidate) => (!best || oklchChroma(candidate.hex) > oklchChroma(best.hex) ? candidate : best), undefined);
}

/** Turns one raw page measurement into a stored, validated site-traits file. The same measurement always gives the same file. */
export function brandSiteTraitsFromMeasurement(meta: SiteMeasurementMeta, raw: SiteMeasurement): BrandSiteTraits {
  const heroValue = hero(raw.hero);
  const candidates = [
    ...(raw.signatureCandidates ?? []).flatMap(candidate => {
      const color = hex(candidate.hex), from = kept(z.enum(SIGNATURE_SOURCES), candidate.from);
      return color && from ? [{ hex: color, from }] : [];
    }),
    ...(heroValue?.kind === "colour" ? [{ hex: heroValue.hex, from: "hero" as const }] : []),
  ];
  const signature = signatureColour(candidates);
  const number = bigNumber(raw, meta.viewport.height), second = secondSurface(raw, heroValue?.kind === "colour" ? heroValue.hex : undefined);
  const traits = defined({
    surface: at(hex(raw.surface), "page background"),
    text: at(hex(raw.text), "text on the page background"),
    headingFont: at(font(raw.headingFont), "first heading"),
    bodyFont: at(font(raw.bodyFont), "first paragraph"),
    labelFont: at(font(raw.labels?.font), "small labels"),
    labelCase: at(caseOf(raw.labels?.case), "small labels"),
    labelTrackingEm: at(kept(emSchema, rounded(raw.labels?.trackingEm, EM_PLACES)), "small labels"),
    primaryButton: at(button(raw.primaryButton), "primary call-to-action"),
    secondaryButton: at(button(raw.secondaryButton), "secondary call-to-action"),
    panelRadiusPx: at(panelRadius(raw), "bordered panels"),
    signature: signature && { value: signature.hex, from: signature.from },
    hero: at(heroValue, "backdrop behind the first heading"),
    numberFont: at(number?.font, "largest number"),
    numberColour: at(number?.colour, "largest number"),
    numberBackdrop: at(number?.backdrop, "largest number"),
    fills: at(firstScreenFills(raw), "first screen"),
    logoInks: at(storedLogoInks(raw), "stored logos"),
    panelFill: at(second.panelFill, "second large surface"),
    surfacePattern: surfacePattern(raw),
    inversePanel: at(kept(inversePanelSchema, second.inversePanel), "dark panel"),
    rule: at(pageRule(raw), "most common border"),
    mutedText: at(hex(raw.mutedText), "secondary text on the page background"),
  });
  return brandSiteTraitsSchema.parse({ schemaVersion: BRAND_SITE_TRAITS_VERSION, ...meta, traits });
}

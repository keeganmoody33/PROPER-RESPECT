import { z } from "zod";
import { oklchChroma } from "./oklab.ts";
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
  z.object({ kind: z.literal("colour"), hex: hexSchema }).strict(),
  z.object({ kind: z.literal("image"), hex: hexSchema }).strict(),
  z.object({ kind: z.literal("none") }).strict(),
]);
const SIGNATURE_SOURCES = ["primary call-to-action", "heading highlight", "hero", "logo"] as const;
/** The largest a surface pattern's cell can be and still read as a pattern on a card. */
const MAX_PATTERN_PITCH_PX = 64;
const patternSchema = z.object({ kind: z.enum(["grid", "dots"]), pitchPx: z.number().int().min(2).max(MAX_PATTERN_PITCH_PX), line: hexSchema }).strict();
const inversePanelSchema = z.object({ fill: hexSchema, text: hexSchema, border: hexSchema.optional(), radiusPx: pxSchema.optional() }).strict();
const ruleSchema = z.object({ style: z.enum(["solid", "dashed"]), hex: hexSchema }).strict();
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
  panelFill: located(hexSchema, ["second large surface"]).optional(),
  surfacePattern: located(patternSchema, ["second large surface"]).optional(),
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

/** The raw `site` object scripts/brand-site-measure.mjs reads off a page. Nothing in it is trusted until parsed below. */
type RawFont = { family?: unknown; generic?: unknown };
type RawButton = { fill?: unknown; label?: unknown; border?: unknown; radiusPx?: unknown; heightPx?: unknown; font?: RawFont; case?: unknown; trackingEm?: unknown };
export type SiteMeasurement = {
  surface?: unknown; text?: unknown; headingFont?: RawFont; bodyFont?: RawFont;
  labels?: { font?: RawFont; case?: unknown; trackingEm?: unknown };
  primaryButton?: RawButton; secondaryButton?: RawButton; panelRadiusPx?: unknown;
  signatureCandidates?: readonly { hex?: unknown; from?: unknown }[];
  /** A backdrop's width as a share of the viewport, and of the frame it sits in; or `fullBleed` from an older capture. */
  hero?: { hex?: unknown; fullBleed?: unknown; widthShare?: unknown; frameShare?: unknown; kind?: unknown };
  number?: { font?: RawFont; colour?: unknown };
  panelFill?: unknown;
  surfacePattern?: { kind?: unknown; pitchPx?: unknown; line?: unknown };
  inversePanel?: { fill?: unknown; text?: unknown; border?: unknown; radiusPx?: unknown };
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
  return raw.kind === "colour" || raw.kind === "image" ? { kind: raw.kind, hex: backdrop } : undefined;
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
    panelRadiusPx: at(kept(pxSchema, rounded(raw.panelRadiusPx, PX_PLACES)), "bordered panels"),
    signature: signature && { value: signature.hex, from: signature.from },
    hero: at(heroValue, "backdrop behind the first heading"),
    numberFont: at(font(raw.number?.font), "largest number"),
    numberColour: at(hex(raw.number?.colour), "largest number"),
    panelFill: at(hex(raw.panelFill), "second large surface"),
    surfacePattern: at(kept(patternSchema, raw.surfacePattern && { ...raw.surfacePattern, line: typeof raw.surfacePattern.line === "string" ? raw.surfacePattern.line.toLowerCase() : raw.surfacePattern.line }), "second large surface"),
    inversePanel: at(kept(inversePanelSchema, raw.inversePanel && defined({ fill: hex(raw.inversePanel.fill), text: hex(raw.inversePanel.text), border: hex(raw.inversePanel.border), radiusPx: kept(pxSchema, rounded(raw.inversePanel.radiusPx, PX_PLACES)) })), "dark panel"),
    rule: at(kept(ruleSchema, raw.rule && { style: raw.rule.style, hex: hex(raw.rule.hex) }), "most common border"),
    mutedText: at(hex(raw.mutedText), "secondary text on the page background"),
  });
  return brandSiteTraitsSchema.parse({ schemaVersion: BRAND_SITE_TRAITS_VERSION, ...meta, traits });
}

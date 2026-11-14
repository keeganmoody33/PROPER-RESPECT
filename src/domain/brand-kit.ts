import type { BrandSiteTraits, SiteFont } from "./brand-site-traits";
import { oklabDistance, oklchChroma } from "./oklab";
import { productBrandFontFamilyKey, type ProductBrandSnapshot } from "./product-brand";

/**
 * The edge and buttons of a product's card, derived from its stored brand by fixed rules.
 * The same snapshot always gives the same card; nothing here is tuned for one brand.
 * A measured site file, when there is one, wins over the provider's values: the site is what people see.
 */
export type BrandCardKit = Partial<Record<
  "--brand-card-border" | "--brand-card-radius" | "--brand-card-button-fill" | "--brand-card-button-text" | "--brand-card-button-radius"
  | "--brand-card-button-weight" | "--brand-card-button-border" | "--brand-card-button-font" | "--brand-card-button-case" | "--brand-card-button-tracking"
  | "--brand-card-label-font" | "--brand-card-label-case" | "--brand-card-label-tracking" | "--brand-card-band" | "--brand-card-band-text"
  | "--brand-card-quiet-fill" | "--brand-card-quiet-text" | "--brand-card-chart", string>>;

// A six-digit hex colour. Accepts "#ff4c00"; rejects "#ff4c0080" (translucent, so its contrast is unknown) and "tomato".
const SOLID_HEX = /^#[0-9a-f]{6}$/i;
/** WCAG relative luminance and contrast. */
const LINEAR_KNEE = 0.03928, LINEAR_DIVISOR = 12.92, GAMMA_OFFSET = 0.055, GAMMA_DIVISOR = 1.055, GAMMA = 2.4;
const LUMA = [0.2126, 0.7152, 0.0722] as const;
const CONTRAST_PAD = 0.05, CHANNEL_MAX = 255, HEX_RADIX = 16;
const CHANNEL_STARTS = [1, 3, 5] as const, CHANNEL_DIGITS = 2;
/** A border must show against the card, and a filled button must stand off it. */
const MIN_BORDER_CONTRAST = 1.3, MIN_FILL_CONTRAST = 1.5, MIN_QUIET_FILL_CONTRAST = 1.04;
/** A chart's bars are marks, not text, so they need the 3:1 WCAG asks of graphics (1.4.11): more than a fill, less than a label. */
const MIN_CHART_CONTRAST = 3;
/** The card's button text is small (0.7rem), so its label needs the contrast WCAG asks of body text. */
const MIN_LABEL_CONTRAST = 4.5;
/** How much of the text colour a derived border takes when the brand's own border is too faint. Tried lightest first; the last is the text colour itself. */
const BORDER_MIXES = [0.22, 0.35, 0.5, 0.75, 1] as const;
/** A square brand keeps a square card. */
const RADIUS = { min: 0, max: 24 } as const;
/** A pill on the site stays a pill on the card's shorter button. */
const PILL_RADIUS = "999px";
const WHITE = "#ffffff", BLACK = "#000000";
/**
 * OKLCH chroma at or under which a colour is a grey for the purpose of a brand's accent. Measured on the homepage brands:
 * Spider's slate accent #94a3b8 is 0.035; the least colourful accent kept, Elicit's dark teal #083d44, is 0.053.
 */
const NEUTRAL_MAX_CHROMA = 0.045;

/**
 * A measured family the card can't load (no file was stored for it, as with Spider's Berkeley) is drawn in a system
 * face of the same kind, so its case and letter-spacing still read as the site's.
 */
const SYSTEM_FACES: Readonly<Record<SiteFont["generic"], string>> = {
  monospace: 'ui-monospace, "SF Mono", Menlo, monospace',
  serif: 'ui-serif, Georgia, "Times New Roman", serif',
  "sans-serif": 'system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
};
const CSS_CASE = { uppercase: "uppercase", "as typed": "none" } as const;
/** Two colours within this OKLab distance read as the same colour at a glance: the fidelity check's tolerance. */
const SAME_COLOUR_DISTANCE = 0.05;

const solid = (value: string | undefined) => (value && SOLID_HEX.test(value) ? value.toLowerCase() : undefined);
const channels = (hex: string) => CHANNEL_STARTS.map(start => parseInt(hex.slice(start, start + CHANNEL_DIGITS), HEX_RADIX));
function luminance(hex: string) {
  return channels(hex).reduce((sum, value, index) => {
    const unit = value / CHANNEL_MAX;
    return sum + LUMA[index] * (unit <= LINEAR_KNEE ? unit / LINEAR_DIVISOR : ((unit + GAMMA_OFFSET) / GAMMA_DIVISOR) ** GAMMA);
  }, 0);
}
export function contrast(first: string, second: string) {
  const [high, low] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (high + CONTRAST_PAD) / (low + CONTRAST_PAD);
}
function mix(from: string, into: string, amount: number) {
  const [a, b] = [channels(from), channels(into)];
  return `#${a.map((value, index) => Math.round(value * amount + b[index] * (1 - amount)).toString(HEX_RADIX).padStart(CHANNEL_DIGITS, "0")).join("")}`;
}
/** The first of the brand's label, the card's text, white and black that small text can be read in on this fill. */
function readableOn(fill: string, preferred: string | undefined, cardText: string) {
  const candidates = [preferred, cardText, WHITE, BLACK].filter((value): value is string => Boolean(value));
  return candidates.find(candidate => contrast(candidate, fill) >= MIN_LABEL_CONTRAST)
    ?? (contrast(WHITE, fill) >= contrast(BLACK, fill) ? WHITE : BLACK);
}
function derivedBorder(surface: string, text: string) {
  const mixes = BORDER_MIXES.map(amount => mix(text, surface, amount));
  return mixes.find(candidate => contrast(candidate, surface) >= MIN_BORDER_CONTRAST) ?? text;
}

/** The card's stack for a measured family: the brand face the card already loads when it is that family, else a system face of its kind. */
function measuredFace(font: SiteFont, guide: Extract<ProductBrandSnapshot, { schemaVersion: 2 }>["styleguide"]) {
  const key = font.family && productBrandFontFamilyKey(font.family);
  const loaded = (["body", "heading"] as const).find(role => {
    const family = guide?.typography?.[role]?.family ?? (role === "body" ? guide?.bodyFamily : guide?.headingFamily);
    return key && family && productBrandFontFamilyKey(family) === key;
  });
  return loaded ? `var(--brand-card-${loaded}-font)` : SYSTEM_FACES[font.generic];
}

export type BrandAccent = { hex: string; source: "site accent" | "primary button" | "logo colour" | "site colour" };

/**
 * The colour that makes a card read as its brand. The site's accent when it has colour. A site can report a grey as its
 * accent (Spider reports the slate of its secondary text); then the most colourful of its stored button fill and brand
 * colours that a chart could draw in on `surface` (3:1), and failing that the grey accent as before.
 */
export function brandAccent(snapshot: ProductBrandSnapshot | undefined, surface: string): BrandAccent | undefined {
  const accent = solid(snapshot?.styleguide?.colors.accent);
  if (accent && oklchChroma(accent) > NEUTRAL_MAX_CHROMA) return { hex: accent, source: "site accent" };
  const button = snapshot?.schemaVersion === 2 ? solid(snapshot.styleguide?.components?.buttonPrimary?.background) : undefined;
  const palette = (snapshot?.colors ?? []).flatMap(({ hex, source }): BrandAccent[] => {
    const color = solid(hex);
    return color ? [{ hex: color, source: source === "logo" ? "logo colour" : "site colour" }] : [];
  });
  const candidates: BrandAccent[] = [...(button ? [{ hex: button, source: "primary button" as const }] : []), ...palette];
  const vivid = candidates
    .filter(candidate => oklchChroma(candidate.hex) > NEUTRAL_MAX_CHROMA && contrast(candidate.hex, surface) >= MIN_CHART_CONTRAST)
    .reduce<BrandAccent | undefined>((best, candidate) => (!best || oklchChroma(candidate.hex) > oklchChroma(best.hex) ? candidate : best), undefined);
  return vivid ?? (accent ? { hex: accent, source: "site accent" } : undefined);
}

/**
 * The colour a card's marks are drawn in when it stands `minContrast` off `surface`. The site's signature colour comes
 * first when it differs from the provider's accent; then the site's own hero colour; then the provider's accent.
 */
export function brandMark(snapshot: ProductBrandSnapshot | undefined, surface: string, minContrast: number, site?: BrandSiteTraits): string | undefined {
  const provider = brandAccent(snapshot, surface)?.hex, signature = site?.traits.signature?.value, hero = site?.traits.hero?.value;
  const differs = signature && (!provider || oklabDistance(signature, provider) > SAME_COLOUR_DISTANCE);
  const heroColour = differs && hero?.kind === "colour" && oklchChroma(hero.hex) > NEUTRAL_MAX_CHROMA ? hero.hex : undefined;
  return [differs ? signature : undefined, heroColour, provider].find((hex): hex is string => hex !== undefined && contrast(hex, surface) >= minContrast);
}

/**
 * `surface` and `text` are the colours the card is already drawn in. With no usable brand values the
 * result still carries a border that shows, so every card has a defined edge.
 */
export function brandCardKit(snapshot: ProductBrandSnapshot | undefined, surfaceColor: string, textColor: string, site?: BrandSiteTraits): BrandCardKit {
  const cardSurface = solid(surfaceColor), cardText = solid(textColor);
  if (!cardSurface || !cardText) return {};
  const surface = cardSurface, text = cardText;
  const guide = snapshot?.schemaVersion === 2 ? snapshot.styleguide : undefined;
  const parts = guide?.components, accent = brandAccent(snapshot, surface)?.hex;
  const measured = site?.traits, measuredButton = measured?.primaryButton?.value;
  const kit: BrandCardKit = {};

  const border = solid(parts?.card?.border);
  kit["--brand-card-border"] = border && contrast(border, surface) >= MIN_BORDER_CONTRAST ? border : derivedBorder(surface, text);
  const cardRadius = measured?.panelRadiusPx?.value ?? parts?.card?.radiusPx;
  if (cardRadius !== undefined) kit["--brand-card-radius"] = `${Math.min(RADIUS.max, Math.max(RADIUS.min, cardRadius))}px`;

  // The stored "primary" is whichever button came first on the product's site. On a coloured hero that can be
  // a white button, which would vanish on the card, and it can be an outline with no fill (GitHub's). Then the
  // site's other stored button carries the card's button, then the brand's accent, in the primary's shape.
  const primary = parts?.buttonPrimary, secondary = parts?.buttonSecondary;
  const fills = [
    { fill: measuredButton?.fill, label: measuredButton?.text, border: measuredButton?.border },
    { fill: solid(primary?.background), label: solid(primary?.text) },
    { fill: solid(secondary?.background), label: solid(secondary?.text) },
    { fill: accent, label: undefined },
  ];
  // With no stored button at all (a brand fetched before buttons were kept), the card keeps its default outlined button.
  const chosen = primary || measuredButton ? fills.find(({ fill }) => fill && contrast(fill, surface) >= MIN_FILL_CONTRAST) : undefined;
  const fill = chosen?.fill;
  if (fill) {
    kit["--brand-card-button-fill"] = fill;
    kit["--brand-card-button-text"] = readableOn(fill, chosen.label, text);
    if (chosen.border) kit["--brand-card-button-border"] = chosen.border;
  }
  if (measuredButton?.radius) kit["--brand-card-button-radius"] = measuredButton.radius.pill ? PILL_RADIUS : `${measuredButton.radius.px}px`;
  else if (primary?.radiusPx !== undefined) kit["--brand-card-button-radius"] = `${primary.radiusPx}px`;
  if (primary?.weight !== undefined) kit["--brand-card-button-weight"] = String(primary.weight);
  if (measuredButton?.font) kit["--brand-card-button-font"] = measuredFace(measuredButton.font, guide);
  if (measuredButton?.case) kit["--brand-card-button-case"] = CSS_CASE[measuredButton.case];
  if (measuredButton?.trackingEm !== undefined) kit["--brand-card-button-tracking"] = `${measuredButton.trackingEm}em`;

  if (measured?.labelFont) kit["--brand-card-label-font"] = measuredFace(measured.labelFont.value, guide);
  if (measured?.labelCase) kit["--brand-card-label-case"] = CSS_CASE[measured.labelCase.value];
  if (measured?.labelTrackingEm) kit["--brand-card-label-tracking"] = `${measured.labelTrackingEm.value}em`;

  // A site whose heading sits on a full-bleed colour shows that colour as a band across the card's top, not as its whole surface.
  const hero = measured?.hero?.value;
  if (hero?.kind === "colour") {
    kit["--brand-card-band"] = hero.hex;
    kit["--brand-card-band-text"] = readableOn(hero.hex, undefined, text);
  }

  kit["--brand-card-chart"] = brandMark(snapshot, surface, MIN_CHART_CONTRAST, site) ?? text;

  const quiet = parts?.buttonSecondary, quietFill = solid(quiet?.background);
  if (quietFill && quietFill !== fill && contrast(quietFill, surface) >= MIN_QUIET_FILL_CONTRAST) {
    kit["--brand-card-quiet-fill"] = quietFill;
    kit["--brand-card-quiet-text"] = readableOn(quietFill, solid(quiet?.text), text);
  }
  return kit;
}

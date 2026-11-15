import type { BrandSiteTraits, SiteFont } from "./brand-site-traits";
import { fromOklab, oklab, oklabDistance, oklchChroma } from "./oklab";
import { productBrandFontFamilyKey, type ProductBrandSnapshot } from "./product-brand";
import { channels, contrast } from "./wcag-contrast";

export { contrast };

/**
 * The edge and buttons of a product's card, derived from its stored brand by fixed rules.
 * The same snapshot always gives the same card; nothing here is tuned for one brand.
 * A measured site file, when there is one, wins over the provider's values: the site is what people see.
 */
export type BrandCardKit = Partial<Record<
  "--brand-card-border" | "--brand-card-radius" | "--brand-card-button-fill" | "--brand-card-button-text" | "--brand-card-button-radius"
  | "--brand-card-button-weight" | "--brand-card-button-border" | "--brand-card-button-font" | "--brand-card-button-case" | "--brand-card-button-tracking"
  | "--brand-card-label-font" | "--brand-card-label-case" | "--brand-card-label-tracking" | "--brand-card-band" | "--brand-card-band-text"
  | "--brand-card-quiet-fill" | "--brand-card-quiet-text" | "--brand-card-chart"
  | "--brand-card-number-font" | "--brand-card-number-colour" | "--brand-card-panel" | "--brand-card-panel-text" | "--brand-card-panel-border"
  | "--brand-card-panel-radius" | "--brand-card-panel-chart" | "--brand-card-pattern-line" | "--brand-card-pattern-pitch"
  | "--brand-card-rule" | "--brand-card-rule-style" | "--brand-card-muted" | "--brand-card-chip-case" | "--brand-card-chip-font"
  | "--brand-card-slab" | "--brand-card-slab-body" | "--brand-card-band-large-text" | "--brand-card-logo-tile"
  | "--brand-card-slab-button-fill" | "--brand-card-slab-button-text" | "--brand-card-chart-tint" | "--brand-card-number-backdrop" | "--brand-card-value-colour" | "--brand-card-pattern-dot"
  | "--brand-card-panel-frame", string>>;

// A six-digit hex colour. Accepts "#ff4c00"; rejects "#ff4c0080" (translucent, so its contrast is unknown) and "tomato".
const SOLID_HEX = /^#[0-9a-f]{6}$/i;
const HEX_RADIX = 16, CHANNEL_DIGITS = 2;
/** A border must show against the card, and a filled button must stand off it. */
const MIN_BORDER_CONTRAST = 1.3, MIN_FILL_CONTRAST = 1.5, MIN_QUIET_FILL_CONTRAST = 1.04;
/** A chart's bars are marks, not text, so they need the 3:1 WCAG asks of graphics (1.4.11): more than a fill, less than a label. */
const MIN_CHART_CONTRAST = 3;
/** The card's button text is small (0.7rem), so its label needs the contrast WCAG asks of body text. */
const MIN_LABEL_CONTRAST = 4.5;
/** Large text (24px, or bold at 18.66px) and a large number need the 3:1 WCAG asks of large text. */
const MIN_LARGE_TEXT_CONTRAST = 3;
/** How much of the text colour a derived border takes when the brand's own border is too faint. Tried lightest first; the last is the text colour itself. */
const BORDER_MIXES = [0.22, 0.35, 0.5, 0.75, 1] as const;
/** A square brand keeps a square card. */
const RADIUS = { min: 0, max: 24 } as const;
/** A pill on the site stays a pill on the card's shorter button: any radius over half its height. */
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
/**
 * The most a button's fill deepens, mixed toward black or white, so the site's own label reads on it at 4.5:1: white on Firecrawl's
 * orange takes 16%. Past this the fill is no longer the brand's, and the label gives way instead.
 */
const MAX_BUTTON_SHADE = 0.2, BUTTON_SHADE_STEP = 0.01;
/**
 * A box of 40x40px. A site that fills less of its first screen than this with its mark colour draws in that colour rather than filling
 * with it (Spider's thin green lines and dots), and the card's chart is drawn in outline the same way.
 */
const MIN_FILLED_MARK_AREA = 40 * 40;
/** How much of the mark colour tints the inside of an outlined bar. */
const LINE_MARK_TINT = 0.18;
/**
 * The most a brand colour's OKLab lightness moves, away from what its bars sit on, keeping its hue, so they read 3:1: the bar's
 * counterpart of the button's 20% deepening. n8n's pink on its #f0f0f0 panel needs 0.215; a cap of 0.2 left it 0.015 short.
 */
const MAX_MARK_SHIFT = 0.25, MARK_SHIFT_STEP = 0.005;
/** A coloured panel frames the card's data this thick: prominent on a phone card, still clear of the bars inside. */
const PANEL_FRAME = "6px";

const solid = (value: string | undefined) => (value && SOLID_HEX.test(value) ? value.toLowerCase() : undefined);
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
/** The fill, deepened as little as makes the site's own label read on it at 4.5:1, up to MAX_BUTTON_SHADE; else nothing. */
function shadedFor(label: string, fill: string) {
  const away = contrast(label, BLACK) >= contrast(label, WHITE) ? BLACK : WHITE;
  for (let amount = BUTTON_SHADE_STEP; amount <= MAX_BUTTON_SHADE + BUTTON_SHADE_STEP / 2; amount += BUTTON_SHADE_STEP) {
    const shaded = mix(away, fill, amount);
    if (contrast(label, shaded) >= MIN_LABEL_CONTRAST) return shaded;
  }
  return undefined;
}
function derivedBorder(surface: string, text: string) {
  const mixes = BORDER_MIXES.map(amount => mix(text, surface, amount));
  return mixes.find(candidate => contrast(candidate, surface) >= MIN_BORDER_CONTRAST) ?? text;
}

/** The card's stack for a measured family: the brand face the card already loads when it is that family, else a system face of its kind. */
function measuredFace(font: SiteFont, guide: Extract<ProductBrandSnapshot, { fontLinks: unknown }>["styleguide"]) {
  const key = font.family && productBrandFontFamilyKey(font.family);
  const loaded = (["body", "heading"] as const).find(role => {
    const family = guide?.typography?.[role]?.family ?? (role === "body" ? guide?.bodyFamily : guide?.headingFamily);
    return key && family && productBrandFontFamilyKey(family) === key;
  });
  return loaded ? `var(--brand-card-${loaded}-font)` : SYSTEM_FACES[font.generic];
}

/**
 * The face a card's big figures are set in. A measured number family the card serves is used as is; one it can't load
 * (GitHub's Mona Sans Mono) stays in the brand's own served faces, since a system mono spaces "1,121" like code.
 */
function numberFace(font: SiteFont, guide: Extract<ProductBrandSnapshot, { fontLinks: unknown }>["styleguide"]) {
  const face = measuredFace(font, guide);
  return face.startsWith("var(") ? face : `var(--brand-card-heading-font, var(--brand-card-body-font, ${face}))`;
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
  return markCandidates(snapshot, surface, site).find(hex => contrast(hex, surface) >= minContrast);
}

/**
 * The brand colours a card can draw in, best first. A measured site that shows no colour of its own (no colourful call-to-action,
 * heading phrase, hero or logo) and fills less than a 40px box of its first screen with the provider's accent doesn't use that accent
 * (Exa's blue), so the card leaves it out as the site does.
 */
function markCandidates(snapshot: ProductBrandSnapshot | undefined, surface: string, site: BrandSiteTraits | undefined): string[] {
  const provider = brandAccent(snapshot, surface)?.hex, signature = site?.traits.signature?.value, hero = site?.traits.hero?.value;
  const differs = signature && (!provider || oklabDistance(signature, provider) > SAME_COLOUR_DISTANCE);
  const heroColour = differs && hero?.kind === "colour" && oklchChroma(hero.hex) > NEUTRAL_MAX_CHROMA ? hero.hex : undefined;
  const unused = provider !== undefined && site?.traits.fills !== undefined && !signature && filledArea(provider, site) < MIN_FILLED_MARK_AREA;
  return [differs ? signature : undefined, heroColour, unused ? undefined : provider].filter((hex): hex is string => hex !== undefined);
}

/** The colour moved in OKLab lightness away from `backing`, hue kept, as little as makes it read `minContrast` there, up to MAX_MARK_SHIFT. */
function shiftedFor(hex: string, backing: string, minContrast: number) {
  const [lightness, a, b] = oklab(hex), direction = contrast(backing, BLACK) >= contrast(backing, WHITE) ? -1 : 1;
  for (let shift = MARK_SHIFT_STEP; shift <= MAX_MARK_SHIFT + MARK_SHIFT_STEP / 2; shift += MARK_SHIFT_STEP) {
    const moved = fromOklab([lightness + direction * shift, a, b]);
    if (contrast(moved, backing) >= minContrast) return moved;
  }
  return undefined;
}

/**
 * The colour bars are drawn in on `backing`, and the brand colour it came from: the first candidate that reads 3:1 as it is, else
 * the first that reads once moved in lightness. Every candidate is tried as it is first, so a moved lime never beats a green that passed.
 */
function barMark(candidates: readonly string[], backing: string): { drawn: string; source: string } | undefined {
  const as = candidates.find(hex => contrast(hex, backing) >= MIN_CHART_CONTRAST);
  if (as) return { drawn: as, source: as };
  for (const source of candidates) {
    const drawn = shiftedFor(source, backing, MIN_CHART_CONTRAST);
    if (drawn) return { drawn, source };
  }
  return undefined;
}

/** WCAG's large text: 24px, or bold (700) from 18.66px. */
const LARGE_TEXT_PX = 24, LARGE_BOLD_TEXT_PX = 18.66, BOLD_WEIGHT = 700;

/**
 * The colour a headline's phrase set apart is drawn in: the brand's mark, where the headline is large text and the mark reads
 * 3:1 on the surface behind the headline. Otherwise none, and the phrase keeps the headline's own colour.
 */
export function headlineAccentColour(snapshot: ProductBrandSnapshot | undefined, surface: string, text: { sizePx: number; weight: number }, site?: BrandSiteTraits): string | undefined {
  const large = text.sizePx >= LARGE_TEXT_PX || (text.weight >= BOLD_WEIGHT && text.sizePx >= LARGE_BOLD_TEXT_PX);
  return large ? brandMark(snapshot, surface, MIN_LARGE_TEXT_CONTRAST, site) : undefined;
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
  // A hero drawn as a rounded slab inset from the page (Cloudflare's) is what the card echoes: its corners are the card's.
  const hero = measured?.hero?.value;
  const insetRadius = hero?.kind === "colour" && hero.radiusPx ? hero.radiusPx : undefined;
  // A site with no measured panel is as round as its buttons, when they are not pills: Spider's square buttons make a square card.
  const buttonRadius = measuredButton?.radius && !measuredButton.radius.pill ? measuredButton.radius.px : undefined;
  const cardRadius = insetRadius ?? measured?.panelRadiusPx?.value ?? buttonRadius ?? parts?.card?.radiusPx;
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
  // The site's own label on a fill it fails on (white on Firecrawl's orange, 3.3:1) keeps its colour where the fill can deepen a little.
  const shaded = chosen?.fill && chosen.label && contrast(chosen.label, chosen.fill) < MIN_LABEL_CONTRAST ? shadedFor(chosen.label, chosen.fill) : undefined;
  const fill = shaded ?? chosen?.fill;
  if (fill) {
    kit["--brand-card-button-fill"] = fill;
    kit["--brand-card-button-text"] = shaded ? chosen!.label! : readableOn(fill, chosen!.label, text);
    if (chosen!.border) kit["--brand-card-button-border"] = chosen!.border;
  }
  if (measuredButton?.radius) kit["--brand-card-button-radius"] = measuredButton.radius.pill ? PILL_RADIUS : `${measuredButton.radius.px}px`;
  else if (primary?.radiusPx !== undefined) kit["--brand-card-button-radius"] = `${primary.radiusPx}px`;
  if (primary?.weight !== undefined) kit["--brand-card-button-weight"] = String(primary.weight);
  if (measuredButton?.font) kit["--brand-card-button-font"] = measuredFace(measuredButton.font, guide);
  if (measuredButton?.case) kit["--brand-card-button-case"] = CSS_CASE[measuredButton.case];
  if (measuredButton?.trackingEm !== undefined) kit["--brand-card-button-tracking"] = `${measuredButton.trackingEm}em`;

  if (measured?.labelFont) kit["--brand-card-label-font"] = measuredFace(measured.labelFont.value, guide);
  // A measured site's labels with no measured case stay as typed: the house uppercase is the house's, not the brand's.
  if (measured) kit["--brand-card-label-case"] = CSS_CASE[measured.labelCase?.value ?? "as typed"];
  if (measured?.labelTrackingEm) kit["--brand-card-label-tracking"] = `${measured.labelTrackingEm.value}em`;
  // The use chips and the footer note are set like the site's buttons, its sentence-length controls, not its tiniest labels.
  const chipCase = measuredButton?.case ?? measured?.labelCase?.value;
  if (measured) kit["--brand-card-chip-case"] = CSS_CASE[chipCase ?? "as typed"];
  const chipFont = measuredButton?.font ?? measured?.labelFont?.value;
  if (chipFont) kit["--brand-card-chip-font"] = measuredFace(chipFont, guide);

  // A site whose heading sits on a colour hero covers the card's whole header with it as one slab, and the body under it takes
  // the site's second surface where its text still reads. The slab's small text is in a label that reads at 4.5:1; its large
  // headline is white, as Clay's, Docker's and Cloudflare's hero headings are, wherever white reads at the 3:1 large text needs.
  if (hero?.kind === "colour") {
    const label = readableOn(hero.hex, undefined, text);
    kit["--brand-card-band"] = hero.hex;
    kit["--brand-card-band-text"] = label;
    kit["--brand-card-band-large-text"] = contrast(WHITE, hero.hex) >= MIN_LARGE_TEXT_CONTRAST ? WHITE : label;
    kit["--brand-card-slab"] = hero.hex;
    const body = measured?.panelFill?.value;
    if (body && contrast(text, body) >= MIN_LABEL_CONTRAST) kit["--brand-card-slab-body"] = body;
    // A logo drawn in the hero's own colour (Cloudflare's orange cloud) would vanish into the slab, so it sits on a tile of the card.
    const logoColour = measured?.signature?.from === "logo" ? measured.signature.value : undefined;
    // Unless the brand stored a wordmark that reads on the slab itself, which then shows on it as the site would show it.
    if (logoColour && contrast(logoColour, hero.hex) < MIN_CHART_CONTRAST && !slabLogo(snapshot, site)) kit["--brand-card-logo-tile"] = surface;
    // A button filled in the hero's own colour would vanish into the slab too, so there it takes the card's surface.
    if (fill && contrast(fill, hero.hex) < MIN_FILL_CONTRAST) {
      kit["--brand-card-slab-button-fill"] = surface;
      kit["--brand-card-slab-button-text"] = readableOn(surface, undefined, text);
    }
  }

  Object.assign(kit, siteFeel(snapshot, surface, text, guide, site));

  // The bars sit on the data panel where the card has a light one (a dark inverse panel draws its own), else on the card.
  const inverse = kit["--brand-card-panel-text"] !== undefined, backing = inverse ? surface : kit["--brand-card-panel"] ?? surface;
  const bars = barMark(markCandidates(snapshot, backing, site), backing);
  kit["--brand-card-chart"] = bars?.drawn ?? text;
  // A brand that draws in its colour rather than filling with it draws the chart's bars as outlines, tinted inside, on whatever they sit on.
  if (bars && !inverse && drawsInLines(bars.source, site)) kit["--brand-card-chart-tint"] = mix(bars.drawn, backing, LINE_MARK_TINT);
  // With no measured site to say how its numbers are set, the card's figures take the brand's accent as it is or moved in lightness,
  // hue kept, to read 4.5:1 at any size the card sets them (Porkbun's salmon, deepened). A measured site's numbers follow siteFeel.
  if (!measured) {
    const candidates = markCandidates(snapshot, surface, undefined);
    const figure = candidates.find(hex => contrast(hex, surface) >= MIN_LABEL_CONTRAST)
      ?? candidates.map(hex => shiftedFor(hex, surface, MIN_LABEL_CONTRAST)).find(hex => hex !== undefined);
    if (figure) Object.assign(kit, { "--brand-card-number-colour": figure, "--brand-card-value-colour": figure });
  }

  const quiet = parts?.buttonSecondary, quietFill = solid(quiet?.background);
  if (quietFill && quietFill !== fill && contrast(quietFill, surface) >= MIN_QUIET_FILL_CONTRAST) {
    kit["--brand-card-quiet-fill"] = quietFill;
    kit["--brand-card-quiet-text"] = readableOn(quietFill, solid(quiet?.text), text);
  }
  return kit;
}

/** A wordmark is at least twice as wide as tall; one drawn this much in inks that read 3:1 on the slab (graphics' floor) shows straight on it. */
const WORDMARK_ASPECT = 2, SLAB_LOGO_SHARE = 0.95;
/**
 * The brand's stored wordmark to show straight on its colour slab: one whose measured inks read 3:1 on the slab for nearly all of its
 * drawn pixels (Cloudflare's black wordmark on its orange). None where every stored variant would vanish into the slab.
 */
export function slabLogo(snapshot: ProductBrandSnapshot | undefined, site: BrandSiteTraits | undefined) {
  const hero = site?.traits.hero?.value, inks = site?.traits.logoInks?.value;
  if (!snapshot || hero?.kind !== "colour" || !inks) return undefined;
  return snapshot.logos.find(logo => {
    if (logo.type !== "logo" || !logo.width || !logo.height || logo.width / logo.height < WORDMARK_ASPECT) return false;
    const measured = inks.find(candidate => candidate.mode === logo.mode && candidate.type === logo.type && candidate.width === logo.width && candidate.height === logo.height);
    return measured !== undefined && measured.inks.filter(ink => contrast(ink.hex, hero.hex) >= MIN_CHART_CONTRAST).reduce((share, ink) => share + ink.share, 0) >= SLAB_LOGO_SHARE;
  });
}

/** Whether the site fills less than a 40px box of its first screen with this brand colour; a grey (the text-colour fallback) never counts. */
function drawsInLines(mark: string, site: BrandSiteTraits | undefined) {
  if (!site?.traits.fills || oklchChroma(mark) <= NEUTRAL_MAX_CHROMA) return false;
  return filledArea(mark, site) < MIN_FILLED_MARK_AREA;
}

/** How much of the site's first screen is filled with this colour, within the fidelity check's tolerance. */
function filledArea(colour: string, site: BrandSiteTraits) {
  return (site.traits.fills?.value ?? []).filter(fill => oklabDistance(fill.hex, colour) <= SAME_COLOUR_DISTANCE).reduce((area, fill) => area + fill.areaPx, 0);
}

/**
 * What a site's feel adds beyond its kit: the face and colour of its big numbers, the second surface its data sits on (a light
 * fill, a ruled grid or a dark inverse panel), the rule between things and its secondary text. Each colour keeps the card's floors.
 */
function siteFeel(snapshot: ProductBrandSnapshot | undefined, surface: string, text: string,
  guide: Extract<ProductBrandSnapshot, { fontLinks: unknown }>["styleguide"] | undefined, site: BrandSiteTraits | undefined): BrandCardKit {
  const traits = site?.traits;
  if (!traits) return {};
  const kit: BrandCardKit = {};
  if (traits.numberFont) kit["--brand-card-number-font"] = numberFace(traits.numberFont.value, guide);
  const number = traits.numberColour?.value, backdrop = traits.numberBackdrop?.value;
  // A number the site sets on a highlight that hugs it (Open Places' yellow) sits on that highlight, read against it.
  if (number && backdrop && contrast(number, backdrop) >= MIN_LARGE_TEXT_CONTRAST) {
    kit["--brand-card-number-colour"] = number;
    kit["--brand-card-number-backdrop"] = backdrop;
  } else if (number && oklchChroma(number) > NEUTRAL_MAX_CHROMA && contrast(number, surface) >= MIN_LARGE_TEXT_CONTRAST) kit["--brand-card-number-colour"] = number;
  else {
    // A number the site sets in a grey, or doesn't set, is the card's one figure: it takes the brand's mark, as GitHub's, Firecrawl's and
    // Elicit's sites colour theirs, where the mark reads 4.5:1 so it holds at any size the card sets it. Else the site's grey, as measured.
    const mark = brandMark(snapshot, surface, MIN_LABEL_CONTRAST, site);
    const neutral = number && contrast(number, surface) >= MIN_LARGE_TEXT_CONTRAST ? number : undefined;
    if (mark ?? neutral) kit["--brand-card-number-colour"] = (mark ?? neutral)!;
  }
  const inverse = traits.inversePanel?.value;
  if (inverse && contrast(inverse.text, inverse.fill) >= MIN_LABEL_CONTRAST) {
    kit["--brand-card-panel"] = inverse.fill;
    kit["--brand-card-panel-text"] = inverse.text;
    if (inverse.border) kit["--brand-card-panel-border"] = inverse.border;
    if (inverse.radiusPx !== undefined) kit["--brand-card-panel-radius"] = `${Math.min(RADIUS.max, inverse.radiusPx)}px`;
    // The site's signature, then the provider's accent, as they are or lightened to read 3:1 on the panel; else the panel's own text.
    const marks = [traits.signature?.value, brandAccent(snapshot, inverse.fill)?.hex].filter((hex): hex is string => hex !== undefined);
    kit["--brand-card-panel-chart"] = barMark(marks, inverse.fill)?.drawn ?? inverse.text;
  } else if (traits.panelFill && contrast(text, traits.panelFill.value) >= MIN_LABEL_CONTRAST) {
    kit["--brand-card-panel"] = traits.panelFill.value;
  }
  const pattern = traits.surfacePattern?.value;
  if (pattern && !inverse) {
    kit[pattern.kind === "dots" ? "--brand-card-pattern-dot" : "--brand-card-pattern-line"] = pattern.line;
    kit["--brand-card-pattern-pitch"] = `${pattern.pitchPx}px`;
  }
  // Decorative: the rule sits between things that already read apart, never as the only mark of a meaning. Too faint to see, it gives way.
  if (traits.rule) {
    const rule = traits.rule.value.hex;
    kit["--brand-card-rule"] = contrast(rule, surface) >= MIN_BORDER_CONTRAST ? rule : derivedBorder(surface, text);
    kit["--brand-card-rule-style"] = traits.rule.value.style;
    // The data sits in a panel framed by that rule: on the site's light second surface, or on the card's own when it measured none.
    if (!kit["--brand-card-panel-text"]) {
      kit["--brand-card-panel"] ??= surface;
      kit["--brand-card-panel-border"] = kit["--brand-card-rule"];
    }
  }
  // A coloured panel in the site's first screen (Context.dev's blue around its search box) frames the card's data panel, over the rule.
  const frame = traits.framedPanel?.value;
  if (frame && !kit["--brand-card-panel-text"] && contrast(frame.hex, kit["--brand-card-panel"] ?? surface) >= MIN_CHART_CONTRAST && contrast(frame.hex, surface) >= MIN_CHART_CONTRAST) {
    kit["--brand-card-panel"] ??= surface;
    kit["--brand-card-panel-border"] = frame.hex;
    kit["--brand-card-panel-frame"] = PANEL_FRAME;
    if (frame.radiusPx !== undefined) kit["--brand-card-panel-radius"] = `${Math.min(RADIUS.max, frame.radiusPx)}px`;
  }
  const muted = traits.mutedText?.value;
  if (muted && contrast(muted, surface) >= MIN_LABEL_CONTRAST) kit["--brand-card-muted"] = muted;
  // The back's values are the front's chart in numbers: set in its number colour where that reads 4.5:1 on their panel. A highlight's
  // ink (Open Places' brown on yellow) is the highlight's, not the brand's, so it stays on the front.
  const valueColour = kit["--brand-card-number-colour"];
  if (valueColour && !kit["--brand-card-number-backdrop"] && contrast(valueColour, kit["--brand-card-panel"] ?? surface) >= MIN_LABEL_CONTRAST) kit["--brand-card-value-colour"] = valueColour;
  return kit;
}

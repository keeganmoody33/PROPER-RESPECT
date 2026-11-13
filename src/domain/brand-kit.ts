import type { ProductBrandSnapshot } from "./product-brand";

/**
 * The edge and buttons of a product's card, derived from its stored brand by fixed rules.
 * The same snapshot always gives the same card; nothing here is tuned for one brand.
 */
export type BrandCardKit = Partial<Record<
  "--brand-card-border" | "--brand-card-radius" | "--brand-card-button-fill" | "--brand-card-button-text" | "--brand-card-button-radius"
  | "--brand-card-button-weight" | "--brand-card-quiet-fill" | "--brand-card-quiet-text", string>>;

// A six-digit hex colour. Accepts "#ff4c00"; rejects "#ff4c0080" (translucent, so its contrast is unknown) and "tomato".
const SOLID_HEX = /^#[0-9a-f]{6}$/i;
/** WCAG relative luminance and contrast. */
const LINEAR_KNEE = 0.03928, LINEAR_DIVISOR = 12.92, GAMMA_OFFSET = 0.055, GAMMA_DIVISOR = 1.055, GAMMA = 2.4;
const LUMA = [0.2126, 0.7152, 0.0722] as const;
const CONTRAST_PAD = 0.05, CHANNEL_MAX = 255, HEX_RADIX = 16;
const CHANNEL_STARTS = [1, 3, 5] as const, CHANNEL_DIGITS = 2;
/** A border must show against the card, and a filled button must stand off it. */
const MIN_BORDER_CONTRAST = 1.3, MIN_FILL_CONTRAST = 1.5, MIN_QUIET_FILL_CONTRAST = 1.04;
/** The card's button text is small (0.7rem), so its label needs the contrast WCAG asks of body text. */
const MIN_LABEL_CONTRAST = 4.5;
/** How much of the text colour a derived border takes when the brand's own border is too faint. Tried lightest first; the last is the text colour itself. */
const BORDER_MIXES = [0.22, 0.35, 0.5, 0.75, 1] as const;
const RADIUS = { min: 6, max: 24 } as const;
const WHITE = "#ffffff", BLACK = "#000000";

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

/**
 * `surface` and `text` are the colours the card is already drawn in. With no usable brand values the
 * result still carries a border that shows, so every card has a defined edge.
 */
export function brandCardKit(snapshot: ProductBrandSnapshot | undefined, surfaceColor: string, textColor: string): BrandCardKit {
  const cardSurface = solid(surfaceColor), cardText = solid(textColor);
  if (!cardSurface || !cardText) return {};
  const surface = cardSurface, text = cardText;
  const guide = snapshot?.schemaVersion === 2 ? snapshot.styleguide : undefined;
  const parts = guide?.components, accent = solid(guide?.colors.accent);
  const kit: BrandCardKit = {};

  const border = solid(parts?.card?.border);
  kit["--brand-card-border"] = border && contrast(border, surface) >= MIN_BORDER_CONTRAST ? border : derivedBorder(surface, text);
  if (parts?.card?.radiusPx !== undefined) kit["--brand-card-radius"] = `${Math.min(RADIUS.max, Math.max(RADIUS.min, parts.card.radiusPx))}px`;

  // The stored "primary" is whichever button came first on the product's site. On a coloured hero that can be
  // a white button, which would vanish on the card; then the brand's accent carries the button in the same shape.
  const primary = parts?.buttonPrimary, pulledFill = solid(primary?.background);
  const fill = pulledFill && contrast(pulledFill, surface) >= MIN_FILL_CONTRAST ? pulledFill : accent && contrast(accent, surface) >= MIN_FILL_CONTRAST ? accent : undefined;
  if (fill) {
    kit["--brand-card-button-fill"] = fill;
    kit["--brand-card-button-text"] = readableOn(fill, fill === pulledFill ? solid(primary?.text) : undefined, text);
  }
  if (primary?.radiusPx !== undefined) kit["--brand-card-button-radius"] = `${primary.radiusPx}px`;
  if (primary?.weight !== undefined) kit["--brand-card-button-weight"] = String(primary.weight);

  const quiet = parts?.buttonSecondary, quietFill = solid(quiet?.background);
  if (quietFill && quietFill !== fill && contrast(quietFill, surface) >= MIN_QUIET_FILL_CONTRAST) {
    kit["--brand-card-quiet-fill"] = quietFill;
    kit["--brand-card-quiet-text"] = readableOn(quietFill, solid(quiet?.text), text);
  }
  return kit;
}

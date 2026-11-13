/**
 * The brand provider hosts each product's font files at media.brand.dev, which sends no
 * Access-Control-Allow-Origin header. A browser refuses a font from another origin without it,
 * so those files are served from this site instead (owner decision, 2026-11-13).
 */

const PROVIDER_FONTS = "https://media.brand.dev/fonts/";
export const OWN_FONT_PATH = "/api/brand-fonts/";

// One content-addressed font file: 64 lowercase hex characters, a dot, and a font extension.
// Accepts "45386689a773179ad2a4f750698c7b6152d7b57f4e7c41aed967d8704d49e115.woff2".
// Rejects "../secret.woff2", "font.woff2" and "4538…e115.svg".
// Try it: https://regex101.com/?regex=%5E%5B0-9a-f%5D%7B64%7D%5C.(woff2%7Cwoff%7Cttf%7Cotf)%24
const FONT_FILE = /^[0-9a-f]{64}\.(woff2|woff|ttf|otf)$/;

const CONTENT_TYPES = { woff2: "font/woff2", woff: "font/woff", ttf: "font/ttf", otf: "font/otf" } as const;

/** The one upstream file a font request may fetch, or null for any other name. */
export function brandFontUpstream(file: string): { url: string; contentType: string } | null {
  const match = FONT_FILE.exec(file);
  if (!match) return null;
  return { url: `${PROVIDER_FONTS}${file}`, contentType: CONTENT_TYPES[match[1] as keyof typeof CONTENT_TYPES] };
}

/** Where a card loads a stored font file from. Hosts that allow other origins (Google Fonts) are left alone. */
export function ownOriginFontUrl(url: string): string {
  if (!url.startsWith(PROVIDER_FONTS)) return url;
  const file = url.slice(PROVIDER_FONTS.length);
  return brandFontUpstream(file) ? `${OWN_FONT_PATH}${file}` : url;
}

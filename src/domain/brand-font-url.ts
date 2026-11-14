/**
 * Card fonts load from this site, never from the host that stored them. The brand provider's host
 * (media.brand.dev) sends no Access-Control-Allow-Origin header, so a browser refuses its fonts from any other
 * origin (owner decision, 2026-11-13). Google's (fonts.gstatic.com) would load, but would hand every visitor's
 * address to Google, so they are served from here too.
 */

const PROVIDER_FONTS = "https://media.brand.dev/fonts/";
export const OWN_FONT_PATH = "/api/brand-fonts/";
const GOOGLE_FONTS = "https://fonts.gstatic.com/s/";
export const OWN_GOOGLE_FONT_PATH = "/api/brand-fonts/google/";

// One content-addressed font file: 64 lowercase hex characters, a dot, and a font extension.
// Accepts "45386689a773179ad2a4f750698c7b6152d7b57f4e7c41aed967d8704d49e115.woff2".
// Rejects "../secret.woff2", "font.woff2" and "4538…e115.svg".
// Try it: https://regex101.com/?regex=%5E%5B0-9a-f%5D%7B64%7D%5C.(woff2%7Cwoff%7Cttf%7Cotf)%24
const FONT_FILE = /^[0-9a-f]{64}\.(woff2|woff|ttf|otf)$/;

// Google's file paths as stored snapshots hold them: /s/<family>/v<version>/<file>.ttf, nothing else.
// Accepts "roboto", "v51" and "KFO7CnqEu92Fr1ME7kSn66aGLdTylUAMa3yUBA.ttf".
// Rejects "Roboto", "../roboto", "latest", "v51/..", "abc.woff2" and "a/b.ttf".
const GOOGLE_FAMILY = /^[a-z0-9]{1,64}$/;
const GOOGLE_VERSION = /^v[0-9]{1,4}$/;
const GOOGLE_FILE = /^[A-Za-z0-9_-]{1,128}\.ttf$/;
const GOOGLE_PATH_PARTS = 3;

const CONTENT_TYPES = { woff2: "font/woff2", woff: "font/woff", ttf: "font/ttf", otf: "font/otf" } as const;

/** The one upstream file a font request may fetch, or null for any other name. */
export function brandFontUpstream(file: string): { url: string; contentType: string } | null {
  const match = FONT_FILE.exec(file);
  if (!match) return null;
  return { url: `${PROVIDER_FONTS}${file}`, contentType: CONTENT_TYPES[match[1] as keyof typeof CONTENT_TYPES] };
}

/** The one Google file a font request may fetch, rebuilt from its checked parts, or null for any other path. */
export function googleFontUpstream(family: string, version: string, file: string): { url: string; contentType: string } | null {
  if (!GOOGLE_FAMILY.test(family) || !GOOGLE_VERSION.test(version) || !GOOGLE_FILE.test(file)) return null;
  return { url: `${GOOGLE_FONTS}${family}/${version}/${file}`, contentType: CONTENT_TYPES.ttf };
}

/** Where a card loads a stored font file from. A URL of any other shape is left as it is. */
export function ownOriginFontUrl(url: string): string {
  if (url.startsWith(PROVIDER_FONTS)) {
    const file = url.slice(PROVIDER_FONTS.length);
    return brandFontUpstream(file) ? `${OWN_FONT_PATH}${file}` : url;
  }
  if (url.startsWith(GOOGLE_FONTS)) {
    const parts = url.slice(GOOGLE_FONTS.length).split("/");
    const [family = "", version = "", file = ""] = parts;
    return parts.length === GOOGLE_PATH_PARTS && googleFontUpstream(family, version, file) ? `${OWN_GOOGLE_FONT_PATH}${family}/${version}/${file}` : url;
  }
  return url;
}

/**
 * Brand logos the provider hosts load from this site, so a visitor's browser never asks media.brand.dev
 * for them (the homepage makes no off-site request). Only the file shape stored snapshots hold is moved.
 */

const PROVIDER_IMAGES = "https://media.brand.dev/";
export const OWN_IMAGE_PATH = "/api/brand-images/";

// One provider logo: a lowercase UUID, a dot, and png or svg, the only types stored snapshots hold.
// Accepts "f895934e-e887-4c7d-ab99-3f7ae465499f.png".
// Rejects "logo.png", "../f895934e-….png", "fonts/f895934e-….png" and "f895934e-….jpg".
// Try it: https://regex101.com/?regex=%5E%5B0-9a-f%5D%7B8%7D-%5B0-9a-f%5D%7B4%7D-%5B0-9a-f%5D%7B4%7D-%5B0-9a-f%5D%7B4%7D-%5B0-9a-f%5D%7B12%7D%5C.(png%7Csvg)%24
const IMAGE_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|svg)$/;

const CONTENT_TYPES = { png: "image/png", svg: "image/svg+xml" } as const;

/** The one upstream file an image request may fetch, with the type this site serves it as, or null for any other name. */
export function brandImageUpstream(file: string): { url: string; contentType: string } | null {
  const match = IMAGE_FILE.exec(file);
  if (!match) return null;
  return { url: `${PROVIDER_IMAGES}${file}`, contentType: CONTENT_TYPES[match[1] as keyof typeof CONTENT_TYPES] };
}

/** Where a card loads a stored logo from. Any other URL is left as it is. */
export function ownOriginImageUrl(url: string): string {
  if (!url.startsWith(PROVIDER_IMAGES)) return url;
  const file = url.slice(PROVIDER_IMAGES.length);
  return brandImageUpstream(file) ? `${OWN_IMAGE_PATH}${file}` : url;
}

import { brandFontUpstream, googleFontUpstream } from "@/src/domain/brand-font-url";
import { serveUpstreamAsset, type AssetFetcher } from "./brand-asset-route";

/** Larger than any card font seen so far (the largest, Noto Sans from Google, is about 630 KB). */
const KILOBYTE = 1024;
const MAX_FONT_BYTES = 3 * KILOBYTE * KILOBYTE;
/** Both hosts name a file by its contents or its version, so a name never changes what it holds. */
const FOREVER = "public, max-age=31536000, immutable";
const FONT_RESPONSE = { maxBytes: MAX_FONT_BYTES, headers: { "cache-control": FOREVER } };

/** Serves one of the brand provider's content-addressed font files from this origin. */
export function serveBrandFont(file: string, fetcher?: AssetFetcher): Promise<Response> {
  return serveUpstreamAsset(brandFontUpstream(file), FONT_RESPONSE, fetcher);
}

/** Serves one Google font file from this origin, so a visitor's browser never asks Google for it. */
export function serveGoogleFont(family: string, version: string, file: string, fetcher?: AssetFetcher): Promise<Response> {
  return serveUpstreamAsset(googleFontUpstream(family, version, file), FONT_RESPONSE, fetcher);
}

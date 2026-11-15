import { brandImageUpstream } from "@/src/domain/brand-image-url";
import { serveUpstreamAsset, type AssetFetcher } from "./brand-asset-route";

/** Several times the largest stored logo seen so far (about 230 KB). */
const KILOBYTE = 1024;
const MAX_IMAGE_BYTES = KILOBYTE * KILOBYTE;
/** A logo's name is a random id, not a hash of its contents, so it is cached for a day rather than forever. */
const ONE_DAY = "public, max-age=86400";
/** An SVG opened on its own could run script; this lets it draw and nothing else. */
const IMAGE_POLICY = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

/** Serves one of the brand provider's logos from this origin. */
export function serveBrandImage(file: string, fetcher?: AssetFetcher): Promise<Response> {
  return serveUpstreamAsset(brandImageUpstream(file), {
    maxBytes: MAX_IMAGE_BYTES,
    headers: { "cache-control": ONE_DAY, "content-security-policy": IMAGE_POLICY },
  }, fetcher);
}

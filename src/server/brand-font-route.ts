import { brandFontUpstream } from "@/src/domain/brand-font-url";

/** Larger than any font file seen from the provider (the largest so far is about 230 KB). */
const KILOBYTE = 1024;
const MAX_FONT_BYTES = 3 * KILOBYTE * KILOBYTE;
const UPSTREAM_TIMEOUT_MS = 10_000;
const NOT_FOUND = 404, BAD_GATEWAY = 502;
/** The file name is a hash of its contents, so a name never changes what it holds. */
const FOREVER = "public, max-age=31536000, immutable";

const failure = (status: number) => new Response(null, { status, headers: { "cache-control": "no-store" } });

/** Closes a response that won't be served, so its connection and buffers are released at once. */
async function discard(response: Response) {
  await response.body?.cancel().catch(() => {});
}

/** Reads at most MAX_FONT_BYTES; null when the body is larger or missing. */
async function boundedBytes(response: Response): Promise<Uint8Array | null> {
  if (Number(response.headers.get("content-length") ?? "0") > MAX_FONT_BYTES) {
    await discard(response);
    return null;
  }
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_FONT_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/**
 * Serves one of the brand provider's font files from this origin. It fetches a fixed host and a
 * content-addressed name only, sends no request data upstream, and passes none of the upstream's headers on.
 */
export async function serveBrandFont(file: string, fetcher: (url: string, init: RequestInit) => Promise<Response> = fetch): Promise<Response> {
  const upstream = brandFontUpstream(file);
  if (!upstream) return failure(NOT_FOUND);
  try {
    const response = await fetcher(upstream.url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS), redirect: "error", credentials: "omit" });
    if (!response.ok) {
      await discard(response);
      return failure(response.status === NOT_FOUND ? NOT_FOUND : BAD_GATEWAY);
    }
    const bytes = await boundedBytes(response);
    if (!bytes || bytes.byteLength === 0) return failure(BAD_GATEWAY);
    return new Response(bytes.buffer as ArrayBuffer, { headers: { "content-type": upstream.contentType, "cache-control": FOREVER, "x-content-type-options": "nosniff" } });
  } catch {
    return failure(BAD_GATEWAY);
  }
}

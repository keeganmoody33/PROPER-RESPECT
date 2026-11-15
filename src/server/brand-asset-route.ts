/** One file this site fetches on a visitor's behalf: a fixed upstream URL and the type it is served as. */
export type UpstreamAsset = { url: string; contentType: string };
export type AssetFetcher = (url: string, init: RequestInit) => Promise<Response>;

const UPSTREAM_TIMEOUT_MS = 10_000;
const NOT_FOUND = 404, BAD_GATEWAY = 502;

const failure = (status: number) => new Response(null, { status, headers: { "cache-control": "no-store" } });

/** Closes a response that won't be served, so its connection and buffers are released at once. */
async function discard(response: Response) {
  await response.body?.cancel().catch(() => {});
}

/** Reads at most maxBytes; null when the body is larger or missing. */
async function boundedBytes(response: Response, maxBytes: number): Promise<Uint8Array | null> {
  if (Number(response.headers.get("content-length") ?? "0") > maxBytes) {
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
    if (size > maxBytes) {
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
 * Serves one checked upstream file from this origin. It sends no request data upstream, follows no redirect,
 * and passes none of the upstream's headers on: the type and every header come from the caller.
 * A null upstream (a name that failed its check) is a 404 with no fetch.
 */
export async function serveUpstreamAsset(
  upstream: UpstreamAsset | null,
  { maxBytes, headers }: { maxBytes: number; headers: Record<string, string> },
  fetcher: AssetFetcher = fetch,
): Promise<Response> {
  if (!upstream) return failure(NOT_FOUND);
  try {
    const response = await fetcher(upstream.url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS), redirect: "error", credentials: "omit" });
    if (!response.ok) {
      await discard(response);
      return failure(response.status === NOT_FOUND ? NOT_FOUND : BAD_GATEWAY);
    }
    const bytes = await boundedBytes(response, maxBytes);
    if (!bytes || bytes.byteLength === 0) return failure(BAD_GATEWAY);
    return new Response(bytes.buffer as ArrayBuffer, { headers: { ...headers, "content-type": upstream.contentType, "x-content-type-options": "nosniff" } });
  } catch {
    return failure(BAD_GATEWAY);
  }
}

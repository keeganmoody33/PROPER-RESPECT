import {
  normalizeProductBrand, productBrandRetrievalSchema,
  type ProductBrandReceipt, type ProductBrandSnapshot, type ProductBrandTypographyRole,
} from "../domain/product-brand.ts";

const API_ROOT = "https://api.context.dev/v1";
const PROVIDER_TIMEOUT_MS = 60_000;
const TRANSPORT_TIMEOUT_MS = 65_000;
const RESPONSE_LIMIT_BYTES = 250 * 1_024;
type Endpoint = ProductBrandReceipt["endpoint"];
type RetrievedResponse = { value?: unknown; receipt: ProductBrandReceipt };
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

async function readJson(response: Response, signal: AbortSignal) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Context.dev response unavailable.");
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  const cancel = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > RESPONSE_LIMIT_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new Error("Context.dev response exceeded its limit.");
      }
      chunks.push(part.value);
    }
  } finally { signal.removeEventListener("abort", cancel); reader.releaseLock(); }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)) as unknown;
}

async function request(endpoint: Endpoint, domain: string, apiKey: string, fetcher: typeof fetch): Promise<RetrievedResponse> {
  const url = new URL(endpoint === "brand" ? `${API_ROOT}/brand/retrieve` : `${API_ROOT}/web/${endpoint}`);
  const timeoutOpts = { milliseconds: PROVIDER_TIMEOUT_MS, behavior: "return-partial" };
  if (endpoint !== "brand") {
    url.searchParams.set("domain", domain);
    url.searchParams.set("timeoutOpts", JSON.stringify(timeoutOpts));
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRANSPORT_TIMEOUT_MS);
  const receipt: ProductBrandReceipt = { endpoint, status: "error" };
  try {
    const retrieve = async (): Promise<RetrievedResponse> => {
      const response = await fetcher(url.toString(), {
        method: endpoint === "brand" ? "POST" : "GET",
        headers: { Authorization: `Bearer ${apiKey}`, ...(endpoint === "brand" ? { "Content-Type": "application/json" } : {}) },
        ...(endpoint === "brand" ? { body: JSON.stringify({ type: "by_domain", domain, timeoutOpts }) } : {}),
        redirect: "error", credentials: "omit", cache: "no-store", signal: controller.signal,
      });
      controller.signal.throwIfAborted();
      receipt.httpStatus = response.status;
      if (!response.ok || response.redirected) {
        await response.body?.cancel().catch(() => undefined);
        return { receipt };
      }
      const value = await readJson(response, controller.signal), object = record(value);
      receipt.status = object.status === "ok" ? "ok" : "unavailable";
      return { value, receipt };
    };
    return await Promise.race([
      retrieve(),
      new Promise<RetrievedResponse>((resolve) => controller.signal.addEventListener("abort", () => resolve({ receipt }), { once: true })),
    ]);
  } catch {
    // Provider/network failures can contain credentials or response bodies.
    return { receipt };
  } finally { clearTimeout(timeout); }
}

/** Only the supported presentation fields survive; provider account metadata never does. */
function retainedResponse(snapshot: ProductBrandSnapshot) {
  const base = (endpoint: Endpoint) => {
    const receipt = snapshot.receipts.find((item) => item.endpoint === endpoint)!;
    return {
      status: receipt.status, ...(receipt.httpStatus ? { code: receipt.httpStatus } : {}),
      ...(receipt.requestId ? { request_id: receipt.requestId } : {}),
      ...(receipt.partial ? { partial: true } : {}),
    };
  };
  const fontLinks = (source: "fonts" | "styleguide") => snapshot.schemaVersion === 2 ? Object.fromEntries(snapshot.fontLinks.filter((link) => link.source === source).map((link) => [link.family, {
    type: link.type, ...(link.category ? { category: link.category } : {}), files: Object.fromEntries(link.files.map((file) => [String(file.weight), file.url])),
  }])) : undefined;
  const typography = (role: ProductBrandTypographyRole | undefined, family: string | undefined) => role ? {
    fontFamily: role.family, fontFallbacks: role.fallbacks,
    ...(role.weight !== undefined ? { fontWeight: role.weight } : {}),
    ...(role.fontSizePx !== undefined ? { fontSize: `${role.fontSizePx}px` } : {}),
    ...(role.lineHeight !== undefined ? { lineHeight: String(role.lineHeight) } : {}),
    ...(role.letterSpacingEm !== undefined ? { letterSpacing: `${role.letterSpacingEm}em` } : {}),
  } : family ? { fontFamily: family } : undefined;
  const roles = snapshot.schemaVersion === 2 ? snapshot.styleguide?.typography : undefined;
  const heading = typography(roles?.heading, snapshot.styleguide?.headingFamily), body = typography(roles?.body, snapshot.styleguide?.bodyFamily);
  return {
    // This is explicitly a normalized, allowlisted response projection, not the full provider body.
    format: `context.dev/presentation-projection-v${snapshot.schemaVersion}`,
    brand: { ...base("brand"), brand: {
      domain: snapshot.canonicalDomain,
      logos: snapshot.logos.map(({ width, height, ...logo }) => ({ ...logo, ...(width || height ? { resolution: { ...(width ? { width } : {}), ...(height ? { height } : {}) } } : {}) })),
      colors: snapshot.colors,
    } },
    fonts: { ...base("fonts"), domain: snapshot.canonicalDomain, fonts: snapshot.fonts.map(({ family, ...font }) => ({ font: family, ...font })), ...(snapshot.schemaVersion === 2 ? { fontLinks: fontLinks("fonts") } : {}) },
    styleguide: { ...base("styleguide"), domain: snapshot.canonicalDomain, ...(snapshot.styleguide ? { styleguide: {
      mode: snapshot.styleguide.mode, colors: snapshot.styleguide.colors,
      typography: {
        ...(heading ? { headings: { h1: heading } } : {}),
        ...(body ? { p: body } : {}),
      },
      ...(snapshot.schemaVersion === 2 ? { fontLinks: fontLinks("styleguide") } : {}),
    } } : {}) },
  };
}

/** Caller must verify canonical product/domain eligibility before retrieval and persist the result.
 * Never call this from card render; it performs no owner/evidence writes or publication.
 */
export async function retrieveProductBrand(
  input: { productSlug: string; canonicalDomain: string; retrievalId?: string; retrievedAt?: string },
  options: { apiKey: string; fetcher?: typeof fetch },
): Promise<{ snapshot: ProductBrandSnapshot; response: unknown }> {
  if (!options.apiKey.trim() || /[\r\n]/.test(options.apiKey)) throw new Error("Context.dev API key is not configured.");
  const metadata = productBrandRetrievalSchema.parse({
    ...input, retrievalId: input.retrievalId ?? crypto.randomUUID(), retrievedAt: input.retrievedAt ?? new Date().toISOString(), responseHash: "0".repeat(64),
  });
  const fetcher = options.fetcher ?? fetch;
  const brand = await request("brand", metadata.canonicalDomain, options.apiKey, fetcher);
  // Fail identity mismatch before issuing optional paid requests.
  normalizeProductBrand(metadata, { brand: brand.value });
  const [fonts, styleguide] = await Promise.all([
    request("fonts", metadata.canonicalDomain, options.apiKey, fetcher),
    request("styleguide", metadata.canonicalDomain, options.apiKey, fetcher),
  ]);
  const snapshot = normalizeProductBrand({ ...metadata, receipts: [brand.receipt, fonts.receipt, styleguide.receipt] }, { brand: brand.value, fonts: fonts.value, styleguide: styleguide.value });
  const response = retainedResponse(snapshot), responseJson = JSON.stringify(response);
  const encoded = new TextEncoder().encode(responseJson);
  if (encoded.byteLength > RESPONSE_LIMIT_BYTES) throw new Error("Context.dev response exceeded its limit.");
  if (responseJson.includes(options.apiKey)) throw new Error("Context.dev returned invalid presentation data.");
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  snapshot.responseHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return { snapshot, response };
}

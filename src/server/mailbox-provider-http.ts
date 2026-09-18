import {
  buildCodeExchangeRequest, buildRefreshRequest, buildIdentityRequest, parseProviderIdentity,
  parseTokenResponse, type MailboxOAuthConfig,
} from "./mailbox-oauth";
import type { MailboxCredential } from "./mailbox-credentials";

const RESPONSE_LIMIT_BYTES = 128 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;

/** Status only; never retain provider bodies, URLs, headers or tokens in errors. */
export class MailboxProviderError extends Error {
  constructor(readonly status: number) { super("Mailbox provider request failed."); }
}

async function readProviderJson(response: Response): Promise<unknown> {
  if (!response.ok || response.redirected) {
    await response.body?.cancel().catch(() => undefined);
    throw new MailboxProviderError(response.status);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Invalid mailbox provider JSON.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      let part: ReadableStreamReadResult<Uint8Array>;
      try { part = await reader.read(); }
      catch { throw new Error("Mailbox provider request failed."); }
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > RESPONSE_LIMIT_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new Error("Mailbox provider response exceeded its limit.");
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)); }
  catch { throw new Error("Invalid mailbox provider JSON."); }
}

export async function requestMailboxJson(request: ReturnType<typeof buildIdentityRequest>, fetcher: typeof fetch) {
  const { url, ...options } = request;
  let response: Response;
  try {
    response = await fetcher(url, {
      ...options, credentials: "omit", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    // Network libraries may include URLs, headers or provider content in errors.
    throw new Error("Mailbox provider request failed.");
  }
  return await readProviderJson(response);
}

/**
 * Server-only provider verification. The caller MUST first atomically consume
 * owner/provider/expiry/generation-bound OAuth state and its stored verifier.
 * This function performs no persistence or publication; a successful grant
 * says nothing about whether the owner used any discovered product.
 * The injected fetcher is a test seam, never client-controlled input.
 */
export async function exchangeMailboxAuthorization(
  config: MailboxOAuthConfig,
  input: { code: string; verifier: string; clientSecret: string },
  fetcher: typeof fetch = fetch,
) {
  return await verifyGrant(config, buildCodeExchangeRequest(config, input), fetcher);
}

/** Caller must generation-check both credential retrieval and atomic rotation persistence. */
export async function refreshMailboxAuthorization(
  config: MailboxOAuthConfig,
  input: { refreshToken: string; clientSecret: string; expectedProviderAccountId: string },
  fetcher: typeof fetch = fetch,
) {
  if (!input.expectedProviderAccountId) throw new Error("Mailbox provider account is required.");
  return await verifyGrant(config, buildRefreshRequest(config, input), fetcher, input);
}

async function verifyGrant(
  config: MailboxOAuthConfig,
  request: ReturnType<typeof buildCodeExchangeRequest>,
  fetcher: typeof fetch,
  previous?: { refreshToken: string; expectedProviderAccountId: string },
) {
  const startedAt = Date.now();
  const tokenResponse = await requestMailboxJson(request, fetcher);
  const tokens = parseTokenResponse(config.provider, tokenResponse, { isRefresh: previous !== undefined });
  const expiresAt = startedAt + tokens.expiresInSeconds * 1000;
  if (!Number.isSafeInteger(expiresAt)) throw new Error("Invalid provider token expiry.");
  // An ID token is not decoded or substituted when this authoritative call fails.
  const identityResponse = await requestMailboxJson(buildIdentityRequest(config.provider, tokens.accessToken), fetcher);
  const identity = parseProviderIdentity(config.provider, identityResponse);
  if (previous && identity.providerAccountId !== previous.expectedProviderAccountId) throw new Error("Mailbox provider account changed.");
  const refreshToken = tokens.refreshToken ?? previous?.refreshToken;
  if (!refreshToken) throw new Error("Mailbox refresh credential unavailable.");
  const credential: MailboxCredential = {
    accessToken: tokens.accessToken, refreshToken, expiresAt,
  };
  return { identity, credential, scopes: tokens.scopes };
}

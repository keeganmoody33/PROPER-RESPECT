import { resolveProduct, type RawSignal } from "../domain/discovery";
import { senderDomain } from "../domain/mailbox-sender";
import { requestMailboxJson } from "./mailbox-provider-http";
import { MAILBOX_PAGE_LIMIT } from "./mailbox-search";

export class MailboxCursorError extends Error {
  constructor() { super("Gmail cursor did not advance."); this.name = "MailboxCursorError"; }
}

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
const STORED_LIMIT = 65536;
const idPattern = /^[a-zA-Z0-9_-]{1,512}$/;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Gmail response.");
  return value as Record<string, unknown>;
}

function cursorValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !value.length || value.length > 8192 || /[^\x20-\x7e]/.test(value)) throw new Error("Invalid Gmail cursor.");
  return value;
}

function requestJson(url: URL, token: string, fetcher: typeof fetch): Promise<unknown> {
  return requestMailboxJson({
    url: url.toString(), method: "GET", headers: { Authorization: `Bearer ${token}` },
    redirect: "error", cache: "no-store",
  }, fetcher);
}

function signalFromMessage(value: unknown, expectedId: string, account: string, retainUnknown: boolean) {
  const message = object(value);
  if (message.id !== expectedId || typeof message.internalDate !== "string" || !/^\d{1,16}$/.test(message.internalDate)) throw new Error("Invalid Gmail message identity or date.");
  const timestamp = Number(message.internalDate);
  if (!Number.isSafeInteger(timestamp) || timestamp < 0 || timestamp > 8640000000000000 || !Number.isFinite(new Date(timestamp).getTime())) throw new Error("Invalid Gmail message date.");
  const sourceHeaders = object(message.payload).headers;
  if (!Array.isArray(sourceHeaders) || sourceHeaders.length > 100) throw new Error("Invalid Gmail headers.");
  const headers: Record<string, string> = {};
  for (const raw of sourceHeaders) {
    const header = object(raw);
    if (typeof header.name !== "string" || typeof header.value !== "string") throw new Error("Invalid Gmail header.");
    const name = header.name.toLowerCase();
    if (!["from", "subject", "date"].includes(name)) continue;
    if (headers[name] !== undefined) throw new Error("Ambiguous Gmail header.");
    headers[name] = header.value;
  }
  const payload = JSON.stringify({ id: expectedId, internalDate: message.internalDate,
    headers: { from: headers.from ?? null, subject: headers.subject ?? null, date: headers.date ?? null } });
  if (new TextEncoder().encode(payload).byteLength > STORED_LIMIT) throw new Error("Gmail evidence exceeded its limit.");
  const domain = senderDomain(headers.from ?? "");
  const candidate: RawSignal = {
    sourceType: "GMAIL", sourceRecordId: expectedId, capturedAt: new Date().toISOString(),
    ...(domain ? { url: `https://${domain}` } : {}), payload, observations: [],
    captureProvenance: { version: 1, route: "DIRECT_API", adapter: { id: "gmail-metadata-v1", version: "1" },
      origin: { issuer: "GOOGLE", accountId: account, recordId: expectedId },
      collector: { kind: "SYSTEM" }, activityActor: { kind: "UNKNOWN" } },
  };
  const product = resolveProduct(candidate);
  // resolveProduct also derives unknown domains. A name-only catalog round trip,
  // with canonical-domain equality, excludes those fallback inventions.
  const known = product ? resolveProduct({ ...candidate, url: undefined, vendor: product.name }) : null;
  if (known && known.domain === product?.domain) return { signal: { ...candidate, vendor: known.name }, messageAt: new Date(timestamp).toISOString() };
  if (!retainUnknown) return { messageAt: new Date(timestamp).toISOString() };
  // An unmatched sender is a private piece of source text, not a canonical
  // product identity. Omit identity hints so ingestion creates no guessed prop.
  return { signal: { ...candidate, url: undefined }, messageAt: new Date(timestamp).toISOString(),
    unknown: { sourceRecordId: expectedId, ...(domain ? { senderDomain: domain } : {}) } };
}

/** Reads one private discovery page. Caller owns account generation checks and atomic persistence. */
export async function readGmailPage(
  input: { accessToken: string; providerAccountId: string; cursor: string | null; query?: string; retainUnknown?: boolean },
  fetcher: typeof fetch = fetch,
): Promise<{ signals: RawSignal[]; nextCursor: string | null; complete: boolean; readCount: number;
  unknown?: Array<{ sourceRecordId: string; senderDomain?: string }>; observedEarliest?: string; observedLatest?: string }> {
  if (!/^[\x21-\x7e]{1,16384}$/.test(input.accessToken) || !/^[\x21-\x7e]{1,255}$/.test(input.providerAccountId)) throw new Error("Invalid Gmail credential or account.");
  const cursor = cursorValue(input.cursor);
  const listUrl = new URL(BASE);
  listUrl.searchParams.set("maxResults", String(MAILBOX_PAGE_LIMIT));
  if (input.query !== undefined) {
    if (!input.query.trim() || input.query.length > 4096 || /[\u0000-\u001f\u007f]/.test(input.query)) throw new Error("Invalid Gmail search.");
    listUrl.searchParams.set("q", input.query);
  }
  if (cursor !== null) listUrl.searchParams.set("pageToken", cursor);
  const list = object(await requestJson(listUrl, input.accessToken, fetcher));
  const messages = list.messages === undefined ? [] : list.messages;
  if (!Array.isArray(messages) || messages.length > MAILBOX_PAGE_LIMIT) throw new Error("Invalid Gmail page size.");
  const nextCursor = cursorValue(list.nextPageToken);
  if (nextCursor !== null && nextCursor === cursor) throw new MailboxCursorError();
  const ids = messages.map(item => {
    const id = object(item).id;
    if (typeof id !== "string" || !idPattern.test(id)) throw new Error("Invalid Gmail message ID.");
    return id;
  });
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate Gmail message ID.");
  const signals: RawSignal[] = [];
  const unknown: Array<{ sourceRecordId: string; senderDomain?: string }> = [];
  const dates: string[] = [];
  for (const id of ids) {
    const url = new URL(`${BASE}/${encodeURIComponent(id)}`);
    url.searchParams.set("format", "metadata");
    for (const name of ["From", "Subject", "Date"]) url.searchParams.append("metadataHeaders", name);
    const capture = signalFromMessage(await requestJson(url, input.accessToken, fetcher), id, input.providerAccountId, input.retainUnknown ?? false);
    if (capture.signal) signals.push(capture.signal);
    if (capture.unknown) unknown.push(capture.unknown);
    dates.push(capture.messageAt);
  }
  dates.sort();
  return { signals, nextCursor, complete: nextCursor === null, readCount: ids.length,
    ...(input.retainUnknown ? { unknown, ...(dates.length ? { observedEarliest: dates[0], observedLatest: dates.at(-1) } : {}) } : {}),
  };
}

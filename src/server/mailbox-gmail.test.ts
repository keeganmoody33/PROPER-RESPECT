import { describe, expect, it, vi } from "vitest";
import { readGmailPage } from "./mailbox-gmail";

const input = { accessToken: "private-token", providerAccountId: "google-sub", cursor: null };
const message = (id = "abc123", from = "GitHub <news@github.com>") => ({
  id, internalDate: "1750000000000", payload: { headers: [
    { name: "Subject", value: "Try our new product" },
    { name: "From", value: from }, { name: "Date", value: "Sun, 15 Jun 2025 15:06:40 +0000" },
  ] },
});
const fetchFor = (...values: unknown[]) => vi.fn<typeof fetch>().mockImplementation(async () => Response.json(values.shift()));

describe("bounded Gmail metadata adapter", () => {
  it("reads fixed metadata endpoints and emits only a private candidate with original attribution", async () => {
    const fetcher = fetchFor({ messages: [{ id: "abc123" }], nextPageToken: "next+/=" }, message());
    const page = await readGmailPage(input, fetcher);
    expect(page).toMatchObject({ complete: false, nextCursor: "next+/=", readCount: 1 });
    expect(page.signals).toHaveLength(1);
    expect(page.signals[0]).toMatchObject({ sourceType: "GMAIL", sourceRecordId: "abc123", vendor: "GitHub", observations: [],
      captureProvenance: { version: 1, route: "DIRECT_API", origin: { issuer: "GOOGLE", accountId: "google-sub", recordId: "abc123" }, collector: { kind: "SYSTEM" }, activityActor: { kind: "UNKNOWN" } } });
    const listUrl = new URL(String(fetcher.mock.calls[0][0]));
    expect(listUrl.origin + listUrl.pathname).toBe("https://gmail.googleapis.com/gmail/v1/users/me/messages");
    expect(listUrl.searchParams.get("maxResults")).toBe("5");
    const getUrl = new URL(String(fetcher.mock.calls[1][0]));
    expect(getUrl.pathname).toBe("/gmail/v1/users/me/messages/abc123");
    expect(getUrl.searchParams.get("format")).toBe("metadata");
    expect(getUrl.searchParams.getAll("metadataHeaders")).toEqual(["From", "Subject", "Date"]);
    for (const [, options] of fetcher.mock.calls) expect(options).toMatchObject({ method: "GET", redirect: "error", cache: "no-store", credentials: "omit", headers: { Authorization: "Bearer private-token" }, signal: expect.any(AbortSignal) });
    const replay = await readGmailPage(input, fetchFor({ messages: [{ id: "abc123" }] }, message()));
    expect(replay.signals.map(signal => ({ ...signal, capturedAt: "ignored" }))).toEqual(page.signals.map(signal => ({ ...signal, capturedAt: "ignored" })));
  });
  it("returns no invented candidate for empty mailboxes", async () => {
    expect(await readGmailPage(input, fetchFor({}))).toEqual({ signals: [], nextCursor: null, complete: true, readCount: 0 });
  });
  it("retains unknown headers without proposing a product when private review is requested", async () => {
    const fetcher = fetchFor({ messages: [{ id: "abc123" }] }, message("abc123", "Product news <news@unlisted.example>"));
    const result = await readGmailPage({ ...input, query: "after:1750000000 before:1800000000", retainUnknown: true }, fetcher);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0]).toMatchObject({ sourceRecordId: "abc123", observations: [] });
    expect(result.signals[0].vendor).toBeUndefined();
    expect(result.signals[0].url).toBeUndefined();
    expect(result.unknown).toEqual([{ sourceRecordId: "abc123", senderDomain: "unlisted.example" }]);
    expect(result.observedEarliest).toBe("2025-06-15T15:06:40.000Z");
    expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.get("q")).toBe("after:1750000000 before:1800000000");
  });
  it.each(["news@unknown.example", "GitHub <news@github.evil>", "news@github.com.evil", "news@github.com, other@evil.com"])("does not infer a product from unknown or ambiguous sender %s", async from => {
    const result = await readGmailPage(input, fetchFor({ messages: [{ id: "abc123" }] }, message("abc123", from)));
    expect(result.signals).toEqual([]);
    expect(result.readCount).toBe(1);
  });
  it("encodes cursors as query data and limits the page to five metadata calls", async () => {
    const messages = Array.from({ length: 5 }, (_, i) => ({ id: `a${i}` }));
    const fetcher = fetchFor({ messages }, ...messages.map(m => message(m.id)));
    await readGmailPage({ ...input, cursor: "token&evil=yes" }, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(6);
    expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.get("pageToken")).toBe("token&evil=yes");
  });
  it.each(["../secret", "abc?x=1", "a".repeat(513), ""])("rejects malicious/invalid message ID", async id => {
    const fetcher = fetchFor({ messages: [{ id }] });
    await expect(readGmailPage(input, fetcher)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects excess list entries before reading any message", async () => {
    const fetcher = fetchFor({ messages: Array.from({ length: 6 }, (_, i) => ({ id: `a${i}` })) });
    await expect(readGmailPage(input, fetcher)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(["not-a-date", "99999999999999999999", "-1"])("rejects invalid internal date", async internalDate => {
    await expect(readGmailPage(input, fetchFor({ messages: [{ id: "abc123" }] }, { ...message(), internalDate }))).rejects.toThrow();
  });
  it("rejects mismatched returned message identity", async () => {
    await expect(readGmailPage(input, fetchFor({ messages: [{ id: "abc123" }] }, message("different")))).rejects.toThrow();
  });
  it.each([302, 401, 429, 500])("rejects HTTP %s with sanitized errors", async status => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("private content", { status }));
    await expect(readGmailPage(input, fetcher)).rejects.toThrow("Mailbox provider request failed.");
  });
  it("rejects malformed JSON and oversized responses", async () => {
    for (const body of ["bad-json", " ".repeat(128 * 1024 + 1)]) {
      await expect(readGmailPage(input, vi.fn<typeof fetch>().mockResolvedValue(new Response(body)))).rejects.toThrow();
    }
  });
  it("rejects oversized stored payload, duplicate From, and repeated cursor", async () => {
    const huge = message(); huge.payload.headers[0].value = "x".repeat(65536);
    const duplicate = message(); duplicate.payload.headers.push({ name: "from", value: "other@github.com" });
    for (const value of [huge, duplicate]) await expect(readGmailPage(input, fetchFor({ messages: [{ id: "abc123" }] }, value))).rejects.toThrow();
    await expect(readGmailPage({ ...input, cursor: "same" }, fetchFor({ nextPageToken: "same" }))).rejects.toThrow();
  });
  it("validates credentials/account/cursor before networking", async () => {
    const fetcher = fetchFor({});
    for (const bad of [{ ...input, accessToken: "bad\nheader" }, { ...input, providerAccountId: "" }, { ...input, cursor: "x".repeat(8193) }]) {
      await expect(readGmailPage(bad, fetcher)).rejects.toThrow();
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
});

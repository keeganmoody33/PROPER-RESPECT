/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { decryptMailboxCredential } from "../src/server/mailbox-credentials";
const modules = import.meta.glob("./**/*.ts");
const start = api.mailboxGoogle.start;
const callback = api.mailboxGoogle.callback;
const read = api.mailboxGoogle.read;
const keyring = { activeVersion: "v1", keys: { v1: Buffer.alloc(32, 3).toString("base64") } };
const scope = "openid email https://www.googleapis.com/auth/gmail.readonly";
beforeEach(() => {
  vi.stubEnv("MAILBOX_GOOGLE_CLIENT_ID", "client");
  vi.stubEnv("MAILBOX_GOOGLE_CLIENT_SECRET", "client-secret");
  vi.stubEnv("MAILBOX_APPLICATION_ORIGIN", "https://props.example.test");
  vi.stubEnv("MAILBOX_ENCRYPTION_ACTIVE_VERSION", "v1");
  vi.stubEnv("MAILBOX_ENCRYPTION_KEYS", JSON.stringify(keyring.keys));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });
async function setup() {
  const t = convexTest(schema, modules);
  const ownerId = await t.run(ctx => ctx.db.insert("users", { handle: "owner", authSubject: "owner", displayName: "Owner", bio: "" }));
  await t.run(ctx => ctx.db.insert("users", { handle: "other", authSubject: "other", displayName: "Other", bio: "" }));
  return { t, ownerId, owner: t.withIdentity({ subject: "owner" }), other: t.withIdentity({ subject: "other" }) };
}
function provider(account = "google-sub", grantedScope = scope) {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async input => {
    const url = String(input);
    if (url === "https://oauth2.googleapis.com/token") return Response.json({ access_token: "access", refresh_token: "refresh", expires_in: 3600, token_type: "Bearer", scope: grantedScope });
    if (url === "https://openidconnect.googleapis.com/v1/userinfo") return Response.json({ sub: account, email: `${account}@example.test`, email_verified: true });
    if (url.includes("/messages?")) return Response.json({ messages: [{ id: "123abc" }] });
    if (url.includes("/messages/123abc?")) return Response.json({ id: "123abc", internalDate: "1750000000000", payload: { headers: [{ name: "From", value: "GitHub <news@github.com>" }, { name: "Subject", value: "Try our product" }] } });
    throw new Error("Unexpected HTTP endpoint");
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
function stateFrom(result: { url: string }) { return new URL(result.url).searchParams.get("state")!; }
function reply(state: string) { return { query: new URLSearchParams({ state, code: "authorization-code" }).toString() }; }

test("real OAuth helpers, owner-bound state, new-generation encryption and bounded Gmail discovery save only a private candidate", async () => {
  const { t, owner, ownerId } = await setup();
  const fetcher = provider();
  const state = stateFrom(await owner.action(start, {}));
  const connection = await owner.action(callback, reply(state));
  expect(connection.generation).toBe(1);
  const secret = (await t.run(ctx => ctx.db.query("mailboxSecrets").unique()))!;
  const context = { ownerId, provider: "GOOGLE" as const, providerAccountId: "google-sub", generation: 1 };
  expect(decryptMailboxCredential(secret.credential, context, keyring)).toMatchObject({ accessToken: "access", refreshToken: "refresh" });
  expect(() => decryptMailboxCredential(secret.credential, { ...context, generation: 2 }, keyring)).toThrow();
  await expect(owner.action(callback, reply(state))).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(2);
  const result = await owner.action(read, { accountId: connection.accountId, expectedGeneration: 1 });
  expect(result.readCount).toBe(1);
  expect(result.proposals).toBe(1);
  const raw = (await t.run(ctx => ctx.db.query("rawEvidence").unique()))!;
  expect(raw.captureProvenance).toMatchObject({ route: "DIRECT_API", collector: { kind: "SYSTEM" }, activityActor: { kind: "UNKNOWN" }, origin: { issuer: "GOOGLE", accountId: "google-sub", recordId: "123abc" } });
  expect(raw.observations ?? []).toEqual([]);
  expect(await t.run(ctx => ctx.db.query("usageSignals").collect())).toEqual([]);
  expect((await owner.query(api.onboarding.getState, {}))!.cards[0].prop.visibility).toBe("DRAFT");
  expect(await t.query(api.publicProfiles.getByHandle, { handle: "owner" })).toBeNull();
});

test("cross-owner and expired OAuth states fail before provider I/O", async () => {
  vi.useFakeTimers();
  const { owner, other } = await setup();
  const fetcher = provider();
  const state = stateFrom(await owner.action(start, {}));
  await expect(other.action(callback, reply(state))).rejects.toThrow();
  vi.advanceTimersByTime(11 * 60 * 1000);
  await expect(owner.action(callback, reply(state))).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});

test("Gmail read returns pending relationship ambiguity to its caller without choosing an existing record", async () => {
  const { t, owner, ownerId } = await setup();
  provider();
  await t.run(async ctx => {
    const productId = await ctx.db.insert("products", { name: "GitHub", slug: "github", domain: "github.com", description: "" });
    for (const status of ["ACTIVE", "ARCHIVED"] as const) await ctx.db.insert("props", {
      userId: ownerId, productId, status, visibility: "PRIVATE", headline: "Saved choice", note: "Preserve",
    });
  });
  const before = await t.run(ctx => ctx.db.query("props").collect());
  const connection = await owner.action(callback, reply(stateFrom(await owner.action(start, {}))));
  expect(await owner.action(read, { accountId: connection.accountId, expectedGeneration: 1 })).toMatchObject({
    readCount: 1, proposals: 1, hasMore: false,
    ambiguousProducts: [{ productSlug: "github", reason: "MULTIPLE_OWNER_RELATIONSHIPS" }],
  });
  expect(await t.run(ctx => ctx.db.query("props").collect())).toEqual(before);
  expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toHaveLength(1);
  expect(await t.run(ctx => ctx.db.query("proofs").collect())).toEqual([]);
});

test.each(["openid email", `${scope} https://www.googleapis.com/auth/gmail.modify`])("partial or broad grant cannot create an account: %s", async granted => {
  const { t, owner } = await setup();
  provider("google-sub", granted);
  const state = stateFrom(await owner.action(start, {}));
  await expect(owner.action(callback, reply(state))).rejects.toThrow();
  expect(await t.run(ctx => ctx.db.query("mailboxAccounts").collect())).toEqual([]);
  await expect(owner.action(callback, reply(state))).rejects.toThrow();
});

test("new account intent cannot silently reconnect and reconnect intent cannot change provider identity", async () => {
  const { t, owner } = await setup();
  provider();
  const connection = await owner.action(callback, reply(stateFrom(await owner.action(start, {}))));
  await expect(owner.action(callback, reply(stateFrom(await owner.action(start, {}))))).rejects.toThrow();
  expect((await t.run(ctx => ctx.db.get(connection.accountId)))?.generation).toBe(1);
  const state = stateFrom(await owner.action(start, { accountId: connection.accountId, expectedGeneration: 1 }));
  provider("different-sub");
  await expect(owner.action(callback, reply(state))).rejects.toThrow();
  expect(await t.run(ctx => ctx.db.query("mailboxAccounts").collect())).toHaveLength(1);
});

test("disconnect during OAuth exchange or Gmail read rejects stale persistence", async () => {
  const { t, owner } = await setup();
  const real = provider();
  const connection = await owner.action(callback, reply(stateFrom(await owner.action(start, {}))));
  const reconnect = stateFrom(await owner.action(start, { accountId: connection.accountId, expectedGeneration: 1 }));
  vi.stubGlobal("fetch", async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (String(input).includes("userinfo")) await owner.mutation(api.mailboxes.disconnect, { accountId: connection.accountId, expectedGeneration: 1 });
    return real(input, init);
  });
  await expect(owner.action(callback, reply(reconnect))).rejects.toThrow();
  expect(await t.run(ctx => ctx.db.query("mailboxSecrets").collect())).toEqual([]);
  provider();
  const resumed = await owner.action(callback, reply(stateFrom(await owner.action(start, { accountId: connection.accountId, expectedGeneration: 2 }))));
  const http = provider();
  vi.stubGlobal("fetch", async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (String(input).includes("/messages?")) await owner.mutation(api.mailboxes.disconnect, { accountId: connection.accountId, expectedGeneration: resumed.generation });
    return http(input, init);
  });
  await expect(owner.action(read, { accountId: connection.accountId, expectedGeneration: resumed.generation })).rejects.toThrow();
  expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toEqual([]);
  expect(await t.run(ctx => ctx.db.query("mailboxBatches").collect())).toEqual([]);
});

test("denied, malformed, superseded and provider-mismatched states fail closed without provider I/O", async () => {
  const { t, owner } = await setup();
  const fetcher = provider();
  const first = stateFrom(await owner.action(start, {}));
  const second = stateFrom(await owner.action(start, {}));
  await expect(owner.action(callback, reply(first))).rejects.toThrow();
  await expect(owner.action(callback, { query: new URLSearchParams({ state: second, error: "access_denied", error_description: "private provider response" }).toString() })).rejects.toThrow("Gmail authorization failed");
  await expect(owner.action(callback, reply(second))).rejects.toThrow();
  const third = stateFrom(await owner.action(start, {}));
  await expect(owner.action(callback, { query: `state=${third}&state=${third}&code=code` })).rejects.toThrow();
  await t.run(async ctx => {
    const pending = (await ctx.db.query("mailboxOAuthStates").unique())!;
    await ctx.db.patch(pending._id, { provider: "MICROSOFT" });
  });
  await expect(owner.action(callback, reply(third))).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});

test("callback expiry during exchange cannot install credentials", async () => {
  const { t, owner } = await setup();
  const http = provider();
  const state = stateFrom(await owner.action(start, {}));
  vi.stubGlobal("fetch", async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (String(input).includes("userinfo")) await t.run(async ctx => {
      const pending = (await ctx.db.query("mailboxOAuthStates").unique())!;
      await ctx.db.patch(pending._id, { expiresAt: Date.now() - 1 });
    });
    return http(input, init);
  });
  await expect(owner.action(callback, reply(state))).rejects.toThrow();
  expect(await t.run(ctx => ctx.db.query("mailboxAccounts").collect())).toEqual([]);
  expect(await t.run(ctx => ctx.db.query("mailboxSecrets").collect())).toEqual([]);
});

test("two Gmail accounts have independent identities and credentials; reconnect uses the new generation AAD", async () => {
  const { t, owner, other, ownerId } = await setup();
  provider("google-a");
  const a = await owner.action(callback, reply(stateFrom(await owner.action(start, {}))));
  provider("google-b");
  const b = await owner.action(callback, reply(stateFrom(await owner.action(start, {}))));
  expect(a.accountId).not.toBe(b.accountId);
  await expect(other.action(start, { accountId: a.accountId, expectedGeneration: 1 })).rejects.toThrow();
  await expect(other.action(read, { accountId: a.accountId, expectedGeneration: 1 })).rejects.toThrow();
  await owner.mutation(api.mailboxes.disconnect, { accountId: a.accountId, expectedGeneration: 1 });
  await expect(owner.action(start, { accountId: a.accountId, expectedGeneration: 1 })).rejects.toThrow();
  provider("google-a");
  const reconnected = await owner.action(callback, reply(stateFrom(await owner.action(start, { accountId: a.accountId, expectedGeneration: 2 }))));
  expect(reconnected).toEqual({ accountId: a.accountId, generation: 3 });
  const secrets = await t.run(ctx => ctx.db.query("mailboxSecrets").collect());
  expect(secrets).toHaveLength(2);
  const aSecret = secrets.find(s => s.accountId === a.accountId)!;
  const context = { ownerId, provider: "GOOGLE" as const, providerAccountId: "google-a", generation: 3 };
  expect(decryptMailboxCredential(aSecret.credential, context, keyring).accessToken).toBe("access");
  expect(() => decryptMailboxCredential(aSecret.credential, { ...context, generation: 2 }, keyring)).toThrow();
  const safe = await owner.query(api.mailboxes.listAccounts, {});
  expect(JSON.stringify(safe)).not.toMatch(/ciphertext|refresh|verifier|stateHash|accessToken/);
});

test("bounded pages resume their cursor; failed reads release the lease without evidence or cursor writes", async () => {
  const { t, owner } = await setup();
  provider();
  const connection = await owner.action(callback, reply(stateFrom(await owner.action(start, {}))));
  const args = { accountId: connection.accountId, expectedGeneration: 1 };
  const first = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ messages: [], nextPageToken: "page-two" }));
  vi.stubGlobal("fetch", first);
  expect(await owner.action(read, args)).toEqual({ readCount: 0, proposals: 0, hasMore: true });
  expect((await t.run(ctx => ctx.db.get(connection.accountId)))?.cursor).toBe("page-two");
  expect((await owner.query(api.mailboxes.listAccounts, {}))[0].lastReadStatus).toBe("COMPLETE");
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response("private", { status: 500 })));
  await expect(owner.action(read, args)).rejects.toThrow("Gmail read failed");
  expect((await t.run(ctx => ctx.db.get(connection.accountId)))?.cursor).toBe("page-two");
  expect((await owner.query(api.mailboxes.listAccounts, {}))[0].lastReadStatus).toBe("FAILED");
  const final = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ messages: [] }));
  vi.stubGlobal("fetch", final);
  expect(await owner.action(read, args)).toEqual({ readCount: 0, proposals: 0, hasMore: false });
  expect(new URL(String(final.mock.calls[0][0])).searchParams.get("pageToken")).toBe("page-two");
  expect((await t.run(ctx => ctx.db.get(connection.accountId)))?.cursor).toBeNull();
  expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toEqual([]);
  expect(await t.run(ctx => ctx.db.query("draftImports").collect())).toEqual([]);
});

test("expired credential is refreshed and encrypted under the current generation before a Gmail read", async () => {
  vi.useFakeTimers();
  const { t, owner } = await setup();
  const fetcher = provider();
  const connection = await owner.action(callback, reply(stateFrom(await owner.action(start, {}))));
  vi.advanceTimersByTime(3600_000);
  fetcher.mockClear();
  vi.stubGlobal("fetch", async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (String(input) === "https://oauth2.googleapis.com/token") {
      fetcher(input, init);
      return Response.json({ access_token: "rotated-access", refresh_token: "rotated-refresh", expires_in: 3600, token_type: "Bearer", scope });
    }
    return fetcher(input, init);
  });
  expect(await owner.action(read, { accountId: connection.accountId, expectedGeneration: 1 })).toMatchObject({ readCount: 1, proposals: 1 });
  expect(fetcher.mock.calls.map(call => String(call[0])).slice(0, 2)).toEqual(["https://oauth2.googleapis.com/token", "https://openidconnect.googleapis.com/v1/userinfo"]);
  expect((await owner.query(api.mailboxes.listAccounts, {}))[0].status).toBe("CONNECTED");
  expect(await t.run(ctx => ctx.db.query("mailboxSecrets").unique())).toMatchObject({ generation: 1, revision: 1 });
  const secret = (await t.run(ctx => ctx.db.query("mailboxSecrets").unique()))!;
  const account = (await t.run(ctx => ctx.db.get(connection.accountId)))!;
  expect(decryptMailboxCredential(secret.credential, { ownerId: account.ownerId, provider: "GOOGLE", providerAccountId: "google-sub", generation: 1 }, keyring)).toMatchObject({ accessToken: "rotated-access", refreshToken: "rotated-refresh" });
});

test("known, historical and incremental searches own independent fixed queries and cursors", async () => {
  const { t, owner } = await setup();
  provider();
  const connection = await owner.action(callback, reply(stateFrom(await owner.action(start, {}))));
  const args = { accountId: connection.accountId, expectedGeneration: 1 };
  await t.run(ctx => ctx.db.patch(connection.accountId, { cursor: "legacy-page" }));
  const calls: URL[] = [];
  vi.stubGlobal("fetch", async (input: Parameters<typeof fetch>[0]) => {
    const url = new URL(String(input)); calls.push(url);
    return Response.json({ messages: [], nextPageToken: `page-${calls.length}` });
  });
  await owner.action(read, { ...args, mode: "KNOWN_PRODUCTS" });
  await owner.action(read, { ...args, mode: "HISTORY" });
  await owner.action(read, { ...args, mode: "INCREMENTAL" });
  await owner.action(read, { ...args, mode: "KNOWN_PRODUCTS" });
  expect(calls[0].searchParams.get("q")).toContain("from:wisprflow.ai");
  expect(calls[0].searchParams.get("q")).toContain("from:github.com");
  expect(calls[1].searchParams.get("q")).toMatch(/^before:\d+$/);
  expect(calls[2].searchParams.get("q")).toMatch(/^after:\d+ before:\d+$/);
  expect(calls[3].searchParams.get("q")).toBe(calls[0].searchParams.get("q"));
  expect(calls[3].searchParams.get("pageToken")).toBe("page-1");
  expect(calls.slice(0, 3).every(url => !url.searchParams.has("pageToken"))).toBe(true);
  expect((await t.run(ctx => ctx.db.get(connection.accountId)))?.cursor).toBe("legacy-page");
  const contexts = await t.run(ctx => ctx.db.query("mailboxScanContexts").collect());
  expect(contexts).toHaveLength(3);
  expect(contexts.find(context => context.mode === "KNOWN_PRODUCTS")).toMatchObject({ cursor: "page-4", pagesRead: 2 });
});

test("a scoped known-product page retains correct private evidence without public or usage changes", async () => {
  const { t, owner, ownerId } = await setup();
  const fetcher = provider();
  const connection = await owner.action(callback, reply(stateFrom(await owner.action(start, {}))));
  await owner.action(read, { accountId: connection.accountId, expectedGeneration: 1, mode: "KNOWN_PRODUCTS" });
  const raw = (await t.run(ctx => ctx.db.query("rawEvidence").unique()))!;
  const source = (await t.run(ctx => ctx.db.get(raw.evidenceSourceId)))!;
  expect(raw.userId).toBe(ownerId);
  expect(source.sourceKey).toBe(JSON.stringify(["mailbox-v1", "GOOGLE", "google-sub"]));
  expect(raw.observations).toEqual([]);
  expect((await t.run(ctx => ctx.db.query("props").unique()))?.visibility).toBe("DRAFT");
  expect(await t.run(ctx => ctx.db.query("usageSignals").collect())).toEqual([]);
  expect(await t.query(api.publicProfiles.getByHandle, { handle: "owner" })).toBeNull();
  await owner.action(read, { accountId: connection.accountId, expectedGeneration: 1, mode: "KNOWN_PRODUCTS" });
  expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toHaveLength(1);
  expect(await t.run(ctx => ctx.db.query("proofs").collect())).toHaveLength(1);
  expect((await t.run(ctx => ctx.db.query("mailboxScanContexts").unique()))?.retainedRecords).toBe(0);
  expect(fetcher.mock.calls.some(call => new URL(String(call[0])).searchParams.get("q")?.includes("from:github.com"))).toBe(true);
});

test("unknown metadata is reviewable without guessed products and owner attachment is replay safe", async () => {
  const { t, owner, other, ownerId } = await setup();
  const http = provider();
  const connection = await owner.action(callback, reply(stateFrom(await owner.action(start, {}))));
  vi.stubGlobal("fetch", async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (String(input).includes("/messages/123abc?")) return Response.json({ id: "123abc", internalDate: "1750000000000",
      payload: { headers: [{ name: "From", value: "Vendor <news@unlisted.example>" }, { name: "Subject", value: "Private source header" }] } });
    return http(input, init);
  });
  const args = { accountId: connection.accountId, expectedGeneration: 1, mode: "HISTORY" as const };
  expect(await owner.action(read, args)).toMatchObject({ unmatchedCount: 1, proposals: 0 });
  await owner.action(read, args);
  expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toHaveLength(1);
  expect(await t.run(ctx => ctx.db.query("products").collect())).toEqual([]);
  const record = (await owner.query(api.mailboxDiscovery.listUnknown, { paginationOpts: { cursor: null, numItems: 10 } })).page[0];
  expect(record.payload).toContain("Private source header");
  expect(record.provenance?.activityActor).toEqual({ kind: "UNKNOWN" });
  expect((await other.query(api.mailboxDiscovery.listUnknown, { paginationOpts: { cursor: null, numItems: 10 } })).page).toEqual([]);
  const propId = await t.run(async ctx => {
    const productId = await ctx.db.insert("products", { name: "Chosen product", slug: "chosen", domain: "chosen.example", description: "" });
    return await ctx.db.insert("props", { userId: ownerId, productId, status: "ARCHIVED", visibility: "PRIVATE", headline: "My prior decision", note: "An important occasional tool", goTo: true });
  });
  await expect(other.mutation(api.mailboxDiscovery.reviewUnknown, { id: record.id, decision: "LINKED", propId })).rejects.toThrow();
  await owner.mutation(api.mailboxDiscovery.reviewUnknown, { id: record.id, decision: "LINKED", propId });
  await owner.mutation(api.mailboxDiscovery.reviewUnknown, { id: record.id, decision: "LINKED", propId });
  expect(await t.run(ctx => ctx.db.query("proofs").collect())).toHaveLength(1);
  expect(await t.run(ctx => ctx.db.get(propId))).toMatchObject({ status: "ARCHIVED", visibility: "PRIVATE", headline: "My prior decision", goTo: true });
  expect(await t.run(ctx => ctx.db.query("relationshipEvents").collect())).toEqual([]);
});

test("expired page cursor needs an explicit scoped restart and does not affect another query", async () => {
  const { t, owner } = await setup();
  provider();
  const connection = await owner.action(callback, reply(stateFrom(await owner.action(start, {}))));
  const args = { accountId: connection.accountId, expectedGeneration: 1, mode: "HISTORY" as const };
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(Response.json({ messages: [], nextPageToken: "stale-page" })));
  await owner.action(read, args);
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response("private provider body", { status: 400 })));
  await expect(owner.action(read, args)).rejects.toThrow("cursor expired");
  const context = (await t.run(ctx => ctx.db.query("mailboxScanContexts").unique()))!;
  expect(context).toMatchObject({ cursor: "stale-page", lastFailure: "CURSOR_EXPIRED", pagesRead: 1 });
  await expect(owner.action(read, args)).rejects.toThrow("cursor expired");
  await owner.mutation(api.mailboxes.restartSearch, { ...args, expectedQueryKey: context.queryKey });
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ messages: [] })); vi.stubGlobal("fetch", fetcher);
  await owner.action(read, args);
  expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.has("pageToken")).toBe(false);
  expect((await t.run(ctx => ctx.db.query("mailboxScanContexts").unique()))?.restartCount).toBe(1);
});

test("disconnect during refresh cannot install rotated credentials or read mailbox headers", async () => {
  vi.useFakeTimers();
  const { t, owner } = await setup();
  const http = provider();
  const connection = await owner.action(callback, reply(stateFrom(await owner.action(start, {}))));
  vi.advanceTimersByTime(3600_000);
  http.mockClear();
  vi.stubGlobal("fetch", async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (String(input).includes("userinfo")) await owner.mutation(api.mailboxes.disconnect, { accountId: connection.accountId, expectedGeneration: 1 });
    return http(input, init);
  });
  await expect(owner.action(read, { accountId: connection.accountId, expectedGeneration: 1, mode: "KNOWN_PRODUCTS" })).rejects.toThrow();
  expect(http.mock.calls.some(call => String(call[0]).includes("/messages"))).toBe(false);
  expect(await t.run(ctx => ctx.db.query("mailboxSecrets").collect())).toEqual([]);
  expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toEqual([]);
  expect((await t.run(ctx => ctx.db.get(connection.accountId)))?.status).toBe("DISCONNECTED");
});

test("revoked refresh requires reconnection but temporary token service failures preserve credentials", async () => {
  vi.useFakeTimers();
  const { t, owner } = await setup();
  provider();
  const connection = await owner.action(callback, reply(stateFrom(await owner.action(start, {}))));
  vi.advanceTimersByTime(3600_000);
  const args = { accountId: connection.accountId, expectedGeneration: 1, mode: "INCREMENTAL" as const };
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response("private", { status: 500 })));
  await expect(owner.action(read, args)).rejects.toThrow();
  expect((await t.run(ctx => ctx.db.get(connection.accountId)))?.status).toBe("CONNECTED");
  expect(await t.run(ctx => ctx.db.query("mailboxSecrets").collect())).toHaveLength(1);
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response("private invalid_grant", { status: 400 })));
  await expect(owner.action(read, args)).rejects.toThrow("Reconnect");
  expect((await t.run(ctx => ctx.db.get(connection.accountId)))?.status).toBe("NEEDS_REAUTH");
  expect(await t.run(ctx => ctx.db.query("mailboxSecrets").collect())).toEqual([]);
});

test("daily hosted maintenance requires explicit owner opt-in, survives no browser identity, and never duplicates a due attempt", async () => {
  vi.useFakeTimers();
  const { t, owner, other } = await setup();
  const fetcher = provider();
  const connection = await owner.action(callback, reply(stateFrom(await owner.action(start, {}))));
  const args = { accountId: connection.accountId, expectedGeneration: 1 };
  fetcher.mockClear();
  expect(await t.action(internal.mailboxGoogle.refreshDue, {})).toEqual({ completed: 0, failed: 0 });
  expect(fetcher).not.toHaveBeenCalled();
  await expect(other.mutation(api.mailboxes.setMaintenance, { ...args, enabled: true })).rejects.toThrow();
  await owner.mutation(api.mailboxes.setMaintenance, { ...args, enabled: true });
  expect((await t.run(ctx => ctx.db.get(connection.accountId)))?.nextMaintenanceAt).toBe(Date.now());
  expect(fetcher).not.toHaveBeenCalled();
  expect(await t.action(internal.mailboxGoogle.refreshDue, {})).toEqual({ completed: 1, failed: 0 });
  const called = fetcher.mock.calls.length;
  expect((await t.run(ctx => ctx.db.get(connection.accountId)))?.nextMaintenanceAt).toBe(Date.now() + 24 * 60 * 60 * 1000);
  await owner.mutation(api.mailboxes.setMaintenance, { ...args, enabled: true });
  expect(await t.action(internal.mailboxGoogle.refreshDue, {})).toEqual({ completed: 0, failed: 0 });
  expect(fetcher).toHaveBeenCalledTimes(called);
  expect((await t.run(ctx => ctx.db.query("mailboxScanContexts").unique()))?.mode).toBe("INCREMENTAL");
  expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toHaveLength(1);
  expect(await t.query(api.publicProfiles.getByHandle, { handle: "owner" })).toBeNull();
  await owner.mutation(api.mailboxes.disconnect, args);
  vi.advanceTimersByTime(24 * 60 * 60 * 1000);
  expect(await t.action(internal.mailboxGoogle.refreshDue, {})).toEqual({ completed: 0, failed: 0 });
  expect(fetcher).toHaveBeenCalledTimes(called);
});

test("stopping daily collection during an in-flight scheduled page discards its stale persistence", async () => {
  vi.useFakeTimers();
  const { t, owner } = await setup();
  const http = provider();
  const connection = await owner.action(callback, reply(stateFrom(await owner.action(start, {}))));
  const args = { accountId: connection.accountId, expectedGeneration: 1 };
  await owner.mutation(api.mailboxes.setMaintenance, { ...args, enabled: true });
  vi.stubGlobal("fetch", async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (String(input).includes("/messages?")) await owner.mutation(api.mailboxes.setMaintenance, { ...args, enabled: false });
    return http(input, init);
  });
  expect(await t.action(internal.mailboxGoogle.refreshDue, {})).toEqual({ completed: 0, failed: 1 });
  expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toEqual([]);
  expect((await t.run(ctx => ctx.db.get(connection.accountId)))?.maintenanceEnabled).toBe(false);
});

test("a crashed read lease can be retried after expiry from its persisted cursor", async () => {
  vi.useFakeTimers();
  const { t, owner } = await setup();
  provider();
  const connection = await owner.action(callback, reply(stateFrom(await owner.action(start, {}))));
  const args = { accountId: connection.accountId, expectedGeneration: 1 };
  const abandoned = await owner.mutation(api.mailboxes.startScan, args);
  expect((await owner.query(api.mailboxes.listAccounts, {}))[0].lastReadStatus).toBe("READING");
  await expect(owner.action(read, args)).rejects.toThrow("already active");
  vi.advanceTimersByTime(121_000);
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(Response.json({ messages: [] })));
  expect(await owner.action(read, args)).toEqual({ readCount: 0, proposals: 0, hasMore: false });
  expect((await t.run(ctx => ctx.db.get(abandoned.jobId)))?.status).toBe("EXPIRED");
  expect((await owner.query(api.mailboxes.listAccounts, {}))[0].lastReadStatus).toBe("COMPLETE");
});

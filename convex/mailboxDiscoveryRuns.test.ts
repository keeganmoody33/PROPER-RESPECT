/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import schema from "./schema";
import { e2eReferenceProfile } from "../src/data/e2e-reference-profile";
import { api, internal } from "./_generated/api";
import { encryptMailboxCredential } from "../src/server/mailbox-credentials";
const modules = import.meta.glob("./**/*.ts");
const keys = { activeVersion: "v1", keys: { v1: Buffer.alloc(32, 3).toString("base64") } };
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("MAILBOX_ENCRYPTION_ACTIVE_VERSION", "v1");
  vi.stubEnv("MAILBOX_ENCRYPTION_KEYS", JSON.stringify(keys.keys));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
async function setup() {
  const t = convexTest(schema, modules);
  const ownerId = await t.run(ctx => ctx.db.insert("users", { handle: "owner", authSubject: "owner", displayName: "Owner", bio: "" }));
  await t.run(ctx => ctx.db.insert("users", { handle: "other", authSubject: "other", displayName: "Other", bio: "" }));
  const owner = t.withIdentity({ subject: "owner" });
  const credential = encryptMailboxCredential({ accessToken: "synthetic", refreshToken: "synthetic-refresh", expiresAt: Date.now() + 3600_000 },
    { ownerId, provider: "GOOGLE", providerAccountId: "synthetic-account", generation: 1 }, keys);
  const connection = await t.mutation(internal.mailboxes.finalizeVerifiedConnection, { ownerId, provider: "GOOGLE", providerAccountId: "synthetic-account", accountLabel: "Synthetic mailbox",
    scopes: ["https://www.googleapis.com/auth/gmail.readonly"], expectedGeneration: 0, credential });
  const args = { accountId: connection.accountId, expectedGeneration: 1 };
  const start = () => owner.mutation(api.mailboxes.startDiscoveryRun, { ...args, requestId: "synthetic-run-1" });
  const run = async () => (await owner.query(api.mailboxes.listAccounts, {}))[0].discoveryRun!;
  return { t, owner, ownerId, args, start, run, credential };
}
function provider() {
  const http = vi.fn<typeof fetch>().mockImplementation(async input => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/messages")) return Response.json({ messages: [{ id: "123abc" }] });
    return Response.json({ id: "123abc", internalDate: "1750000000000", payload: { headers: [
      { name: "From", value: "Unknown <mail@unknown-example.test>" }, { name: "Subject", value: "Synthetic receipt" },
    ] } });
  });
  vi.stubGlobal("fetch", http);
  return http;
}

test("scheduler continues catalog then history, retains unknown evidence once and leaves saved/public state unchanged", async () => {
  const { t, owner, ownerId, start, run } = await setup();
  await t.run(async ctx => {
    const productId = await ctx.db.insert("products", { name: "Existing", slug: "existing", domain: "existing.test", description: "" });
    await ctx.db.insert("props", { userId: ownerId, productId, status: "ACTIVE", visibility: "PRIVATE", headline: "Owner choice", note: "Preserve" });
  });
  const before = await t.run(ctx => ctx.db.query("props").collect());
  const http = provider();
  const runId = await start();
  expect(await start()).toBe(runId);
  for (let page = 0; page < 3; page++) {
    vi.advanceTimersByTime(1);
    await t.finishInProgressScheduledFunctions();
  }
  expect(await run()).toMatchObject({ status: "COMPLETE", phase: "HISTORY", totalAttempts: 2, pagesRead: 2, messagesRead: 2, retainedRecords: 1 });
  expect(http).toHaveBeenCalledTimes(4);
  expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toHaveLength(1);
  expect(await t.run(ctx => ctx.db.query("mailboxUnknownRecords").collect())).toHaveLength(1);
  expect(await t.run(ctx => ctx.db.query("props").collect())).toEqual(before);
  expect(await t.query(api.publicProfiles.getByHandle, { handle: "owner" })).toBeNull();
  expect((await owner.query(api.mailboxes.listAccounts, {}))[0].contexts).toHaveLength(2);
});

test("duplicate deliveries spend one attempt; manual scans and maintenance cannot race a run", async () => {
  const { t, owner, args, start, run } = await setup();
  const http = provider();
  await owner.mutation(api.mailboxes.setMaintenance, { ...args, enabled: true });
  const runId = await start();
  await Promise.all([t.action(internal.mailboxGoogle.discoveryPage, { runId, step: 0 }), t.action(internal.mailboxGoogle.discoveryPage, { runId, step: 0 })]);
  expect(http).toHaveBeenCalledTimes(2);
  expect(await run()).toMatchObject({ totalAttempts: 1, pagesRead: 1 });
  await expect(owner.mutation(api.mailboxes.startScan, { ...args, mode: "HISTORY" })).rejects.toThrow("discovery first");
  expect(await t.mutation(internal.mailboxes.startScheduledScan, args)).toBeNull();
  await expect(owner.mutation(api.mailboxes.startDiscoveryRun, { ...args, requestId: "different-request" })).rejects.toThrow("discovery first");
});

test.each(["PAUSE", "CANCEL"] as const)("%s during HTTP rejects persistence and stale scheduled work", async action => {
  const { t, owner, start, run } = await setup();
  const runId = await start();
  const http = provider();
  vi.stubGlobal("fetch", async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (String(input).includes("/messages?")) await owner.mutation(api.mailboxes.controlDiscoveryRun, { runId, expectedGeneration: 1, action });
    return http(input, init);
  });
  await t.action(internal.mailboxGoogle.discoveryPage, { runId, step: 0 });
  expect(await run()).toMatchObject({ status: action === "PAUSE" ? "PAUSED" : "CANCELLED", totalAttempts: 1, pagesRead: 0 });
  expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toEqual([]);
  await t.action(internal.mailboxGoogle.discoveryPage, { runId, step: 0 });
  expect(http).toHaveBeenCalledTimes(2);
});

test("watchdog exposes crashed attempts; explicit resume retains query and budget", async () => {
  const { t, owner, start, run } = await setup();
  const runId = await start();
  const page = (await t.mutation(internal.mailboxes.claimDiscoveryPage, { runId, step: 0 }))!;
  vi.setSystemTime(Date.now() + 121_000);
  await t.mutation(internal.mailboxes.expireDiscoveryPage, { runId, jobId: page.jobId });
  expect(await run()).toMatchObject({ status: "FAILED", failure: "LEASE_EXPIRED", totalAttempts: 1 });
  await owner.mutation(api.mailboxes.controlDiscoveryRun, { runId, expectedGeneration: 1, action: "RESUME" });
  const next = (await t.mutation(internal.mailboxes.claimDiscoveryPage, { runId, step: 2 }))!;
  expect(next.queryKey).toBe(page.queryKey);
  expect(next.cursor).toBe(page.cursor);
  expect(await run()).toMatchObject({ totalAttempts: 2, phaseAttempts: 2 });
});

test("generation changes and cross-owner controls invalidate old run claims", async () => {
  const { t, owner, args, start, run } = await setup();
  const runId = await start();
  await expect(t.withIdentity({ subject: "other" }).mutation(api.mailboxes.controlDiscoveryRun, { runId, expectedGeneration: 1, action: "CANCEL" })).rejects.toThrow();
  await owner.mutation(api.mailboxes.disconnect, args);
  const http = provider();
  await t.action(internal.mailboxGoogle.discoveryPage, { runId, step: 0 });
  expect(http).not.toHaveBeenCalled();
  expect(await run()).toMatchObject({ status: "CANCELLED", totalAttempts: 0 });
});

test("phase cap survives history exhaustion as LIMIT_REACHED; new run does not reset completed history", async () => {
  const { t, owner, args, start, run } = await setup();
  const runId = await start();
  await t.run(ctx => ctx.db.patch(runId, { phaseAttempts: 100, totalAttempts: 100 }));
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ messages: [] })));
  await t.action(internal.mailboxGoogle.discoveryPage, { runId, step: 0 });
  await t.action(internal.mailboxGoogle.discoveryPage, { runId, step: 1 });
  expect(await run()).toMatchObject({ status: "LIMIT_REACHED", totalAttempts: 101, pagesRead: 1 });
  const history = (await owner.query(api.mailboxes.listAccounts, {}))[0].contexts.find(context => context.mode === "HISTORY")!;
  const nextId = await owner.mutation(api.mailboxes.startDiscoveryRun, { ...args, requestId: "another-run" });
  await t.action(internal.mailboxGoogle.discoveryPage, { runId: nextId, step: 0 });
  await t.action(internal.mailboxGoogle.discoveryPage, { runId: nextId, step: 1 });
  expect(await run()).toMatchObject({ status: "COMPLETE", totalAttempts: 1 });
  expect((await owner.query(api.mailboxes.listAccounts, {}))[0].contexts.find(context => context.mode === "HISTORY")).toEqual(history);
});

test("bounded run never retries a partially fetched page on 401", async () => {
  const { t, start, run } = await setup();
  const runId = await start();
  let headers = 0;
  const http = vi.fn<typeof fetch>().mockImplementation(async input => {
    if (String(input).includes("/messages?")) return Response.json({ messages: [{ id: "1" }, { id: "2" }] });
    headers++;
    return headers === 1 ? Response.json({ id: "1", internalDate: "1750000000000", payload: { headers: [] } }) : new Response("", { status: 401 });
  });
  vi.stubGlobal("fetch", http);
  await t.action(internal.mailboxGoogle.discoveryPage, { runId, step: 0 });
  expect(http).toHaveBeenCalledTimes(3);
  expect(await run()).toMatchObject({ status: "CANCELLED", failure: "REAUTHORIZE", totalAttempts: 1, pagesRead: 0 });
});

test("scheduled 200-page run respects both attempt caps and retains repeated headers only once", async () => {
  const { t, start, run } = await setup();
  let page = 0;
  let headers = 0;
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockImplementation(async input => {
    if (String(input).includes("/messages?")) return Response.json({ messages: Array.from({ length: 5 }, (_, index) => ({ id: String(index + 1) })), nextPageToken: `page-${++page}` });
    headers++;
    const id = new URL(String(input)).pathname.split("/").at(-1)!;
    return Response.json({ id, internalDate: "1750000000000", payload: { headers: [{ name: "From", value: "Unknown <mail@unknown-example.test>" }] } });
  }));
  await start();
  for (let step = 0; step < 201; step++) {
    vi.advanceTimersByTime(1);
    await t.finishInProgressScheduledFunctions();
  }
  expect(await run()).toMatchObject({ status: "LIMIT_REACHED", phase: "HISTORY", phaseAttempts: 100,
    totalAttempts: 200, pagesRead: 200, messagesRead: 1000, retainedRecords: 5 });
  expect(headers).toBe(1000);
  expect(page).toBe(200);
  vi.advanceTimersByTime(121_000);
  await t.finishInProgressScheduledFunctions();
  expect(headers).toBe(1000);
  expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toHaveLength(5);
});

test("cycling cursor stops and requires cancellation plus explicit search restart", async () => {
  const { t, owner, args, start, run } = await setup();
  const runId = await start();
  let page = 0;
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ messages: [], nextPageToken: ++page === 1 ? "a" : page === 2 ? "b" : "a" })));
  for (let step = 0; step < 3; step++) await t.action(internal.mailboxGoogle.discoveryPage, { runId, step });
  expect(await run()).toMatchObject({ status: "FAILED", failure: "CURSOR_CYCLE", totalAttempts: 3, pagesRead: 3 });
  await expect(owner.mutation(api.mailboxes.controlDiscoveryRun, { runId, expectedGeneration: 1, action: "RESUME" })).rejects.toThrow("Cancel");
  const context = (await owner.query(api.mailboxes.listAccounts, {}))[0].contexts[0];
  expect(context.lastFailure).toBe("CURSOR_EXPIRED");
  await expect(owner.mutation(api.mailboxes.restartSearch, { ...args, mode: "KNOWN_PRODUCTS", expectedQueryKey: context.queryKey })).rejects.toThrow("discovery first");
  await owner.mutation(api.mailboxes.controlDiscoveryRun, { runId, expectedGeneration: 1, action: "CANCEL" });
  await owner.mutation(api.mailboxes.restartSearch, { ...args, mode: "KNOWN_PRODUCTS", expectedQueryKey: context.queryKey });
  expect((await owner.query(api.mailboxes.listAccounts, {}))[0].contexts[0]).toMatchObject({ cursor: null, status: "READY", restartCount: 1 });
});

test("receipt replay after run advances returns exact result without scheduling or counting again", async () => {
  const { t, start, run } = await setup();
  const runId = await start();
  const scan = (await t.mutation(internal.mailboxes.claimDiscoveryPage, { runId, step: 0 }))!;
  const page = { accountId: scan.accountId, expectedGeneration: scan.expectedGeneration, jobId: scan.jobId,
    expectedCursor: scan.cursor, nextCursor: null, batchId: "page-1", complete: true, signals: [], readCount: 0, queryKey: scan.queryKey };
  const receipt = await t.mutation(internal.mailboxDiscovery.persistBatch, page);
  const before = await run();
  expect(await t.mutation(internal.mailboxDiscovery.persistBatch, page)).toEqual(receipt);
  expect(await run()).toEqual(before);
});

test("disconnect plus reconnect rejects an already claimed generation and retains no stale page", async () => {
  const { t, owner, ownerId, args, credential, start, run } = await setup();
  const runId = await start();
  const scan = (await t.mutation(internal.mailboxes.claimDiscoveryPage, { runId, step: 0 }))!;
  await owner.mutation(api.mailboxes.disconnect, args);
  await t.mutation(internal.mailboxes.finalizeVerifiedConnection, { ownerId, provider: "GOOGLE", providerAccountId: "synthetic-account", accountLabel: "Same mailbox", expectedGeneration: 2,
    scopes: ["https://www.googleapis.com/auth/gmail.readonly"], credential });
  await expect(t.mutation(internal.mailboxDiscovery.persistBatch, { accountId: args.accountId, expectedGeneration: 1, jobId: scan.jobId,
    expectedCursor: scan.cursor, nextCursor: null, batchId: "page-1", complete: true, signals: [], readCount: 0, queryKey: scan.queryKey })).rejects.toThrow("generation changed");
  expect(await run()).toMatchObject({ status: "CANCELLED", totalAttempts: 1, pagesRead: 0 });
});

test("missing credential before claim becomes visible failure without HTTP or a stuck running job", async () => {
  const { t, start, run } = await setup();
  const runId = await start();
  await t.run(async ctx => { const secret = (await ctx.db.query("mailboxSecrets").unique())!; await ctx.db.delete(secret._id); });
  const http = provider();
  await t.action(internal.mailboxGoogle.discoveryPage, { runId, step: 0 });
  expect(http).not.toHaveBeenCalled();
  expect(await run()).toMatchObject({ status: "FAILED", failure: "REAUTHORIZE", totalAttempts: 0 });
});


test("catalog and history scheduler produces unconfirmed known candidate plus unknown review without altering existing publication", async () => {
  const { t, owner, ownerId, start, run } = await setup();
  await t.run(async ctx => {
    const productId = await ctx.db.insert("products", { name: "Existing", slug: "existing", domain: "existing.test", description: "" });
    await ctx.db.insert("props", { userId: ownerId, productId, status: "ARCHIVED", visibility: "PRIVATE", headline: "Owner history", note: "Preserve my explanation" });
    await ctx.db.insert("publishedProfiles", { handle: "owner", revision: 7, publishedAt: "2026-09-18T00:00:00.000Z", profile: { ...e2eReferenceProfile, handle: "owner" } });
  });
  const saved = await t.run(ctx => ctx.db.query("props").collect());
  const publication = await t.run(ctx => ctx.db.query("publishedProfiles").collect());
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockImplementation(async input => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/messages")) return Response.json({ messages: [{ id: url.searchParams.get("q")!.includes("from:") ? "1" : "2" }] });
    const known = url.pathname.endsWith("/1");
    return Response.json({ id: known ? "1" : "2", internalDate: "1750000000000", payload: { headers: [
      { name: "From", value: known ? "GitHub <news@github.com>" : "Unknown <sender@unknown-example.test>" },
      { name: "Subject", value: "Synthetic marketing message" },
    ] } });
  }));
  await start();
  for (let page = 0; page < 3; page++) { vi.advanceTimersByTime(1); await t.finishInProgressScheduledFunctions(); }
  expect(await run()).toMatchObject({ status: "COMPLETE", retainedRecords: 2 });
  const cards = (await owner.query(api.onboarding.getState, {}))!.cards;
  const candidate = cards.find(card => card.product?.slug === "github")!;
  expect(candidate.prop.visibility).toBe("DRAFT");
  expect(candidate.prop.relationshipVersion).toBeUndefined();
  const retainedSaved = await t.run(async ctx => Promise.all(saved.map(prop => ctx.db.get(prop._id))));
  expect(retainedSaved).toEqual(saved);
  expect(await t.run(ctx => ctx.db.query("publishedProfiles").collect())).toEqual(publication);
  expect(await t.run(ctx => ctx.db.query("mailboxUnknownRecords").collect())).toHaveLength(1);
  const raw = await t.run(ctx => ctx.db.query("rawEvidence").collect());
  expect(raw).toHaveLength(2);
  for (const record of raw) {
    expect(record.userId).toBe(ownerId);
    expect(record.captureProvenance).toMatchObject({ origin: { issuer: "GOOGLE", accountId: "synthetic-account" }, activityActor: { kind: "UNKNOWN" } });
    expect(record.observations ?? []).toEqual([]);
  }
  expect(await t.run(ctx => ctx.db.query("usageSignals").collect())).toEqual([]);
});


test("immediately repeated cursor requires explicit restart and does not invite resume retries", async () => {
  const { t, owner, args, start, run } = await setup();
  const runId = await start();
  const http = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ messages: [], nextPageToken: "same" }));
  vi.stubGlobal("fetch", http);
  for (let step = 0; step < 3; step++) await t.action(internal.mailboxGoogle.discoveryPage, { runId, step });
  expect(await run()).toMatchObject({ status: "FAILED", failure: "CURSOR_EXPIRED", totalAttempts: 2, pagesRead: 1 });
  expect(http).toHaveBeenCalledTimes(2);
  await expect(owner.mutation(api.mailboxes.controlDiscoveryRun, { runId, expectedGeneration: 1, action: "RESUME" })).rejects.toThrow("Cancel");
  const context = (await owner.query(api.mailboxes.listAccounts, {}))[0].contexts[0];
  expect(context.lastFailure).toBe("CURSOR_EXPIRED");
  await owner.mutation(api.mailboxes.controlDiscoveryRun, { runId, expectedGeneration: 1, action: "CANCEL" });
  await owner.mutation(api.mailboxes.restartSearch, { ...args, mode: "KNOWN_PRODUCTS", expectedQueryKey: context.queryKey });
  expect((await owner.query(api.mailboxes.listAccounts, {}))[0].contexts[0]).toMatchObject({ status: "READY", cursor: null });
});

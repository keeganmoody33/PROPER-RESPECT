/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
const modules = import.meta.glob("./**/*.ts");
const start = api.mailboxGoogle.start;
const callback = api.mailboxGoogle.callback;
const disconnectAndRevoke = api.mailboxGoogle.disconnectAndRevoke;
const REVOKE = "https://oauth2.googleapis.com/revoke";
const ACCESS = "access-SECRET-r17-7f3a";
const REFRESH = "refresh-SECRET-r17-9c1e";
const scope = "openid email https://www.googleapis.com/auth/gmail.readonly";
const consoleCalls: unknown[][] = [];
beforeEach(() => {
  vi.stubEnv("MAILBOX_GOOGLE_CLIENT_ID", "client");
  vi.stubEnv("MAILBOX_GOOGLE_CLIENT_SECRET", "client-secret");
  vi.stubEnv("MAILBOX_APPLICATION_ORIGIN", "https://props.example.test");
  vi.stubEnv("MAILBOX_ENCRYPTION_ACTIVE_VERSION", "v1");
  vi.stubEnv("MAILBOX_ENCRYPTION_KEYS", JSON.stringify({ v1: Buffer.alloc(32, 3).toString("base64") }));
  vi.stubEnv("MAILBOX_GOOGLE_TEST_EMAILS", "owner@example.test,other@example.test");
  consoleCalls.length = 0;
  for (const method of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => { consoleCalls.push(args); });
  }
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function setup() {
  const t = convexTest(schema, modules);
  await t.run(ctx => ctx.db.insert("users", { handle: "owner", authSubject: "owner", displayName: "Owner", bio: "" }));
  await t.run(ctx => ctx.db.insert("users", { handle: "other", authSubject: "other", displayName: "Other", bio: "" }));
  return { t, owner: t.withIdentity({ subject: "owner", email: "owner@example.test" }), other: t.withIdentity({ subject: "other", email: "other@example.test" }) };
}
type Revoke = (init: RequestInit | undefined) => Promise<Response>;
/** Google token/identity stub with distinctive tokens and a pluggable revocation response. */
function provider(revoke: Revoke = async () => new Response("{}", { status: 200 })) {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
    const url = String(input);
    if (url === "https://oauth2.googleapis.com/token") return Response.json({ access_token: ACCESS, refresh_token: REFRESH, expires_in: 3600, token_type: "Bearer", scope });
    if (url === "https://openidconnect.googleapis.com/v1/userinfo") return Response.json({ sub: "google-sub", email: "google-sub@example.test", email_verified: true });
    if (url === REVOKE) return await revoke(init);
    throw new Error("Unexpected HTTP endpoint");
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
function stateFrom(result: { url: string }) { return new URL(result.url).searchParams.get("state")!; }
function reply(state: string) { return { query: new URLSearchParams({ state, code: "authorization-code" }).toString() }; }
async function connect(owner: Awaited<ReturnType<typeof setup>>["owner"]) {
  return await owner.action(callback, reply(stateFrom(await owner.action(start, {}))));
}
const revocations = (fetcher: ReturnType<typeof provider>) => fetcher.mock.calls.filter(call => String(call[0]) === REVOKE);
function expectNoToken(value: unknown) {
  const text = JSON.stringify(value) ?? "";
  expect(text).not.toContain(REFRESH);
  expect(text).not.toContain(ACCESS);
}

test("disconnect sends exactly one revocation carrying the refresh token, then disconnects locally (R17)", async () => {
  const { t, owner } = await setup();
  const fetcher = provider();
  const connection = await connect(owner);
  fetcher.mockClear();
  const result = await owner.action(disconnectAndRevoke, { accountId: connection.accountId, expectedGeneration: 1 });
  expect(result).toEqual({ disconnected: true, generation: 2, revocation: "REVOKED" });
  const calls = revocations(fetcher);
  expect(calls).toHaveLength(1);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [, init] = calls[0];
  expect(init).toMatchObject({ method: "POST", redirect: "error", cache: "no-store", credentials: "omit" });
  expect(new Headers(init?.headers).get("Content-Type")).toBe("application/x-www-form-urlencoded");
  expect(new URLSearchParams(String(init?.body)).get("token")).toBe(REFRESH);
  expect(await t.run(ctx => ctx.db.query("mailboxSecrets").collect())).toEqual([]);
  const account = (await t.run(ctx => ctx.db.get(connection.accountId)))!;
  expect(account).toMatchObject({ status: "DISCONNECTED", generation: 2, lastRevocation: { outcome: "REVOKED" } });
  expectNoToken(account);
  expectNoToken(consoleCalls);
});

test.each([
  ["Google returns an error", async () => new Response(`{"error":"invalid_token","token":"${REFRESH}"}`, { status: 400 })],
  ["Google is unavailable", async () => new Response(`PRIVATE ${REFRESH}`, { status: 503 })],
  ["the network request throws", async () => { throw new Error(`socket closed while sending ${REFRESH}`); }],
] as Array<[string, Revoke]>)("the local disconnect completes when %s, recording FAILED without the token (R17)", async (_label, revoke) => {
  const { t, owner } = await setup();
  const fetcher = provider(revoke);
  const connection = await connect(owner);
  const result = await owner.action(disconnectAndRevoke, { accountId: connection.accountId, expectedGeneration: 1 });
  expect(result).toEqual({ disconnected: true, generation: 2, revocation: "FAILED" });
  expectNoToken(result);
  expect(revocations(fetcher)).toHaveLength(1);
  expect(await t.run(ctx => ctx.db.query("mailboxSecrets").collect())).toEqual([]);
  const account = (await t.run(ctx => ctx.db.get(connection.accountId)))!;
  expect(account).toMatchObject({ status: "DISCONNECTED", generation: 2, lastRevocation: { outcome: "FAILED" } });
  expectNoToken(account);
  expectNoToken(consoleCalls);
});

test("an account without a stored credential disconnects with NO_TOKEN and no provider call (R17)", async () => {
  const { t, owner } = await setup();
  const fetcher = provider();
  const connection = await connect(owner);
  await t.run(async ctx => {
    const secret = await ctx.db.query("mailboxSecrets").unique();
    await ctx.db.delete(secret!._id);
  });
  fetcher.mockClear();
  const result = await owner.action(disconnectAndRevoke, { accountId: connection.accountId, expectedGeneration: 1 });
  expect(result).toEqual({ disconnected: true, generation: 2, revocation: "NO_TOKEN" });
  expect(fetcher).not.toHaveBeenCalled();
  expect((await t.run(ctx => ctx.db.get(connection.accountId)))).toMatchObject({ status: "DISCONNECTED", lastRevocation: { outcome: "NO_TOKEN" } });
});

test("a reconnect can't land while its grant is being revoked, and a later reconnect starts clean (R17)", async () => {
  const { t, owner } = await setup();
  provider();
  const connection = await connect(owner);
  const reconnect = stateFrom(await owner.action(start, { accountId: connection.accountId, expectedGeneration: 1 }));
  let refused: unknown;
  const fetcher = provider(async () => {
    // Google is revoking the grant; installing fresh tokens now would hand over tokens Google may be revoking.
    refused = await owner.action(callback, reply(reconnect)).then(() => "installed", error => (error as Error).message);
    return new Response("{}");
  });
  const result = await owner.action(disconnectAndRevoke, { accountId: connection.accountId, expectedGeneration: 1 });
  expect(refused).toBe("Gmail authorization failed. Start a new connection attempt.");
  expect(result).toEqual({ disconnected: true, generation: 2, revocation: "REVOKED" });
  // The disconnect's own revocation, plus one for the refused reconnect's freshly issued tokens.
  expect(revocations(fetcher)).toHaveLength(2);
  const account = (await t.run(ctx => ctx.db.get(connection.accountId)))!;
  expect(account).toMatchObject({ status: "DISCONNECTED", generation: 2, lastRevocation: { outcome: "REVOKED" } });
  expect(account.revocationPending).toBeUndefined();
  expect(await t.run(ctx => ctx.db.query("mailboxSecrets").collect())).toEqual([]);

  // Once the disconnect finishes, reconnecting works and drops the old revocation outcome.
  provider();
  const again = await owner.action(callback, reply(stateFrom(await owner.action(start, { accountId: connection.accountId, expectedGeneration: 2 }))));
  expect(again.generation).toBe(3);
  const reconnected = (await t.run(ctx => ctx.db.get(connection.accountId)))!;
  expect(reconnected).toMatchObject({ status: "CONNECTED", generation: 3 });
  expect(reconnected.lastRevocation).toBeUndefined();
  expectNoToken(consoleCalls);
});

test("a disconnect elsewhere during the revocation leaves the account disconnected and unmarked (R17)", async () => {
  const { t, owner } = await setup();
  provider();
  const connection = await connect(owner);
  const fetcher = provider(async () => {
    await owner.mutation(api.mailboxes.disconnect, { accountId: connection.accountId, expectedGeneration: 1 });
    return new Response("{}");
  });
  const result = await owner.action(disconnectAndRevoke, { accountId: connection.accountId, expectedGeneration: 1 });
  expect(result).toEqual({ disconnected: false, reason: "GENERATION_CHANGED" });
  expect(revocations(fetcher)).toHaveLength(1);
  const account = (await t.run(ctx => ctx.db.get(connection.accountId)))!;
  expect(account.status).toBe("DISCONNECTED");
  expect(account.revocationPending).toBeUndefined();
});

test("another user cannot disconnect or revoke your account, and a stale generation fails before provider I/O (R17)", async () => {
  const { t, owner, other } = await setup();
  const fetcher = provider();
  const connection = await connect(owner);
  fetcher.mockClear();
  const errors: unknown[] = [];
  await other.action(disconnectAndRevoke, { accountId: connection.accountId, expectedGeneration: 1 }).catch(error => errors.push(error));
  await owner.action(disconnectAndRevoke, { accountId: connection.accountId, expectedGeneration: 7 }).catch(error => errors.push(error));
  await t.action(disconnectAndRevoke, { accountId: connection.accountId, expectedGeneration: 1 }).catch(error => errors.push(error));
  expect(errors).toHaveLength(3);
  for (const error of errors) expectNoToken(String(error instanceof Error ? error.message : error));
  expect(fetcher).not.toHaveBeenCalled();
  expect(await t.run(ctx => ctx.db.query("mailboxSecrets").collect())).toHaveLength(1);
  const account = (await t.run(ctx => ctx.db.get(connection.accountId)))!;
  expect(account).toMatchObject({ status: "CONNECTED", generation: 1 });
  expect(account.lastRevocation).toBeUndefined();
  expectNoToken(consoleCalls);
});

test("the older disconnect mutation keeps working for older frontends (R17)", async () => {
  const { t, owner } = await setup();
  const fetcher = provider();
  const connection = await connect(owner);
  fetcher.mockClear();
  expect(await owner.mutation(api.mailboxes.disconnect, { accountId: connection.accountId, expectedGeneration: 1 })).toEqual({ generation: 2 });
  expect(fetcher).not.toHaveBeenCalled();
  expect(await t.run(ctx => ctx.db.query("mailboxSecrets").collect())).toEqual([]);
  expect((await t.run(ctx => ctx.db.get(connection.accountId)))?.status).toBe("DISCONNECTED");
});

test("a second disconnect while one is revoking is refused, so Google gets one request (R17)", async () => {
  const { owner } = await setup();
  provider();
  const connection = await connect(owner);
  let second: unknown;
  let nested = false;
  const fetcher = provider(async () => {
    if (nested) return new Response("{}");
    nested = true;
    second = await owner.action(disconnectAndRevoke, { accountId: connection.accountId, expectedGeneration: 1 })
      .then(() => "revoked again", error => (error as Error).message);
    return new Response("{}");
  });
  const first = await owner.action(disconnectAndRevoke, { accountId: connection.accountId, expectedGeneration: 1 });
  expect(first).toEqual({ disconnected: true, generation: 2, revocation: "REVOKED" });
  expect(second).toContain("Disconnect already in progress.");
  expect(revocations(fetcher)).toHaveLength(1);
});

test("disconnecting an account that's already disconnected keeps its earlier outcome (R17)", async () => {
  const { t, owner } = await setup();
  provider();
  const connection = await connect(owner);
  const fetcher = provider(async () => new Response("{}", { status: 500 }));
  expect(await owner.action(disconnectAndRevoke, { accountId: connection.accountId, expectedGeneration: 1 }))
    .toEqual({ disconnected: true, generation: 2, revocation: "FAILED" });
  fetcher.mockClear();
  await expect(owner.action(disconnectAndRevoke, { accountId: connection.accountId, expectedGeneration: 2 }))
    .rejects.toThrow("Mailbox already disconnected.");
  expect(fetcher).not.toHaveBeenCalled();
  const account = (await t.run(ctx => ctx.db.get(connection.accountId)))!;
  expect(account).toMatchObject({ status: "DISCONNECTED", generation: 2, lastRevocation: { outcome: "FAILED" } });
});

test("scans stop before Google is asked, and none can start during the revocation (R17)", async () => {
  const { t, owner } = await setup();
  provider();
  const connection = await connect(owner);
  const scan = await owner.mutation(api.mailboxes.startScan, { accountId: connection.accountId, expectedGeneration: 1 });
  let during: { job?: string; newScan?: string } = {};
  const fetcher = provider(async () => {
    const job = await t.run(ctx => ctx.db.get(scan.jobId));
    const newScan = await owner.mutation(api.mailboxes.startScan, { accountId: connection.accountId, expectedGeneration: 1 })
      .then(() => "started", error => (error as Error).message);
    during = { job: job?.status, newScan };
    return new Response("{}");
  });
  const result = await owner.action(disconnectAndRevoke, { accountId: connection.accountId, expectedGeneration: 1 });
  expect(during).toEqual({ job: "CANCELLED", newScan: expect.stringContaining("Mailbox disconnect in progress.") });
  expect(result).toEqual({ disconnected: true, generation: 2, revocation: "REVOKED" });
  expect(revocations(fetcher)).toHaveLength(1);
});

test("a revocation that outlived its window can't finish or clear a newer one (R17)", async () => {
  const { t, owner } = await setup();
  provider();
  const connection = await connect(owner);
  const args = { accountId: connection.accountId, expectedGeneration: 1 };
  const older = await owner.mutation(internal.mailboxes.beginRevocation, args);
  // The older action stalls past the pending window; a newer disconnect starts.
  await t.run(async ctx => {
    const account = (await ctx.db.get(connection.accountId))!;
    await ctx.db.patch(account._id, { revocationPending: { ...account.revocationPending!, until: Date.now() - 1 } });
  });
  const newer = await owner.mutation(internal.mailboxes.beginRevocation, args);
  expect(newer.revocationToken).not.toBe(older.revocationToken);

  const stale = await owner.mutation(internal.mailboxes.finishDisconnect, { ...args, outcome: "REVOKED", revocationToken: older.revocationToken });
  expect(stale).toEqual({ disconnected: false, reason: "GENERATION_CHANGED" });
  const during = (await t.run(ctx => ctx.db.get(connection.accountId)))!;
  expect(during).toMatchObject({ status: "CONNECTED", generation: 1, revocationPending: { token: newer.revocationToken } });

  const current = await owner.mutation(internal.mailboxes.finishDisconnect, { ...args, outcome: "REVOKED", revocationToken: newer.revocationToken });
  expect(current).toEqual({ disconnected: true, generation: 2, revocation: "REVOKED" });
  const after = (await t.run(ctx => ctx.db.get(connection.accountId)))!;
  expect(after.status).toBe("DISCONNECTED");
  expect(after.revocationPending).toBeUndefined();
});

test("discovery runs and scheduled scans claim nothing during a revocation (R17)", async () => {
  const { t, owner } = await setup();
  provider();
  const connection = await connect(owner);
  const due = Date.now() - 1000;
  await t.run(ctx => ctx.db.patch(connection.accountId, { maintenanceEnabled: true, nextMaintenanceAt: due }));
  let during: { run?: string; scheduled?: unknown; nextMaintenanceAt?: number; runs?: number } = {};
  provider(async () => {
    const run = await owner.mutation(api.mailboxes.startDiscoveryRun, { accountId: connection.accountId, expectedGeneration: 1, requestId: "request-r17-01" })
      .then(() => "started", error => (error as Error).message);
    const scheduled = await t.mutation(internal.mailboxes.startScheduledScan, { accountId: connection.accountId, expectedGeneration: 1 });
    const account = await t.run(ctx => ctx.db.get(connection.accountId));
    const runs = (await t.run(ctx => ctx.db.query("mailboxDiscoveryRuns").collect())).length;
    during = { run, scheduled, nextMaintenanceAt: account?.nextMaintenanceAt, runs };
    return new Response("{}");
  });
  await owner.action(disconnectAndRevoke, { accountId: connection.accountId, expectedGeneration: 1 });
  expect(during).toEqual({ run: expect.stringContaining("Mailbox disconnect in progress."), scheduled: null, nextMaintenanceAt: due, runs: 0 });
});

test("tokens a reconnect receives during a revocation are revoked, not left live at Google (R17)", async () => {
  const { owner } = await setup();
  provider();
  const connection = await connect(owner);
  const reconnect = stateFrom(await owner.action(start, { accountId: connection.accountId, expectedGeneration: 1 }));
  const NEW_REFRESH = "refresh-SECRET-r17-new-4b2d";
  const revoked: string[] = [];
  let refused: unknown;
  let nested = false;
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
    const url = String(input);
    if (url === "https://oauth2.googleapis.com/token") return Response.json({ access_token: "access-new", refresh_token: NEW_REFRESH, expires_in: 3600, token_type: "Bearer", scope });
    if (url === "https://openidconnect.googleapis.com/v1/userinfo") return Response.json({ sub: "google-sub", email: "google-sub@example.test", email_verified: true });
    if (url === REVOKE) {
      revoked.push(new URLSearchParams(String(init?.body)).get("token") ?? "");
      if (!nested) {
        nested = true;
        // The reconnect's code exchange lands while this disconnect is revoking.
        refused = await owner.action(callback, reply(reconnect)).then(() => "installed", error => (error as Error).message);
      }
      return new Response("{}");
    }
    throw new Error("Unexpected HTTP endpoint");
  });
  vi.stubGlobal("fetch", fetcher);
  const result = await owner.action(disconnectAndRevoke, { accountId: connection.accountId, expectedGeneration: 1 });
  expect(refused).toBe("Gmail authorization failed. Start a new connection attempt.");
  expect(result).toMatchObject({ disconnected: true, revocation: "REVOKED" });
  expect(revoked).toEqual([REFRESH, NEW_REFRESH]);
  expectNoToken(consoleCalls);
  expect(JSON.stringify(consoleCalls)).not.toContain(NEW_REFRESH);
});

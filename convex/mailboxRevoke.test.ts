/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
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

test("a reconnect between the check and the final step leaves the new connection intact (R17)", async () => {
  const { t, owner } = await setup();
  provider();
  const connection = await connect(owner);
  const reconnect = stateFrom(await owner.action(start, { accountId: connection.accountId, expectedGeneration: 1 }));
  let reconnected: { generation: number } | undefined;
  const fetcher = provider(async () => {
    reconnected = await owner.action(callback, reply(reconnect));
    return new Response("{}");
  });
  const result = await owner.action(disconnectAndRevoke, { accountId: connection.accountId, expectedGeneration: 1 });
  expect(reconnected?.generation).toBe(2);
  expect(result).toEqual({ disconnected: false, reason: "GENERATION_CHANGED" });
  expect(revocations(fetcher)).toHaveLength(1);
  const account = (await t.run(ctx => ctx.db.get(connection.accountId)))!;
  expect(account).toMatchObject({ status: "CONNECTED", generation: 2 });
  expect(account.lastRevocation).toBeUndefined();
  const secrets = await t.run(ctx => ctx.db.query("mailboxSecrets").collect());
  expect(secrets).toHaveLength(1);
  expect(secrets[0].generation).toBe(2);
  expectNoToken(consoleCalls);
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

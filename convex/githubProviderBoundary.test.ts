// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { makeFunctionReference } from "convex/server";
import schema from "./schema";
const modules = import.meta.glob("./**/*.ts");
const connect = makeFunctionReference<"action">("connectors:connectGithub");
const source = () => ({ data: { viewer: { login: "synthetic-account", createdAt: "2020-01-01T00:00:00Z", contributionsCollection: { contributionCalendar: { totalContributions: 2, weeks: [{ contributionDays: [{ date: "2026-09-20", contributionCount: 2, contributionLevel: "FIRST_QUARTILE" }] }] } } } } });
const response = (text: string, status = 200) => new Response(text, { status, headers: { "Content-Type": "application/json" } });
beforeEach(() => { vi.stubEnv("CONNECTOR_ENCRYPTION_KEY", "synthetic-audit-only-not-a-credential"); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
async function fixture(fetcher: typeof fetch, existing = true) {
  vi.stubGlobal("fetch", fetcher);
  const t = convexTest(schema, modules);
  await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { handle: "synthetic-owner", authSubject: "synthetic-owner", displayName: "Synthetic", bio: "" });
    if (!existing) return;
    const connectorId = await ctx.db.insert("connectorAccounts", { userId, provider: "GITHUB", accountLabel: "github.com/synthetic-account", attributionScope: "PERSONAL", status: "CONNECTED", connectedAt: "2026-09-01" });
    const secretRef = await ctx.db.insert("connectorSecrets", { userId, provider: "GITHUB", ciphertext: "original-synthetic", iv: "original-synthetic", createdAt: "2026-09-01" });
    await ctx.db.patch(connectorId, { secretRef });
  });
  const call = () => t.withIdentity({ subject: "synthetic-owner" }).action(connect, { token: "synthetic-token-never-sent" });
  const rows = () => t.run(async ctx => ({ raw: await ctx.db.query("rawEvidence").collect(), props: await ctx.db.query("props").collect(), connectors: await ctx.db.query("connectorAccounts").collect(), secrets: await ctx.db.query("connectorSecrets").collect(), proofs: await ctx.db.query("proofs").collect(), signals: await ctx.db.query("usageSignals").collect(), drafts: await ctx.db.query("draftImports").collect(), users: await ctx.db.query("users").collect(), products: await ctx.db.query("products").collect(), sources: await ctx.db.query("evidenceSources").collect(), publications: await ctx.db.query("publishedProfiles").collect(), subscriptions: await ctx.db.query("metricSubscriptions").collect() }));
  return { call, rows };
}
async function rejected(text: string, status = 200) {
  const f = await fixture(vi.fn(async () => response(text, status)));
  const before = await f.rows();
  await expect(f.call()).rejects.toThrow("GitHub activity response unavailable.");
  expect(await f.rows()).toEqual(before);
}
test.each(["1e-999", "1.0000000000000001", "9007199254740991.1", "9007199254740992", "1e999", "-1", "1.5", '\"2\"', "null"])("rejects raw count %s without rotating an existing connector", async token => {
  await rejected(JSON.stringify(source()).replace('"totalContributions":2', `"totalContributions":${token}`).replace('"contributionCount":2', `"contributionCount":${token}`));
});
test.each(["absent", "null", "unknown-level", "date", "createdAt", "duplicate", "rows", "errors"])("rejects invalid source %s before writes", async kind => {
  const input = source(), viewer = input.data.viewer, calendar = viewer.contributionsCollection.contributionCalendar;
  let text: string;
  if (kind === "unknown-level") calendar.weeks[0].contributionDays[0].contributionLevel = "UNRECOGNIZED";
  if (kind === "date") calendar.weeks[0].contributionDays[0].date = "2026-02-30";
  if (kind === "createdAt") viewer.createdAt = "not-a-timestamp";
  if (kind === "duplicate") calendar.weeks.push(calendar.weeks[0]);
  if (kind === "rows") calendar.weeks[0].contributionDays = Array.from({ length: 401 }, (_, index) => ({ date: new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10), contributionCount: 2, contributionLevel: "FIRST_QUARTILE" }));
  text = JSON.stringify(kind === "errors" ? { ...input, errors: [{ message: "SYNTHETIC_PRIVATE_SENTINEL" }] } : input);
  if (kind === "absent") text = text.replace('"login":"synthetic-account",', "");
  if (kind === "null") text = text.replace('"login":"synthetic-account"', '"login":null');
  await rejected(text);
});
test("rejects oversized provider body", async () => {
  await rejected(JSON.stringify({ ...source(), extensions: { diagnostic: "x".repeat(140_000) } }));
});
test("does not echo the provider error", async () => {
  await rejected(JSON.stringify({ errors: [{ message: "SYNTHETIC_PRIVATE_SENTINEL" + "x".repeat(100_000) }] }), 403);
});
test("valid zero creates one private unconfirmed snapshot", async () => {
  const text = JSON.stringify(source()).replace('"totalContributions":2', '"totalContributions":0').replace('"contributionCount":2', '"contributionCount":0');
  const f = await fixture(vi.fn(async () => response(text)));
  await f.call();
  const state = await f.rows();
  expect(state.raw).toHaveLength(1);
  expect(state.raw[0].suggestedActivity).toMatchObject({ total: 0, days: [{ count: 0 }] });
  expect(state.props[0].visibility).toBe("DRAFT");
});
test("an invalid first capture leaves an empty owner's collection and sources empty", async () => {
  const f = await fixture(vi.fn(async () => response(JSON.stringify(source()).replace('"contributionCount":2', '"contributionCount":1e-999'))), false);
  const before = await f.rows();
  await expect(f.call()).rejects.toThrow("GitHub activity response unavailable.");
  expect(await f.rows()).toEqual(before);
});
test("oversized chunked response with misleading header leaves all capture state unchanged", async () => {
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(70_000)); controller.enqueue(new Uint8Array(70_000)); }, cancel });
  const f = await fixture(vi.fn(async () => new Response(stream, { headers: { "Content-Type": "application/json", "Content-Length": "1" } })));
  const before = await f.rows();
  await expect(f.call()).rejects.toThrow("GitHub activity response unavailable.");
  expect(await f.rows()).toEqual(before);
  expect(cancel).toHaveBeenCalledOnce();
  expect(stream.locked).toBe(false);
});
test.each(["fetch", "read"])("stalled %s times out before connector or evidence writes", async kind => {
  vi.useFakeTimers();
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({ cancel });
  const fetcher = vi.fn(() => kind === "fetch" ? new Promise<Response>(() => undefined) : Promise.resolve(new Response(stream, { headers: { "Content-Type": "application/json" } })));
  const f = await fixture(fetcher), before = await f.rows();
  const pending = f.call();
  const checked = expect(pending).rejects.toThrow("GitHub activity response unavailable.");
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  await vi.advanceTimersByTimeAsync(10_000);
  await checked;
  expect(await f.rows()).toEqual(before);
  if (kind === "read") { expect(cancel).toHaveBeenCalledOnce(); expect(stream.locked).toBe(false); }
  expect(vi.getTimerCount()).toBe(0);
});

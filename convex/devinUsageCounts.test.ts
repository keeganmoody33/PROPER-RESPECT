// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import schema from "./schema";

// Issue #86: a usage count Devin leaves out is unknown. It never becomes 0.
const modules = import.meta.glob("./**/*.ts");
const connect = makeFunctionReference<"action">("connectors:connectDevin");
const refresh = makeFunctionReference<"action">("connectors:refreshApproved");
const reply = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
const full = { sessions_count: 9, searches_count: 4, prs_created_count: 2, prs_merged_count: 1 };
const withoutSessions = [
  { searches_count: 4, prs_created_count: 2, prs_merged_count: 1 },
  { sessions_count: null, searches_count: 4, prs_created_count: 2, prs_merged_count: 1 },
  { data: { searches_count: 4, prs_created_count: 2, prs_merged_count: 1 } },
];
const withoutCounts = [{}, { data: {} }, { sessions_count: null, searches_count: null, prs_created_count: null, prs_merged_count: null }];
beforeEach(() => { vi.stubEnv("CONNECTOR_ENCRYPTION_KEY", "synthetic-devin-counts-only"); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

type Metric = { label: string; value: number };
function metrics(activity: { kind: string; primary?: Metric; supporting?: Metric[] } | undefined) {
  return activity?.kind === "headlineMetrics" ? [activity.primary, ...(activity.supporting ?? [])] : activity;
}

async function fixture(body: unknown) {
  const fetcher = vi.fn(async () => reply(body));
  vi.stubGlobal("fetch", fetcher);
  const t = convexTest(schema, modules);
  await t.run(ctx => ctx.db.insert("users", { authSubject: "owner", handle: "owner", displayName: "Owner", bio: "" }));
  const rows = () => t.run(async ctx => ({
    connectors: await ctx.db.query("connectorAccounts").collect(), secrets: await ctx.db.query("connectorSecrets").collect(),
    products: await ctx.db.query("products").collect(), props: await ctx.db.query("props").collect(),
    links: await ctx.db.query("links").collect(), drafts: await ctx.db.query("draftImports").collect(),
    signals: await ctx.db.query("usageSignals").collect(), subscriptions: await ctx.db.query("metricSubscriptions").collect(),
    published: await ctx.db.query("publishedProfiles").collect(),
  }));
  const call = () => t.withIdentity({ subject: "owner" }).action(connect, { token: "synthetic-devin-token-never-sent", organizationId: "synthetic-org" });
  const respond = (next: unknown) => fetcher.mockImplementation(async () => reply(next));
  return { t, rows, call, respond };
}

// Connects with every count, then approves a public card that refreshes devin.sessions.
async function approvedCard(f: Awaited<ReturnType<typeof fixture>>) {
  await f.call();
  await f.t.run(async ctx => {
    const prop = (await ctx.db.query("props").unique())!;
    const product = (await ctx.db.get(prop.productId))!;
    const connector = (await ctx.db.query("connectorAccounts").unique())!;
    await ctx.db.patch(prop._id, { visibility: "PUBLIC" });
    await ctx.db.insert("metricSubscriptions", { userId: prop.userId, propId: prop._id, connectorId: connector._id, metricKey: "devin.sessions",
      attributionScope: "ORGANIZATION", refreshCadence: "DAILY", approvedAt: "2026-09-25T00:00:00.000Z" });
    await ctx.db.insert("publishedProfiles", { handle: "owner", revision: 1, publishedAt: prop.activity!.capturedAt, cardPropIds: [prop._id], profile: {
      handle: "owner", displayName: "Owner", bio: "", cards: [{ product: { name: product.name, slug: product.slug, domain: product.domain, description: product.description },
        status: prop.status, headline: prop.headline, note: prop.note, activity: prop.activity, primaryLink: { type: "CANONICAL", url: "https://devin.ai", label: "Open Devin" } }],
    } });
  });
  return await f.rows();
}

test.each(withoutSessions)("connect leaves a missing sessions count off the card and records no sessions value: %j", async body => {
  const f = await fixture(body);
  await f.call();
  const { props, signals } = await f.rows();
  expect(metrics(props[0].activity)).toEqual([{ label: "Searches", value: 4 }, { label: "PRs created", value: 2 }, { label: "PRs merged", value: 1 }]);
  expect(signals).toEqual([]);
});

test("connect leaves missing supporting counts off the card", async () => {
  const f = await fixture({ sessions_count: 5 });
  await f.call();
  const { props, signals } = await f.rows();
  expect(metrics(props[0].activity)).toEqual([{ label: "Sessions", value: 5 }]);
  expect(signals.map(signal => [signal.metricKey, signal.value])).toEqual([["devin.sessions", 5]]);
});

test("a zero Devin reports stays a zero", async () => {
  const f = await fixture({ sessions_count: 0, searches_count: 0, prs_created_count: 0, prs_merged_count: 0 });
  await f.call();
  const { props, signals } = await f.rows();
  expect(metrics(props[0].activity)).toEqual([{ label: "Sessions", value: 0 }, { label: "Searches", value: 0 }, { label: "PRs created", value: 0 }, { label: "PRs merged", value: 0 }]);
  expect(signals.map(signal => [signal.metricKey, signal.value])).toEqual([["devin.sessions", 0]]);
});

test.each(withoutCounts)("connect with no reported count writes nothing: %j", async body => {
  const f = await fixture(body);
  const before = await f.rows();
  const outcome = await f.call().then(() => "connected", (error: Error) => error.message);
  expect(await f.rows()).toEqual(before);
  expect(outcome).toContain("Devin usage response did not include any usage counts.");
});

test.each([...withoutSessions, ...withoutCounts])("refresh without sessions_count keeps the approved card's last capture, marked stale: %j", async body => {
  const f = await fixture(full);
  const before = await approvedCard(f);
  f.respond(body);
  await f.t.action(refresh, {});
  const after = await f.rows();
  expect(after.published[0].profile.cards[0].activity).toEqual({ ...before.published[0].profile.cards[0].activity!, freshness: "STALE" });
  expect(after.props[0].activity).toEqual({ ...before.props[0].activity!, freshness: "STALE" });
  expect(after.published[0].revision).toBe(1);
  expect(after.signals).toEqual(before.signals);
  expect(after.subscriptions[0].lastError).toMatch(/^Devin usage response did not include/);
  expect(after.connectors[0]).toMatchObject({ status: "ERROR", lastSyncedAt: before.connectors[0].lastSyncedAt });
});

test("refresh leaves missing supporting counts off the approved card", async () => {
  const f = await fixture(full);
  const before = await approvedCard(f);
  expect(metrics(before.published[0].profile.cards[0].activity)).toHaveLength(4);
  f.respond({ sessions_count: 12 });
  await f.t.action(refresh, {});
  const after = await f.rows();
  expect(metrics(after.published[0].profile.cards[0].activity)).toEqual([{ label: "Sessions", value: 12 }]);
  expect(metrics(after.props[0].activity)).toEqual([{ label: "Sessions", value: 12 }]);
  expect(after.signals.slice(before.signals.length).map(signal => [signal.metricKey, signal.value, signal.visibility])).toEqual([["devin.sessions", 12, "PUBLIC"]]);
});

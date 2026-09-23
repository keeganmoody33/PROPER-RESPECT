// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const refresh = makeFunctionReference<"action">("connectors:refreshApproved");
const activity = (total: number) => ({ kind: "contributionCalendar" as const, total, days: [], attributionScope: "PERSONAL" as const,
  capturedAt: "2026-09-22T10:00:00.000Z", freshness: "FRESH" as const, provenanceLabel: "Synthetic" });
const response = (login = "synthetic-account", status = 200) => new Response(JSON.stringify({ data: { viewer: { login,
  createdAt: "2020-01-01T00:00:00Z", contributionsCollection: { contributionCalendar: { totalContributions: 7,
    weeks: [{ contributionDays: [{ date: "2026-09-23", contributionCount: 7, contributionLevel: "FIRST_QUARTILE" }] }] } } } } }),
  { status, headers: { "Content-Type": "application/json" } });
beforeEach(() => { vi.stubEnv("CONNECTOR_ENCRYPTION_KEY", "synthetic-refresh-only"); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

async function fixture(fetcher = vi.fn(async () => response()), plaintext = "synthetic-token-never-sent") {
  vi.stubGlobal("fetch", fetcher);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("synthetic-refresh-only"));
  const key = await crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt"]);
  const iv = new Uint8Array(12);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext)));
  const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { authSubject: "owner", handle: "owner", displayName: "Owner", bio: "" });
    const otherId = await ctx.db.insert("users", { authSubject: "other", handle: "other", displayName: "Other", bio: "" });
    const productId = await ctx.db.insert("products", { name: "GitHub", slug: "github", domain: "github.com", description: "Synthetic" });
    const propId = await ctx.db.insert("props", { userId, productId, status: "ACTIVE", visibility: "PUBLIC", headline: "Approved", note: "Owner context", activity: activity(3) });
    const secretId = await ctx.db.insert("connectorSecrets", { userId, provider: "GITHUB", ciphertext: base64(ciphertext), iv: base64(iv), createdAt: "2026-09-22T00:00:00.000Z" });
    const connectorId = await ctx.db.insert("connectorAccounts", { userId, provider: "GITHUB", status: "CONNECTED", accountLabel: "github.com/synthetic-account", attributionScope: "PERSONAL", secretRef: secretId, connectedAt: "2026-09-22T00:00:00.000Z" });
    const subscriptionId = await ctx.db.insert("metricSubscriptions", { userId, propId, connectorId, metricKey: "github.contributions", attributionScope: "PERSONAL", refreshCadence: "DAILY", approvedAt: "2026-09-22T00:00:00.000Z" });
    const publishedId = await ctx.db.insert("publishedProfiles", { handle: "owner", revision: 1, publishedAt: "2026-09-22T10:00:00.000Z", cardPropIds: [propId], profile: { handle: "owner", displayName: "Owner", bio: "", cards: [{ product: { name: "GitHub", slug: "github", domain: "github.com", description: "Synthetic" }, status: "ACTIVE", headline: "Approved", note: "Owner context", activity: activity(3), primaryLink: { type: "CANONICAL", url: "https://github.com", label: "Open" } }] } });
    return { userId, otherId, productId, propId, secretId, connectorId, subscriptionId, publishedId };
  });
  const state = () => t.run(async ctx => ({ published: await ctx.db.get(ids.publishedId), prop: await ctx.db.get(ids.propId),
    signals: await ctx.db.query("usageSignals").collect(), connector: await ctx.db.get(ids.connectorId) }));
  return { t, ids, fetcher, state, call: () => t.action(refresh, {}) };
}
async function positiveControl() {
  const f = await fixture(); await f.call();
  const state = await f.state();
  expect(state.published?.profile.cards[0].activity).toMatchObject({ total: 7, freshness: "FRESH" });
  expect(state.signals).toHaveLength(1);
  expect(state.signals[0]).toMatchObject({ value: 7, metricKey: "github.contributions", visibility: "PUBLIC" });
}

for (const invalid of ["connector-owner", "secret-owner", "secret-provider", "publication", "private-prop"] as const) {
  test(`refresh blocks provider effects for invalid ${invalid}`, async () => {
    await positiveControl();
    const f = await fixture();
    await f.t.run(async ctx => {
      if (invalid === "connector-owner") await ctx.db.patch(f.ids.connectorId, { userId: f.ids.otherId });
      if (invalid === "secret-owner") await ctx.db.patch(f.ids.secretId, { userId: f.ids.otherId });
      if (invalid === "secret-provider") await ctx.db.patch(f.ids.secretId, { provider: "DEVIN" });
      if (invalid === "publication") await ctx.db.delete(f.ids.publishedId);
      if (invalid === "private-prop") await ctx.db.patch(f.ids.propId, { visibility: "PRIVATE" });
    });
    const before = await f.state(); await f.call();
    expect(f.fetcher).not.toHaveBeenCalled();
    expect(await f.state()).toEqual(before);
  });
}
test("refresh rejects returned source account mismatch without publishing it", async () => {
  await positiveControl();
  const f = await fixture(vi.fn(async () => response("different-account")));
  await f.call(); const state = await f.state();
  expect(state.published?.profile.cards[0].activity).toMatchObject({ total: 3 });
  expect(state.published?.revision).toBe(1);
  expect(state.signals).toHaveLength(0);
});
test("equal captured observation cannot duplicate signals or revisions", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-23T12:00:00.000Z"));
  const f = await fixture(); await f.call(); await f.call();
  const state = await f.state();
  expect(state.published?.profile.cards[0].activity).toMatchObject({ total: 7 });
  expect(state.signals).toHaveLength(1);
  expect(state.published?.revision).toBe(2);
});
for (const succeeds of [true, false]) test(`in-flight ${succeeds ? "success" : "failure"} cannot rewrite a newer owner publication`, async () => {
  await positiveControl();
  let release!: (value: Response) => void;
  const fetcher = vi.fn(() => new Promise<Response>(resolve => { release = resolve; }));
  const f = await fixture(fetcher);
  const pending = f.call();
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  await f.t.run(async ctx => {
    const published = (await ctx.db.get(f.ids.publishedId))!;
    await ctx.db.patch(f.ids.publishedId, { revision: 2, profile: { ...published.profile,
      cards: [{ ...published.profile.cards[0], headline: "New owner choice", activity: activity(99) }] } });
  });
  release(response("synthetic-account", succeeds ? 200 : 403)); await pending;
  const state = await f.state();
  expect(state.published?.profile.cards[0]).toMatchObject({ headline: "New owner choice", activity: { total: 99, freshness: "FRESH" } });
  expect(state.published?.revision).toBe(2);
  expect(state.signals).toHaveLength(0);
});
test("in-flight success from a rotated credential cannot overwrite current account state", async () => {
  await positiveControl();
  let release!: (value: Response) => void;
  const fetcher = vi.fn(() => new Promise<Response>(resolve => { release = resolve; }));
  const f = await fixture(fetcher); const pending = f.call();
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  await f.t.run(ctx => ctx.db.patch(f.ids.secretId, { ciphertext: "new-synthetic-credential", rotatedAt: "2026-09-23T12:00:00.000Z" }));
  release(response()); await pending;
  const state = await f.state();
  expect(state.published?.profile.cards[0].activity).toMatchObject({ total: 3, freshness: "FRESH" });
  expect(state.signals).toHaveLength(0);
});
for (const succeeds of [true, false]) test(`legacy ${succeeds ? "applyRefresh" : "markRefreshFailed"} cannot mutate GitHub without guarded context`, async () => {
  await positiveControl();
  const f = await fixture();
  const before = await f.state();
  const name = succeeds ? "connectors:applyRefresh" : "connectors:markRefreshFailed";
  const args = succeeds ? { subscriptionId: f.ids.subscriptionId, activity: activity(111), value: 111 }
    : { subscriptionId: f.ids.subscriptionId, message: "Old in-flight synthetic error" };
  await f.t.mutation(makeFunctionReference<"mutation">(name), args).catch(() => undefined);
  expect(await f.state()).toEqual(before);
  expect((await f.state()).published?.profile.cards[0].activity).toMatchObject({ total: 3, freshness: "FRESH" });
});

test("strictly newer same-day observation remains refreshable", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-23T12:00:00.000Z"));
  const f = await fixture(); await f.call();
  vi.setSystemTime(new Date("2026-09-23T12:00:01.000Z"));
  await f.call();
  const state = await f.state();
  expect(state.signals).toHaveLength(2);
  expect(state.published?.revision).toBe(3);
  expect(state.published?.profile.cards[0].activity).toMatchObject({ total: 7, capturedAt: "2026-09-23T12:00:01.000Z" });
});

const prepare = makeFunctionReference<"query">("connectors:prepareGithubRefresh");
const complete = makeFunctionReference<"mutation">("connectors:completeGithubRefresh");
const success = (capturedAt = "2026-09-23T12:00:00.000Z") => ({ kind: "success", accountLabel: "github.com/synthetic-account", activity: { ...activity(7), capturedAt }, value: 7 });
for (const status of ["REVOKED", "NEEDS_REAUTH"] as const) test(`ineligible ${status} prevents provider acquisition`, async () => {
  await positiveControl(); const f = await fixture();
  await f.t.run(ctx => ctx.db.patch(f.ids.connectorId, { status }));
  await f.call();
  expect(f.fetcher).not.toHaveBeenCalled();
  expect((await f.state()).published?.profile.cards[0].activity).toMatchObject({ total: 3 });
});
test("duplicate active subscription fails closed before acquisition", async () => {
  await positiveControl(); const f = await fixture();
  await f.t.run(async ctx => { const original = (await ctx.db.get(f.ids.subscriptionId))!;
    const { _id, _creationTime, ...fields } = original; void _id; void _creationTime;
    await ctx.db.insert("metricSubscriptions", fields); });
  await f.call(); expect(f.fetcher).not.toHaveBeenCalled();
  expect((await f.state()).signals).toHaveLength(0);
});
test("concurrent identical grant completions apply at most one signal and revision", async () => {
  const f = await fixture(); const prepared = await f.t.query(prepare, { subscriptionId: f.ids.subscriptionId });
  const result = await Promise.all([f.t.mutation(complete, { grant: prepared.grant, outcome: success() }),
    f.t.mutation(complete, { grant: prepared.grant, outcome: success() })]);
  expect(result.sort()).toEqual([false, true]);
  expect((await f.state()).signals).toHaveLength(1);
  expect((await f.state()).published?.revision).toBe(2);
});
for (const capturedAt of ["2026-09-22T09:59:59.000Z", "2026-09-22T10:00:00.000Z", "bad", "2099-01-01T00:00:00.000Z"]) test(`invalid or non-increasing capture ${capturedAt} cannot apply`, async () => {
  const f = await fixture(); const prepared = await f.t.query(prepare, { subscriptionId: f.ids.subscriptionId });
  expect(await f.t.mutation(complete, { grant: prepared.grant, outcome: success(capturedAt) })).toBe(false);
  expect((await f.state()).published?.revision).toBe(1);
  expect(await f.t.mutation(complete, { grant: prepared.grant, outcome: success() })).toBe(true);
  expect((await f.state()).signals).toHaveLength(1);
});
test("failure checkpoints advance with a frozen clock and transient ERROR can recover", async () => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-09-23T12:00:00.000Z"));
  const f = await fixture();
  const first = await f.t.query(prepare, { subscriptionId: f.ids.subscriptionId });
  expect(await f.t.mutation(complete, { grant: first.grant, outcome: { kind: "failure" } })).toBe(true);
  expect(await f.t.mutation(complete, { grant: first.grant, outcome: { kind: "failure" } })).toBe(false);
  const second = await f.t.query(prepare, { subscriptionId: f.ids.subscriptionId });
  expect(await f.t.mutation(complete, { grant: second.grant, outcome: { kind: "failure" } })).toBe(true);
  expect((await f.t.run(ctx => ctx.db.get(f.ids.subscriptionId)))?.lastAttemptedAt).toBe("2026-09-23T12:00:00.001Z");
  await f.call();
  expect((await f.state()).connector?.status).toBe("CONNECTED");
  expect((await f.state()).signals).toHaveLength(1);
});
test("a still-current grant does not expire at midnight", async () => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-09-23T23:59:59.000Z"));
  const f = await fixture(); const prepared = await f.t.query(prepare, { subscriptionId: f.ids.subscriptionId });
  vi.setSystemTime(new Date("2026-09-24T00:00:01.000Z"));
  expect(await f.t.mutation(complete, { grant: prepared.grant, outcome: success("2026-09-24T00:00:00.000Z") })).toBe(true);
  expect((await f.state()).signals).toHaveLength(1);
});
for (const kind of ["failure", "success"] as const) test(`same-timestamp credential rotation rejects old ${kind} completion`, async () => {
  const f = await fixture(); const prepared = await f.t.query(prepare, { subscriptionId: f.ids.subscriptionId });
  await f.t.run(ctx => ctx.db.patch(f.ids.secretId, { ciphertext: "different-synthetic-ciphertext" }));
  expect(await f.t.mutation(complete, { grant: prepared.grant, outcome: kind === "success" ? success() : { kind } })).toBe(false);
  expect((await f.state()).published?.profile.cards[0].activity).toMatchObject({ total: 3, freshness: "FRESH" });
});
test("new private choice and sibling public card remain unchanged after approved refresh", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    await ctx.db.patch(f.ids.propId, { relationshipVersion: 1, activity: activity(999), headline: "Private choice" });
    const sibling = await ctx.db.insert("props", { userId: f.ids.userId, productId: f.ids.productId, status: "TESTING", visibility: "PUBLIC", headline: "Sibling", note: "Sibling", activity: activity(22) });
    const published = (await ctx.db.get(f.ids.publishedId))!;
    await ctx.db.patch(f.ids.publishedId, { cardPropIds: [f.ids.propId, sibling], profile: { ...published.profile, cards: [...published.profile.cards, { ...published.profile.cards[0], headline: "Sibling", activity: activity(22) }] } });
  });
  const before = await f.state(); await f.call(); const after = await f.state();
  expect(after.prop).toEqual(before.prop);
  expect(after.published?.profile.cards[1]).toEqual(before.published?.profile.cards[1]);
  expect(after.published?.profile.cards[0].activity).toMatchObject({ total: 7 });
  expect(after.signals).toHaveLength(1);
});

test("concurrent admitted action reads still produce one compatible result", async () => {
  const releases: ((value: Response) => void)[] = [];
  const fetcher = vi.fn(() => new Promise<Response>(resolve => { releases.push(resolve); }));
  const f = await fixture(fetcher);
  const first = f.call(), second = f.call();
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  releases.forEach(release => release(response()));
  await Promise.all([first, second]);
  const state = await f.state();
  expect(state.signals).toHaveLength(1); expect(state.published?.revision).toBe(2);
  expect(state.published?.profile.cards[0].activity).toMatchObject({ total: 7 });
});
for (const succeeds of [true, false]) test(`revocation after acquisition prevents stale ${succeeds ? "success" : "failure"} writes`, async () => {
  await positiveControl(); let release!: (value: Response) => void;
  const fetcher = vi.fn(() => new Promise<Response>(resolve => { release = resolve; }));
  const f = await fixture(fetcher); const pending = f.call();
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  await f.t.withIdentity({ subject: "owner" }).mutation(makeFunctionReference<"mutation">("connectors:revokeConnector"), { connectorId: f.ids.connectorId });
  release(response("synthetic-account", succeeds ? 200 : 403)); await pending;
  const state = await f.state();
  expect(state.connector?.status).toBe("REVOKED");
  expect(state.published?.profile.cards[0].activity).toMatchObject({ total: 3, freshness: "FRESH" });
  expect(state.signals).toHaveLength(0);
});
async function devinFixture(fetcher: ReturnType<typeof vi.fn<() => Promise<Response>>>) {
  const f = await fixture(fetcher, JSON.stringify({ token: "synthetic-devin-token", organizationId: "synthetic-org" }));
  const devinActivity = { kind: "headlineMetrics" as const, attributionScope: "ORGANIZATION" as const,
    capturedAt: "2026-09-22T10:00:00.000Z", freshness: "FRESH" as const, provenanceLabel: "Synthetic Devin",
    primary: { label: "Sessions", value: 3 }, supporting: [] };
  await f.t.run(async ctx => {
    await ctx.db.patch(f.ids.productId, { name: "Devin", slug: "devin", domain: "devin.ai" });
    await ctx.db.patch(f.ids.connectorId, { provider: "DEVIN", attributionScope: "ORGANIZATION", accountLabel: "Devin organization synthetic-org" });
    await ctx.db.patch(f.ids.secretId, { provider: "DEVIN" });
    await ctx.db.patch(f.ids.subscriptionId, { metricKey: "devin.sessions", attributionScope: "ORGANIZATION" });
    await ctx.db.patch(f.ids.propId, { activity: devinActivity });
    const pub = (await ctx.db.get(f.ids.publishedId))!;
    await ctx.db.patch(f.ids.publishedId, { profile: { ...pub.profile, cards: [{ ...pub.profile.cards[0],
      product: { name: "Devin", slug: "devin", domain: "devin.ai", description: "Synthetic" }, activity: devinActivity }] } });
  });
  return f;
}
test("Devin action success and failure retain existing behavior", async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ sessions_count: 9, searches_count: 2 }), { status: 200 }));
  const f = await devinFixture(fetcher); await f.call();
  const successful = await f.state();
  expect(successful.published?.profile.cards[0].activity).toMatchObject({ kind: "headlineMetrics", primary: { label: "Sessions", value: 9 }, freshness: "FRESH" });
  expect(successful.signals[0]).toMatchObject({ metricKey: "devin.sessions", value: 9, attributionScope: "ORGANIZATION" });
  fetcher.mockImplementation(async () => new Response("Synthetic failure", { status: 503 }));
  await f.call(); const failed = await f.state();
  expect(failed.published?.profile.cards[0].activity).toMatchObject({ primary: { value: 9 }, freshness: "STALE" });
  expect(failed.connector?.status).toBe("ERROR"); expect(failed.signals).toHaveLength(1);
});
for (const mode of ["withheld", "fixed", "removed"] as const) test(`GitHub ${mode} publication blocks its old grant and preserves omitted refresh permission`, async () => {
  const f = await fixture();
  const sibling = await f.t.run(async ctx => {
    const prop = (await ctx.db.get(f.ids.propId))!;
    const { _id, _creationTime, ...fields } = prop; void _id; void _creationTime;
    const propId = await ctx.db.insert("props", { ...fields, headline: "Omitted" });
    await ctx.db.insert("metricSubscriptions", { userId: f.ids.userId, propId, connectorId: f.ids.connectorId,
      metricKey: "github.contributions", attributionScope: "PERSONAL", refreshCadence: "DAILY", approvedAt: "2026-09-22T00:00:00.000Z" });
    const pub = (await ctx.db.get(f.ids.publishedId))!;
    await ctx.db.patch(f.ids.publishedId, { cardPropIds: [f.ids.propId, propId], profile: { ...pub.profile,
      cards: [...pub.profile.cards, { ...pub.profile.cards[0], headline: "Omitted" }] } });
    return propId;
  });
  const old = await f.t.query(prepare, { subscriptionId: f.ids.subscriptionId });
  const selections = [{ propId: f.ids.propId, expectedRelationshipVersion: 0, publish: mode !== "removed", status: "ACTIVE",
    headline: "Approved", note: "Owner context", autoRefresh: mode !== "fixed", connectorId: f.ids.connectorId, metricKey: "github.contributions",
    ...(mode === "fixed" ? { activity: activity(3) } : {}) }];
  const owner = f.t.withIdentity({ subject: "owner" });
  const preview = await owner.query(makeFunctionReference<"query">("onboarding:previewPublication"), { selections });
  await owner.mutation(makeFunctionReference<"mutation">("onboarding:publishSelected"), { selections, expectedPublicationRevision: preview.revision, expectedPreviewHash: preview.previewHash });
  expect(await f.t.mutation(complete, { grant: old.grant, outcome: success() })).toBe(false);
  const before = await f.state();
  const firstBefore = before.published?.profile.cards.find((_, i) => before.published?.cardPropIds?.[i] === f.ids.propId);
  await f.call(); const after = await f.state();
  expect(f.fetcher).toHaveBeenCalledOnce();
  expect(after.published?.profile.cards.find((_, i) => after.published?.cardPropIds?.[i] === f.ids.propId)).toEqual(firstBefore);
  expect(after.published?.profile.cards.find((_, i) => after.published?.cardPropIds?.[i] === sibling)?.activity).toMatchObject({ total: 7 });
  expect(after.signals).toHaveLength(1); expect(after.signals[0].propId).toBe(sibling);
});

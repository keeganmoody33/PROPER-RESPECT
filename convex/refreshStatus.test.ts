// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import schema from "./schema";

// Regression for #175: a GitHub reconnect revokes the daily refresh approval
// (#150), the card ages on the public profile, and the owner had no query
// that said why. The owner must be able to read the last ledger outcome.

const modules = import.meta.glob("./**/*.ts");
const HTTP_OK = 200;
const HTTP_SERVER_ERROR = 500;
const PROVIDER_TOTAL = 7;
const RETAINED_TOTAL = 3;
const AES_GCM_IV_BYTES = 12;
const RECONNECTED_GENERATION = 2;
const refresh = makeFunctionReference<"action">("connectors:refreshApproved");
const forOwner = makeFunctionReference<"query">("refreshStatus:forOwner");
const connectGithub = makeFunctionReference<"action">("connectors:connectGithub");
const revokeConnector = makeFunctionReference<"mutation">("connectors:revokeConnector");
const recordOutcome = makeFunctionReference<"mutation">("connectors:recordRefreshAttemptOutcome");
const previewPublication = makeFunctionReference<"query">("onboarding:previewPublication");
const publishSelected = makeFunctionReference<"mutation">("onboarding:publishSelected");
const STALE_SKIPS_PAST_LOOKBACK = 6;
const activity = (total: number) => ({ kind: "contributionCalendar" as const, total, days: [], attributionScope: "PERSONAL" as const,
  capturedAt: "2026-09-22T10:00:00.000Z", freshness: "FRESH" as const, provenanceLabel: "Synthetic" });
const response = (status = HTTP_OK) => new Response(JSON.stringify({ data: { viewer: { id: "U_synthetic-account", login: "synthetic-account",
  createdAt: "2020-01-01T00:00:00Z", contributionsCollection: { contributionCalendar: { totalContributions: PROVIDER_TOTAL,
    weeks: [{ contributionDays: [{ date: "2026-09-23", contributionCount: PROVIDER_TOTAL, contributionLevel: "FIRST_QUARTILE" }] }] } } } } }),
  { status, headers: { "Content-Type": "application/json" } });
beforeEach(() => { vi.stubEnv("CONNECTOR_ENCRYPTION_KEY", "synthetic-refresh-only"); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

async function fixture(fetcher = vi.fn(async () => response())) {
  vi.stubGlobal("fetch", fetcher);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("synthetic-refresh-only"));
  const key = await crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt"]);
  const iv = new Uint8Array(AES_GCM_IV_BYTES);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode("synthetic-token-never-sent")));
  const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { authSubject: "owner", handle: "owner", displayName: "Owner", bio: "" });
    await ctx.db.insert("users", { authSubject: "other", handle: "other", displayName: "Other", bio: "" });
    const productId = await ctx.db.insert("products", { name: "GitHub", slug: "github", domain: "github.com", description: "Synthetic" });
    const propId = await ctx.db.insert("props", { userId, productId, status: "ACTIVE", visibility: "PUBLIC", headline: "Approved", note: "Owner context", activity: activity(RETAINED_TOTAL) });
    const secretId = await ctx.db.insert("connectorSecrets", { userId, provider: "GITHUB", ciphertext: base64(ciphertext), iv: base64(iv), createdAt: "2026-09-22T00:00:00.000Z" });
    const connectorId = await ctx.db.insert("connectorAccounts", { userId, provider: "GITHUB", status: "CONNECTED", accountLabel: "github.com/synthetic-account", githubBinding: { providerAccountId: "U_synthetic-account", generation: 1 }, attributionScope: "PERSONAL", secretRef: secretId, connectedAt: "2026-09-22T00:00:00.000Z" });
    const subscriptionId = await ctx.db.insert("metricSubscriptions", { userId, propId, connectorId, githubBinding: { providerAccountId: "U_synthetic-account", generation: 1 }, metricKey: "github.contributions", attributionScope: "PERSONAL", refreshCadence: "DAILY", approvedAt: "2026-09-22T00:00:00.000Z" });
    await ctx.db.insert("publishedProfiles", { handle: "owner", revision: 1, publishedAt: "2026-09-22T10:00:00.000Z", cardPropIds: [propId], profile: { handle: "owner", displayName: "Owner", bio: "", cards: [{ product: { name: "GitHub", slug: "github", domain: "github.com", description: "Synthetic" }, status: "ACTIVE", headline: "Approved", note: "Owner context", activity: activity(RETAINED_TOTAL), primaryLink: { type: "CANONICAL", url: "https://github.com", label: "Open" } }] } });
    return { propId, connectorId, subscriptionId };
  });
  return { t, ids, fetcher, owner: t.withIdentity({ subject: "owner" }), other: t.withIdentity({ subject: "other" }) };
}

async function publishWithRefreshOff(f: Awaited<ReturnType<typeof fixture>>) {
  const selections = [{ propId: f.ids.propId, expectedRelationshipVersion: 0, publish: true, status: "ACTIVE",
    headline: "Approved", note: "Owner context", autoRefresh: false, activity: activity(RETAINED_TOTAL) }];
  const preview = await f.owner.query(previewPublication, { selections });
  await f.owner.mutation(publishSelected, { selections, expectedPublicationRevision: preview.revision, expectedPreviewHash: preview.previewHash });
}

test("an approved refresh that has not run yet reads NEVER_RUN", async () => {
  const f = await fixture();
  const rows = await f.owner.query(forOwner, {});
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ propId: f.ids.propId, metricKey: "github.contributions", state: "NEVER_RUN", lastAttempt: null });
});

test("a successful scheduled refresh reads RUNNING with its ledger row", async () => {
  const f = await fixture();
  await f.t.action(refresh, {});
  const rows = await f.owner.query(forOwner, {});
  expect(rows[0].state).toBe("RUNNING");
  expect(rows[0].lastAttempt).toMatchObject({ outcome: "SUCCESS" });
  expect(f.fetcher).toHaveBeenCalledTimes(1);
});

test("a real reconnect revokes the approval and still reads REAUTHORIZE for the owner", async () => {
  const f = await fixture();
  await f.t.action(refresh, {});
  // connectGithub is a new credential generation and revokes the approval (#150).
  await f.owner.action(connectGithub, { token: "synthetic-new-token" });
  const revoked = await f.t.run(ctx => ctx.db.get(f.ids.subscriptionId));
  expect(revoked?.revokedAt).toBeDefined();
  const rows = await f.owner.query(forOwner, {});
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ subscriptionId: f.ids.subscriptionId, state: "REAUTHORIZE", revokedAt: revoked?.revokedAt });
  expect(rows[0].lastAttempt).toMatchObject({ outcome: "SUCCESS" });
});

test("a current approval whose connection moved on reads REAUTHORIZE and is skipped without a provider call", async () => {
  const f = await fixture();
  await f.t.run(ctx => ctx.db.patch(f.ids.connectorId, { githubBinding: { providerAccountId: "U_synthetic-account", generation: RECONNECTED_GENERATION } }));
  await f.t.action(refresh, {});
  const rows = await f.owner.query(forOwner, {});
  expect(rows[0].state).toBe("REAUTHORIZE");
  expect(rows[0].lastAttempt).toMatchObject({ outcome: "SKIPPED", errorClass: "NOT_ELIGIBLE" });
  expect(f.fetcher).not.toHaveBeenCalled();
});

test("a stale duplicate completion after a success does not ask for reauthorization", async () => {
  const f = await fixture();
  await f.t.action(refresh, {});
  // Two overlapping completions: the second one records STALE_GRANT on a still-current approval.
  await f.t.mutation(recordOutcome, { subscriptionId: f.ids.subscriptionId, outcome: "SKIPPED", errorClass: "STALE_GRANT", provider: "GITHUB" });
  const rows = await f.owner.query(forOwner, {});
  expect(rows[0].state).toBe("RUNNING");
  expect(rows[0].lastAttempt).toMatchObject({ outcome: "SKIPPED", errorClass: "STALE_GRANT" });
});

test("a current approval the scheduler declines for another reason reads SKIPPED", async () => {
  const f = await fixture();
  await f.t.run(ctx => ctx.db.patch(f.ids.propId, { visibility: "PRIVATE" }));
  await f.t.action(refresh, {});
  const rows = await f.owner.query(forOwner, {});
  expect(rows[0].state).toBe("SKIPPED");
  expect(rows[0].lastAttempt).toMatchObject({ outcome: "SKIPPED", errorClass: "NOT_ELIGIBLE" });
});

test("a provider failure on a valid approval reads FAILING", async () => {
  const f = await fixture(vi.fn(async () => response(HTTP_SERVER_ERROR)));
  await f.t.action(refresh, {});
  const rows = await f.owner.query(forOwner, {});
  expect(rows[0].state).toBe("FAILING");
  expect(rows[0].lastAttempt?.outcome).toBe("FAILURE");
});

test("a first attempt that completes stale reads SKIPPED, not NEVER_RUN", async () => {
  const f = await fixture();
  await f.t.mutation(recordOutcome, { subscriptionId: f.ids.subscriptionId, outcome: "SKIPPED", errorClass: "STALE_GRANT", provider: "GITHUB" });
  const rows = await f.owner.query(forOwner, {});
  expect(rows[0].state).toBe("SKIPPED");
  expect(rows[0].lastAttempt).toMatchObject({ outcome: "SKIPPED", errorClass: "STALE_GRANT" });
});

test("a success buried under many stale duplicate completions still reads RUNNING", async () => {
  const f = await fixture();
  await f.t.action(refresh, {});
  await Promise.all(Array.from({ length: STALE_SKIPS_PAST_LOOKBACK }, () =>
    f.t.mutation(recordOutcome, { subscriptionId: f.ids.subscriptionId, outcome: "SKIPPED", errorClass: "STALE_GRANT", provider: "GITHUB" })));
  const rows = await f.owner.query(forOwner, {});
  expect(rows[0].state).toBe("RUNNING");
  expect(rows[0].lastSuccessfulAt).toBeDefined();
  expect(rows[0].lastAttempt).toMatchObject({ outcome: "SKIPPED", errorClass: "STALE_GRANT" });
});

test("turning refresh off on a public card is not listed, even after a later reconnect", async () => {
  const f = await fixture();
  await publishWithRefreshOff(f);
  const stopped = await f.t.run(ctx => ctx.db.get(f.ids.subscriptionId));
  expect(stopped).toMatchObject({ revokedReason: "OWNER" });
  expect(await f.owner.query(forOwner, {})).toEqual([]);
  await f.owner.action(connectGithub, { token: "synthetic-new-token" });
  expect(await f.owner.query(forOwner, {})).toEqual([]);
});

test("a reconnect-revoked approval drops once the owner publishes with refresh off", async () => {
  const f = await fixture();
  await f.owner.action(connectGithub, { token: "synthetic-new-token" });
  expect((await f.owner.query(forOwner, {}))[0]?.state).toBe("REAUTHORIZE");
  await publishWithRefreshOff(f);
  expect(await f.owner.query(forOwner, {})).toEqual([]);
});

test("a revoked row written before revokedReason existed still falls back to the connection", async () => {
  const f = await fixture();
  await f.t.run(ctx => ctx.db.patch(f.ids.connectorId, { githubBinding: { providerAccountId: "U_synthetic-account", generation: RECONNECTED_GENERATION } }));
  await f.t.run(ctx => ctx.db.patch(f.ids.subscriptionId, { revokedAt: "2026-10-01T00:00:00.000Z" }));
  expect((await f.owner.query(forOwner, {}))[0]?.state).toBe("REAUTHORIZE");
});

test("another signed-in user sees no rows", async () => {
  const f = await fixture();
  await f.t.action(refresh, {});
  expect(await f.other.query(forOwner, {})).toEqual([]);
});

test("an approval revoked by disconnecting GitHub is not listed", async () => {
  const f = await fixture();
  await f.owner.mutation(revokeConnector, { connectorId: f.ids.connectorId });
  expect(await f.owner.query(forOwner, {})).toEqual([]);
});

test("an approval revoked while its connection still matches is not listed", async () => {
  const f = await fixture();
  await f.t.run(ctx => ctx.db.patch(f.ids.subscriptionId, { revokedAt: "2026-10-01T00:00:00.000Z" }));
  expect(await f.owner.query(forOwner, {})).toEqual([]);
});

test("a reconnect-revoked approval is not listed once the card is private", async () => {
  const f = await fixture();
  await f.owner.action(connectGithub, { token: "synthetic-new-token" });
  await f.t.run(ctx => ctx.db.patch(f.ids.propId, { visibility: "PRIVATE" }));
  expect(await f.owner.query(forOwner, {})).toEqual([]);
});

test("a reconnect-revoked approval is replaced by a fresh approval on the new connection", async () => {
  const f = await fixture();
  await f.owner.action(connectGithub, { token: "synthetic-new-token" });
  const connector = await f.t.run(ctx => ctx.db.get(f.ids.connectorId));
  const fresh = await f.t.run(ctx => ctx.db.insert("metricSubscriptions", { userId: connector!.userId, propId: f.ids.propId, connectorId: f.ids.connectorId,
    githubBinding: connector!.githubBinding, metricKey: "github.contributions", attributionScope: "PERSONAL", refreshCadence: "DAILY", approvedAt: "2026-10-02T00:00:00.000Z" }));
  const rows = await f.owner.query(forOwner, {});
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ subscriptionId: fresh, state: "NEVER_RUN" });
});

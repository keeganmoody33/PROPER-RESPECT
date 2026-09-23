// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, test } from "vitest";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const prepare = makeFunctionReference<"query">("connectors:prepareGithubRefresh");
const complete = makeFunctionReference<"mutation">("connectors:completeGithubRefresh");
async function finish(t: ReturnType<typeof convexTest>, subscriptionId: string, result: { activity?: ReturnType<typeof activity>; value?: number }) {
  const prepared = await t.query(prepare, { subscriptionId });
  if (!prepared) return;
  await t.mutation(complete, { grant: prepared.grant, outcome: result.activity
    ? { kind: "success", accountLabel: "github.com/synthetic", activity: result.activity, value: result.value }
    : { kind: "failure" } });
}
const activity = (total: number) => ({ kind: "contributionCalendar" as const, total, days: [],
  attributionScope: "PERSONAL" as const, capturedAt: total === 3 ? "2026-09-18T09:00:00.000Z" : "2026-09-18T10:00:00.000Z",
  freshness: "FRESH" as const, provenanceLabel: "Synthetic provider snapshot" });

async function fixture(publicActivity = true) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { authSubject: "owner", handle: "owner", displayName: "Owner", bio: "" });
    const productId = await ctx.db.insert("products", { name: "GitHub", slug: "github", domain: "github.com", description: "Synthetic fixture" });
    const propId = await ctx.db.insert("props", { userId, productId, status: "ACTIVE", visibility: "PUBLIC", headline: "Approved", note: "Public context", activity: activity(3) });
    const evidenceSourceId = await ctx.db.insert("evidenceSources", { userId, type: "GITHUB", connectedAt: "2026-09-18" });
    const rawEvidenceId = await ctx.db.insert("rawEvidence", { userId, evidenceSourceId, capturedAt: "2026-09-18", dedupKey: "synthetic-private-capture", suggestedActivity: activity(999) });
    await ctx.db.insert("proofs", { propId, rawEvidenceId, type: "API_OAUTH", label: "Synthetic private source" });
    const connectorId = await ctx.db.insert("connectorAccounts", { userId, provider: "GITHUB", status: "CONNECTED", accountLabel: "github.com/synthetic", attributionScope: "PERSONAL", connectedAt: "2026-09-18" });
    const secretRef = await ctx.db.insert("connectorSecrets", { userId, provider: "GITHUB", ciphertext: "synthetic", iv: "synthetic", createdAt: "2026-09-18T00:00:00.000Z" });
    await ctx.db.patch(connectorId, { secretRef });
    const subscriptionId = await ctx.db.insert("metricSubscriptions", { userId, propId, connectorId, metricKey: "github.contributions", attributionScope: "PERSONAL", refreshCadence: "DAILY", approvedAt: "2026-09-18T00:00:00.000Z" });
    const publishedId = await ctx.db.insert("publishedProfiles", { handle: "owner", revision: 1, publishedAt: "2026-09-18", cardPropIds: [propId], profile: {
      handle: "owner", displayName: "Owner", bio: "", cards: [{ product: { name: "GitHub", slug: "github", domain: "github.com", description: "Synthetic fixture" }, status: "ACTIVE", headline: "Approved", note: "Public context",
        ...(publicActivity ? { activity: activity(3) } : {}), primaryLink: { type: "CANONICAL", url: "https://github.com", label: "Open" } }],
    } });
    return { propId, rawEvidenceId, subscriptionId, connectorId, publishedId };
  });
  await t.withIdentity({ subject: "owner" }).mutation(makeFunctionReference<"mutation">("inventory:save"), {
    propId: ids.propId, expectedVersion: 0, operationId: "private-snapshot", status: "TESTING", goTo: true,
    headline: "Private headline", note: "Private context", activityEvidenceId: ids.rawEvidenceId,
  });
  return { t, ...ids };
}

for (const publicActivity of [true, false]) test(`failed refresh preserves the approved public snapshot (activity=${publicActivity})`, async () => {
  const { t, propId, rawEvidenceId, subscriptionId, publishedId } = await fixture(publicActivity);
  const privateBefore = await t.run(ctx => ctx.db.get(propId));
  await finish(t, subscriptionId, {});
  const card = (await t.run(ctx => ctx.db.get(publishedId)))!.profile.cards[0];
  expect(card).toMatchObject({ headline: "Approved", note: "Public context", status: "ACTIVE" });
  if (publicActivity) expect(card.activity).toEqual({ ...activity(3), freshness: "STALE" });
  else expect(card.activity).toBeUndefined();
  expect(await t.run(ctx => ctx.db.get(propId))).toEqual(privateBefore);
  expect((await t.run(ctx => ctx.db.get(propId)))?.activityEvidenceId).toBe(rawEvidenceId);
  expect(await t.run(ctx => ctx.db.query("relationshipEvents").collect())).toHaveLength(1);
});

test("successful approved refresh does not replace a privately selected retained source", async () => {
  const { t, propId, subscriptionId, publishedId } = await fixture();
  const privateBefore = await t.run(ctx => ctx.db.get(propId));
  await finish(t, subscriptionId, { activity: activity(5), value: 5 });
  expect((await t.run(ctx => ctx.db.get(publishedId)))!.profile.cards[0].activity).toEqual(activity(5));
  expect(await t.run(ctx => ctx.db.get(propId))).toEqual(privateBefore);
  expect(await t.run(ctx => ctx.db.query("relationshipEvents").collect())).toHaveLength(1);
});

test("approved public refresh cannot restore a supporting snapshot the owner removed privately", async () => {
  const { t, propId, subscriptionId, publishedId } = await fixture();
  await t.withIdentity({ subject: "owner" }).mutation(makeFunctionReference<"mutation">("inventory:save"), {
    propId, expectedVersion: 1, operationId: "remove-support", status: "TESTING", goTo: true,
    headline: "Private headline", note: "Private context", clearActivity: true,
  });
  await finish(t, subscriptionId, { activity: activity(5), value: 5 });
  expect((await t.run(ctx => ctx.db.get(publishedId)))!.profile.cards[0].activity).toEqual(activity(5));
  const saved = (await t.run(ctx => ctx.db.get(propId)))!;
  expect(saved.activity).toBeUndefined();
  expect(saved.activityEvidenceId).toBeUndefined();
  expect(saved.relationshipVersion).toBe(2);
});

test("an in-flight failure cannot reactivate a revoked connector or change its public snapshot", async () => {
  const { t, subscriptionId, connectorId, publishedId } = await fixture();
  await t.run(async ctx => {
    await ctx.db.patch(subscriptionId, { revokedAt: "2026-09-18T11:00:00.000Z" });
    await ctx.db.patch(connectorId, { status: "REVOKED" });
  });
  const before = await t.run(ctx => ctx.db.get(publishedId));
  await finish(t, subscriptionId, {});
  expect((await t.run(ctx => ctx.db.get(connectorId)))?.status).toBe("REVOKED");
  expect(await t.run(ctx => ctx.db.get(publishedId))).toEqual(before);
});

for (const succeeds of [true, false]) test(`refresh targets only its approved relationship when a product has two public cards (success=${succeeds})`, async () => {
  const { t, propId, subscriptionId, publishedId } = await fixture();
  await t.run(async ctx => {
    const first = (await ctx.db.get(propId))!;
    const siblingId = await ctx.db.insert("props", { userId: first.userId, productId: first.productId,
      visibility: "PUBLIC", status: "ARCHIVED", headline: "Separate relationship", note: "Separate context", activity: activity(100) });
    const published = (await ctx.db.get(publishedId))!;
    await ctx.db.patch(publishedId, { cardPropIds: [propId, siblingId], profile: { ...published.profile,
      cards: [...published.profile.cards, { ...published.profile.cards[0], status: "ARCHIVED", headline: "Separate relationship", note: "Separate context", activity: activity(100) }],
    } });
  });
  const sibling = (await t.run(ctx => ctx.db.get(publishedId)))!.profile.cards[1];
  if (succeeds) await finish(t, subscriptionId, { activity: activity(5), value: 5 });
  else await finish(t, subscriptionId, {});
  const cards = (await t.run(ctx => ctx.db.get(publishedId)))!.profile.cards;
  expect(cards[1]).toEqual(sibling);
  expect(cards[0].activity).toEqual(succeeds ? activity(5) : { ...activity(3), freshness: "STALE" });
});

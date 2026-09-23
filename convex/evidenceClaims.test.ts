// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { makeFunctionReference } from "convex/server";
import schema from "./schema";
import { canUseAsStart, evidenceObservationSchema, githubDateObservations } from "../src/domain/evidence-claims";
const modules = import.meta.glob("./**/*.ts");
const ingest = makeFunctionReference<"mutation">("discovery:ingestSignals");
const review = makeFunctionReference<"mutation">("onboarding:reviewClaim");
const state = makeFunctionReference<"query">("onboarding:getState");
const publicProfile = makeFunctionReference<"query">("publicProfiles:getByHandle");
const saveSnapshot = makeFunctionReference<"mutation">("connectors:saveConnectedSnapshot");
const saveRelationship = makeFunctionReference<"mutation">("inventory:save");
const inventoryEvidence = makeFunctionReference<"query">("inventory:evidence");
const selectedActivity = makeFunctionReference<"query">("inventory:selectedActivity");
const inventoryList = makeFunctionReference<"query">("inventory:list");
const firstPage = { paginationOpts: { numItems: 25, cursor: null } };
const observation = { kind: "SIGNUP" as const, date: "2025-03-12", excerpt: "Welcome to GitHub on March 12, 2025.", scope: "PERSONAL" as const, acquisition: "ASSISTANT_EXTRACTED" as const };
async function fixture() {
  const t = convexTest(schema, modules);
  await t.run(async ctx => {
    await ctx.db.insert("users", { handle: "owner", authSubject: "owner", displayName: "Owner", bio: "" });
    await ctx.db.insert("users", { handle: "other", authSubject: "other", displayName: "Other", bio: "" });
  });
  const args = { handle: "owner", sourceType: "GMAIL", signals: [{ sourceType: "GMAIL", vendor: "GitHub", capturedAt: "2026-09-16T00:00:00.000Z", payload: observation.excerpt, observations: [observation] }] };
  return { t, owner: t.withIdentity({ subject: "owner" }), other: t.withIdentity({ subject: "other" }), args };
}
test("signup and paid evidence cannot become use-start dates; scope and verdict matter", () => {
  expect(canUseAsStart(observation, "CORRECT")).toBe(false);
  expect(canUseAsStart({ ...observation, kind: "PAID_PERIOD" }, "CORRECT")).toBe(false);
  expect(canUseAsStart({ ...observation, kind: "FIRST_USE", scope: "ORGANIZATION" }, "CORRECT")).toBe(false);
  expect(canUseAsStart({ ...observation, kind: "FIRST_USE" }, "UNKNOWN")).toBe(false);
  expect(canUseAsStart({ ...observation, kind: "FIRST_USE" }, "CORRECT")).toBe(true);
  expect(evidenceObservationSchema.safeParse({ ...observation, date: "2025-02-30" }).success).toBe(false);
});
test("private original survives corrections; other owners cannot read or review it", async () => {
  const { t, owner, other, args } = await fixture();
  await t.mutation(ingest, args);
  const before = await owner.query(state, {});
  const card = before.cards[0];
  const claim = card.claims[0];
  expect(claim.observation).toEqual(observation);
  expect(card.prop.startedAt).toBeUndefined();
  const input = { propId: card.prop._id, rawEvidenceId: claim.rawEvidenceId, observationIndex: 0, verdict: "INCORRECT", correction: "Only a trial signup." };
  await expect(other.mutation(review, input)).rejects.toThrow("Evidence unavailable");
  expect((await other.query(state, {})).cards).toEqual([]);
  await owner.mutation(review, input);
  await owner.mutation(review, { ...input, verdict: "INCOMPLETE" });
  const after = await owner.query(state, {});
  expect(after.cards[0].claims[0].observation).toEqual(observation);
  expect(after.cards[0].claims[0].review.verdict).toBe("INCOMPLETE");
  expect(await t.run(ctx => ctx.db.query("claimReviews").collect())).toHaveLength(2);
  expect(await t.query(publicProfile, { handle: "owner" })).toBeNull();
  expect(after.cards[0].prop.visibility).toBe("DRAFT");
});
test("fabricated excerpts and changed evidence under the same identity are rejected", async () => {
  const { t, args } = await fixture();
  await expect(t.mutation(ingest, { ...args, signals: [{ ...args.signals[0], payload: "unrelated" }] })).rejects.toThrow("verbatim");
  await t.mutation(ingest, args);
  await t.mutation(ingest, args);
  expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toHaveLength(1);
  await expect(t.mutation(ingest, { ...args, signals: [{ ...args.signals[0], payload: observation.excerpt + " changed" }] })).rejects.toThrow("collision");
});
test("GitHub proposes observed dates only from nonzero days; account date remains separate", () => {
  const activity = { memberSince: "2020-01-01", days: [{ date: "2026-09-10", count: 0 }, { date: "2026-09-11", count: 2 }, { date: "2026-09-13", count: 1 }] };
  const observations = githubDateObservations(activity);
  expect(observations.map(o => [o.kind, o.date])).toEqual([["SIGNUP", "2020-01-01"], ["FIRST_USE", "2026-09-11"], ["RECENT_USE", "2026-09-13"]]);
  for (const o of observations) expect(JSON.stringify(activity)).toContain(o.excerpt);
  expect(githubDateObservations({ days: [{ date: "2026-09-10", count: 0 }] })).toEqual([]);
});

test("a connected GitHub snapshot produces private review claims without setting use-start", async () => {
  const { t, owner } = await fixture();
  // A separately keyed source must not break the legacy GitHub connector's
  // account-keyed source lookup or be reused as its provenance bucket.
  await t.mutation(ingest, {
    handle: "owner", sourceType: "GITHUB", sourceKey: "github:another-account", signals: [],
  });
  await t.mutation(saveSnapshot, {
    authSubject: "owner", provider: "GITHUB", accountLabel: "github.com/example", ciphertext: "test-only", iv: "test-only",
    product: { name: "GitHub", slug: "github", domain: "github.com", description: "Code" },
    activity: { kind: "contributionCalendar", attributionScope: "PERSONAL", capturedAt: "2026-09-16T00:00:00.000Z", freshness: "FRESH", provenanceLabel: "GitHub", total: 2, memberSince: "2020-01-01", days: [{ date: "2026-09-10", count: 2, level: 1 }] },
    metricKey: "github.contributions", value: 2,
  });
  const result = await owner.query(state, {});
  expect(result.cards[0].claims).toHaveLength(3);
  expect(result.cards[0].prop.startedAt).toBeUndefined();
  expect(result.cards[0].prop.visibility).toBe("DRAFT");
  expect(JSON.stringify(result)).not.toContain("test-only");
  const sources = await t.run(ctx => ctx.db.query("evidenceSources").collect());
  expect(sources).toHaveLength(2);
  const evidence = await t.run(ctx => ctx.db.query("rawEvidence").first());
  expect(sources.find(source => source._id === evidence?.evidenceSourceId)?.sourceKey).toBe("github-connector:example");
});

test("a connected GitHub snapshot can be selected as supporting activity after a later refresh", async () => {
  const { t, owner } = await fixture();
  const product = { name: "GitHub", slug: "github", domain: "github.com", description: "Code" };
  const firstActivity = {
    kind: "contributionCalendar" as const, attributionScope: "PERSONAL" as const,
    capturedAt: "2026-09-16T00:00:00.000Z", freshness: "FRESH" as const, provenanceLabel: "GitHub",
    total: 2, memberSince: "2020-01-01", days: [{ date: "2026-09-10", count: 2, level: 1 }],
  };
  const first = await t.mutation(saveSnapshot, {
    authSubject: "owner", provider: "GITHUB", accountLabel: "github.com/example",
    ciphertext: "test-only", iv: "test-only", product, activity: firstActivity,
    metricKey: "github.contributions", value: 2,
  });
  const firstEvidence = await owner.query(inventoryEvidence, { propId: first.propId, ...firstPage });
  expect(firstEvidence.page[0]).toMatchObject({
    suggestedActivity: { kind: "contributionCalendar", total: 2 },
    captureProvenance: {
      route: "DIRECT_API", activityActor: { kind: "UNKNOWN" },
      origin: { issuer: "GITHUB", accountId: "example" },
    },
  });
  const raw = await t.run(async ctx => {
    const rows = await ctx.db.query("rawEvidence").collect();
    return rows.find(row => row._id === firstEvidence.page[0].id);
  });
  expect(raw?.detectedUrl).toBe("https://github.com/example");
  await owner.mutation(saveRelationship, {
    propId: first.propId, expectedVersion: 0, operationId: "confirm",
    status: "ACTIVE", goTo: false, headline: "Code hosting", note: "Owner-described relationship",
  });
  const refreshedActivity = {
    ...firstActivity, capturedAt: "2026-09-19T00:00:00.000Z", total: 9,
    days: [{ date: "2026-09-18", count: 9, level: 2 }],
  };
  await t.mutation(saveSnapshot, {
    authSubject: "owner", provider: "GITHUB", accountLabel: "github.com/example",
    ciphertext: "test-only", iv: "test-only", product, activity: refreshedActivity,
    metricKey: "github.contributions", value: 9,
  });
  const afterRefresh = await owner.query(inventoryEvidence, { propId: first.propId, ...firstPage });
  const later = afterRefresh.page.find((entry: { id: string; suggestedActivity?: { kind: string; total?: number; capturedAt?: string } }) =>
    entry.suggestedActivity?.kind === "contributionCalendar" && entry.suggestedActivity.total === 9);
  expect(later?.suggestedActivity).toMatchObject({ total: 9, capturedAt: "2026-09-19T00:00:00.000Z" });
  const listed = await owner.query(inventoryList, firstPage);
  expect(listed.page[0].prop.activity?.total).toBe(2);
  expect(listed.page[0].prop.visibility).toBe("PRIVATE");
  await owner.mutation(saveRelationship, {
    propId: first.propId, expectedVersion: 1, operationId: "select-refresh",
    status: "ACTIVE", goTo: false, headline: "Code hosting", note: "Owner-described relationship",
    activityEvidenceId: later!.id,
  });
  expect(await owner.query(selectedActivity, { propId: first.propId })).toMatchObject({
    id: later!.id, suggestedActivity: { total: 9 },
  });
  expect((await owner.query(inventoryList, firstPage)).page[0].prop.activity?.total).toBe(9);
  expect(await t.query(publicProfile, { handle: "owner" })).toBeNull();
});

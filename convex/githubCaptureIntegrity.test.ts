// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { makeFunctionReference } from "convex/server";
import schema from "./schema";
const modules = import.meta.glob("./**/*.ts");
const save = makeFunctionReference<"mutation">("connectors:saveConnectedSnapshot");
const list = makeFunctionReference<"query">("discoveryReview:list");
const candidates = makeFunctionReference<"query">("discoveryReview:candidates");
const attach = makeFunctionReference<"mutation">("discoveryReview:attach");
const saveRelationship = makeFunctionReference<"mutation">("inventory:save");
const page = { paginationOpts: { numItems: 10, cursor: null } };
const product = { name: "GitHub", slug: "github", domain: "github.com", description: "Code" };
const activity = { kind: "contributionCalendar" as const, attributionScope: "PERSONAL" as const, capturedAt: "2026-09-22T12:00:00.000Z", freshness: "FRESH" as const, provenanceLabel: "GitHub", total: 2, days: [{ date: "2026-09-20", count: 2, level: 1 }] };
const args = { authSubject: "owner", provider: "GITHUB" as const, accountLabel: "github.com/Example", ciphertext: "synthetic", iv: "synthetic", product, activity, metricKey: "github.contributions", value: 2 };
async function fixture(count = 0, visibility: "DRAFT" | "PRIVATE" | "PUBLIC" = "PRIVATE") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { handle: "owner", authSubject: "owner", displayName: "Owner", bio: "" });
    const otherId = await ctx.db.insert("users", { handle: "other", authSubject: "other", displayName: "Other", bio: "" });
    const productId = await ctx.db.insert("products", product);
    const props = [];
    for (let index = 0; index < count; index++) props.push(await ctx.db.insert("props", { userId, productId, status: "ACTIVE", visibility, headline: `Record ${index + 1}`, note: "Preserve", goTo: true, relationshipVersion: 1, activity: { ...activity, total: 9 } }));
    return { userId, otherId, productId, props };
  });
  const rows = () => t.run(async ctx => ({ raw: await ctx.db.query("rawEvidence").collect(), proofs: await ctx.db.query("proofs").collect(), signals: await ctx.db.query("usageSignals").collect(), props: await ctx.db.query("props").collect(), drafts: await ctx.db.query("draftImports").collect(), secrets: await ctx.db.query("connectorSecrets").collect(), connectors: await ctx.db.query("connectorAccounts").collect(), publications: await ctx.db.query("publishedProfiles").collect(), subscriptions: await ctx.db.query("metricSubscriptions").collect() }));
  return { t, ids, rows, owner: t.withIdentity({ subject: "owner" }) };
}
test("zero creates one unconfirmed private card and exact replay adds nothing", async () => {
  const { t, rows } = await fixture();
  const first = await t.mutation(save, args);
  const before = await rows();
  const replay = await t.mutation(save, { ...args, accountLabel: "github.com/example" });
  const after = await rows();
  expect(first.propId).not.toBeNull();
  expect(replay.duplicate).toBe(true);
  expect(after.props).toEqual(before.props);
  expect(after.raw).toEqual(before.raw);
  expect(after.proofs).toEqual(before.proofs);
  expect(after.signals).toEqual(before.signals);
  expect(after.drafts).toEqual(before.drafts);
  expect(after.props[0]).toMatchObject({ visibility: "DRAFT", status: "TESTING" });
  expect(after.publications).toEqual([]); expect(after.subscriptions).toEqual([]);
});
test.each(["DRAFT", "PRIVATE", "PUBLIC"] as const)("one %s relationship retains all owner fields", async visibility => {
  const { t, rows } = await fixture(1, visibility);
  const before = (await rows()).props;
  await t.mutation(save, args);
  const after = await rows();
  expect(after.props).toEqual(before);
  expect(after.proofs).toHaveLength(1); expect(after.signals).toHaveLength(1);
});
test("four records stay unassigned until explicit review and separate activity save", async () => {
  const { t, rows, owner, ids } = await fixture(4);
  const before = (await rows()).props;
  const result = await t.mutation(save, args);
  expect(result).toMatchObject({ propId: null, reviewRequired: true });
  const captured = await rows();
  expect(captured.props).toEqual(before);
  expect(captured.proofs).toEqual([]); expect(captured.signals).toEqual([]);
  const drafts = await owner.query(list, page);
  expect(drafts.page).toHaveLength(1);
  const choices = await owner.query(candidates, { draftId: drafts.page[0].id, ...page });
  const choice = choices.page.find((entry: { id: string }) => entry.id === ids.props[2]);
  await owner.mutation(attach, { draftId: drafts.page[0].id, propId: choice.id, expectedHash: choice.expectedHash });
  expect((await rows()).props).toEqual(before);
  await owner.mutation(saveRelationship, { propId: choice.id, operationId: "choose-activity", expectedVersion: 1, status: "ACTIVE", goTo: true, headline: "Record 3", note: "Preserve", activityEvidenceId: captured.raw[0]._id });
  const selected = await rows();
  expect(selected.props[2].activity).toMatchObject({ kind: "contributionCalendar", total: 2 });
  expect(selected.publications).toEqual([]);
  await t.mutation(save, args);
  const replay = await rows();
  expect(replay.props).toEqual(selected.props); expect(replay.raw).toEqual(selected.raw); expect(replay.proofs).toEqual(selected.proofs); expect(replay.drafts).toEqual(selected.drafts);
});
test("changed capture content or metric fails without rotating credentials", async () => {
  const { t, rows } = await fixture(1);
  await t.mutation(save, args);
  const before = await rows();
  for (const changed of [{ ...args, activity: { ...activity, total: 3 }, value: 3 }, { ...args, metricKey: "wrong" }, { ...args, value: 3 }, { ...args, activity: { ...activity, attributionScope: "ORGANIZATION" } }]) {
    await expect(t.mutation(save, { ...changed, ciphertext: "rotated" })).rejects.toThrow();
    expect(await rows()).toEqual(before);
  }
});
test("distinct accounts, owners and overlapping capture times remain snapshots", async () => {
  const { t, rows } = await fixture(1);
  await t.mutation(save, args);
  await t.mutation(save, { ...args, accountLabel: "github.com/second" });
  await t.mutation(save, { ...args, authSubject: "other" });
  await t.mutation(save, { ...args, activity: { ...activity, capturedAt: "2026-09-23T12:00:00.000Z" } });
  const result = await rows();
  expect(result.raw).toHaveLength(4);
  expect(new Set(result.raw.map(raw => raw.dedupKey)).size).toBe(4);
  expect(result.signals.map(signal => signal.value)).toEqual([2, 2, 2, 2]);
});

test("legacy arbitrary mapping and frozen/rejected drafts do not absorb new evidence", async () => {
  const { t, ids, rows, owner } = await fixture(4);
  const draftIds = await t.run(async ctx => {
    const base = { userId: ids.userId, suggestedProductSlug: "github", suggestedProductName: "GitHub", suggestedDomain: "github.com", suggestedDescription: "Code", suggestedUrl: "https://github.com", rawEvidenceIds: [], resultPropId: ids.props[0] };
    return [await ctx.db.insert("draftImports", { ...base, status: "PENDING" }), await ctx.db.insert("draftImports", { ...base, status: "REJECTED" }), await ctx.db.insert("draftImports", { ...base, status: "PENDING", evidenceResolution: { targetPropId: ids.props[0], rawEvidenceIds: [], nextOffset: 0, skippedDeleted: 0, startedAt: activity.capturedAt, appliedHashes: [] } })];
  });
  const before = (await rows()).drafts;
  await t.mutation(save, args);
  const after = await rows();
  expect(after.drafts.filter(draft => draftIds.includes(draft._id))).toEqual(before);
  expect(after.proofs).toEqual([]);
  expect((await owner.query(list, page)).page).toHaveLength(1);
});

test("later capture after explicit resolution is new unassigned evidence", async () => {
  const { t, owner, rows } = await fixture(4);
  await t.mutation(save, args);
  const draftId = (await owner.query(list, page)).page[0].id;
  const choice = (await owner.query(candidates, { draftId, ...page })).page[0];
  await owner.mutation(attach, { draftId, propId: choice.id, expectedHash: choice.expectedHash });
  const frozen = (await rows()).drafts[0];
  await t.mutation(save, { ...args, activity: { ...activity, capturedAt: "2026-09-23T12:00:00.000Z" } });
  const after = await rows();
  expect(after.drafts[0]).toEqual(frozen);
  expect(after.proofs).toHaveLength(1);
  expect(after.signals).toHaveLength(0);
  expect((await owner.query(list, page)).page).toHaveLength(1);
});

test.each(["deleted", "duplicate", "changed", "foreign"])("legacy %s capture fails closed before credentials rotate", async mode => {
  const { t, ids, rows } = await fixture(1);
  await t.mutation(save, args);
  await t.run(async ctx => {
    const raw = (await ctx.db.query("rawEvidence").first())!;
    const legacy = { ...raw, dedupKey: `${ids.userId}:github-snapshot:${activity.capturedAt}` };
    await ctx.db.patch(raw._id, { dedupKey: legacy.dedupKey,
      ...(mode === "deleted" ? { deletedAt: activity.capturedAt } : {}),
      ...(mode === "changed" ? { payload: "{}" } : {}),
      ...(mode === "foreign" ? { userId: ids.otherId } : {}),
    });
    if (mode === "duplicate") {
      const { _id, _creationTime, ...fields } = legacy;
      void _id; void _creationTime;
      await ctx.db.insert("rawEvidence", fields);
    }
  });
  const before = await rows();
  await expect(t.mutation(save, { ...args, ciphertext: "rotated" })).rejects.toThrow();
  expect(await rows()).toEqual(before);
});

test("single compatible legacy capture and canonical key ordering replay without migration", async () => {
  const { t, ids, rows } = await fixture(1);
  await t.mutation(save, args);
  await t.run(async ctx => {
    const raw = (await ctx.db.query("rawEvidence").first())!;
    await ctx.db.patch(raw.evidenceSourceId, { sourceKey: undefined });
    await ctx.db.patch(raw._id, { dedupKey: `${ids.userId}:github-snapshot:${activity.capturedAt}`, payload: JSON.stringify(Object.fromEntries(Object.entries(activity).reverse())), captureProvenance: { ...raw.captureProvenance!, adapter: { id: "github-connector", version: "provider-v1" }, origin: { ...raw.captureProvenance!.origin, accountId: "Example" } } });
  });
  const before = await rows();
  expect((await t.mutation(save, args)).duplicate).toBe(true);
  const after = await rows();
  expect(after.raw).toEqual(before.raw); expect(after.proofs).toEqual(before.proofs); expect(after.signals).toEqual(before.signals); expect(after.props).toEqual(before.props);
});

test.each(["owner", "product"])("wrong %s draft mapping is rejected unchanged", async mismatch => {
  const { t, ids, rows } = await fixture(4);
  await t.run(async ctx => {
    const otherProductId = await ctx.db.insert("products", { name: "Other", slug: "other", domain: "other.example", description: "" });
    const foreign = await ctx.db.insert("props", { userId: mismatch === "owner" ? ids.otherId : ids.userId, productId: mismatch === "product" ? otherProductId : ids.productId, status: "TESTING", visibility: "PRIVATE", headline: "Foreign", note: "" });
    await ctx.db.insert("draftImports", { userId: ids.userId, status: "PENDING", suggestedProductSlug: "github", suggestedProductName: "GitHub", suggestedDomain: "github.com", suggestedDescription: "Code", suggestedUrl: "https://github.com", rawEvidenceIds: [], resultPropId: foreign });
  });
  const before = await rows();
  await expect(t.mutation(save, args)).rejects.toThrow("relationship identity");
  expect(await rows()).toEqual(before);
});

test("invalid account, product and activity variants never persist", async () => {
  const { t, rows } = await fixture();
  for (const changed of [{ ...args, accountLabel: "github.com/" }, { ...args, product: { ...product, domain: "wrong.example" } }, { ...args, activity: { ...activity, total: Number.MAX_SAFE_INTEGER + 1 }, value: Number.MAX_SAFE_INTEGER + 1 }]) await expect(t.mutation(save, changed)).rejects.toThrow();
  expect((await rows()).raw).toEqual([]); expect((await rows()).secrets).toEqual([]);
});

test("replay never resurrects a rejected discovery or removed supporting choice", async () => {
  const { t, rows, ids } = await fixture(1);
  await t.mutation(save, args);
  await t.run(async ctx => {
    const draft = (await ctx.db.query("draftImports").first())!;
    await ctx.db.patch(draft._id, { status: "REJECTED" });
    await ctx.db.patch(ids.props[0], { activity: undefined, relationshipVersion: 2 });
  });
  const before = await rows();
  await t.mutation(save, args);
  const after = await rows();
  expect(after.props).toEqual(before.props); expect(after.drafts).toEqual(before.drafts); expect(after.raw).toEqual(before.raw); expect(after.proofs).toEqual(before.proofs);
});

test("new evidence cannot enter a frozen in-progress resolution", async () => {
  const { t, rows, ids, owner } = await fixture(4);
  await t.mutation(save, args);
  await t.run(async ctx => {
    const draft = (await ctx.db.query("draftImports").first())!;
    await ctx.db.patch(draft._id, { resultPropId: ids.props[0], evidenceResolution: { targetPropId: ids.props[0], rawEvidenceIds: draft.rawEvidenceIds, nextOffset: 0, skippedDeleted: 0, startedAt: activity.capturedAt, appliedHashes: [] } });
  });
  const frozen = (await rows()).drafts[0];
  await t.mutation(save, { ...args, activity: { ...activity, capturedAt: "2026-09-23T12:00:00.000Z" } });
  const after = await rows();
  expect(after.drafts[0]).toEqual(frozen);
  expect(after.drafts[1].rawEvidenceIds).toEqual([after.raw[1]._id]);
  expect((await owner.query(list, page)).page).toHaveLength(2);
});

test.each(["foreign-source", "foreign-raw", "deleted", "duplicate", "origin", "origin-url", "collector"])("versioned %s identity fails closed", async mode => {
  const { t, ids, rows } = await fixture(1);
  await t.mutation(save, args);
  await t.run(async ctx => {
    const raw = (await ctx.db.query("rawEvidence").first())!;
    if (mode === "origin-url") await ctx.db.patch(raw._id, { detectedUrl: "https://github.com/different" });
    if (mode === "collector") await ctx.db.patch(raw._id, { captureProvenance: { ...raw.captureProvenance!, collector: { kind: "AGENT" } } });
    if (mode === "foreign-source") await ctx.db.patch(raw.evidenceSourceId, { userId: ids.otherId });
    if (mode === "foreign-raw") await ctx.db.patch(raw._id, { userId: ids.otherId });
    if (mode === "deleted") await ctx.db.patch(raw._id, { deletedAt: activity.capturedAt });
    if (mode === "origin") await ctx.db.patch(raw._id, { captureProvenance: { ...raw.captureProvenance!, activityActor: { kind: "HUMAN" } } });
    if (mode === "duplicate") { const { _id, _creationTime, ...fields } = raw; void _id; void _creationTime; await ctx.db.insert("rawEvidence", fields); }
  });
  const before = await rows();
  await expect(t.mutation(save, { ...args, ciphertext: "rotated" })).rejects.toThrow();
  expect(await rows()).toEqual(before);
});

test("Devin still uses its existing organization snapshot path", async () => {
  const { t, rows } = await fixture();
  const devin = { ...args, provider: "DEVIN", accountLabel: "organization/synthetic", product: { name: "Devin", slug: "devin", domain: "devin.ai", description: "Engineering" }, activity: { kind: "headlineMetrics", attributionScope: "ORGANIZATION", capturedAt: activity.capturedAt, freshness: "FRESH", provenanceLabel: "Devin", primary: { label: "sessions", value: 2, unit: "sessions" }, supporting: [] }, metricKey: "devin.sessions" };
  const result = await t.mutation(save, devin);
  const after = await rows();
  expect(result.propId).not.toBeNull(); expect(after.signals).toHaveLength(1); expect(after.raw).toEqual([]);
  expect(after.connectors[0].provider).toBe("DEVIN"); expect(after.props[0].activity).toEqual(devin.activity);
});

test("capture preserves selected evidence, existing publication and revoked refresh consent", async () => {
  const { t, ids, rows } = await fixture(1, "PUBLIC");
  await t.run(async ctx => {
    const evidenceSourceId = await ctx.db.insert("evidenceSources", { userId: ids.userId, type: "GITHUB", sourceKey: "retained-old", connectedAt: activity.capturedAt });
    const rawEvidenceId = await ctx.db.insert("rawEvidence", { userId: ids.userId, evidenceSourceId, capturedAt: activity.capturedAt, dedupKey: "retained-old", suggestedActivity: { ...activity, total: 9 } });
    await ctx.db.insert("proofs", { propId: ids.props[0], rawEvidenceId, type: "API_OAUTH" });
    await ctx.db.patch(ids.props[0], { activityEvidenceId: rawEvidenceId, confirmedAt: activity.capturedAt, startedAt: "2025-01-01", startedAtSource: "USER_CONFIRMED" });
    const connectorId = await ctx.db.insert("connectorAccounts", { userId: ids.userId, provider: "GITHUB", status: "REVOKED", accountLabel: args.accountLabel, attributionScope: "PERSONAL", connectedAt: activity.capturedAt });
    await ctx.db.insert("metricSubscriptions", { userId: ids.userId, propId: ids.props[0], connectorId, metricKey: args.metricKey, attributionScope: "PERSONAL", refreshCadence: "DAILY", approvedAt: activity.capturedAt, revokedAt: activity.capturedAt });
    await ctx.db.insert("publishedProfiles", { handle: "owner", revision: 1, publishedAt: activity.capturedAt, cardPropIds: [ids.props[0]], profile: { handle: "owner", displayName: "Owner", bio: "", cards: [{ product, status: "ACTIVE", headline: "Published", note: "Published note", activity: { ...activity, total: 9 } }] } });
  });
  const before = await rows();
  await t.mutation(save, args);
  const after = await rows();
  expect(after.props).toEqual(before.props);
  expect(after.publications).toEqual(before.publications);
  expect(after.subscriptions).toEqual(before.subscriptions);
  expect(after.connectors[0].status).toBe("CONNECTED");
});

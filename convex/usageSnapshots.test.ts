// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { afterEach, expect, test, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { canonicalJson } from "../src/domain/canonical-json";
import { digest, evidenceKey, type NumericEvidence } from "../src/domain/usage-sync";
import type { Id } from "./_generated/dataModel";
import { createUsageSnapshotAccumulator } from "../src/domain/usage-snapshot";

const save = makeFunctionReference<"action">("retainedEvidence:saveUsageSnapshot");
const read = makeFunctionReference<"query">("retainedEvidence:measurements");
const start = "2026-10-01T00:00:00.000Z", end = "2026-10-08T00:00:00.000Z";
const row = (response = "b".repeat(64), value = "9007199254740993"): NumericEvidence => ({ kind: "response", thread: "a".repeat(64), response,
  at: "2026-10-02T00:00:00.000Z", status: "measured", counts: { input_tokens: value, cached_input_tokens: "0", output_tokens: "0", reasoning_output_tokens: "0", total_tokens: value, cache_write_input_tokens: null } });
afterEach(() => vi.useRealTimers());
async function fixture(delayPage = false) {
  const modules = import.meta.glob("./**/*.ts");
  if (delayPage) modules["./retainedEvidence.ts"] = async () => {
    const actual = await import("./retainedEvidence");
    return { ...actual, originalSnapshotPage: actual.usageSnapshotPage, usageSnapshotPage: internalQuery({ args: { sourceId: v.id("usageSources"), propId: v.optional(v.id("props")), checkpoint: v.string(), cursor: v.union(v.string(), v.null()) }, handler: async (ctx, args) => {
      const page = await ctx.runQuery(makeFunctionReference<"query">("retainedEvidence:originalSnapshotPage"), args);
      vi.setSystemTime(Date.now() + 180_001);
      return page;
    } }) };
  };
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { authSubject: "owner", handle: "owner", displayName: "Owner", bio: "" });
    const otherId = await ctx.db.insert("users", { authSubject: "other", handle: "other", displayName: "Other", bio: "" });
    const productId = await ctx.db.insert("products", { name: "Codex", slug: "codex", domain: "openai.com", description: "" });
    const propId = await ctx.db.insert("props", { userId, productId, visibility: "PRIVATE", status: "ACTIVE", headline: "", note: "", confirmedAt: start, relationshipVersion: 1 });
    const otherPropId = await ctx.db.insert("props", { userId: otherId, productId, visibility: "PRIVATE", status: "ACTIVE", headline: "", note: "", confirmedAt: start, relationshipVersion: 1 });
    const sourceId = await ctx.db.insert("usageSources", { userId, sourceKey: "c".repeat(64), deviceDigest: "d".repeat(64), context: "work", retainOnDisconnect: true });
    return { userId, propId, otherPropId, sourceId };
  });
  const add = (value = row()) => t.run(async ctx => {
    const rowJson = canonicalJson(value);
    await ctx.db.insert("usageEvidence", { sourceId: ids.sourceId, key: evidenceKey(value), fingerprint: digest(rowJson), rowJson });
  });
  await add();
  return { t, ...ids, owner: t.withIdentity({ subject: "owner" }), other: t.withIdentity({ subject: "other" }), add };
}

test("one retained Codex window saves privately, replays once, and never trusts another owner", async () => {
  const f = await fixture(), args = { sourceId: f.sourceId, propId: f.propId, start, end };
  await expect(f.other.action(save, args)).rejects.toThrow("unavailable");
  await expect(f.owner.action(save, { ...args, propId: f.otherPropId })).rejects.toThrow("unavailable");
  const first = await f.owner.action(save, args);
  expect(first).toMatchObject({ propId: f.propId, replayed: false });
  expect(await f.owner.action(save, args)).toEqual({ ...first, replayed: true });
  const entries = await f.owner.query(read, { propId: f.propId, measurementVersion: 2 });
  expect(entries).toHaveLength(1);
  expect(entries[0].measurements.find((item: {metric: string}) => item.metric === "input_tokens")).toMatchObject({ value: "9007199254740993", derivation: "SUMMED_RESPONSES", coverage: "PARTIAL", temporality: "DELTA", aggregation: "NON_ADDITIVE" });
  expect(entries[0].measurements.find((item: {metric: string}) => item.metric === "cache_write_input_tokens").value).toBeNull();
  expect(entries[0].reviewedMeasurementIds).toEqual([]);
  expect(await f.owner.query(read, { propId: f.propId })).toEqual([]);
  expect(await f.t.run(ctx => ctx.db.query("publishedProfiles").collect())).toEqual([]);
  await f.owner.mutation(api.onboarding.deleteEvidence, { evidenceId: first.rawEvidenceId as Id<"rawEvidence"> });
  await expect(f.owner.action(save, args)).rejects.toThrow("removed");
});

test("only reviewed snapshot rows pass through a hash-bound preview to the public reader", async () => {
  const f = await fixture();
  const saved = await f.owner.action(save, { sourceId: f.sourceId, propId: f.propId, start, end });
  const entry = (await f.owner.query(read, { propId: f.propId, measurementVersion: 2 }))[0];
  const selections = [{ propId: f.propId, expectedRelationshipVersion: 1, publish: true, status: "ACTIVE" as const, headline: "", note: "", autoRefresh: false, measurementEvidenceIds: [saved.rawEvidenceId as Id<"rawEvidence">] }];
  const previewRef = makeFunctionReference<"query">("onboarding:previewPublication");
  const publishRef = makeFunctionReference<"mutation">("onboarding:publishSelected");
  await expect(f.owner.query(previewRef, { selections, measurementVersion: 2 })).rejects.toThrow("review");
  await f.owner.mutation(api.retainedEvidence.reviewMeasurements, { propId: f.propId, rawEvidenceId: saved.rawEvidenceId, expectedDigest: entry.digest, expectedReviewVersion: 0, measurementIds: [entry.measurements.find((item: {metric: string}) => item.metric === "input_tokens").id] });
  const preview = await f.owner.query(previewRef, { selections, measurementVersion: 2 });
  expect(preview.profile.cards[0].measurements).toHaveLength(1);
  expect(JSON.stringify(preview.profile)).not.toMatch(/sourceKey|sourceId|responseCount|evidenceDigest|thread|deviceDigest/);
  await f.owner.mutation(publishRef, { selections, measurementVersion: 2, expectedPreviewHash: preview.previewHash, expectedPublicationRevision: preview.revision });
  const publicRead = makeFunctionReference<"query">("publicProfiles:getByHandleV2");
  expect((await f.t.query(publicRead, { handle: "owner", measurementVersion: 2 })).cards[0].measurements[0].value).toBe("9007199254740993");
  expect((await f.t.query(publicRead, { handle: "owner" })).cards[0].measurements ?? []).toEqual([]);
  // A changed saved capture cannot reuse the earlier review or preview.
  await f.add(row("e".repeat(64), "1"));
  await f.owner.action(save, { sourceId: f.sourceId, propId: f.propId, start, end });
  await expect(f.owner.mutation(publishRef, { selections, measurementVersion: 2, expectedPreviewHash: preview.previewHash, expectedPublicationRevision: preview.revision + 1 })).rejects.toThrow();
  expect((await f.t.query(publicRead, { handle: "owner", measurementVersion: 2 })).cards[0].measurements[0].value).toBe("9007199254740993");
});

test("concurrent identical saves retain one capture and a new owner session sees it", async () => {
  const f = await fixture(), args = { sourceId: f.sourceId, propId: f.propId, start, end };
  const results = await Promise.all([f.owner.action(save, args), f.owner.action(save, args)]);
  expect(new Set(results.map(result => result.rawEvidenceId)).size).toBe(1);
  expect(results.map(result => result.replayed).sort()).toEqual([false, true]);
  expect(await f.t.run(ctx => ctx.db.query("rawEvidence").collect())).toHaveLength(1);
  expect(await f.t.withIdentity({ subject: "owner", tokenIdentifier: "fresh-session" }).query(read, { propId: f.propId, measurementVersion: 2 })).toHaveLength(1);
});

test.each(["sync", "repair", "disconnect", "erase", "owner"])("a %s between scan and commit rejects the stale checkpoint", async change => {
  const f = await fixture();
  const sourceRef = makeFunctionReference<"query">("retainedEvidence:usageSnapshotSource");
  const pageRef = makeFunctionReference<"query">("retainedEvidence:usageSnapshotPage");
  const commitRef = makeFunctionReference<"mutation">("retainedEvidence:commitUsageSnapshot");
  const scope = { sourceId: f.sourceId, propId: f.propId }, current = await f.owner.query(sourceRef, scope);
  const accumulator = createUsageSnapshotAccumulator({ start, end }); accumulator.add(row());
  const snapshot = accumulator.finish({ sourceKey: current.sourceKey, context: current.context, capturedAt: start });
  await f.t.run(async ctx => {
    if (change === "owner") { await ctx.db.patch(f.userId, { authSubject: "changed-owner" }); return; }
    await ctx.db.patch(f.sourceId, { snapshotRevision: 1, ...(change === "erase" ? { erasing: true } : {}), ...(change === "disconnect" ? { retainOnDisconnect: false } : {}) });
  });
  await expect(f.owner.query(pageRef, { ...scope, checkpoint: current.checkpoint, cursor: null })).rejects.toThrow();
  await expect(f.owner.mutation(commitRef, { ...scope, checkpoint: current.checkpoint, snapshotJson: canonicalJson(snapshot) })).rejects.toThrow();
  expect(await f.t.run(ctx => ctx.db.query("rawEvidence").collect())).toEqual([]);
});

test("source erasure removes derived private values and approvals without altering deliberately published copies", async () => {
  vi.useFakeTimers();
  const f = await fixture(), args = { sourceId: f.sourceId, propId: f.propId, start, end };
  const saved = await f.owner.action(save, args);
  const entry = (await f.owner.query(read, { propId: f.propId, measurementVersion: 2 }))[0];
  await f.owner.mutation(api.retainedEvidence.reviewMeasurements, { propId: f.propId, rawEvidenceId: saved.rawEvidenceId, expectedDigest: entry.digest, expectedReviewVersion: 0, measurementIds: [entry.measurements[0].id] });
  const selections = [{ propId: f.propId, expectedRelationshipVersion: 1, publish: true, status: "ACTIVE" as const, headline: "", note: "", autoRefresh: false, measurementEvidenceIds: [saved.rawEvidenceId as Id<"rawEvidence">] }];
  const preview = await f.owner.query(api.onboarding.previewPublication, { selections, measurementVersion: 2 });
  await f.owner.mutation(api.onboarding.publishSelected, { selections, measurementVersion: 2, expectedPreviewHash: preview.previewHash, expectedPublicationRevision: preview.revision });
  const published = await f.t.run(ctx => ctx.db.query("publishedProfiles").collect());
  const grantId = await f.t.run(async ctx => ctx.db.insert("usageGrants", { userId: f.userId, sourceId: f.sourceId, scopeJson: "{}", codeDigest: "e".repeat(64), deviceDigest: "d".repeat(64), pairExpiresAt: 0, expiresAt: 0, state: "revoked", sequence: 1 }));
  const erased = await f.owner.mutation(makeFunctionReference<"mutation">("usageConnections:erase"), { grantId });
  if (erased.done) expect((await f.t.run(ctx => ctx.db.get(saved.rawEvidenceId as Id<"rawEvidence">)))?.payload).toBeUndefined();
  expect(await f.owner.query(read, { propId: f.propId, measurementVersion: 2 })).toEqual([]);
  await expect(f.owner.query(api.onboarding.previewPublication, { selections, measurementVersion: 2 })).rejects.toThrow();
  await expect(f.owner.action(save, args)).rejects.toThrow();
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  const retained = await f.t.run(ctx => ctx.db.get(saved.rawEvidenceId as Id<"rawEvidence">));
  expect(retained?.payload).toBeUndefined(); expect(retained?.measurementReview).toBeUndefined(); expect(retained?.deletedAt).toBeTruthy();
  expect(await f.t.run(ctx => ctx.db.query("publishedProfiles").collect())).toEqual(published);
  // Even re-importing the same numeric history after a deletion cannot restore a tombstone.
  await f.add();
  await expect(f.owner.action(save, args)).rejects.toThrow("removed");
});

test("empty modern windows and invalid ranges leave the private collection unchanged", async () => {
  const f = await fixture(), before = await f.t.run(ctx => ctx.db.query("props").collect());
  await expect(f.owner.action(save, { sourceId: f.sourceId, start: end, end: "2026-10-09T00:00:00.000Z" })).rejects.toThrow("No matching modern");
  await expect(f.owner.action(save, { sourceId: f.sourceId, start, end: "2026-10-09T00:00:00.000Z" })).rejects.toThrow();
  expect(await f.t.run(ctx => ctx.db.query("props").collect())).toEqual(before);
  expect(await f.t.run(ctx => ctx.db.query("rawEvidence").collect())).toEqual([]);
});

test("source and UTC window stay separate; a conflicting response outside the window still blocks approval", async () => {
  const f = await fixture();
  await f.add({ ...row(), at: "2026-10-08T00:00:00.000Z" });
  const saved = await f.owner.action(save, { sourceId: f.sourceId, propId: f.propId, start, end });
  const entry = (await f.owner.query(read, { propId: f.propId, measurementVersion: 2 }))[0];
  expect(entry.measurements.every((item: {value: string | null; status: string}) => item.status === "conflict" && item.value === null)).toBe(true);
  await expect(f.owner.mutation(api.retainedEvidence.reviewMeasurements, { propId: f.propId, rawEvidenceId: saved.rawEvidenceId, expectedDigest: entry.digest, expectedReviewVersion: 0, measurementIds: [entry.measurements[0].id] })).rejects.toThrow("non-conflicting");
});

test("a delayed final page cannot commit after the scan deadline", async () => {
  vi.useFakeTimers();
  const f = await fixture(true);
  await expect(f.owner.action(save, { sourceId: f.sourceId, propId: f.propId, start, end })).rejects.toThrow("scan limit");
  expect(await f.t.run(ctx => ctx.db.query("rawEvidence").collect())).toEqual([]);
});

test("first save reuses the owner's existing Codex card while another account stays separate", async () => {
  const f = await fixture();
  const before = await f.t.run(ctx => ctx.db.query("props").collect());
  const saved = await f.owner.action(save, { sourceId: f.sourceId, start, end });
  expect(saved.propId).toBe(f.propId);
  expect(await f.t.run(ctx => ctx.db.query("props").collect())).toEqual(before);
  expect(await f.other.query(read, { propId: f.otherPropId, measurementVersion: 2 })).toEqual([]);
  const raw = await f.t.run(ctx => ctx.db.get(saved.rawEvidenceId as Id<"rawEvidence">));
  await expect(f.owner.mutation(api.retainedEvidence.importMeasurements, { propId: f.propId, text: raw!.payload! })).rejects.toThrow("supported sanitized");
});

test("ordered backend pages preserve exact totals beyond one page", async () => {
  const f = await fixture();
  for (let index = 0; index < 204; index++) await f.add(row(digest(String(index)), "1"));
  const saved = await f.owner.action(save, { sourceId: f.sourceId, propId: f.propId, start, end });
  const entry = (await f.owner.query(read, { propId: f.propId, measurementVersion: 2 }))[0];
  expect(entry.rawEvidenceId).toBe(saved.rawEvidenceId);
  expect(entry.measurements.find((item: {metric: string}) => item.metric === "input_tokens").value).toBe("9007199254741197");
});

test.each([true, false])("disconnect applies current retention consent to private snapshots (%s)", async retained => {
  vi.useFakeTimers();
  const f = await fixture();
  const grantId = await f.t.run(async ctx => {
    const grantId = await ctx.db.insert("usageGrants", { userId: f.userId, sourceId: f.sourceId, scopeJson: "{}", codeDigest: "e".repeat(64), deviceDigest: "d".repeat(64), pairExpiresAt: Date.now() + 1000, expiresAt: Date.now() + 10000, state: "active", sequence: 1 });
    await ctx.db.patch(f.sourceId, { currentGrantId: grantId, retainOnDisconnect: retained });
    return grantId;
  });
  const saved = await f.owner.action(save, { sourceId: f.sourceId, propId: f.propId, start, end });
  await f.owner.mutation(makeFunctionReference<"mutation">("usageConnections:disconnect"), { grantId });
  expect(await f.owner.query(read, { propId: f.propId, measurementVersion: 2 })).toHaveLength(retained ? 1 : 0);
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  const raw = await f.t.run(ctx => ctx.db.get(saved.rawEvidenceId as Id<"rawEvidence">));
  expect(Boolean(raw?.payload)).toBe(retained);
  if (retained) expect((await f.owner.action(save, { sourceId: f.sourceId, propId: f.propId, start, end })).replayed).toBe(true);
  else await expect(f.owner.action(save, { sourceId: f.sourceId, propId: f.propId, start, end })).rejects.toThrow("unavailable");
});

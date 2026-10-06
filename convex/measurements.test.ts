// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, test } from "vitest";
import schema from "./schema";
import codexFixture from "../tests/fixtures/codex-usage/account-snapshot.json";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");
const retain = makeFunctionReference<"mutation">("retainedEvidence:importMeasurements");
const read = makeFunctionReference<"query">("retainedEvidence:measurements");
const review = makeFunctionReference<"mutation">("retainedEvidence:reviewMeasurements");
const source = { namespace: "uncatalogued-tool", identityBasis: "OWNER_SUPPLIED", sourceAlias: "export", ownerAlias: null, accountAlias: "private-account-a", workspaceAlias: "private-workspace", deviceAlias: null };
const input = (captureId = "capture-1", value: string | null = "9007199254740993123456789", extra = {}) => JSON.stringify({
  format: "proper-measurements-v1", captureId, capturedAt: "2026-10-01T00:00:00.000Z", source,
  measurements: [{ id: "words", metric: "words", value, unit: "words", period: { kind: "unknown" }, scope: "WORKSPACE", coverage: "UNKNOWN", temporality: "SNAPSHOT", aggregation: "NON_ADDITIVE", overlapGroup: "private-overlap" }], ...extra,
});
async function fixture() {
  const t = convexTest(schema, modules);
  const propId = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { handle: "owner", authSubject: "owner", displayName: "Owner", bio: "" });
    await ctx.db.insert("users", { handle: "other", authSubject: "other", displayName: "Other", bio: "" });
    const productId = await ctx.db.insert("products", { name: "Uncatalogued", slug: "uncatalogued", domain: "", description: "" });
    return ctx.db.insert("props", { userId, productId, visibility: "PRIVATE", status: "ACTIVE", headline: "", note: "", confirmedAt: "2026-10-01T00:00:00.000Z", relationshipVersion: 1 });
  });
  return { t, propId, owner: t.withIdentity({ subject: "owner" }), other: t.withIdentity({ subject: "other" }) };
}
const selection = (propId: Id<"props">, measurementEvidenceIds?: Id<"rawEvidence">[]) => ({ propId, expectedRelationshipVersion: 1, publish: true, status: "ACTIVE" as const, headline: "", note: "", autoRefresh: false, measurementEvidenceIds });

test("imports exact measurements privately, replays safely, denies other owners and persists across sessions", async () => {
  const { t, owner, other, propId } = await fixture();
  const args = { propId, text: input() };
  await expect(t.mutation(retain, args)).rejects.toThrow();
  await expect(other.mutation(retain, args)).rejects.toThrow("unavailable");
  const first = await owner.mutation(retain, args);
  expect(await owner.mutation(retain, args)).toEqual({ ...first, duplicate: true });
  const entries = await t.withIdentity({ subject: "owner", tokenIdentifier: "new-session" }).query(read, { propId });
  expect(entries).toHaveLength(1);
  expect(entries[0].measurements[0].value).toBe("9007199254740993123456789");
  expect(entries[0].reviewedMeasurementIds).toEqual([]);
  expect(await t.run(ctx => ctx.db.query("publishedProfiles").collect())).toEqual([]);
  await expect(owner.mutation(retain, { propId, text: input("capture-1", "99") })).rejects.toThrow("conflict");
  expect((await owner.query(read, { propId }))[0].measurements[0].value).toBe("9007199254740993123456789");
});

test("review and exact preview precede explicit public allowlist projection; changed evidence invalidates preview", async () => {
  const { t, owner, other, propId } = await fixture();
  const first = await owner.mutation(retain, { propId, text: input() });
  const entry = (await owner.query(read, { propId }))[0];
  const selections = [selection(propId, [first.rawEvidenceId])];
  await expect(owner.query(api.onboarding.previewPublication, { selections })).rejects.toThrow("review");
  const reviewArgs = { propId, rawEvidenceId: first.rawEvidenceId, expectedDigest: entry.digest, expectedReviewVersion: entry.reviewVersion, measurementIds: [entry.measurements[0].id] };
  await expect(other.mutation(review, reviewArgs)).rejects.toThrow("unavailable");
  await owner.mutation(review, reviewArgs);
  expect((await owner.mutation(review, reviewArgs)).duplicate).toBe(true);
  const preview = await owner.query(api.onboarding.previewPublication, { selections });
  const projection = preview.profile.cards[0].measurements![0];
  expect(projection.value).toBe("9007199254740993123456789");
  expect(JSON.stringify(preview.profile)).not.toMatch(/private-account|private-workspace|private-overlap|rawEvidenceId|sourceAlias/);
  expect(await t.run(ctx => ctx.db.query("publishedProfiles").collect())).toEqual([]);
  await owner.mutation(api.onboarding.publishSelected, { selections, expectedPreviewHash: preview.previewHash, expectedPublicationRevision: preview.revision });
  const publicBefore = await t.run(ctx => ctx.db.query("publishedProfiles").collect());
  await owner.mutation(retain, { propId, text: input("capture-2", "0") });
  await expect(owner.mutation(api.onboarding.publishSelected, { selections, expectedPreviewHash: preview.previewHash, expectedPublicationRevision: preview.revision + 1 })).rejects.toThrow();
  expect(await t.run(ctx => ctx.db.query("publishedProfiles").collect())).toEqual(publicBefore);
});

test("deleted original cannot replay or contribute to a stale source review", async () => {
  const { owner, propId } = await fixture();
  const first = await owner.mutation(retain, { propId, text: input() });
  const entry = (await owner.query(read, { propId }))[0];
  await owner.mutation(review, { propId, rawEvidenceId: first.rawEvidenceId, expectedDigest: entry.digest, expectedReviewVersion: 0, measurementIds: [entry.measurements[0].id] });
  await owner.mutation(api.onboarding.deleteEvidence, { evidenceId: first.rawEvidenceId });
  await expect(owner.mutation(retain, { propId, text: input() })).rejects.toThrow("removed");
  expect(await owner.query(read, { propId })).toEqual([]);
  await expect(owner.query(api.onboarding.previewPublication, { selections: [selection(propId, [first.rawEvidenceId])] })).rejects.toThrow();
});

test("multiple accounts remain separate and the no-measurement old frontend still publishes", async () => {
  const { owner, propId } = await fixture();
  await owner.mutation(retain, { propId, text: input() });
  await owner.mutation(retain, { propId, text: input("capture-1", "0", { source: { ...source, accountAlias: "second-account" } }) });
  expect(await owner.query(read, { propId })).toHaveLength(2);
  const preview = await owner.query(api.onboarding.previewPublication, { selections: [selection(propId)] });
  expect(preview.profile.cards[0].measurements).toBeUndefined();
});

test("a malformed first result never leaves an empty relationship and supported first import returns its exact card", async () => {
  const { t, owner } = await fixture();
  const before = await t.run(ctx => ctx.db.query("props").collect());
  await expect(owner.mutation(retain, { text: '{"prompt":"private"}', productName: "New tool" })).rejects.toThrow();
  expect(await t.run(ctx => ctx.db.query("props").collect())).toEqual(before);
  const result = await owner.mutation(retain, { text: input(), productName: "New tool" });
  expect(await t.run(ctx => ctx.db.get(result.propId as Id<"props">))).toMatchObject({ visibility: "DRAFT" });
  expect((await owner.query(read, { propId: result.propId }))[0].rawEvidenceId).toBe(result.rawEvidenceId);
});

test("actual sanitized Claude native imports reconcile through the saved private relationship", async () => {
  const { owner, t } = await fixture();
  const text = (second: boolean) => JSON.stringify({ format: "claude-code-native-metrics-v1", sample: "synthetic", capturedAt: second ? "2026-10-01T00:00:01.000Z" : "2026-10-01T00:00:00.000Z", keyScopeDigest: "a".repeat(64), points: [{ streamDigest: "b".repeat(64), familyDigest: "c".repeat(64), metric: "input", model: null, sourceVersion: "2.1.214", temporality: "cumulative", startUnixNano: "1000000000000000001", endUnixNano: second ? "1000000000000000003" : "1000000000000000002", quantity: second ? "9007199254740993001" : "9007199254740993000" }] });
  const first = await owner.mutation(retain, { text: text(false), expectedSource: "claude-code" });
  const second = await owner.mutation(retain, { text: text(true), expectedSource: "claude-code" });
  expect(second.propId).toBe(first.propId);
  const entry = (await owner.query(read, { propId: first.propId }))[0];
  expect(entry.measurements.map((row: {value: string}) => row.value)).toEqual(["9007199254740993000", "1"]);
  expect(entry.measurements[1]).toMatchObject({ derivation: "CUMULATIVE_DIFFERENCE", sample: "synthetic", period: { startUnixNano: "1000000000000000002", endUnixNano: "1000000000000000003" } });
  expect(await t.run(ctx => ctx.db.query("publishedProfiles").collect())).toEqual([]);
});

test("changing selections and restoring them invalidates a preview even if projected values are identical", async () => {
  const { owner, propId } = await fixture();
  const first = await owner.mutation(retain, { propId, text: input() });
  const entry = (await owner.query(read, { propId }))[0];
  const base = { propId, rawEvidenceId: first.rawEvidenceId, expectedDigest: entry.digest, measurementIds: [entry.measurements[0].id] };
  await owner.mutation(review, { ...base, expectedReviewVersion: 0 });
  const selections = [selection(propId, [first.rawEvidenceId])];
  const preview = await owner.query(api.onboarding.previewPublication, { selections });
  await owner.mutation(review, { ...base, expectedReviewVersion: 1, measurementIds: [] });
  await owner.mutation(review, { ...base, expectedReviewVersion: 2 });
  await expect(owner.mutation(api.onboarding.publishSelected, { selections, expectedPreviewHash: preview.previewHash, expectedPublicationRevision: preview.revision })).rejects.toThrow("preview changed");
});

test("unchanged current selections are idempotent without accepting stale or future versions", async () => {
  const { t, owner, other, propId } = await fixture();
  await owner.mutation(retain, { propId, text: input() });
  await owner.mutation(retain, { propId, text: input("capture-2", "0") });
  const entry = (await owner.query(read, { propId }))[0];
  const args = { propId, rawEvidenceId: entry.rawEvidenceId, expectedDigest: entry.digest, measurementIds: entry.measurements.map((row: { id: string }) => row.id) };
  expect(await owner.mutation(review, { ...args, expectedReviewVersion: 0 })).toEqual({ version: 1, duplicate: false });
  const history = await t.run(ctx => ctx.db.query("measurementReviews").collect());
  const selections = [selection(propId, [entry.rawEvidenceId])];
  const preview = await owner.query(api.onboarding.previewPublication, { selections });
  for (let save = 0; save < 3; save++) {
    const current = (await owner.query(read, { propId }))[0];
    expect(await owner.mutation(review, { ...args, expectedReviewVersion: current.reviewVersion, measurementIds: [...args.measurementIds].reverse() })).toEqual({ version: 1, duplicate: true });
  }
  expect(await t.run(ctx => ctx.db.query("measurementReviews").collect())).toEqual(history);
  expect(await owner.query(api.onboarding.previewPublication, { selections })).toEqual(preview);
  await expect(other.mutation(review, { ...args, expectedReviewVersion: 1 })).rejects.toThrow("unavailable");
  await expect(owner.mutation(review, { ...args, expectedReviewVersion: 2 })).rejects.toThrow("review changed");
  await owner.mutation(review, { ...args, expectedReviewVersion: 1, measurementIds: [] });
  await owner.mutation(review, { ...args, expectedReviewVersion: 2 });
  await expect(owner.mutation(review, { ...args, expectedReviewVersion: 0 })).rejects.toThrow("review changed");
  expect(await owner.mutation(review, { ...args, expectedReviewVersion: 2 })).toEqual({ version: 3, duplicate: true });
});

test("256 reviews bound the whole relationship while reads, unchanged saves and retries preserve approvals", async () => {
  const { t, owner, other, propId } = await fixture();
  await owner.mutation(retain, { propId, text: input() });
  await owner.mutation(retain, { propId, text: input("capture-1", "0", { source: { ...source, accountAlias: "second-account" } }) });
  const entries = await owner.query(read, { propId });
  const first = { propId, rawEvidenceId: entries[0].rawEvidenceId, expectedDigest: entries[0].digest, measurementIds: [entries[0].measurements[0].id] };
  const second = { propId, rawEvidenceId: entries[1].rawEvidenceId, expectedDigest: entries[1].digest, measurementIds: [entries[1].measurements[0].id] };
  for (let version = 1; version <= 255; version++) {
    expect(await owner.mutation(review, { ...first, expectedReviewVersion: version - 1, measurementIds: version % 2 ? first.measurementIds : [] })).toEqual({ version, duplicate: false });
  }
  expect(await owner.mutation(review, { ...second, expectedReviewVersion: 0 })).toEqual({ version: 1, duplicate: false });
  const history = await t.run(ctx => ctx.db.query("measurementReviews").collect());
  expect(history).toHaveLength(256);
  const privateBefore = await owner.query(read, { propId });
  const selections = [selection(propId, entries.map((entry: { rawEvidenceId: Id<"rawEvidence"> }) => entry.rawEvidenceId))];
  const preview = await owner.query(api.onboarding.previewPublication, { selections });
  await expect(owner.mutation(review, { ...first, expectedReviewVersion: 255, measurementIds: [] })).rejects.toThrow("review history limit");
  await expect(owner.mutation(review, { ...second, expectedReviewVersion: 1, measurementIds: [] })).rejects.toThrow("review history limit");
  for (const expectedReviewVersion of [254, 255]) {
    expect(await owner.mutation(review, { ...first, expectedReviewVersion })).toEqual({ version: 255, duplicate: true });
  }
  expect(await owner.mutation(review, { ...second, expectedReviewVersion: 1 })).toEqual({ version: 1, duplicate: true });
  await expect(owner.mutation(review, { ...first, expectedReviewVersion: 256 })).rejects.toThrow("review changed");
  await expect(other.mutation(review, { ...first, expectedReviewVersion: 255 })).rejects.toThrow("unavailable");
  expect(await owner.query(read, { propId })).toEqual(privateBefore);
  expect(await t.run(ctx => ctx.db.query("measurementReviews").collect())).toEqual(history);
  expect(await owner.query(api.onboarding.previewPublication, { selections })).toEqual(preview);
  await owner.mutation(api.onboarding.publishSelected, { selections, expectedPreviewHash: preview.previewHash, expectedPublicationRevision: preview.revision });
  expect((await t.query(api.publicProfiles.getByHandleV2, { handle: "owner" }))?.cards[0].measurements).toHaveLength(2);
  const otherImport = await other.mutation(retain, { text: input(), productName: "Other owner's tool" });
  const otherEntry = (await other.query(read, { propId: otherImport.propId }))[0];
  expect(await other.mutation(review, { propId: otherImport.propId, rawEvidenceId: otherEntry.rawEvidenceId, expectedDigest: otherEntry.digest, expectedReviewVersion: 0, measurementIds: [otherEntry.measurements[0].id] })).toEqual({ version: 1, duplicate: false });
});

test("a changed source digest requires a fresh review even when the selection is still empty", async () => {
  const { t, owner, propId } = await fixture();
  const first = await owner.mutation(retain, { propId, text: input() });
  await owner.mutation(retain, { propId, text: input("capture-2", "0") });
  const entry = (await owner.query(read, { propId }))[0];
  const args = { propId, rawEvidenceId: entry.rawEvidenceId, expectedDigest: entry.digest, expectedReviewVersion: 0, measurementIds: [] };
  expect(await owner.mutation(review, args)).toEqual({ version: 1, duplicate: false });
  await owner.mutation(api.onboarding.deleteEvidence, { evidenceId: first.rawEvidenceId });
  const current = (await owner.query(read, { propId }))[0];
  expect(current.digest).not.toBe(entry.digest);
  await expect(owner.mutation(review, args)).rejects.toThrow("measurements changed");
  await expect(owner.mutation(review, { ...args, expectedDigest: current.digest })).rejects.toThrow("review changed");
  expect(await owner.mutation(review, { ...args, expectedDigest: current.digest, expectedReviewVersion: current.reviewVersion })).toEqual({ version: 2, duplicate: false });
  expect(await t.run(ctx => ctx.db.query("measurementReviews").collect())).toHaveLength(2);
});

test.each(["9007199254740993123456789", "0.0000000000000000000000000000000000000000001", "0", null])("exact scalar %s survives DB, review, publication and public reload", async value => {
  const { t, owner, propId } = await fixture();
  const first = await owner.mutation(retain, { propId, text: input("capture-1", value) });
  const entry = (await owner.query(read, { propId }))[0];
  await owner.mutation(review, { propId, rawEvidenceId: first.rawEvidenceId, expectedDigest: entry.digest, expectedReviewVersion: 0, measurementIds: [entry.measurements[0].id] });
  const selections = [selection(propId, [first.rawEvidenceId])];
  const preview = await owner.query(api.onboarding.previewPublication, { selections });
  await owner.mutation(api.onboarding.publishSelected, { selections, expectedPreviewHash: preview.previewHash, expectedPublicationRevision: preview.revision });
  const reloaded = await t.query(api.publicProfiles.getByHandleV2, { handle: "owner" });
  expect(reloaded?.cards[0].measurements?.[0].value).toBe(value);
  expect(JSON.stringify(reloaded)).not.toMatch(/private-account|private-workspace|private-overlap|sourceAlias|evidenceDigest|rawEvidenceId/);
  const privateReload = await t.withIdentity({ subject: "owner", tokenIdentifier: "another-session" }).query(read, { propId });
  expect(privateReload[0].measurements[0].value).toBe(value);
});

test("Codex first-result accepts its actual capture schema and keeps daily buckets and private thread groups", async () => {
  const { owner } = await fixture();
  const result = await owner.mutation(retain, { text: JSON.stringify(codexFixture), expectedSource: "codex" });
  const entry = (await owner.query(read, { propId: result.propId }))[0];
  expect(entry.source).toMatchObject({ accountAlias: "synthetic-account", identityBasis: "OWNER_SUPPLIED" });
  expect(entry.measurements.filter((row: {metric: string}) => row.metric === "daily_tokens").map((row: {value: string}) => row.value)).toEqual(["1200", "0"]);
  expect(entry.measurements.every((row: {sample: string}) => row.sample === "unknown")).toBe(true);
  expect(entry.measurements.some((row: {dimensions: {threadAlias: string | null}}) => row.dimensions.threadAlias === "synthetic-thread")).toBe(true);
  await expect(owner.mutation(retain, { text: JSON.stringify(codexFixture), expectedSource: "claude-code" })).rejects.toThrow("different measurement source");
});

test("later conflicting Claude streams quarantine the whole stream and invalidate the prior review", async () => {
  const { owner } = await fixture();
  const native = (second: boolean) => JSON.stringify({ format: "claude-code-native-metrics-v1", sample: "owner-supplied", capturedAt: second ? "2026-10-01T00:00:01.000Z" : "2026-10-01T00:00:00.000Z", keyScopeDigest: "a".repeat(64), points: [{ streamDigest: "b".repeat(64), familyDigest: "c".repeat(64), metric: "input", model: null, sourceVersion: "2.1.214", temporality: "delta", startUnixNano: "1000000000000000001", endUnixNano: "1000000000000000002", quantity: second ? "999" : "7" }] });
  const first = await owner.mutation(retain, { text: native(false) });
  let entry = (await owner.query(read, { propId: first.propId }))[0];
  await owner.mutation(review, { propId: first.propId, rawEvidenceId: entry.rawEvidenceId, expectedDigest: entry.digest, expectedReviewVersion: 0, measurementIds: [entry.measurements[0].id] });
  await owner.mutation(retain, { text: native(true) });
  entry = (await owner.query(read, { propId: first.propId }))[0];
  expect(entry.reviewedMeasurementIds).toEqual([]);
  expect(entry.measurements.every((row: {status: string}) => row.status === "conflict")).toBe(true);
  await expect(owner.mutation(review, { propId: first.propId, rawEvidenceId: entry.rawEvidenceId, expectedDigest: entry.digest, expectedReviewVersion: 0, measurementIds: [entry.measurements[0].id] })).rejects.toThrow("non-conflicting");
});

test("deleting an older input invalidates the newer derived review and never restores it on replay", async () => {
  const { owner, propId } = await fixture();
  const first = await owner.mutation(retain, { propId, text: input() });
  const second = await owner.mutation(retain, { propId, text: input("capture-2", "0") });
  const entry = (await owner.query(read, { propId }))[0];
  await owner.mutation(review, { propId, rawEvidenceId: second.rawEvidenceId, expectedDigest: entry.digest, expectedReviewVersion: 0, measurementIds: entry.measurements.map((row: {id: string}) => row.id) });
  await owner.mutation(api.onboarding.deleteEvidence, { evidenceId: first.rawEvidenceId });
  const after = (await owner.query(read, { propId }))[0];
  expect(after.measurements.map((row: {value: string}) => row.value)).toEqual(["0"]);
  expect(after.digest).not.toBe(entry.digest);
  expect(after.reviewedMeasurementIds).toEqual([]);
  await expect(owner.mutation(retain, { propId, text: input() })).rejects.toThrow("removed");
  await expect(owner.query(api.onboarding.previewPublication, { selections: [selection(propId, [second.rawEvidenceId])] })).rejects.toThrow("review");
});

test("distinct workspace rows and device duration preserve account scope through review and publication", async () => {
  const { owner, propId, t } = await fixture();
  const payload = JSON.parse(input());
  payload.measurements = [
    { ...payload.measurements[0], id: "workspace-rows", metric: "distinct_rows", value: "400", unit: "rows", scope: "WORKSPACE", aggregation: "DISTINCT", period: { kind: "date", start: "2026-09-01", end: "2026-09-30", timezone: "UTC" } },
    { ...payload.measurements[0], id: "device-duration", metric: "app_duration", value: "0.000000001", unit: "seconds", scope: "DEVICE", period: { kind: "instant", startUnixNano: "1000000000000000001", endUnixNano: "1000000000000000002" } },
  ];
  payload.source.deviceAlias = "private-laptop";
  const retained = await owner.mutation(retain, { propId, text: JSON.stringify(payload) });
  const entry = (await owner.query(read, { propId }))[0];
  await owner.mutation(review, { propId, rawEvidenceId: retained.rawEvidenceId, expectedDigest: entry.digest, expectedReviewVersion: 0, measurementIds: entry.measurements.map((row: {id: string}) => row.id) });
  const selections = [selection(propId, [retained.rawEvidenceId])];
  const preview = await owner.query(api.onboarding.previewPublication, { selections });
  expect(preview.profile.cards[0].measurements).toMatchObject([{ metric: "distinct_rows", value: "400", scope: "WORKSPACE", aggregation: "DISTINCT", period: { kind: "date", timezone: "UTC" } }, { metric: "app_duration", value: "0.000000001", scope: "DEVICE", period: { startUnixNano: "1000000000000000001", endUnixNano: "1000000000000000002" } }]);
  await owner.mutation(api.onboarding.publishSelected, { selections, expectedPreviewHash: preview.previewHash, expectedPublicationRevision: preview.revision });
  expect(JSON.stringify(await t.query(api.publicProfiles.getByHandleV2, { handle: "owner" }))).not.toContain("private-laptop");
});

test("same source aliases imported by another signed-in owner never bind or read the first owner's evidence", async () => {
  const { owner, other } = await fixture();
  const args = { text: input(), productName: "Shared public product name" };
  const first = await owner.mutation(retain, args);
  const second = await other.mutation(retain, args);
  expect(second.propId).not.toBe(first.propId);
  expect(second.rawEvidenceId).not.toBe(first.rawEvidenceId);
  await expect(other.query(read, { propId: first.propId })).rejects.toThrow("unavailable");
  expect((await other.query(read, { propId: second.propId }))[0].source.identityBasis).toBe("OWNER_SUPPLIED");
});

test("revoking a connection leaves imported historical measurements and owner decisions unchanged", async () => {
  const { owner, t, propId } = await fixture();
  await owner.mutation(retain, { propId, text: input() });
  const before = await owner.query(read, { propId });
  const connectorId = await t.run(async ctx => {
    const prop = await ctx.db.get(propId);
    return ctx.db.insert("connectorAccounts", { userId: prop!.userId, provider: "GITHUB", status: "CONNECTED", accountLabel: "github.com/synthetic", attributionScope: "PERSONAL", connectedAt: "2026-10-01T00:00:00.000Z" });
  });
  await owner.mutation(api.connectors.revokeConnector, { connectorId });
  expect(await owner.query(read, { propId })).toEqual(before);
  expect(await t.run(ctx => ctx.db.get(propId))).toMatchObject({ status: "ACTIVE", visibility: "PRIVATE", relationshipVersion: 1 });
});

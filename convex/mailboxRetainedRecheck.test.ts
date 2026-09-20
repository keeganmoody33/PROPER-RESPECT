// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { FunctionReturnType } from "convex/server";
import { mailboxSourceKey } from "./mailboxes";

const modules = import.meta.glob("./**/*.ts");
const recheck = api.mailboxDiscovery.recheckRetained;
const page = { paginationOpts: { cursor: null, numItems: 10 } };
async function fixture(count = 1, domain = "github.com") {
  const t = convexTest(schema, modules);
  const ownerId = await t.run(ctx => ctx.db.insert("users", { handle: "owner", authSubject: "owner", displayName: "Owner", bio: "" }));
  const otherId = await t.run(ctx => ctx.db.insert("users", { handle: "other", authSubject: "other", displayName: "Other", bio: "" }));
  const owner = t.withIdentity({ subject: "owner" });
  const time = "2026-09-19T12:00:00.000Z";
  const { sourceId, accountId, records } = await t.run(async ctx => {
    const sourceId = await ctx.db.insert("evidenceSources", { userId: ownerId, type: "GMAIL", sourceKey: mailboxSourceKey("GOOGLE", "account"), connectedAt: time, lastSyncedAt: time });
    const accountId = await ctx.db.insert("mailboxAccounts", { ownerId, provider: "GOOGLE", providerAccountId: "account", evidenceSourceId: sourceId, accountLabel: "Private fixture", scopes: [], status: "DISCONNECTED", generation: 2, cursor: "untouched", connectedAt: time, updatedAt: time });
    const records = [];
    for (let index = 0; index < count; index++) {
      const sourceRecordId = `message-${index}`;
      const rawId = await ctx.db.insert("rawEvidence", { userId: ownerId, evidenceSourceId: sourceId, sourceRecordId,
        dedupKey: JSON.stringify(["source-v1", sourceId, ["record", sourceRecordId]]), capturedAt: time,
        payload: JSON.stringify({ id: sourceRecordId, internalDate: "1789819200000", headers: { from: `Product <hello@${domain}>`, subject: "Your account", date: time } }), observations: [],
        captureProvenance: { version: 1, route: "DIRECT_API", adapter: { id: "gmail-metadata-v1", version: "1" }, origin: { issuer: "GOOGLE", accountId: "account", recordId: sourceRecordId }, collector: { kind: "SYSTEM" }, activityActor: { kind: "UNKNOWN" } } });
      const unknownId = await ctx.db.insert("mailboxUnknownRecords", { ownerId, accountId, rawEvidenceId: rawId, sourceRecordId, senderDomain: domain, status: "PENDING", createdAt: time });
      records.push({ rawId, unknownId });
    }
    return { sourceId, accountId, records };
  });
  return { t, owner, ownerId, otherId, sourceId, accountId, records };
}
async function unchangedState(t: ReturnType<typeof convexTest>) {
  return t.run(async ctx => Object.fromEntries(await Promise.all([
    "rawEvidence", "evidenceSources", "mailboxAccounts", "mailboxUnknownRecords", "mailboxScanContexts", "mailboxScanJobs", "mailboxDiscoveryRuns", "mailboxBatches", "publishedProfiles", "relationshipEvents", "usageSignals", "claimReviews",
  ].map(async table => [table, await ctx.db.query(table).collect()]))));
}

test("retained recheck creates private proposals without captures, reads, freshness or relationship decisions; replay is idempotent", async () => {
  const { t, owner, records } = await fixture(2);
  const before = await unchangedState(t);
  const fetcher = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("No provider reads allowed"));
  try {
    const first = await owner.mutation(recheck, page);
    expect(first).toMatchObject({ examined: 2, matched: 2, createdDrafts: 1, alreadyClassified: 0, skipped: 0, isDone: true });
    const draft = (await t.run(ctx => ctx.db.query("draftImports").unique()))!;
    expect(draft).toMatchObject({ status: "PENDING", rawEvidenceIds: records.map(record => record.rawId) });
    const prop = (await t.run(ctx => ctx.db.get(draft.resultPropId!)))!;
    expect(prop).toMatchObject({ visibility: "DRAFT", status: "TESTING" });
    expect(prop.confirmedAt).toBeUndefined();
    expect(prop.goTo).toBeUndefined();
    expect(await t.run(ctx => ctx.db.query("proofs").collect())).toHaveLength(2);
    expect(await owner.mutation(recheck, page)).toMatchObject({ matched: 2, createdDrafts: 0, alreadyClassified: 2 });
    expect(await t.run(ctx => ctx.db.query("proofs").collect())).toHaveLength(2);
    expect(await unchangedState(t)).toEqual(before);
    expect(fetcher).not.toHaveBeenCalled();
    const scheduled = await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    expect(scheduled.every(job => job.name.includes("productBrands"))).toBe(true);
  } finally { fetcher.mockRestore(); }
});

test("owner pagination is bounded and advances past unmatched records without consuming mailbox cursors", async () => {
  const { t, owner } = await fixture(23, "unknown.example");
  const before = await unchangedState(t);
  let cursor: string | null = null;
  const examined = [];
  for (let i = 0; i < 3; i++) {
    const result: FunctionReturnType<typeof recheck> = await owner.mutation(recheck, { paginationOpts: { cursor, numItems: 100 } });
    examined.push(result.examined);
    cursor = result.continueCursor;
    expect(result.isDone).toBe(i === 2);
    expect(result.unmatched).toBe(result.examined);
  }
  expect(examined).toEqual([10, 10, 3]);
  expect(await unchangedState(t)).toEqual(before);
  expect(await t.run(ctx => ctx.db.query("draftImports").collect())).toEqual([]);
});

test("authentication and owner-scoped selection cannot expose another owner's retained headers", async () => {
  const { t, owner } = await fixture();
  await expect(t.mutation(recheck, page)).rejects.toThrow("Authentication required");
  expect(await t.withIdentity({ subject: "other" }).mutation(recheck, page)).toMatchObject({ examined: 0, matched: 0 });
  await expect(owner.mutation(recheck, { paginationOpts: { cursor: null, numItems: 0 } })).rejects.toThrow("page size");
});

test.each(["DISMISSED", "LINKED", "DELETED", "MALFORMED"] as const)("%s retained records do not create a discovery", async status => {
  const { t, owner, records: [record] } = await fixture();
  await t.run(async ctx => {
    if (status === "DELETED") await ctx.db.patch(record.rawId, { deletedAt: "2026-09-19T13:00:00Z" });
    else if (status === "MALFORMED") await ctx.db.patch(record.rawId, { payload: "invalid JSON" });
    else await ctx.db.patch(record.unknownId, { status });
  });
  const before = await unchangedState(t);
  expect(await owner.mutation(recheck, page)).toMatchObject({ createdDrafts: 0, matched: 0 });
  expect(await unchangedState(t)).toEqual(before);
  expect(await t.run(ctx => ctx.db.query("draftImports").collect())).toEqual([]);
});

test.each(["owner", "account", "source", "record", "dedup", "origin", "sender"] as const)("%s integrity mismatch rejects the whole retained page", async kind => {
  const { t, owner, otherId, records: [record] } = await fixture();
  await t.run(async ctx => {
    const raw = (await ctx.db.get(record.rawId))!;
    if (kind === "owner") await ctx.db.patch(record.rawId, { userId: otherId });
    if (kind === "account") { const unknown = (await ctx.db.get(record.unknownId))!; await ctx.db.patch(unknown.accountId, { ownerId: otherId }); }
    if (kind === "source") await ctx.db.patch(raw.evidenceSourceId, { sourceKey: "other-source" });
    if (kind === "record") await ctx.db.patch(record.rawId, { sourceRecordId: "different" });
    if (kind === "dedup") await ctx.db.patch(record.rawId, { dedupKey: "different" });
    if (kind === "origin") await ctx.db.patch(record.rawId, { captureProvenance: { ...raw.captureProvenance!, origin: { ...raw.captureProvenance!.origin, accountId: "other" } } });
    if (kind === "sender") await ctx.db.patch(record.unknownId, { senderDomain: "clerk.com" });
  });
  const before = await unchangedState(t);
  await expect(owner.mutation(recheck, page)).rejects.toThrow("integrity");
  expect(await unchangedState(t)).toEqual(before);
  expect(await t.run(ctx => ctx.db.query("draftImports").collect())).toEqual([]);
});

test.each(["REJECTED", "SUPERSEDED"] as const)("%s catalog decisions are not reopened", async status => {
  const { t, owner, ownerId } = await fixture();
  await t.run(ctx => ctx.db.insert("draftImports", { userId: ownerId, status, suggestedProductSlug: "github", suggestedProductName: "GitHub", suggestedDomain: "github.com", suggestedDescription: "", suggestedUrl: "https://github.com", rawEvidenceIds: [] }));
  const before = await t.run(ctx => ctx.db.query("draftImports").collect());
  expect(await owner.mutation(recheck, page)).toMatchObject({ createdDrafts: 0, skipped: 1 });
  expect(await t.run(ctx => ctx.db.query("draftImports").collect())).toEqual(before);
  expect(await t.run(ctx => ctx.db.query("props").collect())).toEqual([]);
});

test("multiple existing relationships keep catalog evidence ambiguous without selecting a card", async () => {
  const { t, owner, ownerId, records: [record] } = await fixture();
  await t.run(async ctx => {
    const productId = await ctx.db.insert("products", { name: "GitHub", slug: "github", domain: "github.com", description: "" });
    for (const status of ["ACTIVE", "ARCHIVED"] as const) await ctx.db.insert("props", { userId: ownerId, productId, status, visibility: "PRIVATE", headline: "Owner choice", note: "Keep" });
  });
  const props = await t.run(ctx => ctx.db.query("props").collect());
  expect(await owner.mutation(recheck, page)).toMatchObject({ createdDrafts: 0, ambiguousProducts: [{ productSlug: "github", reason: "MULTIPLE_OWNER_RELATIONSHIPS" }] });
  const draft = (await t.run(ctx => ctx.db.query("draftImports").unique()))!;
  expect(draft.rawEvidenceIds).toEqual([record.rawId]);
  expect(draft.resultPropId).toBeUndefined();
  expect(await t.run(ctx => ctx.db.query("props").collect())).toEqual(props);
  expect(await t.run(ctx => ctx.db.query("proofs").collect())).toEqual([]);
  expect(await owner.mutation(recheck, page)).toMatchObject({ createdDrafts: 0, alreadyClassified: 1 });
});

test("same provider message ID in separate accounts stays two originals linked to one candidate", async () => {
  const { t, owner, ownerId, records: [record] } = await fixture();
  await t.run(async ctx => {
    const original = (await ctx.db.get(record.rawId))!;
    const unknown = (await ctx.db.get(record.unknownId))!;
    const firstAccount = (await ctx.db.get(unknown.accountId))!;
    const time = original.capturedAt;
    const sourceId = await ctx.db.insert("evidenceSources", { userId: ownerId, type: "GMAIL", sourceKey: mailboxSourceKey("GOOGLE", "second-account"), connectedAt: time });
    const accountId = await ctx.db.insert("mailboxAccounts", { ownerId, provider: "GOOGLE", providerAccountId: "second-account", evidenceSourceId: sourceId, accountLabel: "Other mailbox", scopes: [], status: "CONNECTED", generation: 1, cursor: null, connectedAt: time, updatedAt: time });
    expect(firstAccount.providerAccountId).not.toBe("second-account");
    const rawId = await ctx.db.insert("rawEvidence", { userId: ownerId, evidenceSourceId: sourceId,
      sourceRecordId: original.sourceRecordId, dedupKey: JSON.stringify(["source-v1", sourceId, ["record", original.sourceRecordId]]),
      capturedAt: time, payload: original.payload, observations: [],
      captureProvenance: { ...original.captureProvenance!, origin: { ...original.captureProvenance!.origin, accountId: "second-account" } } });
    await ctx.db.insert("mailboxUnknownRecords", { ownerId, accountId, rawEvidenceId: rawId, sourceRecordId: unknown.sourceRecordId, senderDomain: unknown.senderDomain, status: "PENDING", createdAt: time });
  });
  const before = await unchangedState(t);
  expect(await owner.mutation(recheck, page)).toMatchObject({ matched: 2, createdDrafts: 1 });
  expect(await unchangedState(t)).toEqual(before);
  expect(await t.run(ctx => ctx.db.query("proofs").collect())).toHaveLength(2);
  expect((await t.run(ctx => ctx.db.query("draftImports").unique()))!.rawEvidenceIds).toHaveLength(2);
});

test("existing saved relationship receives only retained proof, never edited choices or links", async () => {
  const { t, owner, ownerId } = await fixture();
  const propId = await t.run(async ctx => {
    const productId = await ctx.db.insert("products", { name: "GitHub", slug: "github", domain: "github.com", description: "" });
    const propId = await ctx.db.insert("props", { userId: ownerId, productId, status: "ARCHIVED", visibility: "PRIVATE", headline: "Owner explanation", note: "Owner history", goTo: true, confirmedAt: "2026-09-19T12:00:00Z" });
    await ctx.db.insert("links", { propId, type: "CANONICAL", url: "https://github.com/owner", label: "Owner's page", isPrimary: true });
    return propId;
  });
  const selections = [{ propId, expectedRelationshipVersion: 0, publish: true, status: "ARCHIVED" as const,
    headline: "Owner explanation", note: "Owner history", autoRefresh: false }];
  const preview = await owner.query(api.onboarding.previewPublication, { selections });
  await owner.mutation(api.onboarding.publishSelected, { selections, expectedPublicationRevision: preview.revision, expectedPreviewHash: preview.previewHash });
  const publication = await t.run(ctx => ctx.db.query("publishedProfiles").collect());
  expect(publication).toHaveLength(1);
  expect(publication[0].profile.cards).toHaveLength(1);
  const before = await t.run(async ctx => ({ prop: await ctx.db.get(propId), links: await ctx.db.query("links").collect() }));
  expect(await owner.mutation(recheck, page)).toMatchObject({ createdDrafts: 0, matched: 1 });
  await owner.mutation(recheck, page);
  expect(await t.run(async ctx => ({ prop: await ctx.db.get(propId), links: await ctx.db.query("links").collect() }))).toEqual(before);
  expect(await t.run(ctx => ctx.db.query("publishedProfiles").collect())).toEqual(publication);
  expect(await t.run(ctx => ctx.db.query("proofs").collect())).toMatchObject([{ propId, type: "EMAIL_EVIDENCE" }]);
});

test("retained-only ingestion fails closed rather than inventing a source or capture", async () => {
  const { t, ownerId, sourceId } = await fixture();
  const { ingestSignalsForOwner } = await import("./discovery");
  const signal = { sourceType: "GMAIL" as const, sourceRecordId: "not-retained", capturedAt: "2026-09-19T12:00:00Z", payload: "Synthetic new data" };
  const before = await unchangedState(t);
  await expect(t.run(ctx => ingestSignalsForOwner(ctx, { ownerId, sourceType: "GMAIL", sourceKey: mailboxSourceKey("GOOGLE", "account"), retainedOnly: true, signals: [signal] }))).rejects.toThrow("existing source");
  await expect(t.run(ctx => ingestSignalsForOwner(ctx, { ownerId, sourceType: "GMAIL", evidenceSourceId: sourceId, sourceKey: mailboxSourceKey("GOOGLE", "account"), retainedOnly: true, signals: [signal] }))).rejects.toThrow("cannot create a capture");
  expect(await unchangedState(t)).toEqual(before);
});

test("mature relationships preserve existing proofs while adding each new retained original only once", async () => {
  const { t, owner, ownerId, records } = await fixture(2);
  const prior = await t.run(async ctx => {
    const productId = await ctx.db.insert("products", { name: "GitHub", slug: "github", domain: "github.com", description: "" });
    const propId = await ctx.db.insert("props", { userId: ownerId, productId, status: "ACTIVE", visibility: "PRIVATE", headline: "Keep", note: "Keep" });
    for (let i = 0; i < 200; i++) await ctx.db.insert("proofs", { propId, type: "NOTE", label: `Historical owner context ${i}` });
    await ctx.db.insert("proofs", { propId, type: "EMAIL_EVIDENCE", rawEvidenceId: records[0].rawId, label: "Prior owner-selected proof" });
    return ctx.db.query("proofs").collect();
  });
  expect(await owner.mutation(recheck, page)).toMatchObject({ matched: 2, createdDrafts: 0 });
  await owner.mutation(recheck, page);
  const after = await t.run(ctx => ctx.db.query("proofs").collect());
  expect(after).toHaveLength(prior.length + 1);
  for (const proof of prior) expect(after.find(item => item._id === proof._id)).toEqual(proof);
  expect(after.filter(proof => proof.rawEvidenceId === records[1].rawId)).toHaveLength(1);
});

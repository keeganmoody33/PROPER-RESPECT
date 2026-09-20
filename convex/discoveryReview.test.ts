// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import type { FunctionReturnType } from "convex/server";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const firstPage = { numItems: 10, cursor: null };

async function fixture(count = 2) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const ownerId = await ctx.db.insert("users", { authSubject: "owner", handle: "owner", displayName: "Owner", bio: "" });
    const otherId = await ctx.db.insert("users", { authSubject: "other", handle: "other", displayName: "Other", bio: "" });
    const productId = await ctx.db.insert("products", { slug: "github", name: "GitHub", domain: "github.com", description: "Code" });
    const otherProductId = await ctx.db.insert("products", { slug: "github-copilot", name: "Copilot", domain: "github.com", description: "Assistant" });
    const base = { status: "TESTING" as const, visibility: "PRIVATE" as const, headline: "", note: "Owner's existing explanation", relationshipVersion: 1, goTo: true };
    const a = await ctx.db.insert("props", { ...base, userId: ownerId, productId, headline: "Work record" });
    const b = await ctx.db.insert("props", { ...base, userId: ownerId, productId, headline: "Personal record", status: "ARCHIVED" });
    const wrongProduct = await ctx.db.insert("props", { ...base, userId: ownerId, productId: otherProductId });
    const foreignProp = await ctx.db.insert("props", { ...base, userId: otherId, productId });
    const sourceId = await ctx.db.insert("evidenceSources", { userId: ownerId, type: "GITHUB", label: "Synthetic personal GitHub", connectedAt: "2026-09-19T00:00:00.000Z" });
    const rawEvidenceIds = [];
    for (let i = 0; i < count; i++) rawEvidenceIds.push(await ctx.db.insert("rawEvidence", { userId: ownerId, evidenceSourceId: sourceId, capturedAt: "2026-09-19T00:00:00.000Z", payload: `PRIVATE_ORIGINAL_${i}`, dedupKey: `raw-${i}` }));
    const draftId = await ctx.db.insert("draftImports", { userId: ownerId, status: "PENDING", suggestedProductSlug: "github", suggestedProductName: "GitHub", suggestedDomain: "github.com", suggestedDescription: "Code", suggestedUrl: "https://github.com", rawEvidenceIds });
    await ctx.db.insert("publishedProfiles", { handle: "owner", revision: 1, publishedAt: "2026-09-19T00:00:00.000Z", profile: { handle: "owner", displayName: "Approved public owner", bio: "Approved bio", cards: [] } });
    return { ownerId, otherId, productId, a, b, wrongProduct, foreignProp, sourceId, rawEvidenceIds, draftId };
  });
  const owner = t.withIdentity({ subject: "owner" });
  const choice = async () => (await owner.query(api.discoveryReview.candidates, { draftId: ids.draftId, paginationOpts: firstPage })).page.find(item => item.id === ids.b)!;
  const preserved = () => t.run(async ctx => ({ props: await ctx.db.query("props").collect(), publications: await ctx.db.query("publishedProfiles").collect(), events: await ctx.db.query("relationshipEvents").collect(), originals: await ctx.db.query("rawEvidence").collect(), links: await ctx.db.query("links").collect() }));
  return { t, owner, ...ids, choice, preserved };
}

test("owner review lists ambiguity with bounded safe source metadata and exact product candidates", async () => {
  const { t, owner, draftId, a, b } = await fixture();
  await expect(t.query(api.discoveryReview.list, { paginationOpts: firstPage })).rejects.toThrow("Authentication");
  expect((await t.withIdentity({ subject: "other" }).query(api.discoveryReview.list, { paginationOpts: firstPage })).page).toEqual([]);
  const pending = await owner.query(api.discoveryReview.list, { paginationOpts: firstPage });
  expect(pending.page).toMatchObject([{ id: draftId, name: "GitHub", evidenceCount: 2 }]);
  const options = await owner.query(api.discoveryReview.candidates, { draftId, paginationOpts: firstPage });
  expect(options.page.map(item => item.id)).toEqual([a, b]);
  const details = await owner.query(api.discoveryReview.details, { draftId });
  expect(details.sources).toMatchObject([{ sourceType: "GITHUB", capturedAt: "2026-09-19T00:00:00.000Z" }, { sourceType: "GITHUB" }]);
  expect(JSON.stringify({ pending, options, details })).not.toContain("PRIVATE_ORIGINAL");
  expect(details.sources[0]).toMatchObject({ sourceLabel: "Synthetic personal GitHub" });
});

test("explicit attachment changes only deduplicated proofs and draft mapping and replays without writes", async () => {
  const { t, owner, draftId, a, b, rawEvidenceIds, choice, preserved } = await fixture();
  await t.run(ctx => ctx.db.insert("proofs", { propId: b, rawEvidenceId: rawEvidenceIds[0], type: "GITHUB_REPO" }));
  const before = await preserved();
  const selected = await choice();
  const request = { draftId, propId: b, expectedHash: selected.expectedHash };
  expect(await owner.mutation(api.discoveryReview.attach, request)).toMatchObject({ duplicate: false, processed: 2, total: 2, skippedDeleted: 0 });
  expect(await preserved()).toEqual(before);
  const proofs = await t.run(ctx => ctx.db.query("proofs").collect());
  expect(proofs.map(proof => [proof.propId, proof.rawEvidenceId])).toEqual(rawEvidenceIds.map(id => [b, id]));
  expect(await t.run(ctx => ctx.db.get(draftId))).toMatchObject({ status: "PENDING", resultPropId: b });
  const draftAfter = await t.run(ctx => ctx.db.get(draftId));
  expect(await owner.mutation(api.discoveryReview.attach, request)).toMatchObject({ duplicate: true, processed: 2 });
  expect(await t.run(ctx => ctx.db.get(draftId))).toEqual(draftAfter);
  expect(await t.run(ctx => ctx.db.query("proofs").collect())).toEqual(proofs);
  await expect(owner.mutation(api.discoveryReview.attach, { ...request, propId: a })).rejects.toThrow("different relationship");
  expect((await owner.query(api.discoveryReview.list, { paginationOpts: firstPage })).page).toEqual([]);
});

test("foreign owners and same-domain different products cannot receive the originals", async () => {
  const { t, owner, draftId, b, wrongProduct, foreignProp, choice } = await fixture();
  const selected = await choice();
  const request = { draftId, propId: b, expectedHash: selected.expectedHash };
  await expect(t.withIdentity({ subject: "other" }).mutation(api.discoveryReview.attach, request)).rejects.toThrow("unavailable");
  for (const propId of [wrongProduct, foreignProp]) await expect(owner.mutation(api.discoveryReview.attach, { ...request, propId })).rejects.toThrow("unavailable");
  await t.run(ctx => ctx.db.patch(draftId, { suggestedDomain: "another.example" }));
  await expect(owner.mutation(api.discoveryReview.attach, request)).rejects.toThrow("product identity");
  expect(await t.run(ctx => ctx.db.query("proofs").collect())).toEqual([]);
});

test.each(["relationship", "evidence", "source label"] as const)("changed %s rejects the old expectation before any attachment", async changed => {
  const { t, owner, draftId, b, rawEvidenceIds, sourceId, choice } = await fixture();
  const selected = await choice();
  if (changed === "relationship") await t.run(ctx => ctx.db.patch(b, { relationshipVersion: 2, note: "Changed decision" }));
  else if (changed === "source label") await t.run(ctx => ctx.db.patch(sourceId, { label: "Synthetic work GitHub" }));
  else await t.run(ctx => ctx.db.patch(rawEvidenceIds[0], { deletedAt: "2026-09-19T01:00:00.000Z" }));
  await expect(owner.mutation(api.discoveryReview.attach, { draftId, propId: b, expectedHash: selected.expectedHash })).rejects.toThrow("changed");
  expect(await t.run(ctx => ctx.db.query("proofs").collect())).toEqual([]);
  expect((await t.run(ctx => ctx.db.get(draftId)))?.resultPropId).toBeUndefined();
});

test.each(["raw", "source"] as const)("foreign %s ownership fails the whole chunk without leaking source details", async changed => {
  const { t, owner, draftId, b, otherId, rawEvidenceIds, sourceId, choice } = await fixture();
  const selected = await choice();
  await t.run(ctx => ctx.db.patch(changed === "raw" ? rawEvidenceIds[1] : sourceId, { userId: otherId }));
  await expect(owner.mutation(api.discoveryReview.attach, { draftId, propId: b, expectedHash: selected.expectedHash })).rejects.toThrow("Evidence unavailable");
  expect(await t.run(ctx => ctx.db.query("proofs").collect())).toEqual([]);
  expect((await t.run(ctx => ctx.db.get(draftId)))?.resultPropId).toBeUndefined();
});

test("deleted originals are excluded and counted without becoming relationship claims", async () => {
  const { t, owner, draftId, b, rawEvidenceIds, choice } = await fixture();
  await t.run(ctx => ctx.db.patch(rawEvidenceIds[0], { deletedAt: "2026-09-19T01:00:00.000Z" }));
  const selected = await choice();
  expect(await owner.mutation(api.discoveryReview.attach, { draftId, propId: b, expectedHash: selected.expectedHash })).toMatchObject({ processed: 2, skippedDeleted: 1 });
  expect((await t.run(ctx => ctx.db.query("proofs").collect())).map(proof => proof.rawEvidenceId)).toEqual([rawEvidenceIds[1]]);
});

test("large resolutions resume durably in bounded chunks and new ingestion follows the explicit target", async () => {
  const { t, owner, ownerId, draftId, a, b, choice, preserved } = await fixture(205);
  const before = await preserved();
  const selected = await choice();
  const initial = { draftId, propId: b, expectedHash: selected.expectedHash };
  expect(await owner.mutation(api.discoveryReview.attach, initial)).toMatchObject({ processed: 100, total: 205 });
  expect((await t.run(ctx => ctx.db.query("proofs").collect()))).toHaveLength(100);
  expect((await owner.query(api.discoveryReview.list, { paginationOpts: firstPage })).page).toMatchObject([{ id: draftId, progress: { processed: 100, total: 205 } }]);
  await t.mutation(internal.discovery.ingestSignals, { handle: "owner", sourceType: "GMAIL", sourceKey: "synthetic-account", signals: [{ sourceType: "GMAIL", vendor: "GitHub", capturedAt: "2026-09-19T02:00:00.000Z", payload: "Welcome", sourceRecordId: "new-message" }] });
  const draft = (await t.run(ctx => ctx.db.get(draftId)))!;
  expect(draft.resultPropId).toBe(b);
  expect(draft.rawEvidenceIds).toHaveLength(206);
  expect(draft.evidenceResolution?.rawEvidenceIds).toHaveLength(205);
  const fresh = t.withIdentity({ subject: "owner", tokenIdentifier: "fresh-session" });
  const step = await fresh.query(api.discoveryReview.details, { draftId });
  expect(await fresh.mutation(api.discoveryReview.attach, { draftId, propId: b, expectedHash: step.expectedHash! })).toMatchObject({ processed: 200, total: 205 });
  expect(await fresh.mutation(api.discoveryReview.attach, initial)).toMatchObject({ duplicate: true, processed: 200 });
  await expect(fresh.mutation(api.discoveryReview.attach, { ...initial, propId: a })).rejects.toThrow("different relationship");
  const last = await fresh.query(api.discoveryReview.details, { draftId });
  expect(await fresh.mutation(api.discoveryReview.attach, { draftId, propId: b, expectedHash: last.expectedHash! })).toMatchObject({ processed: 205, total: 205 });
  const after = await preserved();
  expect(after.props).toEqual(before.props);
  expect(after.publications).toEqual(before.publications);
  expect(after.events).toEqual(before.events);
  expect(after.links).toEqual(before.links);
  expect((await t.run(ctx => ctx.db.query("proofs").collect()))).toHaveLength(206);
  expect((await fresh.query(api.discoveryReview.list, { paginationOpts: firstPage })).page).toEqual([]);
  expect((await t.run(ctx => ctx.db.get(ownerId)))?.handle).toBe("owner");
});

test("unmapped originals remain reviewable when one or no matching relationship remains", async () => {
  const { t, owner, draftId, a, b } = await fixture();
  await t.run(ctx => ctx.db.delete(a));
  expect((await owner.query(api.discoveryReview.list, { paginationOpts: firstPage })).page).toMatchObject([{ id: draftId }]);
  expect((await owner.query(api.discoveryReview.candidates, { draftId, paginationOpts: firstPage })).page.map(item => item.id)).toEqual([b]);
  await t.run(ctx => ctx.db.delete(b));
  expect((await owner.query(api.discoveryReview.list, { paginationOpts: firstPage })).page).toMatchObject([{ id: draftId }]);
  expect((await owner.query(api.discoveryReview.candidates, { draftId, paginationOpts: firstPage })).page).toEqual([]);
});

test("unavailable canonical identity stays visible as unresolved and cannot be attached", async () => {
  const { t, owner, draftId, b, choice } = await fixture();
  const selected = await choice();
  await t.run(ctx => ctx.db.patch(draftId, { suggestedDomain: "wrong.example" }));
  expect((await owner.query(api.discoveryReview.list, { paginationOpts: firstPage })).page).toMatchObject([{ id: draftId, identityIssue: expect.stringContaining("product identity") }]);
  await expect(owner.mutation(api.discoveryReview.attach, { draftId, propId: b, expectedHash: selected.expectedHash })).rejects.toThrow("product identity");
});

test("draft and candidate pagination reaches every record without expanding requested bounds", async () => {
  const { t, owner, draftId, ownerId, productId } = await fixture();
  await t.run(async ctx => {
    const original = (await ctx.db.get(draftId))!;
    for (let i = 0; i < 22; i++) {
      await ctx.db.insert("draftImports", { userId: ownerId, status: "PENDING", suggestedProductSlug: "github", suggestedProductName: "GitHub", suggestedDomain: "github.com", suggestedDescription: "Code", suggestedUrl: "https://github.com", rawEvidenceIds: original.rawEvidenceIds });
      await ctx.db.insert("props", { userId: ownerId, productId, status: "TESTING", visibility: "DRAFT", headline: `Separate record ${i}`, note: "" });
    }
  });
  const drafts = [];
  let cursor: string | null = null;
  for (;;) {
    const page: FunctionReturnType<typeof api.discoveryReview.list> = await owner.query(api.discoveryReview.list, { paginationOpts: { numItems: 1000, cursor } });
    expect(page.page.length).toBeLessThanOrEqual(10);
    drafts.push(...page.page.map(item => item.id));
    if (page.isDone) break;
    cursor = page.continueCursor;
  }
  expect(new Set(drafts).size).toBe(23);
  const records = [];
  cursor = null;
  for (;;) {
    const page: FunctionReturnType<typeof api.discoveryReview.candidates> = await owner.query(api.discoveryReview.candidates, { draftId, paginationOpts: { numItems: 1000, cursor } });
    expect(page.page.length).toBeLessThanOrEqual(10);
    records.push(...page.page.map(item => item.id));
    if (page.isDone) break;
    cursor = page.continueCursor;
  }
  expect(new Set(records).size).toBe(24);
});

test("a privately confirmed relationship keeps its unfinished attachment reachable", async () => {
  const { owner, draftId, b, choice } = await fixture(101);
  const selected = await choice();
  await owner.mutation(api.discoveryReview.attach, { draftId, propId: b, expectedHash: selected.expectedHash });
  await owner.mutation(api.inventory.save, { propId: b, operationId: "owner-decision", expectedVersion: 1, status: "ACTIVE", goTo: false, headline: "Later owner decision", note: "Saved separately" });
  expect((await owner.query(api.discoveryReview.list, { paginationOpts: firstPage })).page).toMatchObject([{ id: draftId, progress: { processed: 100, total: 101 } }]);
  const next = await owner.query(api.discoveryReview.details, { draftId });
  expect(await owner.mutation(api.discoveryReview.attach, { draftId, propId: b, expectedHash: next.expectedHash! })).toMatchObject({ processed: 101, total: 101 });
});

test("an open candidate query becomes an empty terminal page when the owner binds the draft", async () => {
  const { owner, draftId, b, choice } = await fixture(101);
  const selected = await choice();
  await owner.mutation(api.discoveryReview.attach, { draftId, propId: b, expectedHash: selected.expectedHash });
  expect(await owner.query(api.discoveryReview.candidates, { draftId, paginationOpts: firstPage })).toEqual({ page: [], isDone: true, continueCursor: "" });
  expect((await owner.query(api.discoveryReview.details, { draftId })).target).toMatchObject({ id: b, headline: "Personal record" });
});

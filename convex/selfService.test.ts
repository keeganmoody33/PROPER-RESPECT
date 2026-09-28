// @vitest-environment edge-runtime
/// <reference types="vite/client" />
// R15: self-service deletion of originals, unpublish-all and data export.
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { collectPages } from "../src/client/export-data";

const modules = import.meta.glob("./**/*.ts");
const capturedAt = "2026-09-18T00:00:00.000Z";
const SECRET_TEXT = "RAW-ORIGINAL-PAYLOAD-SENTINEL";
const TOKEN = "TOKEN-IDENTIFIER-SENTINEL";

async function fixture({ props = 2 }: { props?: number } = {}) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { authSubject: "owner", handle: "owner", displayName: "Owner", bio: "My bio" });
    const otherUserId = await ctx.db.insert("users", { authSubject: "other", handle: "other", displayName: "Other", bio: "" });
    const productId = await ctx.db.insert("products", { name: "Shared Tool", slug: "shared-tool", domain: "shared.example", description: "Synthetic product" });
    const propIds: Id<"props">[] = [];
    for (let index = 0; index < props; index++) {
      const propId = await ctx.db.insert("props", {
        userId, productId, visibility: "PRIVATE", status: "ACTIVE", relationshipVersion: 1,
        confirmedAt: capturedAt, headline: `Relationship ${index + 1}`, note: `Note ${index + 1}`,
      });
      await ctx.db.insert("links", { propId, type: "CANONICAL", url: "https://shared.example", label: "Visit", isPrimary: true });
      await ctx.db.insert("relationshipEvents", {
        userId, propId, operationId: `op-${index}`, version: 1, recordedAt: capturedAt, basis: "OWNER_ASSERTED",
        before: { status: "ACTIVE", goTo: false, confirmed: false, headline: "", note: "" },
        after: { status: "ACTIVE", goTo: false, confirmed: true, headline: `Relationship ${index + 1}`, note: `Note ${index + 1}` },
        requestJson: "{}",
      });
      propIds.push(propId);
    }
    const sourceId = await ctx.db.insert("evidenceSources", { userId, type: "FILE_UPLOAD", label: "Owner upload", connectedAt: capturedAt });
    const storageId = await ctx.storage.store(new Blob([SECRET_TEXT], { type: "text/plain" }));
    const ticketId = await ctx.db.insert("uploadTickets", { userId, tokenIdentifier: TOKEN, filename: "receipt.txt", mimeType: "text/plain", byteSize: SECRET_TEXT.length, createdAt: 0, expiresAt: 1, storageId });
    const evidenceId = await ctx.db.insert("rawEvidence", {
      evidenceSourceId: sourceId, userId, payload: SECRET_TEXT, storageId, capturedAt, dedupKey: "owner-upload-1",
      filename: "receipt.txt", mimeType: "text/plain", byteSize: SECRET_TEXT.length,
      uploadAttribution: { status: "VERIFIED_OWNER_SESSION", userId, tokenIdentifier: TOKEN, ticketId, receivedAt: capturedAt, sha256: "a".repeat(64) },
    });
    const otherSourceId = await ctx.db.insert("evidenceSources", { userId: otherUserId, type: "FILE_UPLOAD", label: "Other upload", connectedAt: capturedAt });
    const otherStorageId = await ctx.storage.store(new Blob(["other"], { type: "text/plain" }));
    const otherEvidenceId = await ctx.db.insert("rawEvidence", {
      evidenceSourceId: otherSourceId, userId: otherUserId, payload: "other", storageId: otherStorageId, capturedAt, dedupKey: "other-upload-1",
    });
    return { userId, otherUserId, productId, propIds, evidenceId, storageId, otherEvidenceId, otherStorageId };
  });
  return { t, ...ids, owner: t.withIdentity({ subject: "owner" }), other: t.withIdentity({ subject: "other" }) };
}

test("deleting an original removes its stored object and its text", async () => {
  const { t, owner, evidenceId, storageId } = await fixture();
  await owner.mutation(api.onboarding.deleteEvidence, { evidenceId });
  const after = await t.run(async ctx => ({ row: await ctx.db.get(evidenceId), stored: (await ctx.storage.get(storageId)) !== null }));
  expect(after.stored).toBe(false);
  expect(after.row?.storageId).toBeUndefined();
  expect(after.row?.payload).toBeUndefined();
  expect(after.row?.deletedAt).toBeDefined();
});

test("another user can't delete your original", async () => {
  const { t, other, evidenceId, storageId } = await fixture();
  await expect(other.mutation(api.onboarding.deleteEvidence, { evidenceId })).rejects.toThrow("Evidence not found.");
  const after = await t.run(async ctx => ({ row: await ctx.db.get(evidenceId), stored: (await ctx.storage.get(storageId)) !== null }));
  expect(after.stored).toBe(true);
  expect(after.row?.payload).toBe(SECRET_TEXT);
  expect(after.row?.deletedAt).toBeUndefined();
});

test("the export returns only the caller's own records", async () => {
  const { owner, other, t, propIds, evidenceId, otherEvidenceId } = await fixture();
  const first = { paginationOpts: { numItems: 25, cursor: null } };
  const ownerRelationships = await owner.query(api.inventory.exportRelationships, first);
  const otherRelationships = await other.query(api.inventory.exportRelationships, first);
  expect(ownerRelationships.page.map(row => row.id).sort()).toEqual([...propIds].sort());
  expect(otherRelationships.page).toEqual([]);
  const ownerEvidence = await owner.query(api.inventory.exportEvidence, first);
  const otherEvidence = await other.query(api.inventory.exportEvidence, first);
  expect(ownerEvidence.page.map(row => row.id)).toEqual([evidenceId]);
  expect(otherEvidence.page.map(row => row.id)).toEqual([otherEvidenceId]);
  expect((await other.query(api.inventory.exportProfile, {})).handle).toBe("other");
  await expect(t.query(api.inventory.exportProfile, {})).rejects.toThrow("Authentication required.");
});

test("the export leaves out raw originals, storage references and tokens", async () => {
  const { owner } = await fixture();
  const evidence = await owner.query(api.inventory.exportEvidence, { paginationOpts: { numItems: 25, cursor: null } });
  const serialized = JSON.stringify(evidence.page);
  expect(serialized).not.toContain(SECRET_TEXT);
  expect(serialized).not.toContain(TOKEN);
  expect(evidence.page[0]).not.toHaveProperty("payload");
  expect(evidence.page[0]).not.toHaveProperty("storageId");
  expect(evidence.page[0]).not.toHaveProperty("uploadAttribution");
  expect(evidence.page[0]).toMatchObject({ filename: "receipt.txt", mimeType: "text/plain", sourceLabel: "Owner upload" });
  const relationships = await owner.query(api.inventory.exportRelationships, { paginationOpts: { numItems: 25, cursor: null } });
  expect(JSON.stringify(relationships.page)).not.toContain("requestJson");
});

test("an export larger than one page arrives complete", async () => {
  const { owner, propIds } = await fixture({ props: 12 });
  const rows = await collectPages(cursor => owner.query(api.inventory.exportRelationships, { paginationOpts: { numItems: 5, cursor } }));
  expect(rows).toHaveLength(12);
  expect(rows.map(row => row.id).sort()).toEqual([...propIds].sort());
  for (const row of rows) {
    expect(row.links).toHaveLength(1);
    expect(row.history).toHaveLength(1);
    expect(row.product).toMatchObject({ name: "Shared Tool", slug: "shared-tool" });
  }
});

async function publishAll(owner: Awaited<ReturnType<typeof fixture>>["owner"], t: Awaited<ReturnType<typeof fixture>>["t"], propIds: Id<"props">[]) {
  for (let start = 0; start < propIds.length; start += 100) {
    const selections = await Promise.all(propIds.slice(start, start + 100).map(async propId => {
      const prop = (await t.run(ctx => ctx.db.get(propId)))!;
      return { propId, expectedRelationshipVersion: prop.relationshipVersion ?? 0, publish: true, status: prop.status, headline: prop.headline, note: prop.note,
        primaryLink: { type: "CANONICAL" as const, url: "https://shared.example", label: "Visit" }, autoRefresh: false };
    }));
    const preview = await owner.query(api.onboarding.previewPublication, { selections });
    await owner.mutation(api.onboarding.publishSelected, { selections, expectedPublicationRevision: preview.revision, expectedPreviewHash: preview.previewHash });
  }
}

async function removeAllCards(owner: Awaited<ReturnType<typeof fixture>>["owner"]) {
  const preview = await owner.query(api.onboarding.previewPublication, { selections: [], removeAllCards: true });
  expect(preview.profile.cards).toEqual([]);
  await owner.mutation(api.onboarding.publishSelected, { selections: [], removeAllCards: true, expectedPublicationRevision: preview.revision, expectedPreviewHash: preview.previewHash });
  return preview;
}

const publishedProfile = (t: Awaited<ReturnType<typeof fixture>>["t"]) =>
  t.run(ctx => ctx.db.query("publishedProfiles").withIndex("by_handle", q => q.eq("handle", "owner")).unique());

test("unpublish all removes every card and keeps the profile fields public", async () => {
  const { owner, t, propIds } = await fixture();
  await publishAll(owner, t, propIds);
  const preview = await removeAllCards(owner);
  expect(preview.profile).toMatchObject({ handle: "owner", displayName: "Owner", bio: "My bio" });
  const published = await publishedProfile(t);
  expect(published?.profile.cards).toEqual([]);
  expect(published?.cardPropIds).toEqual([]);
  expect(published?.profile).toMatchObject({ handle: "owner", displayName: "Owner", bio: "My bio" });
  const props = await t.run(ctx => Promise.all(propIds.map(propId => ctx.db.get(propId))));
  expect(props.every(prop => prop?.visibility === "PRIVATE")).toBe(true);
});

test("unpublish all removes older cards that can't be matched to a relationship", async () => {
  const { owner, t, propIds } = await fixture();
  await publishAll(owner, t, propIds);
  const before = await publishedProfile(t);
  // An older publication stored no relationship identity for its cards.
  await t.run(ctx => ctx.db.patch(before!._id, { cardPropIds: undefined }));
  const state = await owner.query(api.onboarding.getState, { includeClaims: false });
  expect(state!.cards.some(card => card.isPublishedAtCurrentHandle)).toBe(false);
  await removeAllCards(owner);
  expect((await publishedProfile(t))?.profile.cards).toEqual([]);
  const props = await t.run(ctx => Promise.all(propIds.map(propId => ctx.db.get(propId))));
  expect(props.every(prop => prop?.visibility === "PRIVATE")).toBe(true);
});

test("unpublish all works for more than 100 relationships in one step", async () => {
  const { owner, t, propIds } = await fixture({ props: 101 });
  await publishAll(owner, t, propIds);
  expect((await publishedProfile(t))?.profile.cards).toHaveLength(101);
  await removeAllCards(owner);
  expect((await publishedProfile(t))?.profile.cards).toEqual([]);
});

test("a remove-all preview can't approve a different publish, and remove-all takes no other changes", async () => {
  const { owner, t, propIds } = await fixture();
  await publishAll(owner, t, propIds);
  const preview = await owner.query(api.onboarding.previewPublication, { selections: [], removeAllCards: true });
  await expect(owner.mutation(api.onboarding.publishSelected, { selections: [], expectedPublicationRevision: preview.revision, expectedPreviewHash: preview.previewHash }))
    .rejects.toThrow("The sharing preview changed");
  const prop = (await t.run(ctx => ctx.db.get(propIds[0])))!;
  await expect(owner.query(api.onboarding.previewPublication, { removeAllCards: true, selections: [{ propId: propIds[0], expectedRelationshipVersion: prop.relationshipVersion ?? 0, publish: false, status: prop.status, headline: prop.headline, note: prop.note, autoRefresh: false }] }))
    .rejects.toThrow("Remove all cards on its own");
  expect((await publishedProfile(t))?.profile.cards).toHaveLength(2);
});

test("the export says exactly when a relationship's history was cut off", async () => {
  const { owner, t, userId, propIds } = await fixture({ props: 2 });
  const [exact, over] = propIds;
  await t.run(async ctx => {
    // Each relationship already has one event; top them up to 1,000 and 1,001.
    for (const [propId, count] of [[exact, 999], [over, 1000]] as const) {
      for (let index = 0; index < count; index++) {
        await ctx.db.insert("relationshipEvents", {
          userId, propId, operationId: `extra-${index}`, version: index + 2, recordedAt: capturedAt, basis: "OWNER_ASSERTED",
          before: { status: "ACTIVE", goTo: false, confirmed: true, headline: "", note: "" },
          after: { status: "ACTIVE", goTo: false, confirmed: true, headline: "", note: "" }, requestJson: "{}",
        });
      }
    }
  });
  const rows = await collectPages(cursor => owner.query(api.inventory.exportRelationships, { paginationOpts: { numItems: 10, cursor } }));
  const byId = new Map(rows.map(row => [row.id, row]));
  expect(byId.get(exact)).toMatchObject({ historyComplete: true });
  expect(byId.get(exact)!.history).toHaveLength(1000);
  expect(byId.get(over)).toMatchObject({ historyComplete: false });
  expect(byId.get(over)!.history).toHaveLength(1000);
  expect(byId.get(exact)).toMatchObject({ linksComplete: true });
});

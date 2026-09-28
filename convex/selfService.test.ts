// @vitest-environment edge-runtime
/// <reference types="vite/client" />
// R15: self-service deletion of originals, unpublish-all and data export.
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { unpublishAllSelections } from "../src/domain/review";
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

test("unpublish all removes every card and keeps the profile fields public", async () => {
  const { owner, t, propIds } = await fixture();
  const publishArgs = async (selections: unknown[]) => {
    const preview = await owner.query(api.onboarding.previewPublication, { selections } as never);
    return { selections, expectedPublicationRevision: preview.revision, expectedPreviewHash: preview.previewHash } as never;
  };
  const publishSelections = await Promise.all(propIds.map(async propId => {
    const prop = await t.run(ctx => ctx.db.get(propId));
    return { propId, expectedRelationshipVersion: prop?.relationshipVersion ?? 0, publish: true, status: prop!.status, headline: prop!.headline, note: prop!.note,
      primaryLink: { type: "CANONICAL" as const, url: "https://shared.example", label: "Visit" }, autoRefresh: false };
  }));
  await owner.mutation(api.onboarding.publishSelected, await publishArgs(publishSelections));
  const state = await owner.query(api.onboarding.getState, { includeClaims: false });
  const cards = state!.cards.flatMap(card => card.product ? [{ ...card, product: card.product }] : []);
  const selections = unpublishAllSelections(cards, true);
  expect(selections.map(selection => selection.propId).sort()).toEqual([...propIds].sort());
  const preview = await owner.query(api.onboarding.previewPublication, { selections });
  expect(preview.profile.cards).toEqual([]);
  expect(preview.profile).toMatchObject({ handle: "owner", displayName: "Owner", bio: "My bio" });
  await owner.mutation(api.onboarding.publishSelected, await publishArgs(selections));
  const published = await t.run(ctx => ctx.db.query("publishedProfiles").withIndex("by_handle", q => q.eq("handle", "owner")).unique());
  expect(published?.profile.cards).toEqual([]);
  expect(published?.profile).toMatchObject({ handle: "owner", displayName: "Owner", bio: "My bio" });
  const props = await t.run(ctx => Promise.all(propIds.map(propId => ctx.db.get(propId))));
  expect(props.every(prop => prop?.visibility === "PRIVATE")).toBe(true);
});

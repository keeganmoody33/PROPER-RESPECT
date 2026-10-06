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
const ARTIFACT_HASH = "c".repeat(64);

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
      // What evidenceUpload stores: the storage id as the artifact reference.
      captureProvenance: { version: 1, route: "UPLOAD", adapter: { id: "evidence-upload", version: "2" },
        origin: { issuer: "OWNER_SUPPLIED_FILE", artifactRef: storageId }, collector: { kind: "UNKNOWN" }, activityActor: { kind: "UNKNOWN" } },
      retainedArtifact: { kind: "GITHUB_ACTIVITY", sourceFile: "activity.json", sha256: ARTIFACT_HASH, byteLength: 10, sourceCapturedDate: "2026-09-17", sourceCaptureBasis: "RETAINED_SOURCE_DATE", preparedAt: capturedAt, adapterVersion: "1" },
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
  const { owner, storageId } = await fixture();
  const evidence = await owner.query(api.inventory.exportEvidence, { paginationOpts: { numItems: 25, cursor: null } });
  const serialized = JSON.stringify(evidence.page);
  expect(serialized).not.toContain(SECRET_TEXT);
  expect(serialized).not.toContain(TOKEN);
  expect(serialized).not.toContain(ARTIFACT_HASH);
  expect(serialized).not.toContain(storageId);
  const [row] = evidence.page;
  if ("deletedAt" in row) throw new Error("The fixture original isn't deleted.");
  expect(row.captureProvenance).toMatchObject({ route: "UPLOAD", origin: { issuer: "OWNER_SUPPLIED_FILE" } });
  expect(row.captureProvenance?.origin).not.toHaveProperty("artifactRef");
  expect(row.retainedArtifact).toMatchObject({ kind: "GITHUB_ACTIVITY", sourceFile: "activity.json", sourceCapturedDate: "2026-09-17" });
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

test("unpublish all refuses at preview, with a way forward, above its supported size", async () => {
  const { owner, t, propIds } = await fixture({ props: 1001 });
  await publishAll(owner, t, propIds.slice(0, 1));
  // Mark every relationship public directly; publishing 1,001 cards isn't what this tests.
  await t.run(async ctx => { for (const propId of propIds) await ctx.db.patch(propId, { visibility: "PUBLIC" }); });
  await expect(owner.query(api.onboarding.previewPublication, { selections: [], removeAllCards: true }))
    .rejects.toThrow("Unpublish all handles up to 1,000 public cards and daily refreshes at once");
  await t.run(async ctx => ctx.db.patch(propIds[0], { visibility: "PRIVATE" }));
  const preview = await owner.query(api.onboarding.previewPublication, { selections: [], removeAllCards: true });
  expect(preview.profile.cards).toEqual([]);
});

test("the export shows the public page as visitors see it", async () => {
  const { owner, t, propIds } = await fixture();
  await publishAll(owner, t, propIds);
  const stored = (await publishedProfile(t))!;
  // A card link stored before the http(s) rule is dropped when the page is read.
  const cards = stored.profile.cards.map((card, index) => index === 0
    ? { ...card, primaryLink: { ...card.primaryLink!, url: "javascript:alert(1)" } } : card);
  await t.run(ctx => ctx.db.patch(stored._id, { profile: { ...stored.profile, cards } }));
  const live = (await owner.query(api.inventory.exportProfile, {})).publicPage;
  expect(live).toMatchObject({ revision: stored.revision, takenDown: false });
  expect(JSON.stringify(live)).not.toContain("javascript:");
  expect(live?.profile?.cards).toHaveLength(cards.length);

  await t.run(ctx => ctx.db.patch(stored._id, { takenDownAt: "2026-09-28T00:00:00.000Z", takedownReason: "Operator note" }));
  const takenDown = (await owner.query(api.inventory.exportProfile, {})).publicPage;
  expect(takenDown).toMatchObject({ revision: stored.revision, takenDown: true, profile: null });
  expect(JSON.stringify(takenDown)).not.toContain("Operator note");
});

test("unpublish all can't create a first publication", async () => {
  const { owner, t } = await fixture();
  const refusal = "There is no published page to remove cards from.";
  await expect(owner.query(api.onboarding.previewPublication, { selections: [], removeAllCards: true })).rejects.toThrow(refusal);
  await expect(owner.mutation(api.onboarding.publishSelected, {
    selections: [], removeAllCards: true, expectedPublicationRevision: 0, expectedPreviewHash: "any",
  })).rejects.toThrow(refusal);
  expect(await publishedProfile(t)).toBeNull();
});

test("unpublish all refuses at preview while the page is taken down", async () => {
  const { owner, t, propIds } = await fixture();
  await publishAll(owner, t, propIds);
  const published = (await publishedProfile(t))!;
  await t.run(ctx => ctx.db.patch(published._id, { takenDownAt: "2026-09-28T00:00:00.000Z", takedownReason: "Operator note" }));
  await expect(owner.query(api.onboarding.previewPublication, { selections: [], removeAllCards: true }))
    .rejects.toThrow("This profile is under review. Contact 33@lecturesfrom.com.");
  expect((await publishedProfile(t))?.profile.cards).toHaveLength(published.profile.cards.length);
});

test("unpublish all revokes every daily refresh the owner approved, and only theirs", async () => {
  const { owner, t, propIds, userId, otherUserId } = await fixture();
  await publishAll(owner, t, propIds);
  const earlier = "2026-09-01T00:00:00.000Z";
  const ids = await t.run(async ctx => {
    const connector = (user: typeof userId) => ctx.db.insert("connectorAccounts", {
      userId: user, provider: "GITHUB", status: "CONNECTED", accountLabel: "octocat", attributionScope: "PERSONAL", connectedAt: capturedAt,
    });
    const connectorId = await connector(userId);
    const subscription = (propId: Id<"props">, revokedAt?: string) => ctx.db.insert("metricSubscriptions", {
      userId, propId, connectorId, metricKey: "github.contributions", attributionScope: "PERSONAL", refreshCadence: "DAILY", approvedAt: capturedAt,
      ...(revokedAt ? { revokedAt } : {}),
    });
    const active = [await subscription(propIds[0]), await subscription(propIds[1])];
    const alreadyRevoked = await subscription(propIds[0], earlier);
    const otherPropId = await ctx.db.insert("props", {
      userId: otherUserId, productId: (await ctx.db.get(propIds[0]))!.productId, visibility: "PUBLIC", status: "ACTIVE",
      relationshipVersion: 1, confirmedAt: capturedAt, headline: "Other", note: "",
    });
    const others = await ctx.db.insert("metricSubscriptions", {
      userId: otherUserId, propId: otherPropId, connectorId: await connector(otherUserId), metricKey: "github.contributions",
      attributionScope: "PERSONAL", refreshCadence: "DAILY", approvedAt: capturedAt,
    });
    return { active, alreadyRevoked, others };
  });
  await removeAllCards(owner);
  const rows = await t.run(async ctx => ({
    active: await Promise.all(ids.active.map(id => ctx.db.get(id))),
    alreadyRevoked: await ctx.db.get(ids.alreadyRevoked),
    others: await ctx.db.get(ids.others),
  }));
  expect(rows.active.every(row => typeof row?.revokedAt === "string")).toBe(true);
  expect(rows.alreadyRevoked?.revokedAt).toBe(earlier);
  expect(rows.others?.revokedAt).toBeUndefined();
});

test("a deleted original exports only that it existed and when it was deleted", async () => {
  const { owner, t, evidenceId } = await fixture();
  await t.run(ctx => ctx.db.patch(evidenceId, { sourceUrl: "https://mail.example/message/42", detectedUrl: "https://shared.example/account", detectedVendor: "Shared Tool" }));
  await owner.mutation(api.onboarding.deleteEvidence, { evidenceId });
  const rows = await collectPages(cursor => owner.query(api.inventory.exportEvidence, { paginationOpts: { numItems: 10, cursor } }));
  const row = rows.find(item => item.id === evidenceId)!;
  expect(Object.keys(row).sort()).toEqual(["capturedAt", "deletedAt", "id", "sourceLabel", "sourceType"]);
  const serialized = JSON.stringify(rows);
  for (const identifying of ["receipt.txt", "mail.example", "shared.example/account", "activity.json"]) expect(serialized).not.toContain(identifying);
});

// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { authSubject: "owner", handle: "owner", displayName: "Owner", bio: "Approved bio" });
    const otherId = await ctx.db.insert("users", { authSubject: "other", handle: "other", displayName: "Other", bio: "" });
    return { userId, otherId };
  });
  const owner = t.withIdentity({ subject: "owner" });
  const preview = await owner.query(api.onboarding.previewPublication, { selections: [] });
  const approval = { selections: [], expectedPublicationRevision: preview.revision, expectedPreviewHash: preview.previewHash };
  return { t, owner, ...ids, approval };
}

test("a published handle cannot be renamed and its approved public identity remains intact", async () => {
  const { t, owner, userId, approval } = await fixture();
  await owner.mutation(api.onboarding.publishSelected, approval);
  const before = await t.query(api.publicProfiles.getByHandleV2, { handle: "owner" });
  await expect(owner.mutation(api.onboarding.claimHandle, { handle: "renamed", displayName: "Renamed", bio: "New bio" })).rejects.toThrow("published handle");
  expect(await t.run(ctx => ctx.db.get(userId))).toMatchObject({ handle: "owner", displayName: "Owner", bio: "Approved bio" });
  expect(await t.query(api.publicProfiles.getByHandleV2, { handle: "owner" })).toEqual(before);
  expect(await t.query(api.publicProfiles.getByHandleV2, { handle: "renamed" })).toBeNull();
});

test("an orphaned public handle cannot be claimed by another account", async () => {
  const { t, owner, userId, otherId, approval } = await fixture();
  await owner.mutation(api.onboarding.publishSelected, approval);
  await t.run(ctx => ctx.db.patch(userId, { handle: "already-renamed" }));
  const other = t.withIdentity({ subject: "other" });
  const before = await t.query(api.publicProfiles.getByHandleV2, { handle: "owner" });
  await expect(other.mutation(api.onboarding.claimHandle, { handle: "owner", displayName: "Other", bio: "" })).rejects.toThrow("published profile");
  expect(await t.run(ctx => ctx.db.get(otherId))).toMatchObject({ handle: "other" });
  expect(await t.query(api.publicProfiles.getByHandleV2, { handle: "owner" })).toEqual(before);
});

test("an owner can save the same published handle without replacing its approved identity", async () => {
  const { t, owner, userId, approval } = await fixture();
  await owner.mutation(api.onboarding.publishSelected, approval);
  expect(await owner.mutation(api.onboarding.claimHandle, { handle: "owner", displayName: "Private updated name", bio: "Private updated bio" })).toEqual({ handle: "owner" });
  expect(await t.run(ctx => ctx.db.get(userId))).toMatchObject({ handle: "owner", displayName: "Private updated name" });
  expect(await t.query(api.publicProfiles.getByHandleV2, { handle: "owner" })).toMatchObject({ displayName: "Owner", bio: "Approved bio" });
});

test("an unpublished owner can change to an available handle", async () => {
  const { t, owner, userId } = await fixture();
  expect(await owner.mutation(api.onboarding.claimHandle, { handle: "available", displayName: "Owner", bio: "" })).toEqual({ handle: "available" });
  expect(await t.run(ctx => ctx.db.get(userId))).toMatchObject({ handle: "available" });
});

test.each(["both", "revision", "hash"])("publication rejects missing %s preview proof before writing", async missing => {
  const { t, owner, approval } = await fixture();
  const args = { ...approval } as Record<string, unknown>;
  if (missing === "both" || missing === "revision") delete args.expectedPublicationRevision;
  if (missing === "both" || missing === "hash") delete args.expectedPreviewHash;
  await expect(owner.mutation(makeFunctionReference<"mutation">("onboarding:publishSelected"), args)).rejects.toThrow();
  expect(await t.query(api.publicProfiles.getByHandleV2, { handle: "owner" })).toBeNull();
  await owner.mutation(api.onboarding.publishSelected, approval);
  expect(await t.query(api.publicProfiles.getByHandleV2, { handle: "owner" })).toMatchObject({ handle: "owner", displayName: "Owner", cards: [] });
});

test.each(["unpublished", "published", "orphaned"] as const)("account creation avoids a %s pending-handle reservation and remains idempotent", async reservation => {
  const { t, owner, userId } = await fixture();
  await owner.mutation(api.onboarding.claimHandle, { handle: "pending-victim123", displayName: "Owner", bio: "Approved bio" });
  if (reservation !== "unpublished") {
    const preview = await owner.query(api.onboarding.previewPublication, { selections: [] });
    await owner.mutation(api.onboarding.publishSelected, { selections: [], expectedPublicationRevision: preview.revision, expectedPreviewHash: preview.previewHash });
  }
  if (reservation === "orphaned") await t.run(ctx => ctx.db.patch(userId, { handle: "already-renamed" }));
  const publicBefore = await t.query(api.publicProfiles.getByHandleV2, { handle: "pending-victim123" });
  const newcomer = t.withIdentity({ subject: "victim123" });
  const newcomerId = await newcomer.mutation(api.onboarding.ensureAccount, { displayName: "New owner" });
  expect(await t.run(ctx => ctx.db.get(newcomerId))).toMatchObject({ handle: "pending-victim123-1", displayName: "New owner" });
  expect(await newcomer.mutation(api.onboarding.ensureAccount, { displayName: "Ignored repeat" })).toBe(newcomerId);
  expect(await t.run(ctx => ctx.db.query("users").withIndex("by_auth_subject", q => q.eq("authSubject", "victim123")).collect())).toHaveLength(1);
  const newcomerPreview = await newcomer.query(api.onboarding.previewPublication, { selections: [] });
  expect(newcomerPreview.profile).toMatchObject({ handle: "pending-victim123-1", displayName: "New owner", cards: [] });
  await newcomer.mutation(api.onboarding.publishSelected, { selections: [], expectedPublicationRevision: newcomerPreview.revision, expectedPreviewHash: newcomerPreview.previewHash });
  expect(await t.query(api.publicProfiles.getByHandleV2, { handle: "pending-victim123" })).toEqual(publicBefore);
  expect(await t.query(api.publicProfiles.getByHandleV2, { handle: "pending-victim123-1" })).toMatchObject({ displayName: "New owner" });
});

test("preexisting duplicate handle owners cannot preview or replace a publication", async () => {
  const { t, owner, otherId, approval } = await fixture();
  await owner.mutation(api.onboarding.publishSelected, approval);
  const fresh = await owner.query(api.onboarding.previewPublication, { selections: [] });
  await t.run(ctx => ctx.db.patch(otherId, { handle: "owner" }));
  const before = await t.run(ctx => ctx.db.query("publishedProfiles").collect());
  for (const actor of [owner, t.withIdentity({ subject: "other" })]) {
    await expect(actor.query(api.onboarding.previewPublication, { selections: [] })).rejects.toThrow("unique owner");
    await expect(actor.mutation(api.onboarding.publishSelected, { selections: [], expectedPublicationRevision: fresh.revision, expectedPreviewHash: fresh.previewHash })).rejects.toThrow("unique owner");
  }
  expect(await t.run(ctx => ctx.db.query("publishedProfiles").collect())).toEqual(before);
  expect(await t.query(api.publicProfiles.getByHandleV2, { handle: "owner" })).toMatchObject({ displayName: "Owner", bio: "Approved bio" });
});

test("exhausted pending-handle reservations fail without creating or changing an account", async () => {
  const t = convexTest(schema, modules);
  await t.run(async ctx => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const handle = attempt === 0 ? "pending-collision" : `pending-collision-${attempt}`;
      if (attempt % 2 === 0) {
        await ctx.db.insert("users", { authSubject: `reserved-${attempt}`, handle, displayName: "Existing owner", bio: "" });
      } else {
        await ctx.db.insert("publishedProfiles", { handle, revision: 1, publishedAt: "2026-09-19T00:00:00.000Z", profile: { handle, displayName: "Retained owner", bio: "", cards: [] } });
      }
    }
  });
  const before = await t.run(async ctx => ({ users: await ctx.db.query("users").collect(), publications: await ctx.db.query("publishedProfiles").collect() }));
  const newcomer = t.withIdentity({ subject: "collision" });
  await expect(newcomer.mutation(api.onboarding.ensureAccount, {})).rejects.toThrow("No account was created");
  expect(await t.run(async ctx => ({ users: await ctx.db.query("users").collect(), publications: await ctx.db.query("publishedProfiles").collect() }))).toEqual(before);
  const available = t.withIdentity({ subject: "available" });
  const availableId = await available.mutation(api.onboarding.ensureAccount, { displayName: "Available owner" });
  expect(await t.run(ctx => ctx.db.get(availableId))).toMatchObject({ handle: "pending-available", displayName: "Available owner" });
});

test("profile links are owner edits, preserve old callers, and require a new exact preview to publish", async () => {
  const { t, owner, userId, otherId, approval } = await fixture();
  await owner.mutation(api.onboarding.publishSelected, approval);
  const oldPreview = await owner.query(api.onboarding.previewPublication, { selections: [] });
  const profileLinks = [{ label: "My LinkedIn", url: "https://www.linkedin.com/in/example" }, { label: "Website", url: "https://example.com" }];
  await owner.mutation(api.onboarding.claimHandle, { handle: "owner", displayName: "Owner", bio: "", profileLinks, preferredLinkUrl: profileLinks[0].url });
  expect(await t.run(ctx => ctx.db.get(otherId))).not.toHaveProperty("profileLinks");
  expect(await t.query(api.publicProfiles.getByHandleV2, { handle: "owner" })).not.toHaveProperty("profileLinks");
  await expect(owner.mutation(api.onboarding.publishSelected, { selections: [], expectedPublicationRevision: oldPreview.revision, expectedPreviewHash: oldPreview.previewHash })).rejects.toThrow("preview changed");
  await owner.mutation(api.onboarding.claimHandle, { handle: "owner", displayName: "New name", bio: "" });
  expect(await t.run(ctx => ctx.db.get(userId))).toMatchObject({ profileLinks, preferredLinkUrl: profileLinks[0].url });
  const preview = await owner.query(api.onboarding.previewPublication, { selections: [] });
  expect(preview.profile).toMatchObject({ profileLinks, preferredLinkUrl: profileLinks[0].url });
  await owner.mutation(api.onboarding.publishSelected, { selections: [], expectedPublicationRevision: preview.revision, expectedPreviewHash: preview.previewHash });
  expect(await t.query(api.publicProfiles.getByHandleV2, { handle: "owner" })).toMatchObject({ profileLinks, preferredLinkUrl: profileLinks[0].url });
  await owner.mutation(api.onboarding.claimHandle, { handle: "owner", displayName: "New name", bio: "", profileLinks: [], preferredLinkUrl: null });
  expect(await t.run(ctx => ctx.db.get(userId))).not.toHaveProperty("preferredLinkUrl");
  expect(await t.query(api.publicProfiles.getByHandleV2, { handle: "owner" })).toMatchObject({ profileLinks });
});

test.each(["javascript:alert(1)", "data:text/html,hello", "https://user:secret@example.com", "ftp://example.com"])("rejects unsafe profile link %s without changing identity", async url => {
  const { t, owner, userId } = await fixture();
  const before = await t.run(ctx => ctx.db.get(userId));
  await expect(owner.mutation(api.onboarding.claimHandle, { handle: "owner", displayName: "Changed", bio: "", profileLinks: [{ label: "Test", url }] })).rejects.toThrow();
  expect(await t.run(ctx => ctx.db.get(userId))).toEqual(before);
});

test("name destination must be explicitly selected from bounded profile links", async () => {
  const { t, owner, userId } = await fixture();
  const values = { handle: "owner", displayName: "Owner", bio: "" };
  await expect(owner.mutation(api.onboarding.claimHandle, { ...values, profileLinks: [], preferredLinkUrl: "https://example.com" })).rejects.toThrow("saved profile links");
  await expect(owner.mutation(api.onboarding.claimHandle, { ...values, profileLinks: Array.from({ length: 9 }, () => ({ label: "Site", url: "https://example.com" })) })).rejects.toThrow();
  await owner.mutation(api.onboarding.claimHandle, { ...values, profileLinks: [{ label: "Site", url: "https://example.com" }] });
  expect(await t.run(ctx => ctx.db.get(userId))).not.toHaveProperty("preferredLinkUrl");
  await expect(t.mutation(api.onboarding.claimHandle, { ...values, profileLinks: [] })).rejects.toThrow();
  const other = t.withIdentity({ subject: "other" });
  await expect(other.mutation(api.onboarding.claimHandle, { ...values, profileLinks: [] })).rejects.toThrow("already claimed");
});

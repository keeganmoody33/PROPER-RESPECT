// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const preview = makeFunctionReference<"query">("accountRecovery:previewHandleRestoration");
const restore = makeFunctionReference<"mutation">("accountRecovery:restoreHandle");

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { seedKey: "original", authSubject: "verified-owner", handle: "renamed", displayName: "Saved name", bio: "Saved bio", updatedAt: "2026-09-01T00:00:00.000Z", onboardingStatus: "PUBLISHED" });
    const otherId = await ctx.db.insert("users", { authSubject: "other-owner", handle: "other", displayName: "Other", bio: "" });
    const siteId = await ctx.db.insert("sites", { seedKey: "original-hosted-site", ownerId: userId, handle: "renamed", status: "ACTIVE" });
    const product = { slug: "example", domain: "example.test", name: "Example", description: "Synthetic product" };
    const productId = await ctx.db.insert("products", product);
    const propId = await ctx.db.insert("props", { userId, productId, visibility: "PUBLIC", status: "ACTIVE", headline: "Approved headline", note: "Approved explanation", startedAt: "2024-01-01", relationshipVersion: 3 });
    const privatePropId = await ctx.db.insert("props", { userId, productId, visibility: "PRIVATE", status: "ACTIVE", headline: "Private source", note: "Keep private" });
    const linkId = await ctx.db.insert("links", { propId, type: "CANONICAL", url: "https://example.test/owner", label: "Owner account", isPrimary: true });
    const publicationId = await ctx.db.insert("publishedProfiles", { handle: "original", revision: 4, publishedAt: "2026-08-01T00:00:00.000Z", profile: { handle: "original", displayName: "Approved name", bio: "Approved bio", cards: [{ product, status: "ACTIVE", headline: "Approved headline", note: "Approved explanation", startedAt: "2024-01-01", primaryLink: { type: "CANONICAL", url: "https://example.test/owner", label: "Owner account" } }] } });
    return { userId, otherId, siteId, publicationId, propId, privatePropId, productId, linkId };
  });
  const args = { userId: ids.userId, siteId: ids.siteId, publicationId: ids.publicationId, expectedSubject: "verified-owner", expectedSeedKey: "original", fromHandle: "renamed", toHandle: "original", expectedCardPropIds: [ids.propId] };
  const snapshot = () => t.run(async ctx => ({ users: await ctx.db.query("users").collect(), sites: await ctx.db.query("sites").collect(), publications: await ctx.db.query("publishedProfiles").collect(), props: await ctx.db.query("props").collect(), links: await ctx.db.query("links").collect(), products: await ctx.db.query("products").collect(), events: await ctx.db.query("relationshipEvents").collect() }));
  const approval = async () => {
    const result = await t.query(preview, args);
    return { ...args, expectedBeforeFingerprint: result.beforeFingerprint, expectedAfterFingerprint: result.afterFingerprint };
  };
  return { t, ids, args, snapshot, approval };
}

test("preview is read-only; restoration changes exactly two handles and replay changes nothing", async () => {
  const { t, ids, args, snapshot, approval } = await fixture();
  const before = await snapshot();
  const proposed = await t.query(preview, args);
  expect(proposed.status).toBe("ready");
  expect(proposed.changes).toEqual([{ table: "users", field: "handle", from: "renamed", to: "original" }, { table: "sites", field: "handle", from: "renamed", to: "original" }]);
  expect(await snapshot()).toEqual(before);
  const request = await approval();
  expect(await t.mutation(restore, request)).toEqual({ status: "restored" });
  const expected = { ...before, users: before.users.map(u => u._id === ids.userId ? { ...u, handle: "original" } : u), sites: before.sites.map(s => s._id === ids.siteId ? { ...s, handle: "original" } : s) };
  expect(await snapshot()).toEqual(expected);
  expect(await t.mutation(restore, request)).toEqual({ status: "already-restored" });
  expect(await snapshot()).toEqual(expected);
  expect((await t.query(preview, args)).status).toBe("already-restored");
  const freshOwner = t.withIdentity({ subject: "verified-owner" });
  expect((await freshOwner.query(api.onboarding.getState, {}))?.user.handle).toBe("original");
  expect((await snapshot()).publications[0].cardPropIds).toBeUndefined();
});

test("public claim cannot perform restoration before or after adding the operator path", async () => {
  const { t, snapshot } = await fixture();
  const before = await snapshot();
  await expect(t.withIdentity({ subject: "verified-owner" }).mutation(api.onboarding.claimHandle, { handle: "original", displayName: "Saved name", bio: "Saved bio" })).rejects.toThrow("published profile");
  expect(await snapshot()).toEqual(before);
});

test.each(["user", "site", "publication", "prop", "product"])("rejects stale %s state atomically", async changed => {
  const { t, ids, snapshot, approval } = await fixture();
  const request = await approval();
  await t.run(async ctx => {
    if (changed === "user") await ctx.db.patch(ids.userId, { bio: "New private bio" });
    if (changed === "site") await ctx.db.patch(ids.siteId, { status: "DRAFT" });
    if (changed === "publication") await ctx.db.patch(ids.publicationId, { revision: 5 });
    if (changed === "prop") await ctx.db.patch(ids.propId, { relationshipVersion: 4 });
    if (changed === "product") await ctx.db.patch(ids.productId, { description: "Changed description" });
  });
  const before = await snapshot();
  await expect(t.mutation(restore, request)).rejects.toThrow();
  expect(await snapshot()).toEqual(before);
});

test.each(["subject", "seed", "foreign-site", "private-card", "foreign-card", "mixed-state", "wrong-embedded-handle", "explicit-card-mismatch", "empty-card-selection", "wrong-publication"])("rejects %s preconditions without writing", async issue => {
  const { t, ids, args, snapshot } = await fixture();
  const request = { ...args };
  await t.run(async ctx => {
    if (issue === "subject") request.expectedSubject = "other-owner";
    if (issue === "seed") request.expectedSeedKey = "not-original";
    if (issue === "foreign-site") await ctx.db.patch(ids.siteId, { ownerId: ids.otherId });
    if (issue === "private-card") request.expectedCardPropIds = [ids.privatePropId];
    if (issue === "foreign-card") await ctx.db.patch(ids.propId, { userId: ids.otherId });
    if (issue === "mixed-state") await ctx.db.patch(ids.userId, { handle: "original" });
    if (issue === "wrong-embedded-handle") {
      const pub = (await ctx.db.get(ids.publicationId))!;
      await ctx.db.patch(ids.publicationId, { profile: { ...pub.profile, handle: "different" } });
    }
    if (issue === "explicit-card-mismatch") await ctx.db.patch(ids.publicationId, { cardPropIds: [ids.privatePropId] });
    if (issue === "empty-card-selection") request.expectedCardPropIds = [];
    if (issue === "wrong-publication") await ctx.db.patch(ids.publicationId, { handle: "different" });
  });
  const before = await snapshot();
  await expect(t.query(preview, request)).rejects.toThrow();
  expect(await snapshot()).toEqual(before);
});

test.each(["destination-user", "source-user", "destination-site", "source-site", "second-owned-site", "duplicate-subject", "duplicate-seed", "duplicate-publication", "source-publication"])("rejects %s introduced after review", async conflict => {
  const { t, ids, snapshot, approval } = await fixture();
  const request = await approval();
  await t.run(async ctx => {
    if (conflict === "destination-user" || conflict === "source-user") await ctx.db.patch(ids.otherId, { handle: conflict === "destination-user" ? "original" : "renamed" });
    if (conflict === "destination-site" || conflict === "source-site") await ctx.db.insert("sites", { ownerId: ids.otherId, handle: conflict === "destination-site" ? "original" : "renamed", status: "DRAFT" });
    if (conflict === "second-owned-site") await ctx.db.insert("sites", { ownerId: ids.userId, handle: "unrelated", status: "DRAFT" });
    if (conflict === "duplicate-subject") await ctx.db.patch(ids.otherId, { authSubject: "verified-owner" });
    if (conflict === "duplicate-seed") await ctx.db.patch(ids.otherId, { seedKey: "original" });
    if (conflict === "duplicate-publication" || conflict === "source-publication") {
      const pub = (await ctx.db.get(ids.publicationId))!;
      const handle = conflict === "source-publication" ? "renamed" : "original";
      await ctx.db.insert("publishedProfiles", { handle, revision: pub.revision, publishedAt: pub.publishedAt, profile: { ...pub.profile, handle } });
    }
  });
  const before = await snapshot();
  await expect(t.mutation(restore, request)).rejects.toThrow();
  expect(await snapshot()).toEqual(before);
});

test("already-restored replay still rejects later drift and a changed approval", async () => {
  const { t, ids, snapshot, approval } = await fixture();
  const request = await approval();
  await t.mutation(restore, request);
  await expect(t.mutation(restore, { ...request, expectedAfterFingerprint: "0".repeat(64) })).rejects.toThrow();
  await t.run(ctx => ctx.db.patch(ids.userId, { bio: "Later owner edit" }));
  const before = await snapshot();
  await expect(t.mutation(restore, request)).rejects.toThrow();
  expect(await snapshot()).toEqual(before);
});

test.each(["expectedBeforeFingerprint", "expectedAfterFingerprint"] as const)("rejects an incorrect %s before making either change", async field => {
  const { t, snapshot, approval } = await fixture();
  const request = await approval();
  const before = await snapshot();
  await expect(t.mutation(restore, { ...request, [field]: "0".repeat(64) })).rejects.toThrow();
  expect(await snapshot()).toEqual(before);
});

test("preserves an existing explicit card mapping", async () => {
  const { t, ids, snapshot, approval } = await fixture();
  await t.run(ctx => ctx.db.patch(ids.publicationId, { cardPropIds: [ids.propId] }));
  const before = await snapshot();
  await t.mutation(restore, await approval());
  expect((await snapshot()).publications).toEqual(before.publications);
});

test("rejects duplicate reviewed correspondence even when the stored cards repeat", async () => {
  const { t, ids, args, snapshot } = await fixture();
  await t.run(async ctx => {
    const publication = (await ctx.db.get(ids.publicationId))!;
    await ctx.db.patch(ids.publicationId, { profile: { ...publication.profile, cards: [...publication.profile.cards, ...publication.profile.cards] } });
  });
  const before = await snapshot();
  await expect(t.query(preview, { ...args, expectedCardPropIds: [ids.propId, ids.propId] })).rejects.toThrow();
  expect(await snapshot()).toEqual(before);
});

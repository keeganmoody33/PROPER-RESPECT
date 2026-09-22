// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { e2eReferenceProfile } from "../src/data/e2e-reference-profile";
import { canonicalJson } from "../src/domain/canonical-json";
import { sha256 } from "../src/domain/product-knowledge";

const modules = import.meta.glob("./**/*.ts");
const migrate = makeFunctionReference<"mutation">("publicationMigration:moveSeededPublication");
async function fixture() {
  const t = convexTest(schema, modules);
  const profile = { ...e2eReferenceProfile, handle: "keegan" };
  const ids = await t.run(async ctx => {
    const ownerId = await ctx.db.insert("users", { handle: "lecturesfrom", seedKey: "keegan", authSubject: "owner-subject", displayName: "Private name", bio: "Private bio" });
    const productId = await ctx.db.insert("products", { name: "Private tool", slug: "private-tool", domain: "private.example", description: "Never published" });
    await ctx.db.insert("props", { userId: ownerId, productId, status: "TESTING", visibility: "PRIVATE", headline: "Private decision", note: "Do not publish this" });
    await ctx.db.insert("sites", { ownerId, handle: "lecturesfrom", seedKey: "keegan-hosted-site", status: "ACTIVE" });
    const publicationId = await ctx.db.insert("publishedProfiles", { handle: "keegan", profile, revision: 4, publishedAt: "2026-07-25T00:00:00.000Z" });
    return { ownerId, publicationId };
  });
  const args = { ...ids, expectedSubject: "owner-subject", expectedSeedKey: "keegan", fromHandle: "keegan", toHandle: "lecturesfrom", expectedRevision: 4, expectedProfileHash: await sha256(canonicalJson(profile)), dryRun: true };
  return { t, args, profile };
}

test("dry run is read-only; migration preserves approved fields, private identity and idempotent replay", async () => {
  const { t, args, profile } = await fixture();
  const before = await t.run(async ctx => ({ user: await ctx.db.get(args.ownerId), sites: await ctx.db.query("sites").collect(), props: await ctx.db.query("props").collect(), publication: await ctx.db.get(args.publicationId) }));
  expect(await t.mutation(migrate, args)).toMatchObject({ status: "ready", cardCount: profile.cards.length });
  expect(await t.run(ctx => ctx.db.get(args.publicationId))).toEqual(before.publication);
  expect(await t.mutation(migrate, { ...args, dryRun: false })).toMatchObject({ status: "migrated" });
  expect(await t.run(ctx => ctx.db.get(args.publicationId))).toEqual({ ...before.publication, handle: "lecturesfrom", profile: { ...profile, handle: "lecturesfrom" }, revision: 5 });
  expect(await t.run(ctx => ctx.db.get(args.ownerId))).toEqual(before.user);
  expect(await t.run(ctx => ctx.db.query("sites").collect())).toEqual(before.sites);
  expect(await t.run(ctx => ctx.db.query("props").collect())).toEqual(before.props);
  expect(await t.mutation(migrate, { ...args, dryRun: false })).toMatchObject({ status: "already-migrated" });
  const current = await t.query(api.publicProfiles.getByHandleV2, { handle: "lecturesfrom" });
  expect(current?.cards).toEqual(profile.cards);
  expect(await t.query(api.publicProfiles.getByHandleV2, { handle: "keegan" })).toEqual(current);
  const preview = await t.withIdentity({ subject: "owner-subject" }).query(api.onboarding.previewPublication, { selections: [] });
  expect(preview.profile.cards).toEqual(profile.cards);
});

test("migration preserves unresolved card identities without guessing a relationship", async () => {
  const { t, args, profile } = await fixture();
  const unresolved = profile.cards.map(() => null);
  await t.run(ctx => ctx.db.patch(args.publicationId, { cardPropIds: unresolved }));
  await t.mutation(migrate, { ...args, dryRun: false });
  expect((await t.run(ctx => ctx.db.get(args.publicationId)))?.cardPropIds).toEqual(unresolved);
});

test.each([
  { expectedSubject: "wrong" },
  { expectedSeedKey: "wrong" },
  { expectedRevision: 3 },
  { expectedProfileHash: "changed" },
  { toHandle: "someone-else" },
  { fromHandle: "lecturesfrom" },
])("rejects stale or incorrect preconditions without writing: %j", async change => {
  const { t, args } = await fixture();
  const before = await t.run(ctx => ctx.db.get(args.publicationId));
  await expect(t.mutation(migrate, { ...args, ...change, dryRun: false })).rejects.toThrow();
  expect(await t.run(ctx => ctx.db.get(args.publicationId))).toEqual(before);
});

test.each(["target publication", "old owner", "duplicate target", "foreign site"])("rejects %s conflict atomically", async conflict => {
  const { t, args, profile } = await fixture();
  await t.run(async ctx => {
    if (conflict === "target publication") await ctx.db.insert("publishedProfiles", { handle: "lecturesfrom", profile: { ...profile, handle: "lecturesfrom" }, revision: 1, publishedAt: "2026-07-25T00:00:00.000Z" });
    else if (conflict === "foreign site") {
      const site = await ctx.db.query("sites").withIndex("by_owner", q => q.eq("ownerId", args.ownerId)).unique();
      await ctx.db.patch(site!._id, { seedKey: "wrong" });
    } else await ctx.db.insert("users", { handle: conflict === "old owner" ? "keegan" : "lecturesfrom", authSubject: "other", displayName: "Other", bio: "" });
  });
  const before = await t.run(ctx => ctx.db.get(args.publicationId));
  await expect(t.mutation(migrate, { ...args, dryRun: false })).rejects.toThrow();
  expect(await t.run(ctx => ctx.db.get(args.publicationId))).toEqual(before);
});

test("migrated handle stays reserved and publication resolves through one alias", async () => {
  const { t, args } = await fixture();
  await t.mutation(migrate, { ...args, dryRun: false });
  await t.run(ctx => ctx.db.insert("users", { handle: "other", authSubject: "other", displayName: "Other", bio: "" }));
  await expect(t.withIdentity({ subject: "other" }).mutation(api.onboarding.claimHandle, { handle: "keegan", displayName: "Other", bio: "" })).rejects.toThrow("reserved");
});

test.each(["source", "target"])("rejects an existing %s alias without writes", async side => {
  const { t, args } = await fixture();
  await t.run(ctx => ctx.db.insert("publicProfileAliases", { handle: side === "source" ? "keegan" : "lecturesfrom", targetHandle: "other", ownerId: args.ownerId, publicationId: args.publicationId, createdAt: "2026-09-22T00:00:00.000Z" }));
  const before = await t.run(ctx => ctx.db.get(args.publicationId));
  await expect(t.mutation(migrate, { ...args, dryRun: false })).rejects.toThrow();
  expect(await t.run(ctx => ctx.db.get(args.publicationId))).toEqual(before);
});

test("broken aliases and chains cannot expose a different publication", async () => {
  const { t, args } = await fixture();
  await t.mutation(migrate, { ...args, dryRun: false });
  await t.run(ctx => ctx.db.insert("publicProfileAliases", { handle: "lecturesfrom", targetHandle: "keegan", ownerId: args.ownerId, publicationId: args.publicationId, createdAt: "2026-09-22T00:00:00.000Z" }));
  expect(await t.query(api.publicProfiles.getByHandleV2, { handle: "keegan" })).toBeNull();
  expect(await t.query(api.publicProfiles.getByHandleV2, { handle: "lecturesfrom" })).toBeNull();
});

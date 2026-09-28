// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { e2eReferenceProfile } from "../src/data/e2e-reference-profile";

const modules = import.meta.glob("./**/*.ts");
const reason = "Report 2026-09-28: impersonation claim";

async function fixture() {
  const t = convexTest(schema, modules);
  const profile = { ...e2eReferenceProfile, handle: "owner" };
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { authSubject: "owner", handle: "owner", displayName: "Owner", bio: "" });
    const productId = await ctx.db.insert("products", { name: "Shared Tool", slug: "shared-tool", domain: "shared.example", description: "Synthetic product" });
    const propId = await ctx.db.insert("props", {
      userId, productId, visibility: "PRIVATE", status: "ACTIVE", relationshipVersion: 1,
      confirmedAt: "2026-09-18T00:00:00.000Z", headline: "Relationship", note: "Approved note",
    });
    const publicationId = await ctx.db.insert("publishedProfiles", {
      handle: "owner", revision: 3, publishedAt: "2026-09-18T00:00:00.000Z", profile,
    });
    await ctx.db.insert("publicProfileAliases", {
      handle: "old-owner", targetHandle: "owner", ownerId: userId, publicationId, createdAt: "2026-09-19T00:00:00.000Z",
    });
    return { userId, propId, publicationId };
  });
  const state = () => t.run(async ctx => ({
    users: await ctx.db.query("users").collect(),
    props: await ctx.db.query("props").collect(),
    publications: await ctx.db.query("publishedProfiles").collect(),
    aliases: await ctx.db.query("publicProfileAliases").collect(),
    sites: await ctx.db.query("sites").collect(),
    links: await ctx.db.query("links").collect(),
  }));
  const read = async (handle: string) => ({
    v1: await t.query(api.publicProfiles.getByHandle, { handle }),
    v2: await t.query(api.publicProfiles.getByHandleV2, { handle }),
  });
  return { t, profile, ...ids, state, read };
}

test("a takedown hides the profile and its alias, and keeps the snapshot for restore", async () => {
  const { t, profile, publicationId, state, read } = await fixture();
  expect((await read("owner")).v2).toEqual(profile);
  expect((await read("old-owner")).v2).toEqual(profile);
  const before = await state();

  expect(await t.mutation(internal.publicProfiles.takeDownHandle, { handle: "owner", reason, dryRun: false }))
    .toMatchObject({ status: "taken-down", handle: "owner", revision: 3, cardCount: profile.cards.length });
  expect(await read("owner")).toEqual({ v1: null, v2: null });
  expect(await read("old-owner")).toEqual({ v1: null, v2: null });

  const publication = await t.run(ctx => ctx.db.get(publicationId));
  expect(publication).toMatchObject({ takedownReason: reason, revision: 3, profile });
  expect(Date.parse(publication?.takenDownAt ?? "")).not.toBeNaN();
  expect({ ...publication, takenDownAt: undefined, takedownReason: undefined }).toEqual(before.publications[0]);
});

test("a takedown dry run changes nothing", async () => {
  const { t, state, read, profile } = await fixture();
  const before = await state();
  expect(await t.mutation(internal.publicProfiles.takeDownHandle, { handle: "owner", reason, dryRun: true }))
    .toMatchObject({ status: "ready", handle: "owner" });
  expect(await state()).toEqual(before);
  expect((await read("owner")).v2).toEqual(profile);
});

test("a report naming an old handle takes down the profile its alias points to", async () => {
  const { t, read } = await fixture();
  expect(await t.mutation(internal.publicProfiles.takeDownHandle, { handle: "old-owner", reason, dryRun: false }))
    .toMatchObject({ status: "taken-down", handle: "owner" });
  expect(await read("owner")).toEqual({ v1: null, v2: null });
});

test("a takedown refuses an unknown handle and an empty reason without writing", async () => {
  const { t, state } = await fixture();
  const before = await state();
  await expect(t.mutation(internal.publicProfiles.takeDownHandle, { handle: "nobody", reason, dryRun: false }))
    .rejects.toThrow("No published profile has that handle.");
  await expect(t.mutation(internal.publicProfiles.takeDownHandle, { handle: "owner", reason: "   ", dryRun: false }))
    .rejects.toThrow("Record why the profile is being taken down.");
  expect(await state()).toEqual(before);
});

test("repeating a takedown keeps the first record", async () => {
  const { t, publicationId } = await fixture();
  await t.mutation(internal.publicProfiles.takeDownHandle, { handle: "owner", reason, dryRun: false });
  const first = await t.run(ctx => ctx.db.get(publicationId));
  expect(await t.mutation(internal.publicProfiles.takeDownHandle, { handle: "owner", reason: "Second report", dryRun: false }))
    .toMatchObject({ status: "already-taken-down", takenDownAt: first?.takenDownAt, takedownReason: reason });
  expect(await t.run(ctx => ctx.db.get(publicationId))).toEqual(first);
});

test("publishing is refused while the profile is taken down", async () => {
  const { t, propId, state } = await fixture();
  await t.mutation(internal.publicProfiles.takeDownHandle, { handle: "owner", reason, dryRun: false });
  const owner = t.withIdentity({ subject: "owner" });
  const selections = [{
    propId, expectedRelationshipVersion: 1, publish: true, status: "ACTIVE" as const,
    headline: "Relationship", note: "Approved note",
    primaryLink: { type: "CANONICAL" as const, url: "https://shared.example", label: "Visit" }, autoRefresh: false,
  }];
  const preview = await owner.query(api.onboarding.previewPublication, { selections });
  const before = await state();
  await expect(owner.mutation(api.onboarding.publishSelected, {
    selections, expectedPublicationRevision: preview.revision, expectedPreviewHash: preview.previewHash,
  })).rejects.toThrow("This profile is under review.");
  expect(await state()).toEqual(before);
});

test("restore returns the profile; its dry run and a repeat change nothing", async () => {
  const { t, profile, state, read } = await fixture();
  const original = await state();
  await t.mutation(internal.publicProfiles.takeDownHandle, { handle: "owner", reason, dryRun: false });
  const takenDown = await state();

  expect(await t.mutation(internal.publicProfiles.restoreHandle, { handle: "owner", dryRun: true }))
    .toMatchObject({ status: "ready", handle: "owner", takedownReason: reason });
  expect(await state()).toEqual(takenDown);

  expect(await t.mutation(internal.publicProfiles.restoreHandle, { handle: "owner", dryRun: false }))
    .toMatchObject({ status: "restored", handle: "owner" });
  expect(await state()).toEqual(original);
  expect(await read("owner")).toEqual({ v1: profile, v2: profile });
  expect((await read("old-owner")).v2).toEqual(profile);

  expect(await t.mutation(internal.publicProfiles.restoreHandle, { handle: "owner", dryRun: false }))
    .toMatchObject({ status: "not-taken-down" });
  expect(await state()).toEqual(original);
});

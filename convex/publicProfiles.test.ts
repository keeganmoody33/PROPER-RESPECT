// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { e2eReferenceProfile } from "../src/data/e2e-reference-profile";
import { publicProfileV1Schema, type PublicProfile } from "../src/domain/public-profile";

const modules = import.meta.glob("./**/*.ts");

test("both public query versions preserve existing curated cards without changing retained publication", async () => {
  const t = convexTest(schema, modules);
  const id = await t.run(ctx => ctx.db.insert("publishedProfiles", {
    handle: e2eReferenceProfile.handle,
    revision: 1,
    publishedAt: "2026-09-18T00:00:00.000Z",
    profile: e2eReferenceProfile,
  }));
  const before = await t.run(ctx => ctx.db.get(id));
  const args = { handle: e2eReferenceProfile.handle };

  const legacy = await t.query(api.publicProfiles.getByHandle, args);
  expect(legacy).toEqual(e2eReferenceProfile);
  expect(publicProfileV1Schema.parse(legacy)).toEqual(e2eReferenceProfile);
  expect(await t.query(api.publicProfiles.getByHandleV2, args)).toEqual(e2eReferenceProfile);
  expect(await t.run(ctx => ctx.db.get(id))).toEqual(before);
});

test("linkless and domainless published products stay visible to v2 without breaking legacy readers", async () => {
  const t = convexTest(schema, modules);
  const linked = e2eReferenceProfile.cards[0];
  const profile: PublicProfile = {
    handle: "owner", displayName: "Owner", bio: "",
    cards: [
      linked,
      {
        product: { name: "Owner's tool", slug: "owner-tool", domain: "", description: "" },
        status: "TESTING", headline: "A tool I am testing", note: "Owner description",
      },
      { ...linked, primaryLink: undefined },
      { ...linked, product: { ...linked.product, domain: "" } },
    ],
  };
  const id = await t.run(ctx => ctx.db.insert("publishedProfiles", {
    handle: profile.handle, revision: 1, publishedAt: "2026-09-18T00:00:00.000Z", profile,
  }));
  const before = await t.run(ctx => ctx.db.get(id));
  const args = { handle: profile.handle };

  const legacy = await t.query(api.publicProfiles.getByHandle, args);
  expect(legacy).toEqual({ ...profile, cards: [linked] });
  // This is the property access the already-deployed card renderer performs.
  expect(legacy?.cards.map(card => card.primaryLink.url)).toEqual([linked.primaryLink?.url]);
  expect(publicProfileV1Schema.safeParse(legacy).success).toBe(true);
  expect(await t.query(api.publicProfiles.getByHandleV2, args)).toEqual(profile);
  expect(await t.run(ctx => ctx.db.get(id))).toEqual(before);
});

test("neither public query version creates a profile for an unknown handle", async () => {
  const t = convexTest(schema, modules);
  expect(await t.query(api.publicProfiles.getByHandle, { handle: "missing" })).toBeNull();
  expect(await t.query(api.publicProfiles.getByHandleV2, { handle: "missing" })).toBeNull();
  expect(await t.run(ctx => ctx.db.query("publishedProfiles").collect())).toEqual([]);
});

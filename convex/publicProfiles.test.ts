// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { productBrandSnapshotSchema } from "../src/domain/product-brand";
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

test("public reads omit unsupported embedded parent brands without rewriting published records", async () => {
  const receipt = (await import("../docs/verification/fixtures/2026-09-17-context-brands/github.json")).default;
  const t = convexTest(schema, modules);
  const identities = [
    { slug: "github-copilot", name: "GitHub Copilot", domain: "github.com" },
    { slug: "devin-desktop", name: "Devin Desktop", domain: "devin.ai" },
    { slug: "notebooklm", name: "NotebookLM", domain: "notebooklm.google.com" },
    { slug: "manual-notebooklm-existing", name: "NotebookLM", domain: "notebooklm.google.com" },
  ];
  const cards: PublicProfile["cards"] = identities.map(identity => ({
    product: { ...identity, description: "Saved product description", brand: productBrandSnapshotSchema.parse({ ...receipt.snapshot, productSlug: identity.slug, canonicalDomain: identity.domain }) },
    status: "TESTING", headline: "Owner explanation", note: "Owner history",
    primaryLink: { type: "CANONICAL", url: `https://${identity.domain}`, label: "Visit" },
  }));
  const ordinary = e2eReferenceProfile.cards[0];
  const unknown = { ...cards[0], product: { ...cards[0].product, slug: "unknown-tool", name: "Unknown tool", domain: "unknown.example" } };
  const knownUnbranded = { ...cards[2], product: { ...identities[2], description: "Unbranded existing card" } };
  const profile: PublicProfile = { handle: "owner", displayName: "Owner", bio: "", cards: [...cards, ordinary, unknown, knownUnbranded] };
  // Published snapshots can outlive catalog rows: eligibility must use the saved identity too.
  const id = await t.run(ctx => ctx.db.insert("publishedProfiles", { handle: "owner", revision: 7, publishedAt: "2026-09-19T00:00:00.000Z", profile }));
  const before = await t.run(ctx => ctx.db.get(id));
  for (const endpoint of [api.publicProfiles.getByHandle, api.publicProfiles.getByHandleV2]) {
    const displayed = await t.query(endpoint, { handle: "owner" });
    expect(displayed?.cards).toHaveLength(profile.cards.length);
    for (const [index, card] of cards.entries()) {
      const product = { ...card.product };
      delete product.brand;
      expect(displayed?.cards[index]).toEqual({ ...card, product });
    }
    expect(displayed?.cards.slice(cards.length)).toEqual([ordinary, unknown, knownUnbranded]);
  }
  expect(await t.run(ctx => ctx.db.get(id))).toEqual(before);
  expect(await t.run(ctx => ctx.db.query("productBrandSnapshots").collect())).toEqual([]);
  expect(await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toEqual([]);
});


test("100 repeated cards share retained brand reads while mismatched domains remain untouched", async () => {
  const { readPublishedProfile } = await import("./publicProfiles");
  const receipt = (await import("../docs/verification/fixtures/2026-09-17-context-brands/wisprflow.json")).default;
  const t = convexTest(schema, modules);
  const card = { product: receipt.product, status: "TESTING", headline: "Published explanation", note: "Owner wording" } as const;
  const profile = { handle: "owner", displayName: "Owner", bio: "", cards: [
    ...Array.from({ length: 99 }, () => card),
    { ...card, product: { ...card.product, domain: "different.example" } },
  ] };
  const id = await t.run(async ctx => {
    const productId = await ctx.db.insert("products", receipt.product);
    const currentSnapshotId = await ctx.db.insert("productBrandSnapshots", {
      productId, generation: 1, snapshot: productBrandSnapshotSchema.parse(receipt.snapshot), responseJson: JSON.stringify(receipt.response),
    });
    await ctx.db.insert("productBrandJobs", { productId, canonicalDomain: receipt.product.domain,
      generation: 1, status: "READY", requestedAt: 1, currentSnapshotId });
    return ctx.db.insert("publishedProfiles", { handle: "owner", revision: 1, publishedAt: "2026-09-18T00:00:00Z", profile });
  });
  await t.run(async ctx => {
    const query = vi.spyOn(ctx.db, "query");
    const get = vi.spyOn(ctx.db, "get");
    try {
      const displayed = await readPublishedProfile(ctx, "owner");
      expect(displayed?.cards).toHaveLength(100);
      expect(displayed?.cards[0].product.brand).toEqual(receipt.snapshot);
      expect(displayed?.cards[99]).toEqual(profile.cards[99]);
      expect(query.mock.calls.map(([table]) => table)).toEqual(["publishedProfiles", "products", "productBrandJobs"]);
      expect(get).toHaveBeenCalledTimes(1);
    } finally { query.mockRestore(); get.mockRestore(); }
  });
  expect((await t.run(ctx => ctx.db.get(id)))?.profile).toEqual(profile);
});

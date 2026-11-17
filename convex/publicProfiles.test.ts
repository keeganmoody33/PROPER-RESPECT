// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";
import { canonicalJson } from "../src/domain/canonical-json";
import { sha256 } from "../src/domain/product-knowledge";
import { productBrandSnapshotSchema } from "../src/domain/product-brand";
import { e2eReferenceProfile } from "../src/data/e2e-reference-profile";
import { publicProfileV1Schema, type PublicProfile } from "../src/domain/public-profile";
import { LISTED_TOOLS_MAX } from "../src/domain/search-listing";

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
      expect(query.mock.calls.map(([table]) => table)).toEqual(["publicProfileAliases", "publishedProfiles", "products", "productBrandJobs"]);
      expect(get).toHaveBeenCalledTimes(1);
    } finally { query.mockRestore(); get.mockRestore(); }
  });
  expect((await t.run(ctx => ctx.db.get(id)))?.profile).toEqual(profile);
});

test.each(["javascript:alert(1)", "data:text/html,x", "https://user:pass@example.com/"])("a stored %s link or avatar never leaves the public reader", async url => {
  const t = convexTest(schema, modules);
  const [linked] = e2eReferenceProfile.cards;
  const profile: PublicProfile = {
    handle: "owner", displayName: "Owner", bio: "", avatarUrl: url,
    cards: [{ ...linked, primaryLink: { type: "CANONICAL", url, label: "Visit" } }, linked],
  };
  await t.run(ctx => ctx.db.insert("publishedProfiles", { handle: "owner", revision: 1, publishedAt: "2026-09-18T00:00:00.000Z", profile }));
  const current = await t.query(api.publicProfiles.getByHandleV2, { handle: "owner" });
  const legacy = await t.query(api.publicProfiles.getByHandle, { handle: "owner" });
  expect(JSON.stringify([current, legacy])).not.toContain(url);
  expect(current?.cards).toHaveLength(2);
  expect(current?.cards[0].primaryLink).toBeUndefined();
  expect(current?.cards[1].primaryLink).toEqual(linked.primaryLink);
  expect(legacy?.cards.map(card => card.primaryLink.url)).toEqual([linked.primaryLink?.url]);
});

test.each(["javascript:alert(1)", "data:text/html,x", "ftp://x.example/file", "https://user:pass@example.com/"])("a stored %s artifact link never leaves the public reader", async url => {
  const t = convexTest(schema, modules);
  const [linked] = e2eReferenceProfile.cards;
  const good = { title: "Good artifact", url: "https://example.com/good" };
  const profile: PublicProfile = {
    handle: "owner", displayName: "Owner", bio: "",
    cards: [{ ...linked, activity: {
      kind: "artifactCollection", attributionScope: "PERSONAL", capturedAt: "2026-09-18T00:00:00.000Z", freshness: "FRESH",
      provenanceLabel: "Synthetic artifacts", total: 2, artifacts: [{ title: "Bad artifact", url }, good],
    } }],
  };
  const id = await t.run(ctx => ctx.db.insert("publishedProfiles", { handle: "owner", revision: 1, publishedAt: "2026-09-18T00:00:00.000Z", profile }));
  const before = await t.run(ctx => ctx.db.get(id));
  const current = await t.query(api.publicProfiles.getByHandleV2, { handle: "owner" });
  const legacy = await t.query(api.publicProfiles.getByHandle, { handle: "owner" });
  expect(JSON.stringify([current, legacy])).not.toContain(url);
  for (const read of [current, legacy]) expect(read?.cards[0].activity).toMatchObject({ kind: "artifactCollection", total: 2, artifacts: [good] });
  expect(await t.run(ctx => ctx.db.get(id))).toEqual(before);
});

test("stored profile links that aren't plain http(s) never leave the public reader", async () => {
  const t = convexTest(schema, modules);
  const profile: PublicProfile = {
    handle: "owner", displayName: "Owner", bio: "", cards: [],
    profileLinks: [
      { label: "Bad script", url: "javascript:alert(1)" },
      { label: "Bad data", url: "data:text/html,x" },
      { label: "Website", url: "https://owner.example/" },
    ],
    preferredLinkUrl: "javascript:alert(1)",
  };
  await t.run(ctx => ctx.db.insert("publishedProfiles", { handle: "owner", revision: 1, publishedAt: "2026-09-18T00:00:00.000Z", profile }));
  const current = await t.query(api.publicProfiles.getByHandleV2, { handle: "owner" });
  expect(current?.profileLinks).toEqual([{ label: "Website", url: "https://owner.example/" }]);
  expect(current?.preferredLinkUrl).toBeUndefined();
  expect(JSON.stringify(current)).not.toMatch(/javascript:|data:text/);
});

test("a stored preferred link that is still valid stays preferred", async () => {
  const t = convexTest(schema, modules);
  const profile: PublicProfile = {
    handle: "owner", displayName: "Owner", bio: "", cards: [],
    profileLinks: [{ label: "Bad", url: "javascript:alert(1)" }, { label: "Website", url: "https://owner.example/" }],
    preferredLinkUrl: "https://owner.example/",
  };
  await t.run(ctx => ctx.db.insert("publishedProfiles", { handle: "owner", revision: 1, publishedAt: "2026-09-18T00:00:00.000Z", profile }));
  expect(await t.query(api.publicProfiles.getByHandleV2, { handle: "owner" })).toMatchObject({
    profileLinks: [{ label: "Website", url: "https://owner.example/" }], preferredLinkUrl: "https://owner.example/",
  });
});

test("a stored avatar link over 2,048 characters never leaves the public reader", async () => {
  const t = convexTest(schema, modules);
  const avatarUrl = `https://img.example/${"a".repeat(2049 - "https://img.example/".length)}`;
  const profile: PublicProfile = { handle: "owner", displayName: "Owner", bio: "", avatarUrl, cards: [] };
  await t.run(ctx => ctx.db.insert("publishedProfiles", { handle: "owner", revision: 1, publishedAt: "2026-09-18T00:00:00.000Z", profile }));
  expect((await t.query(api.publicProfiles.getByHandleV2, { handle: "owner" }))?.avatarUrl).toBeUndefined();
});

test("a stored card keeps a known level, drops an unknown one, and a card without one still reads", async () => {
  const t = convexTest(schema, modules);
  const linked = e2eReferenceProfile.cards[0];
  const stored = {
    handle: "levels", displayName: "Levels", bio: "",
    cards: [
      { ...linked, status: "ACTIVE" as const, level: "DAILY" },
      { ...linked, status: "ACTIVE" as const, level: "RETIRED_LEVEL" },
      { ...linked, status: "ARCHIVED" as const },
    ],
  };
  const id = await t.run(ctx => ctx.db.insert("publishedProfiles", { handle: "levels", revision: 1, publishedAt: "2026-11-12T00:00:00.000Z", profile: stored }));
  const before = await t.run(ctx => ctx.db.get(id));
  const read = await t.query(api.publicProfiles.getByHandleV2, { handle: "levels" });
  expect(read?.cards.map(card => [card.status, card.level])).toEqual([["ACTIVE", "DAILY"], ["ACTIVE", undefined], ["ARCHIVED", undefined]]);
  expect(read?.cards[1]).not.toHaveProperty("level");
  const legacy = await t.query(api.publicProfiles.getByHandle, { handle: "levels" });
  expect(legacy?.cards.map(card => card.level)).toEqual(["DAILY", undefined, undefined]);
  expect(await t.run(ctx => ctx.db.get(id))).toEqual(before);
});

test("the reserved-handle check names a reserved word an account already holds, and nothing else", async () => {
  const t = convexTest(schema, modules);
  expect(await t.query(internal.publicProfiles.reservedHandlesHeld, {})).toEqual([]);
  await t.run(async ctx => {
    await ctx.db.insert("users", { handle: "tools", displayName: "Synthetic holder", bio: "" });
    await ctx.db.insert("users", { handle: "not-reserved", displayName: "Synthetic other", bio: "" });
  });
  expect(await t.query(internal.publicProfiles.reservedHandlesHeld, {})).toEqual([{ handle: "tools", heldBy: ["account"] }]);
});

// Search read model (C1). Synthetic people only.
const confirmedAt = "2026-11-01T00:00:00.000Z";
const SEARCH_QUERY_MAX = 80;
const SEARCH_WORDS_MAX = 16;
const SEARCH_RESULTS_MAX = 24;
const CURSOR_MAX = 200;
const OVER_CAP = 30;
const MONTHLY_PRICE = 4321;
type SearchAccount = Pick<TestConvex<typeof schema>, "query" | "mutation">;
type SearchProps = Partial<Omit<Doc<"props">, "_id" | "_creationTime" | "userId" | "productId">>;

async function searchFixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const person = async (handle: string, displayName: string) => {
      const userId = await ctx.db.insert("users", { authSubject: handle, handle, displayName, bio: "A private bio line" });
      await ctx.db.insert("sites", { ownerId: userId, handle, status: "DRAFT" });
      return userId;
    };
    const product = (slug: string, name: string) => ctx.db.insert("products", { slug, name, domain: `${slug}.example`, description: "Synthetic product" });
    return {
      sam: await person("synthetic-sam", "Synthetic Sam"), ria: await person("synthetic-ria", "Synthetic Ria"), abe: await person("synthetic-abe", "Synthetic Abe"),
      clay: await product("clay", "Clay"), github: await product("github", "GitHub"), notion: await product("notion", "Notion"), linear: await product("linear", "Linear"),
    };
  });
  const addProp = (userId: Id<"users">, productId: Id<"products">, fields: SearchProps = {}) => t.run(ctx => ctx.db.insert("props", {
    userId, productId, visibility: "PRIVATE", status: "ACTIVE", level: "DAILY", relationshipVersion: 1, confirmedAt,
    headline: "A synthetic headline", note: "A synthetic note", ...fields,
  }));
  const selection = async (propId: Id<"props">, publish: boolean) => {
    const prop = (await t.run(ctx => ctx.db.get(propId)))!;
    return { propId, expectedRelationshipVersion: prop.relationshipVersion, publish, status: prop.status, level: prop.level,
      headline: prop.headline, note: prop.note, autoRefresh: false };
  };
  const publish = async (account: SearchAccount, choices: [Id<"props">, boolean][], extra: { removeAllCards?: boolean } = {}) => {
    const selections = await Promise.all(choices.map(([propId, shown]) => selection(propId, shown)));
    const preview = await account.query(api.onboarding.previewPublication, { selections, ...extra });
    await account.mutation(api.onboarding.publishSelected, { selections, ...extra, expectedPublicationRevision: preview.revision, expectedPreviewHash: preview.previewHash });
  };
  const model = () => t.run(async ctx => ({
    pages: (await ctx.db.query("listedPages").collect()).map(({ handle, displayName, sortName, searchText }) => ({ handle, displayName, sortName, searchText })),
    cards: (await ctx.db.query("listedCards").collect()).map(({ handle, productSlug, usedBefore, levelLabel }) => [handle, productSlug, usedBefore, levelLabel]),
    tools: (await ctx.db.query("listedTools").collect()).map(({ productSlug, productName, peopleNow, peopleBefore, people }) => [productSlug, productName, peopleNow, peopleBefore, people]),
  }));
  const as = (handle: string) => t.withIdentity({ subject: handle });
  return { t, ...ids, addProp, publish, model, as };
}

test("publishing lists only the page's published cards: a draft, a private card, words and a cost never enter search", async () => {
  const f = await searchFixture();
  const clay = await f.addProp(f.sam, f.clay, { cost: { amount: MONTHLY_PRICE, currency: "USD", cadence: "MONTHLY", basis: "OWNER_REPORTED", asOf: "2026-11-01" }, costVisibility: "PUBLIC" });
  const github = await f.addProp(f.sam, f.github, { status: "ARCHIVED", level: "STOPPED" });
  await f.addProp(f.sam, f.notion);
  await f.addProp(f.sam, f.linear, { visibility: "DRAFT", confirmedAt: undefined });
  await f.publish(f.as("synthetic-sam"), [[clay, true], [github, true]]);

  const model = await f.model();
  expect(model).toEqual({
    pages: [{ handle: "synthetic-sam", displayName: "Synthetic Sam", sortName: "synthetic sam synthetic-sam", searchText: "synthetic-sam synthetic sam Synthetic Sam" }],
    cards: [["synthetic-sam", "clay", false, "Daily"], ["synthetic-sam", "github", true, "Stopped using"]],
    tools: [["clay", "Clay", 1, 0, 1], ["github", "GitHub", 0, 1, 1]],
  });
  const stored = JSON.stringify(await f.t.run(async ctx => [await ctx.db.query("listedPages").collect(), await ctx.db.query("listedCards").collect(), await ctx.db.query("listedTools").collect()]));
  for (const hidden of ["Notion", "Linear", "synthetic headline", "synthetic note", "private bio", String(MONTHLY_PRICE)]) expect(stored).not.toContain(hidden);

  expect((await f.t.query(api.publicProfiles.searchPeople, { q: "synthetic" })).people).toEqual([{ handle: "synthetic-sam", displayName: "Synthetic Sam" }]);
  expect((await f.t.query(api.publicProfiles.searchPeople, { q: "Sam" })).people.map(person => person.handle)).toEqual(["synthetic-sam"]);
  expect((await f.t.query(api.publicProfiles.searchPeople, { q: "ria" })).people).toEqual([]);
  expect((await f.t.query(api.publicProfiles.searchTools, { q: "cla" })).tools).toEqual([{ slug: "clay", name: "Clay", peopleNow: 1, peopleBefore: 0 }]);
  expect((await f.t.query(api.publicProfiles.searchTools, { q: "notion" })).tools).toEqual([]);
  expect(await f.t.query(api.publicProfiles.listedToolSlugs, { handle: "synthetic-sam" })).toEqual(["clay", "github"]);
});

test("a republish replaces the page's rows, and unpublishing a card or every card removes them", async () => {
  const f = await searchFixture();
  const clay = await f.addProp(f.sam, f.clay);
  const github = await f.addProp(f.sam, f.github);
  const sam = f.as("synthetic-sam");
  await f.publish(sam, [[clay, true], [github, true]]);
  await f.t.run(ctx => ctx.db.patch(clay, { status: "ARCHIVED", level: "PAUSED", relationshipVersion: 2 }));
  await f.publish(sam, [[clay, true]]);
  expect((await f.model()).cards).toEqual([["synthetic-sam", "clay", true, "Paused"], ["synthetic-sam", "github", false, "Daily"]]);
  expect((await f.model()).tools).toEqual([["clay", "Clay", 0, 1, 1], ["github", "GitHub", 1, 0, 1]]);

  await f.publish(sam, [[github, false]]);
  expect(await f.model()).toMatchObject({ cards: [["synthetic-sam", "clay", true, "Paused"]], tools: [["clay", "Clay", 0, 1, 1]] });

  await f.publish(sam, [], { removeAllCards: true });
  expect(await f.model()).toEqual({ pages: [], cards: [], tools: [] });
  expect(await f.t.query(api.publicProfiles.toolPage, { slug: "clay" })).toBeNull();
});

test("a takedown drops the page from search and a restore brings it back", async () => {
  const f = await searchFixture();
  await f.publish(f.as("synthetic-sam"), [[await f.addProp(f.sam, f.clay), true]]);
  const listed = await f.model();
  await f.t.mutation(internal.publicProfiles.takeDownHandle, { handle: "synthetic-sam", reason: "Report 2026-11-17: synthetic", dryRun: true });
  expect(await f.model()).toEqual(listed);
  await f.t.mutation(internal.publicProfiles.takeDownHandle, { handle: "synthetic-sam", reason: "Report 2026-11-17: synthetic", dryRun: false });
  expect(await f.model()).toEqual({ pages: [], cards: [], tools: [] });
  expect((await f.t.query(api.publicProfiles.searchPeople, { q: "sam" })).people).toEqual([]);
  await f.t.mutation(internal.publicProfiles.restoreHandle, { handle: "synthetic-sam", dryRun: false });
  expect(await f.model()).toEqual(listed);
});

test("an unlisted page stays out of search through a republish, and the switch lists it again at once", async () => {
  const f = await searchFixture();
  const sam = f.as("synthetic-sam");
  expect(await sam.query(api.publicProfiles.searchListingChoice, {})).toEqual({ listed: true });
  await sam.mutation(api.publicProfiles.setSearchListing, { listed: false });
  expect(await sam.query(api.publicProfiles.searchListingChoice, {})).toEqual({ listed: false });
  const clay = await f.addProp(f.sam, f.clay);
  await f.publish(sam, [[clay, true]]);
  await f.publish(sam, [[await f.addProp(f.sam, f.github), true]]);
  expect(await f.model()).toEqual({ pages: [], cards: [], tools: [] });
  expect(await f.t.query(api.publicProfiles.listedToolSlugs, { handle: "synthetic-sam" })).toEqual([]);
  expect((await f.t.query(api.publicProfiles.getByHandleV2, { handle: "synthetic-sam" }))?.cards).toHaveLength(2);

  await sam.mutation(api.publicProfiles.setSearchListing, { listed: true });
  expect((await f.model()).cards).toEqual([["synthetic-sam", "clay", false, "Daily"], ["synthetic-sam", "github", false, "Daily"]]);
  await sam.mutation(api.publicProfiles.setSearchListing, { listed: false });
  expect(await f.model()).toEqual({ pages: [], cards: [], tools: [] });
  await expect(f.t.mutation(api.publicProfiles.setSearchListing, { listed: true })).rejects.toThrow("Authentication required.");
});

test("a tool page lists people A to Z in two groups, counts people per tool, and knows nothing else", async () => {
  const f = await searchFixture();
  await f.publish(f.as("synthetic-sam"), [[await f.addProp(f.sam, f.clay, { level: "WEEKLY" }), true], [await f.addProp(f.sam, f.github), true]]);
  await f.publish(f.as("synthetic-ria"), [[await f.addProp(f.ria, f.clay, { status: "ARCHIVED", level: "TRIED_NOT_ADOPTED" }), true]]);
  await f.publish(f.as("synthetic-abe"), [[await f.addProp(f.abe, f.clay, { status: "TESTING", level: "TESTING" }), true]]);

  expect(await f.t.query(api.publicProfiles.toolPage, { slug: "clay" })).toEqual({
    slug: "clay", name: "Clay", peopleNow: 2, peopleBefore: 1,
    now: { people: [{ handle: "synthetic-abe", displayName: "Synthetic Abe", levelLabel: "Testing" }, { handle: "synthetic-sam", displayName: "Synthetic Sam", levelLabel: "Weekly" }], nextAfter: null },
    before: { people: [{ handle: "synthetic-ria", displayName: "Synthetic Ria", levelLabel: "Tried, didn't adopt" }], nextAfter: null },
  });
  expect(await f.t.query(api.publicProfiles.toolPage, { slug: "notion" })).toBeNull();
  expect(await f.t.query(api.publicProfiles.toolPage, { slug: "Not A Slug" })).toBeNull();
  expect((await f.t.query(api.publicProfiles.toolPage, { slug: "clay", nowAfter: "synthetic abe synthetic-abe" }))?.now.people.map(person => person.handle)).toEqual(["synthetic-sam"]);
  expect((await f.t.query(api.publicProfiles.searchPeople, { q: "" })).people.map(person => person.handle)).toEqual(["synthetic-abe", "synthetic-ria", "synthetic-sam"]);
  expect((await f.t.query(api.publicProfiles.searchTools, { q: "" })).tools.map(tool => [tool.slug, tool.peopleNow + tool.peopleBefore])).toEqual([["clay", 3], ["github", 1]]);
  expect(await f.t.query(api.publicProfiles.sitemapListing, {})).toEqual({ handles: ["synthetic-abe", "synthetic-ria", "synthetic-sam"], tools: ["clay", "github"] });
});

test("search refuses over-long input and caps every result list", async () => {
  const f = await searchFixture();
  await expect(f.t.query(api.publicProfiles.searchPeople, { q: "a".repeat(SEARCH_QUERY_MAX + 1) })).rejects.toThrow("Search with 80 characters or fewer.");
  await expect(f.t.query(api.publicProfiles.searchTools, { q: "a".repeat(SEARCH_QUERY_MAX + 1) })).rejects.toThrow("Search with 80 characters or fewer.");
  expect(await f.t.query(api.publicProfiles.searchPeople, { q: ` ${"a".repeat(SEARCH_QUERY_MAX)} ` })).toEqual({ people: [], more: false });
  const words = (count: number) => Array.from({ length: count }, () => "a").join(" ");
  expect((await f.t.query(api.publicProfiles.searchTools, { q: words(SEARCH_WORDS_MAX) })).tools).toEqual([]);
  await expect(f.t.query(api.publicProfiles.searchTools, { q: words(SEARCH_WORDS_MAX + 1) })).rejects.toThrow("Search with 16 words or fewer.");
  await expect(f.t.query(api.publicProfiles.toolPage, { slug: "clay", beforeAfter: "a".repeat(CURSOR_MAX + 1) })).rejects.toThrow("That page of people is out of range.");
  await f.t.run(ctx => Promise.all(Array.from({ length: OVER_CAP }, (_, index) => ctx.db.insert("listedPages", {
    handle: `person-${index}`, displayName: `Person ${index}`, sortName: `person ${String(index).padStart(2, "0")}`, searchText: `person-${index} person ${index} Person ${index}`,
  }))));
  for (const q of ["", "person"]) {
    const result = await f.t.query(api.publicProfiles.searchPeople, { q });
    expect([result.people.length, result.more]).toEqual([SEARCH_RESULTS_MAX, true]);
  }
});

test("moving a published page and seeding the reference page keep search on the page's own handle", async () => {
  const t = convexTest(schema, modules);
  const profile = { ...e2eReferenceProfile, handle: "keegan" };
  const ids = await t.run(async ctx => {
    const ownerId = await ctx.db.insert("users", { handle: "lecturesfrom", seedKey: "keegan", authSubject: "owner-subject", displayName: "Private name", bio: "" });
    await ctx.db.insert("sites", { ownerId, handle: "lecturesfrom", seedKey: "keegan-hosted-site", status: "ACTIVE" });
    const publicationId = await ctx.db.insert("publishedProfiles", { handle: "keegan", profile, revision: 4, publishedAt: "2026-07-25T00:00:00.000Z" });
    return { ownerId, publicationId };
  });
  await t.mutation(internal.publicProfiles.rebuildSearch, {});
  // Before the move the page sits at a handle no account holds, so nobody can answer for it and it is not listed.
  expect(await t.run(async ctx => (await ctx.db.query("listedPages").collect()).map(page => page.handle))).toEqual([]);
  await t.mutation(makeFunctionReference<"mutation">("publicationMigration:moveSeededPublication"), {
    ...ids, expectedSubject: "owner-subject", expectedSeedKey: "keegan", fromHandle: "keegan", toHandle: "lecturesfrom",
    expectedRevision: 4, expectedProfileHash: await sha256(canonicalJson(profile)), dryRun: false,
  });
  const rows = await t.run(async ctx => ({
    pages: (await ctx.db.query("listedPages").collect()).map(page => [page.handle, page.displayName]),
    cards: (await ctx.db.query("listedCards").collect()).map(card => [card.handle, card.productSlug]),
  }));
  expect(rows).toEqual({ pages: [["lecturesfrom", "Keegan Moody"]], cards: [["lecturesfrom", "github"], ["lecturesfrom", "wisprflow"]] });

  const seeded = convexTest(schema, modules);
  await seeded.mutation(internal.seed.seedKeegan, {});
  expect(await seeded.run(async ctx => (await ctx.db.query("listedPages").collect()).map(page => page.handle))).toEqual(["keegan"]);
});

async function rebuildAll(t: TestConvex<typeof schema>) {
  const runs: unknown[] = [];
  const step = async (args: { phase?: "publications" | "pages" | "cards" | "tools"; cursor?: string | null }): Promise<void> => {
    const result = await t.mutation(internal.publicProfiles.rebuildSearch, args);
    runs.push(result);
    if (result.next) await step(result.next);
  };
  await step({});
  return runs;
}

test("a page with more tools than search lists holds exactly its first 500 through repeated syncs, and unlisting clears every row", async () => {
  const t = convexTest(schema, modules);
  const handle = "synthetic-many";
  const cards = Array.from({ length: LISTED_TOOLS_MAX + OVER_CAP }, (_, index) => ({
    product: { name: `Tool ${index}`, slug: `tool-${index}`, domain: `tool-${index}.example`, description: "Synthetic product" },
    status: "ACTIVE" as const, level: "DAILY" as const, headline: "Line", note: "",
  }));
  const owner = await t.run(async ctx => {
    await ctx.db.insert("publishedProfiles", { handle, revision: 1, publishedAt: confirmedAt, profile: { handle, displayName: "Synthetic Many", bio: "", cards } });
    return ctx.db.insert("users", { handle, displayName: "Synthetic Many", bio: "" });
  });
  const held = () => t.run(async ctx => {
    const [rows, tools] = [await ctx.db.query("listedCards").collect(), await ctx.db.query("listedTools").collect()];
    return { cards: rows.length, distinct: new Set(rows.map(row => row.productSlug)).size, tools: tools.length, most: Math.max(0, ...tools.map(tool => tool.people)) };
  });
  // The rebuild's first step syncs each published page once; three steps here are three syncs of this one page.
  const sync = () => t.mutation(internal.publicProfiles.rebuildSearch, {});
  await sync();
  await sync();
  expect(await held()).toEqual({ cards: LISTED_TOOLS_MAX, distinct: LISTED_TOOLS_MAX, tools: LISTED_TOOLS_MAX, most: 1 });
  expect(await t.query(api.publicProfiles.listedToolSlugs, { handle })).toHaveLength(LISTED_TOOLS_MAX);
  await t.run(ctx => ctx.db.patch(owner, { listedInSearch: false }));
  await sync();
  expect(await held()).toEqual({ cards: 0, distinct: 0, tools: 0, most: 0 });
});

test("the rebuild fills search from published pages alone, honours takedowns and the switch, and changes nothing the second time", async () => {
  const t = convexTest(schema, modules);
  const card = (slug: string, name: string, fields: Partial<PublicProfile["cards"][number]> = {}): PublicProfile["cards"][number] => ({
    product: { name, slug, domain: `${slug}.example`, description: "Synthetic product" }, status: "ACTIVE", level: "DAILY", headline: "Line", note: "", ...fields,
  });
  const page = (handle: string, displayName: string, cards: PublicProfile["cards"]) => ({ handle, revision: 1, publishedAt: confirmedAt, profile: { handle, displayName, bio: "", cards } });
  const untouched = await t.run(async ctx => {
    await ctx.db.insert("users", { handle: "synthetic-sam", displayName: "Synthetic Sam", bio: "" });
    await ctx.db.insert("users", { handle: "synthetic-off", displayName: "Synthetic Off", bio: "", listedInSearch: false });
    await ctx.db.insert("users", { handle: "synthetic-ria", displayName: "Synthetic Ria", bio: "" });
    await ctx.db.insert("users", { handle: "synthetic-down", displayName: "Synthetic Down", bio: "" });
    // A page kept after its account left the handle: nobody can answer for it, so it is never listed.
    await ctx.db.insert("publishedProfiles", page("synthetic-orphan", "Synthetic Orphan", [card("clay", "Clay"), card("orphan-only", "Orphan Only")]));
    await ctx.db.insert("publishedProfiles", page("synthetic-sam", "Synthetic Sam", [card("clay", "Clay"), card("github", "GitHub", { status: "ARCHIVED", level: "PAUSED" })]));
    await ctx.db.insert("publishedProfiles", page("synthetic-ria", "Synthetic Ria", [card("clay", "Clay", { status: "ARCHIVED", level: "STOPPED" })]));
    await ctx.db.insert("publishedProfiles", { ...page("synthetic-down", "Synthetic Down", [card("clay", "Clay")]), takenDownAt: confirmedAt, takedownReason: "Synthetic" });
    await ctx.db.insert("publishedProfiles", page("synthetic-off", "Synthetic Off", [card("notion", "Notion")]));
    // Rows left from a page that is gone, and a count that drifted.
    await ctx.db.insert("listedPages", { handle: "synthetic-gone", displayName: "Gone", sortName: "gone synthetic-gone", searchText: "gone" });
    await ctx.db.insert("listedCards", { handle: "synthetic-gone", displayName: "Gone", sortName: "gone synthetic-gone", productSlug: "linear", productName: "Linear", usedBefore: false, levelLabel: "Daily" });
    await ctx.db.insert("listedTools", { productSlug: "linear", productName: "Linear", searchText: "Linear linear", peopleNow: 1, peopleBefore: 0, people: 1 });
    await ctx.db.insert("listedTools", { productSlug: "clay", productName: "Clay", searchText: "Clay clay", peopleNow: 7, peopleBefore: 0, people: 7 });
    return { users: await ctx.db.query("users").collect(), publications: await ctx.db.query("publishedProfiles").collect() };
  });
  const everything = () => t.run(async ctx => ({
    pages: await ctx.db.query("listedPages").collect(), cards: await ctx.db.query("listedCards").collect(), tools: await ctx.db.query("listedTools").collect(),
    users: await ctx.db.query("users").collect(), publications: await ctx.db.query("publishedProfiles").collect(),
  }));

  const first = await rebuildAll(t);
  expect(first.map(run => (run as { phase: string }).phase)).toEqual(["publications", "pages", "cards", "tools"]);
  const built = await everything();
  expect({ users: built.users, publications: built.publications }).toEqual(untouched);
  expect(built.pages.map(row => row.handle)).toEqual(["synthetic-sam", "synthetic-ria"]);
  expect(built.cards.map(row => [row.handle, row.productSlug, row.usedBefore])).toEqual([
    ["synthetic-sam", "clay", false], ["synthetic-sam", "github", true], ["synthetic-ria", "clay", true],
  ]);
  expect(built.tools.map(row => [row.productSlug, row.peopleNow, row.peopleBefore, row.people])).toEqual([["clay", 1, 1, 2], ["github", 0, 1, 1]]);

  await rebuildAll(t);
  expect(await everything()).toEqual(built);
});

// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const confirmedAt = "2026-11-01T00:00:00.000Z";
const SAVED_VERSION = 3;
const MONTHLY_PRICE = 49;
const OVER_LIMIT = 103;
const BATCH = 100;
const LONG_NOTE = 10_000;
const THREE_CARDS = 3;
const shareAll = { selections: [], shareAllConfirmed: true };
const cost = { amount: MONTHLY_PRICE, currency: "USD", cadence: "MONTHLY", basis: "OWNER_REPORTED", asOf: "2026-11-01" } as const;

afterEach(() => vi.useRealTimers());

type PropFields = Partial<Omit<Doc<"props">, "_id" | "_creationTime" | "userId" | "productId">>;
type Account = Pick<TestConvex<typeof schema>, "query" | "mutation">;

async function fixture(handle = "owner") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => ({
    userId: await ctx.db.insert("users", { authSubject: "owner", handle, displayName: "Owner", bio: "" }),
    otherUserId: await ctx.db.insert("users", { authSubject: "other", handle: "other", displayName: "Other", bio: "" }),
  }));
  let products = 0;
  const addProp = (fields: PropFields = {}, product: { slug?: string; name?: string; domain?: string } = {}, userId = ids.userId) =>
    t.run(async ctx => {
      products += 1;
      const slug = product.slug ?? `tool-${products}`;
      const existing = await ctx.db.query("products").withIndex("by_slug", q => q.eq("slug", slug)).unique();
      const productId = existing?._id ?? await ctx.db.insert("products", {
        slug, name: product.name ?? `Tool ${products}`, domain: product.domain ?? `${slug}.example`, description: "Synthetic product",
      });
      return ctx.db.insert("props", {
        userId, productId, visibility: "PRIVATE", status: "ACTIVE", relationshipVersion: SAVED_VERSION, confirmedAt,
        headline: `Headline ${products}`, note: `Note ${products}`, ...fields,
      });
    });
  const addLink = (propId: Id<"props">, url: string, label = "Open") =>
    t.run(ctx => ctx.db.insert("links", { propId, type: "CANONICAL", url, label, isPrimary: true }));
  const rows = () => t.run(async ctx => ({
    props: await ctx.db.query("props").collect(),
    publications: await ctx.db.query("publishedProfiles").collect(),
    links: await ctx.db.query("links").collect(),
    rateLimits: await ctx.db.query("rateLimits").collect(),
    brandJobs: await ctx.db.query("productBrandJobs").collect(),
    scheduled: await ctx.db.system.query("_scheduled_functions").collect(),
  }));
  const visibility = (propId: Id<"props">) => t.run(async ctx => (await ctx.db.get(propId))!.visibility);
  const visibilities = (propIds: Id<"props">[]) => Promise.all(propIds.map(visibility));
  // Sequential, so collection order is creation order.
  const addProps = async (count: number, fields: PropFields = {}) => {
    const propIds: Id<"props">[] = [];
    for (let index = 0; index < count; index++) propIds.push(await addProp(fields));
    return propIds;
  };
  return { t, owner: t.withIdentity({ subject: "owner" }), other: t.withIdentity({ subject: "other" }), ...ids, addProp, addProps, addLink, rows, visibility, visibilities };
}

async function publishAll(account: Account) {
  const preview = await account.query(api.onboarding.previewPublication, shareAll);
  await account.mutation(api.onboarding.publishSelected, {
    ...shareAll, expectedPublicationRevision: preview.revision, expectedPreviewHash: preview.previewHash,
  });
  return preview;
}

test("one previewed approval shares every confirmed private card, archived included, drafts and other owners left out", async () => {
  const f = await fixture();
  const active = await f.addProp({ status: "ACTIVE" });
  const testing = await f.addProp({ status: "TESTING" });
  const archived = await f.addProp({ status: "ARCHIVED" });
  const draft = await f.addProp({ visibility: "DRAFT", confirmedAt: undefined, relationshipVersion: undefined });
  const othersCard = await f.addProp({}, {}, f.otherUserId);

  const preview = await f.owner.query(api.onboarding.previewPublication, shareAll);
  expect(preview).toMatchObject({ revision: 0, sharedCount: THREE_CARDS, remainingCount: 0, skipped: [] });
  expect(preview.profile.cards.map(card => [card.product.name, card.status])).toEqual([
    ["Tool 1", "ACTIVE"], ["Tool 2", "TESTING"], ["Tool 3", "ARCHIVED"],
  ]);
  expect((await f.rows()).publications).toEqual([]);
  expect(await f.visibility(active)).toBe("PRIVATE");

  await f.owner.mutation(api.onboarding.publishSelected, {
    ...shareAll, expectedPublicationRevision: preview.revision, expectedPreviewHash: preview.previewHash,
  });
  expect(await f.visibilities([active, testing, archived])).toEqual(["PUBLIC", "PUBLIC", "PUBLIC"]);
  expect(await f.visibility(draft)).toBe("DRAFT");
  expect(await f.visibility(othersCard)).toBe("PRIVATE");
  const page = await f.t.query(api.publicProfiles.getByHandleV2, { handle: "owner" });
  expect(page?.cards.map(card => ({ name: card.product.name, status: card.status, headline: card.headline, note: card.note, primaryLink: card.primaryLink }))).toEqual([
    { name: "Tool 1", status: "ACTIVE", headline: "Headline 1", note: "Note 1", primaryLink: { type: "CANONICAL", url: "https://tool-1.example", label: "Open product" } },
    { name: "Tool 2", status: "TESTING", headline: "Headline 2", note: "Note 2", primaryLink: { type: "CANONICAL", url: "https://tool-2.example", label: "Open product" } },
    { name: "Tool 3", status: "ARCHIVED", headline: "Headline 3", note: "Note 3", primaryLink: { type: "CANONICAL", url: "https://tool-3.example", label: "Open product" } },
  ]);
  expect((await f.rows()).publications[0].cardPropIds).toEqual([active, testing, archived]);
});

test("a card that was already public keeps its approved projection; private edits stay private", async () => {
  const f = await fixture();
  const shown = await f.addProp({ cost, costVisibility: "PRIVATE" });
  await f.addLink(shown, "https://tool-1.example/ref", "My referral");
  const selections = [{
    propId: shown, expectedRelationshipVersion: SAVED_VERSION, publish: true, status: "ACTIVE" as const,
    headline: "Headline 1", note: "Note 1", autoRefresh: false, cost, costVisibility: "PUBLIC" as const,
    primaryLink: { type: "REFERRAL" as const, url: "https://tool-1.example/ref", label: "My referral" },
  }];
  const first = await f.owner.query(api.onboarding.previewPublication, { selections });
  await f.owner.mutation(api.onboarding.publishSelected, { selections, expectedPublicationRevision: first.revision, expectedPreviewHash: first.previewHash });
  const approved = (await f.rows()).publications[0].profile.cards[0];
  expect(approved.cost).toEqual(cost);
  await f.t.run(ctx => ctx.db.patch(shown, { headline: "Private rewrite", relationshipVersion: SAVED_VERSION + 1 }));
  const added = await f.addProp();

  const preview = await publishAll(f.owner);
  expect(preview).toMatchObject({ sharedCount: 1, remainingCount: 0 });
  const stored = (await f.rows()).publications[0];
  expect(stored.profile.cards[0]).toEqual(approved);
  expect(stored.cardPropIds).toEqual([shown, added]);
  expect(await f.visibility(added)).toBe("PUBLIC");
});

test("share-all never publishes a saved public cost, and keeps the saved amount", async () => {
  const f = await fixture();
  const priced = await f.addProp({ cost, costVisibility: "PUBLIC" });
  await publishAll(f.owner);
  const stored = (await f.rows()).publications[0].profile.cards[0];
  expect(stored.cost).toBeUndefined();
  const page = await f.t.query(api.publicProfiles.getByHandleV2, { handle: "owner" });
  expect(page?.cards[0].cost).toBeUndefined();
  expect(await f.t.run(ctx => ctx.db.get(priced))).toMatchObject({ visibility: "PUBLIC", cost, costVisibility: "PRIVATE" });
});

test("a card whose saved owner link can't go public is skipped and named; the rest publish", async () => {
  const f = await fixture();
  const badUrls = ["javascript:alert(1)", "data:text/html,x", "ftp://files.example/tool", "https://user:pass@tool.example"];
  const bad = await f.addProps(badUrls.length);
  await Promise.all(bad.map((propId, index) => f.addLink(propId, badUrls[index])));
  const good = await f.addProp();
  await f.addLink(good, "https://good.example/start");

  const preview = await publishAll(f.owner);
  expect(preview.sharedCount).toBe(1);
  expect(preview.skipped).toEqual(bad.map((propId, index) => ({ propId, productName: `Tool ${index + 1}`, reason: "LINK_NEEDS_REVIEW" })));
  expect(await f.visibilities(bad)).toEqual(badUrls.map(() => "PRIVATE"));
  expect(await f.visibility(good)).toBe("PUBLIC");
  const page = await f.t.query(api.publicProfiles.getByHandleV2, { handle: "owner" });
  expect(page?.cards.map(card => card.primaryLink?.url)).toEqual(["https://good.example/start"]);
});

test("a product with no domain and no saved link publishes without a link", async () => {
  const f = await fixture();
  const bare = await f.addProp({}, { slug: "bare-tool", name: "Bare Tool", domain: "" });
  await publishAll(f.owner);
  expect(await f.visibility(bare)).toBe("PUBLIC");
  const card = (await f.rows()).publications[0].profile.cards[0];
  expect(card.product.name).toBe("Bare Tool");
  expect(card.primaryLink).toBeUndefined();
  expect((await f.t.query(api.publicProfiles.getByHandleV2, { handle: "owner" }))?.cards.map(item => item.product.name)).toEqual(["Bare Tool"]);
});

test("share-all is refused until a real handle is claimed", async () => {
  const f = await fixture("pending-owner");
  const propId = await f.addProp();
  await expect(f.owner.query(api.onboarding.previewPublication, shareAll)).rejects.toThrow("Claim your public handle before sharing your stack.");
  await expect(f.owner.mutation(api.onboarding.publishSelected, { ...shareAll, expectedPublicationRevision: 0, expectedPreviewHash: "unused" }))
    .rejects.toThrow("Claim your public handle before sharing your stack.");
  expect(await f.visibility(propId)).toBe("PRIVATE");
  expect((await f.rows()).publications).toEqual([]);
});

test.each(["selections", "remove-all"] as const)("share-all can't be combined with %s", async combined => {
  const f = await fixture();
  const propId = await f.addProp();
  const selection = { propId, expectedRelationshipVersion: SAVED_VERSION, publish: true, status: "ACTIVE" as const,
    headline: "Headline 1", note: "Note 1", autoRefresh: false };
  const args = combined === "selections"
    ? { selections: [selection], shareAllConfirmed: true }
    : { selections: [], shareAllConfirmed: true, removeAllCards: true };
  await expect(f.owner.query(api.onboarding.previewPublication, args)).rejects.toThrow("Share all confirmed cards on its own, without other card changes.");
  await expect(f.owner.mutation(api.onboarding.publishSelected, { ...args, expectedPublicationRevision: 0, expectedPreviewHash: "unused" }))
    .rejects.toThrow("Share all confirmed cards on its own, without other card changes.");
  expect(await f.visibility(propId)).toBe("PRIVATE");
  expect((await f.rows()).publications).toEqual([]);
});

test.each([
  ["a private save", async (f: Awaited<ReturnType<typeof fixture>>, propId: Id<"props">) => {
    await f.t.run(ctx => ctx.db.patch(propId, { note: "Saved after the preview", relationshipVersion: SAVED_VERSION + 1 }));
  }],
  ["a new confirmed pick", async (f: Awaited<ReturnType<typeof fixture>>) => { await f.addProp(); }],
] as const)("%s between preview and publish makes the preview stale", async (_, change) => {
  const f = await fixture();
  const propId = await f.addProp();
  const preview = await f.owner.query(api.onboarding.previewPublication, shareAll);
  await change(f, propId);
  await expect(f.owner.mutation(api.onboarding.publishSelected, {
    ...shareAll, expectedPublicationRevision: preview.revision, expectedPreviewHash: preview.previewHash,
  })).rejects.toThrow("The sharing preview changed. Open a fresh preview before publishing.");
  const after = await f.rows();
  expect(after.props.map(prop => prop.visibility)).toEqual(after.props.map(() => "PRIVATE"));
  expect(after.publications).toEqual([]);
});

test("more than 100 confirmed cards share 100 per run and say how many remain", async () => {
  const f = await fixture();
  const propIds = await f.addProps(OVER_LIMIT);

  const first = await publishAll(f.owner);
  expect(first).toMatchObject({ sharedCount: BATCH, remainingCount: OVER_LIMIT - BATCH, skipped: [] });
  const afterFirst = await f.rows();
  expect(afterFirst.publications[0].cardPropIds).toEqual(propIds.slice(0, BATCH));
  expect(afterFirst.props.filter(prop => prop.visibility === "PUBLIC").map(prop => prop._id)).toEqual(propIds.slice(0, BATCH));

  const second = await publishAll(f.owner);
  expect(second).toMatchObject({ sharedCount: OVER_LIMIT - BATCH, remainingCount: 0 });
  const afterSecond = await f.rows();
  expect(afterSecond.publications[0].cardPropIds).toEqual(propIds);
  expect(afterSecond.props.every(prop => prop.visibility === "PUBLIC")).toBe(true);
});

test("one share-all publish spends one publication change from the hourly allowance", async () => {
  const f = await fixture();
  await f.addProps(THREE_CARDS);
  await publishAll(f.owner);
  expect((await f.rows()).rateLimits.map(row => [row.operation, row.count])).toEqual([["publishSelected", 1]]);
});

test("a page too large for one stored document is refused before approval", async () => {
  const f = await fixture();
  await f.addProps(BATCH, { note: "n".repeat(LONG_NOTE) });
  await expect(f.owner.query(api.onboarding.previewPublication, shareAll))
    .rejects.toThrow("This page is too large to publish. Share fewer cards or shorten long notes, then preview again.");
  expect((await f.rows()).publications).toEqual([]);
});

test("share-all starts no logo retrieval for listed products and keeps it for evidence-tier products", async () => {
  vi.useFakeTimers();
  const f = await fixture();
  await f.addProp({}, { slug: "tidal", name: "TIDAL", domain: "tidal.com" });
  await f.addProp({}, { slug: "notion", name: "Notion", domain: "notion.so" });
  await publishAll(f.owner);
  const after = await f.rows();
  const notion = await f.t.run(ctx => ctx.db.query("products").withIndex("by_slug", q => q.eq("slug", "notion")).unique());
  expect(after.brandJobs.map(job => [job.productId, job.canonicalDomain])).toEqual([[notion!._id, "notion.so"]]);
  expect(after.scheduled).toHaveLength(1);
});

test("share-all with nothing left to share is refused and publishes no page", async () => {
  const f = await fixture();
  await f.addProp({ visibility: "DRAFT", confirmedAt: undefined });
  const preview = await f.owner.query(api.onboarding.previewPublication, shareAll);
  expect(preview.sharedCount).toBe(0);
  await expect(f.owner.mutation(api.onboarding.publishSelected, {
    ...shareAll, expectedPublicationRevision: preview.revision, expectedPreviewHash: preview.previewHash,
  })).rejects.toThrow("There are no confirmed cards left to share.");
  expect((await f.rows()).publications).toEqual([]);
});

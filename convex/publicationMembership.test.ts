// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { defaultReview, explicitPublicationCards } from "../src/domain/review";

const modules = import.meta.glob("./**/*.ts");
const timestamp = "2026-09-19T23:00:00.000Z";

async function fixture(handle = "original", count = 1) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { handle, authSubject: "owner", displayName: "Owner", bio: "" });
    const propIds = [];
    const cards = [];
    for (let index = 0; index < count; index++) {
      const product = { name: `Product ${index}`, slug: `product-${index}`, domain: `product-${index}.example`, description: "Fixture" };
      const productId = await ctx.db.insert("products", product);
      const relationship = { status: "ACTIVE" as const, headline: `Saved ${index}`, note: "Saved note" };
      propIds.push(await ctx.db.insert("props", { userId, productId, ...relationship, visibility: "PUBLIC", relationshipVersion: 1, confirmedAt: timestamp }));
      cards.push({ product, ...relationship });
    }
    const publicationId = await ctx.db.insert("publishedProfiles", {
      handle: "original", revision: 1, publishedAt: timestamp,
      profile: { handle: "original", displayName: "Owner", bio: "", cards },
    });
    return { userId, propIds, publicationId };
  });
  const owner = t.withIdentity({ subject: "owner" });
  const reviewCards = async () => {
    const state = await owner.query(api.onboarding.getState, { includeClaims: false });
    if (!state) throw new Error("Missing fixture user");
    return state.cards.flatMap(card => card.product ? [{ ...card, product: card.product }] : []);
  };
  return { t, owner, ...ids, reviewCards };
}

test("four PUBLIC records under a renamed handle are not published or selected there", async () => {
  const { t, owner, reviewCards, publicationId } = await fixture("current", 4);
  const before = await t.run(ctx => ctx.db.get(publicationId));
  const cards = await reviewCards();
  expect(cards).toHaveLength(4);
  for (const card of cards) {
    expect(card).toMatchObject({ isPublishedAtCurrentHandle: false, prop: { visibility: "PUBLIC" } });
    expect(defaultReview(card).publish).toBe(false);
  }
  expect(explicitPublicationCards(cards, {})).toEqual([]);
  const preview = await owner.query(api.onboarding.previewPublication, { selections: [] });
  expect(preview.profile).toMatchObject({ handle: "current", cards: [] });
  expect(await t.run(ctx => ctx.db.get(publicationId))).toEqual(before);
});

test.each(["explicit", "unique legacy"])("resolved %s membership retains an untouched approved card", async mapping => {
  const { t, owner, reviewCards, publicationId, propIds } = await fixture();
  if (mapping === "explicit") await t.run(ctx => ctx.db.patch(publicationId, { cardPropIds: propIds }));
  const before = await t.run(ctx => ctx.db.get(publicationId));
  const cards = await reviewCards();
  expect(cards[0]).toMatchObject({ isPublishedAtCurrentHandle: true });
  expect(defaultReview(cards[0]).publish).toBe(true);
  expect(explicitPublicationCards(cards, {})).toEqual([]);
  const preview = await owner.query(api.onboarding.previewPublication, { selections: [] });
  expect(preview.profile.cards).toEqual(before!.profile.cards);
  expect(await t.run(ctx => ctx.db.get(publicationId))).toEqual(before);
});

test("ambiguous legacy membership stays unselected while its approved snapshot is preserved", async () => {
  const { t, owner, userId, reviewCards, publicationId, propIds: [propId] } = await fixture();
  await t.run(async ctx => {
    const prop = (await ctx.db.get(propId))!;
    await ctx.db.insert("props", { userId, productId: prop.productId, visibility: "PRIVATE", status: "TESTING", headline: "Private sibling", note: "" });
  });
  const before = await t.run(ctx => ctx.db.get(publicationId));
  const cards = await reviewCards();
  for (const card of cards) {
    expect(card).toMatchObject({ isPublishedAtCurrentHandle: false });
    expect(defaultReview(card).publish).toBe(false);
  }
  const preview = await owner.query(api.onboarding.previewPublication, { selections: [] });
  expect(preview.profile.cards).toEqual(before!.profile.cards);
  expect(await t.run(ctx => ctx.db.get(publicationId))).toEqual(before);
});

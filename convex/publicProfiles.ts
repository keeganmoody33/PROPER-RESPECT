import { query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { publicProfileValidator } from "./validators";
import { retainedProductBrand } from "./productBrands";
import { projectPublicProfileV1 } from "../src/domain/public-profile";

const cardValidator = publicProfileValidator.fields.cards.element;
const publicProfileV1Validator = v.object({
  ...publicProfileValidator.fields,
  cards: v.array(v.object({
    ...cardValidator.fields,
    primaryLink: v.object(cardValidator.fields.primaryLink.fields),
  })),
});

async function readPublishedProfile(ctx: QueryCtx, handle: string) {
  const published = await ctx.db
    .query("publishedProfiles")
    .withIndex("by_handle", (q) => q.eq("handle", handle))
    .unique();

  if (!published) return null;
  // Only presentation is refreshed. The owner's published evidence and
  // relationship projection stays byte-for-byte unchanged in storage.
  const cards = await Promise.all(published.profile.cards.map(async (card) => {
    const product = await ctx.db.query("products").withIndex("by_slug", q => q.eq("slug", card.product.slug)).unique();
    if (!product || product.domain !== card.product.domain) return card;
    const brand = await retainedProductBrand(ctx, product);
    return brand ? { ...card, product: { ...card.product, brand } } : card;
  }));
  return { ...published.profile, cards };
}

/** Compatibility endpoint for deployed readers that dereference primaryLink. */
export const getByHandle = query({
  args: { handle: v.string() },
  returns: v.union(publicProfileV1Validator, v.null()),
  handler: async (ctx, { handle }) => {
    const profile = await readPublishedProfile(ctx, handle);
    return profile === null ? null : projectPublicProfileV1(profile);
  },
});

/** Current readers also render explicitly shared products without a website. */
export const getByHandleV2 = query({
  args: { handle: v.string() },
  returns: v.union(publicProfileValidator, v.null()),
  handler: (ctx, { handle }) => readPublishedProfile(ctx, handle),
});

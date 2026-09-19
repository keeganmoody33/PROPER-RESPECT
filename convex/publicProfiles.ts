import { query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { publicProfileValidator } from "./validators";
import { productBrandEligibility, retainedProductBrand } from "./productBrands";
import { projectPublicProfileV1 } from "../src/domain/public-profile";

const cardValidator = publicProfileValidator.fields.cards.element;
const publicProfileV1Validator = v.object({
  ...publicProfileValidator.fields,
  cards: v.array(v.object({
    ...cardValidator.fields,
    primaryLink: v.object(cardValidator.fields.primaryLink.fields),
  })),
});

export async function readPublishedProfile(ctx: QueryCtx, handle: string) {
  const published = await ctx.db
    .query("publishedProfiles")
    .withIndex("by_handle", (q) => q.eq("handle", handle))
    .unique();

  if (!published) return null;
  // Only presentation is refreshed. The owner's published evidence and
  // relationship projection stays byte-for-byte unchanged in storage.
  // Read only the products in this profile, once per slug. Avoid scanning the
  // global catalog or all historical snapshots to hydrate a public page.
  const brands = new Map(await Promise.all(
    [...new Set(published.profile.cards.map(card => card.product.slug))].map(async slug => {
      const product = await ctx.db.query("products").withIndex("by_slug", q => q.eq("slug", slug)).unique();
      return [slug, product ? { domain: product.domain, brand: await retainedProductBrand(ctx, product) } : null] as const;
    }),
  ));
  const cards = published.profile.cards.map(card => {
    if (card.product.brand?.provider === "context.dev" && productBrandEligibility(card.product) === "PRODUCT_IDENTITY_REQUIRED") {
      const product = { ...card.product };
      delete product.brand;
      return { ...card, product };
    }
    const retained = brands.get(card.product.slug);
    return retained?.brand && retained.domain === card.product.domain
      ? { ...card, product: { ...card.product, brand: retained.brand } } : card;
  });
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

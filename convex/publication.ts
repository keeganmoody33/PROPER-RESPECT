import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

/** Private identity metadata, always aligned with the saved public card order. */
export async function resolvePublishedCardPropIds(
  ctx: Pick<QueryCtx, "db">,
  published: Doc<"publishedProfiles">,
  userId: Id<"users">,
  ownedProps?: Doc<"props">[],
): Promise<Array<Id<"props"> | null>> {
  const user = await ctx.db.get(userId);
  if (!user || user.handle !== published.handle) {
    return published.profile.cards.map(() => null);
  }
  const props = (ownedProps ?? await ctx.db.query("props")
    .withIndex("by_user", q => q.eq("userId", userId)).collect())
    .filter(prop => prop.userId === userId);
  const propIds = new Set(props.map(prop => prop._id));
  const resolved = published.profile.cards.map((_, index) => {
    const propId = published.cardPropIds?.[index];
    return propId && propIds.has(propId) ? propId : null;
  });
  if (resolved.every(propId => propId !== null)) return resolved;

  const productIds = [...new Set(props.map(prop => prop.productId))];
  const products = await Promise.all(productIds.map(productId => ctx.db.get(productId)));
  const slugsByProduct = new Map(products.flatMap(product => product ? [[product._id, product.slug] as const] : []));
  const propsBySlug = new Map<string, Id<"props">[]>();
  for (const prop of props) {
    const slug = slugsByProduct.get(prop.productId);
    if (slug) propsBySlug.set(slug, [...(propsBySlug.get(slug) ?? []), prop._id]);
  }
  const cardCounts = new Map<string, number>();
  for (const card of published.profile.cards) {
    cardCounts.set(card.product.slug, (cardCounts.get(card.product.slug) ?? 0) + 1);
  }
  return resolved.map((propId, index) => {
    if (propId !== null) return propId;
    // An invalid explicit identity must not be reassigned by product similarity.
    if (published.cardPropIds?.[index]) return null;
    const slug = published.profile.cards[index].product.slug;
    const candidates = propsBySlug.get(slug) ?? [];
    return candidates.length === 1 && cardCounts.get(slug) === 1 ? candidates[0] : null;
  });
}

/** Resolve a known owner's relationship without touching another same-product card. */
export async function publishedCardIndicesForProp(
  ctx: Pick<QueryCtx, "db">,
  published: Doc<"publishedProfiles">,
  prop: Doc<"props">,
): Promise<number[]> {
  const propIds = await resolvePublishedCardPropIds(ctx, published, prop.userId);
  return propIds.flatMap((propId, index) => propId === prop._id ? [index] : []);
}

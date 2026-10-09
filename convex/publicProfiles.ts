import { internalMutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { publicProfileValidator } from "./validators";
import { productBrandEligibility, retainedProductBrand } from "./productBrands";
import { projectPublicProfileV1 } from "../src/domain/public-profile";
import { isHttpUrl } from "../src/domain/profile-links";
import { PUBLISHED_URL_MAX } from "../src/domain/published-text-limits";

const cardValidator = publicProfileValidator.fields.cards.element;
const publicProfileV1Validator = v.object({
  ...publicProfileValidator.fields,
  cards: v.array(v.object({
    ...cardValidator.fields,
    primaryLink: v.object(cardValidator.fields.primaryLink.fields),
  })),
});

export async function readPublishedProfile(ctx: QueryCtx, handle: string) {
  const alias = await ctx.db.query("publicProfileAliases").withIndex("by_handle", q => q.eq("handle", handle)).unique();
  if (alias && await ctx.db.query("publicProfileAliases").withIndex("by_handle", q => q.eq("handle", alias.targetHandle)).first()) return null;
  const published = await ctx.db
    .query("publishedProfiles")
    .withIndex("by_handle", (q) => q.eq("handle", alias?.targetHandle ?? handle))
    .unique();

  if (!published || (alias && alias.publicationId !== published._id)) return null;
  if (published.takenDownAt) return null;
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
  // Links from before the http(s) rule are dropped on read; storage is unchanged.
  const cards = published.profile.cards.map(stored => {
    const card = stored.primaryLink && !isHttpUrl(stored.primaryLink.url) ? { ...stored, primaryLink: undefined } : stored;
    if (card.product.brand?.provider === "context.dev" && productBrandEligibility(card.product) === "PRODUCT_IDENTITY_REQUIRED") {
      const product = { ...card.product };
      delete product.brand;
      return { ...card, product };
    }
    const retained = brands.get(card.product.slug);
    return retained?.brand && retained.domain === card.product.domain
      ? { ...card, product: { ...card.product, brand: retained.brand } } : card;
  });
  const { avatarUrl, profileLinks, preferredLinkUrl, ...profile } = published.profile;
  const links = profileLinks?.filter(link => isHttpUrl(link.url));
  return {
    ...profile,
    ...(avatarUrl !== undefined && isHttpUrl(avatarUrl) && avatarUrl.length <= PUBLISHED_URL_MAX ? { avatarUrl } : {}),
    ...(links !== undefined ? { profileLinks: links } : {}),
    ...(preferredLinkUrl !== undefined && links?.some(link => link.url === preferredLinkUrl) ? { preferredLinkUrl } : {}),
    cards,
  };
}

/** Deployed readers cannot interpret summed-response derivation. Keep the card
 * and all understood measurements without rewriting the approved snapshot. */
function legacyMeasurements(profile: NonNullable<Awaited<ReturnType<typeof readPublishedProfile>>>) {
  return { ...profile, cards: profile.cards.map(card => {
    if (!card.measurements?.some(row => row.derivation === "SUMMED_RESPONSES")) return card;
    const visible: typeof card = { ...card, measurements: card.measurements.filter(row => row.derivation !== "SUMMED_RESPONSES") };
    if (!visible.measurements?.length) delete visible.measurements;
    return visible;
  }) };
}

/** Compatibility endpoint for deployed readers that dereference primaryLink. */
export const getByHandle = query({
  args: { handle: v.string() },
  returns: v.union(publicProfileV1Validator, v.null()),
  handler: async (ctx, { handle }) => {
    const profile = await readPublishedProfile(ctx, handle);
    return profile === null ? null : projectPublicProfileV1(legacyMeasurements(profile));
  },
});

/** Current readers also render explicitly shared products without a website. */
export const getByHandleV2 = query({
  args: { handle: v.string(), measurementVersion: v.optional(v.literal(2)) },
  returns: v.union(publicProfileValidator, v.null()),
  handler: async (ctx, { handle, measurementVersion }) => {
    const profile = await readPublishedProfile(ctx, handle);
    return profile === null || measurementVersion === 2 ? profile : legacyMeasurements(profile);
  },
});

const TAKEDOWN_REASON_MAX = 500;

/** The publication a reported URL shows: its own handle, or an alias's target. */
async function reportedPublication(ctx: MutationCtx, handle: string) {
  const direct = await ctx.db.query("publishedProfiles").withIndex("by_handle", q => q.eq("handle", handle)).unique();
  if (direct) return direct;
  const alias = await ctx.db.query("publicProfileAliases").withIndex("by_handle", q => q.eq("handle", handle)).unique();
  const target = alias ? await ctx.db.get(alias.publicationId) : null;
  if (!target || target.handle !== alias?.targetHandle) throw new Error("No published profile has that handle.");
  return target;
}

/**
 * Operator takedown, run from the Convex CLI (docs/runbooks/takedown.md).
 * Storage keeps the snapshot so a restore returns it unchanged.
 */
export const takeDownHandle = internalMutation({
  args: { handle: v.string(), reason: v.string(), dryRun: v.boolean() },
  handler: async (ctx, args) => {
    const reason = args.reason.trim();
    if (!reason) throw new Error("Record why the profile is being taken down.");
    if (reason.length > TAKEDOWN_REASON_MAX) throw new Error(`Keep the reason within ${TAKEDOWN_REASON_MAX} characters.`);
    const publication = await reportedPublication(ctx, args.handle);
    const summary = { handle: publication.handle, revision: publication.revision, cardCount: publication.profile.cards.length };
    if (publication.takenDownAt) {
      return { status: "already-taken-down" as const, ...summary,
        takenDownAt: publication.takenDownAt, takedownReason: publication.takedownReason };
    }
    if (args.dryRun) return { status: "ready" as const, ...summary };
    await ctx.db.patch(publication._id, { takenDownAt: new Date().toISOString(), takedownReason: reason });
    return { status: "taken-down" as const, ...summary };
  },
});

export const restoreHandle = internalMutation({
  args: { handle: v.string(), dryRun: v.boolean() },
  handler: async (ctx, args) => {
    const publication = await reportedPublication(ctx, args.handle);
    const summary = { handle: publication.handle, revision: publication.revision, cardCount: publication.profile.cards.length };
    if (!publication.takenDownAt) return { status: "not-taken-down" as const, ...summary };
    const record = { takenDownAt: publication.takenDownAt, takedownReason: publication.takedownReason };
    if (args.dryRun) return { status: "ready" as const, ...summary, ...record };
    await ctx.db.patch(publication._id, { takenDownAt: undefined, takedownReason: undefined });
    return { status: "restored" as const, ...summary, ...record };
  },
});

import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { requireUser } from "./authHelpers";
import { readPublishedProfile } from "./publicProfiles";
import { creditFromStoredLink, type LinkPropCredit } from "../src/domain/link-prop";

const creditValidator = v.object({
  productName: v.string(),
  productSlug: v.string(),
  disclosure: v.union(v.literal("Affiliate link"), v.literal("Referral link")),
  url: v.string(),
  count: v.number(),
});

async function creditsForHandle(ctx: QueryCtx | MutationCtx, handle: string): Promise<LinkPropCredit[]> {
  const profile = await readPublishedProfile(ctx, handle);
  if (!profile) return [];
  const rows = await ctx.db.query("linkCredits").withIndex("by_handle", q => q.eq("handle", handle)).take(100);
  const credits: LinkPropCredit[] = [];
  for (const card of profile.cards) {
    const stored = creditFromStoredLink(card);
    if (!stored) continue;
    const sourceType = stored.disclosure === "Affiliate link" ? "AFFILIATE" : "REFERRAL";
    const count = rows.filter(row => row.productSlug === stored.productSlug && row.sourceUrl === stored.url && row.sourceType === sourceType).length;
    if (count > 0) credits.push({ ...stored, count });
  }
  return credits;
}

export const listForProfile = query({
  args: { handle: v.string() },
  returns: v.array(creditValidator),
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await creditsForHandle(ctx, args.handle);
  },
});

export const give = mutation({
  args: { handle: v.string(), productSlug: v.string() },
  returns: creditValidator,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const profile = await readPublishedProfile(ctx, args.handle);
    const card = profile?.cards.find(item => item.product.slug === args.productSlug);
    const stored = card ? creditFromStoredLink(card) : undefined;
    if (!stored) throw new Error("This card has no stored affiliate or referral link.");
    const sourceType = stored.disclosure === "Affiliate link" ? "AFFILIATE" : "REFERRAL";
    const existing = await ctx.db.query("linkCredits")
      .withIndex("by_handle_slug_giver", q => q.eq("handle", args.handle).eq("productSlug", stored.productSlug).eq("giverId", user._id))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { productName: stored.productName, sourceType, sourceUrl: stored.url });
    } else {
      await ctx.db.insert("linkCredits", {
        handle: args.handle,
        productSlug: stored.productSlug,
        productName: stored.productName,
        sourceType,
        sourceUrl: stored.url,
        giverId: user._id,
      });
    }
    const credit = (await creditsForHandle(ctx, args.handle)).find(item => item.productSlug === stored.productSlug && item.url === stored.url);
    if (!credit) throw new Error("This card has no stored affiliate or referral link.");
    return credit;
  },
});

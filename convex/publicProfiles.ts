import { query } from "./_generated/server";
import { v } from "convex/values";

const profileValidator = v.object({
  handle: v.string(),
  displayName: v.string(),
  bio: v.string(),
  avatarUrl: v.optional(v.string()),
  cards: v.array(
    v.object({
      product: v.object({
        name: v.string(),
        slug: v.string(),
        domain: v.string(),
        description: v.string(),
      }),
      status: v.union(
        v.literal("ACTIVE"),
        v.literal("TESTING"),
        v.literal("ARCHIVED"),
      ),
      headline: v.string(),
      note: v.string(),
      startedAt: v.optional(v.string()),
      primaryLink: v.object({
        type: v.union(
          v.literal("CANONICAL"),
          v.literal("AFFILIATE"),
          v.literal("REFERRAL"),
          v.literal("INVITE"),
        ),
        url: v.string(),
        label: v.string(),
      }),
    }),
  ),
});

export const getByHandle = query({
  args: { handle: v.string() },
  returns: v.union(profileValidator, v.null()),
  handler: async (ctx, { handle }) => {
    const published = await ctx.db
      .query("publishedProfiles")
      .withIndex("by_handle", (q) => q.eq("handle", handle))
      .unique();

    return published?.profile ?? null;
  },
});

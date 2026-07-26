import { query } from "./_generated/server";
import { v } from "convex/values";
import { publicProfileValidator } from "./validators";

export const getByHandle = query({
  args: { handle: v.string() },
  returns: v.union(publicProfileValidator, v.null()),
  handler: async (ctx, { handle }) => {
    const published = await ctx.db
      .query("publishedProfiles")
      .withIndex("by_handle", (q) => q.eq("handle", handle))
      .unique();

    return published?.profile ?? null;
  },
});

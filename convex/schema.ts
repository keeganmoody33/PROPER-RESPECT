import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    seedKey: v.string(),
    handle: v.string(),
    displayName: v.string(),
    bio: v.string(),
    avatarUrl: v.optional(v.string()),
  })
    .index("by_seed_key", ["seedKey"])
    .index("by_handle", ["handle"]),

  products: defineTable({
    seedKey: v.string(),
    name: v.string(),
    slug: v.string(),
    domain: v.string(),
    description: v.string(),
  }).index("by_seed_key", ["seedKey"]),

  props: defineTable({
    seedKey: v.string(),
    userId: v.id("users"),
    productId: v.id("products"),
    status: v.union(
      v.literal("ACTIVE"),
      v.literal("TESTING"),
      v.literal("ARCHIVED"),
    ),
    visibility: v.union(
      v.literal("PUBLIC"),
      v.literal("PRIVATE"),
      v.literal("DRAFT"),
    ),
    headline: v.string(),
    note: v.string(),
    startedAt: v.optional(v.string()),
  })
    .index("by_seed_key", ["seedKey"])
    .index("by_user", ["userId"]),

  links: defineTable({
    seedKey: v.string(),
    propId: v.id("props"),
    type: v.union(
      v.literal("CANONICAL"),
      v.literal("AFFILIATE"),
      v.literal("REFERRAL"),
      v.literal("INVITE"),
    ),
    url: v.string(),
    label: v.string(),
    isPrimary: v.boolean(),
  })
    .index("by_seed_key", ["seedKey"])
    .index("by_prop", ["propId"]),

  sites: defineTable({
    seedKey: v.string(),
    ownerId: v.id("users"),
    handle: v.string(),
    status: v.literal("ACTIVE"),
  }).index("by_seed_key", ["seedKey"]),

  publishedProfiles: defineTable({
    handle: v.string(),
    revision: v.number(),
    publishedAt: v.string(),
    profile: v.object({
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
    }),
  }).index("by_handle", ["handle"]),
});

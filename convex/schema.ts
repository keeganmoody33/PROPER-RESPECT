import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const evidenceSourceType = v.union(
  v.literal("MANUAL"),
  v.literal("PUBLIC_PROFILE"),
  v.literal("GITHUB"),
  v.literal("BILLING"),
  v.literal("BROWSER_HISTORY"),
  v.literal("SCREEN_TIME"),
  v.literal("SOCIAL_MESSAGES"),
  v.literal("GMAIL"),
);

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

  evidenceSources: defineTable({
    userId: v.id("users"),
    type: evidenceSourceType,
    label: v.optional(v.string()),
    connectedAt: v.string(),
    lastSyncedAt: v.optional(v.string()),
  }).index("by_user_type", ["userId", "type"]),

  rawEvidence: defineTable({
    evidenceSourceId: v.id("evidenceSources"),
    userId: v.id("users"),
    payload: v.string(),
    detectedVendor: v.optional(v.string()),
    detectedUrl: v.optional(v.string()),
    capturedAt: v.string(),
    dedupKey: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_dedup_key", ["dedupKey"]),

  draftImports: defineTable({
    userId: v.id("users"),
    status: v.union(
      v.literal("PENDING"),
      v.literal("APPROVED"),
      v.literal("MERGED"),
      v.literal("REJECTED"),
      v.literal("SUPERSEDED"),
    ),
    suggestedProductSlug: v.string(),
    suggestedProductName: v.string(),
    suggestedDomain: v.string(),
    suggestedDescription: v.string(),
    suggestedUrl: v.string(),
    rawEvidenceIds: v.array(v.id("rawEvidence")),
    resultPropId: v.optional(v.id("props")),
  }).index("by_user_slug", ["userId", "suggestedProductSlug"]),

  proofs: defineTable({
    propId: v.id("props"),
    type: v.union(
      v.literal("NOTE"),
      v.literal("SCREENSHOT"),
      v.literal("RECEIPT"),
      v.literal("GITHUB_REPO"),
      v.literal("EMAIL_EVIDENCE"),
      v.literal("BROWSER_HISTORY_EXPORT"),
      v.literal("API_OAUTH"),
    ),
    url: v.optional(v.string()),
    text: v.optional(v.string()),
    label: v.optional(v.string()),
    rawEvidenceId: v.optional(v.id("rawEvidence")),
  }).index("by_prop", ["propId"]),

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

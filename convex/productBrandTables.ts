import { defineTable } from "convex/server";
import { v } from "convex/values";

const mode = v.union(v.literal("light"), v.literal("dark"), v.literal("unknown"));
const styleguideFields = {
  mode,
  colors: v.object({ accent: v.optional(v.string()), background: v.optional(v.string()), text: v.optional(v.string()) }),
  headingFamily: v.optional(v.string()), bodyFamily: v.optional(v.string()),
};
const typographyRole = v.object({
  family: v.string(), fallbacks: v.array(v.string()), weight: v.optional(v.number()),
  fontSizePx: v.optional(v.number()), lineHeight: v.optional(v.number()), letterSpacingEm: v.optional(v.number()),
});
const snapshotFields = {
  provider: v.literal("context.dev"),
  adapterVersion: v.string(),
  productSlug: v.string(),
  canonicalDomain: v.string(),
  retrievalId: v.string(),
  retrievedAt: v.string(),
  partial: v.boolean(),
  responseHash: v.string(),
  logos: v.array(v.object({
    url: v.string(), mode,
    type: v.union(v.literal("logo"), v.literal("icon"), v.literal("unknown")),
    width: v.optional(v.number()), height: v.optional(v.number()),
  })),
  colors: v.array(v.object({ hex: v.string(), name: v.optional(v.string()), source: v.optional(v.string()) })),
  fonts: v.array(v.object({ family: v.string(), uses: v.array(v.string()), fallbacks: v.array(v.string()) })),
  receipts: v.array(v.object({
    endpoint: v.union(v.literal("brand"), v.literal("fonts"), v.literal("styleguide")),
    status: v.union(v.literal("ok"), v.literal("unavailable"), v.literal("error")),
    httpStatus: v.optional(v.number()), requestId: v.optional(v.string()), partial: v.optional(v.boolean()),
  })),
};
export const productBrandSnapshotValidator = v.union(
  v.object({ ...snapshotFields, schemaVersion: v.literal(1), styleguide: v.optional(v.object(styleguideFields)) }),
  v.object({
    ...snapshotFields,
    schemaVersion: v.literal(2),
    fontLinks: v.array(v.object({
      family: v.string(), source: v.union(v.literal("fonts"), v.literal("styleguide")),
      type: v.union(v.literal("google"), v.literal("custom")),
      category: v.optional(v.union(v.literal("sans-serif"), v.literal("serif"), v.literal("monospace"), v.literal("display"), v.literal("handwriting"))),
      files: v.array(v.object({ url: v.string(), weight: v.number(), format: v.union(v.literal("woff2"), v.literal("woff"), v.literal("truetype"), v.literal("opentype")) })),
    })),
    styleguide: v.optional(v.object({ ...styleguideFields, typography: v.optional(v.object({ heading: v.optional(typographyRole), body: v.optional(typographyRole) })) })),
  }),
);

export const productBrandTables = {
  productBrandJobs: defineTable({
    productId: v.id("products"), canonicalDomain: v.string(), generation: v.number(),
    status: v.union(v.literal("PENDING"), v.literal("RUNNING"), v.literal("READY"), v.literal("FAILED")),
    requestedAt: v.number(), completedAt: v.optional(v.number()), leaseUntil: v.optional(v.number()),
    currentSnapshotId: v.optional(v.id("productBrandSnapshots")),
    lastError: v.optional(v.string()),
  }).index("by_product", ["productId"]),
  productBrandSnapshots: defineTable({
    productId: v.id("products"), generation: v.number(),
    snapshot: productBrandSnapshotValidator,
    responseJson: v.string(),
  }).index("by_product", ["productId"])
    .index("by_retrieval", ["snapshot.retrievalId"]),
};

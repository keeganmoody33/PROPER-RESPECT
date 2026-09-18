import { defineTable } from "convex/server";
import { v } from "convex/values";
const period = v.union(
  v.literal("MONTH"),
  v.literal("YEAR"),
  v.literal("UNKNOWN"),
);
export const offeringFactsValidator = v.object({
  tiers: v.array(
    v.object({
      name: v.string(),
      option: v.string(),
      excerpt: v.string(),
      features: v.array(v.string()),
      prices: v.array(
        v.object({
          amount: v.union(v.number(), v.null()),
          currency: v.string(),
          displayBasis: period,
          billingCadence: period,
          perSeat: v.union(v.boolean(), v.null()),
          availability: v.union(
            v.literal("LISTED"),
            v.literal("CUSTOM"),
            v.literal("UNAVAILABLE"),
            v.literal("UNKNOWN"),
          ),
          excerpt: v.string(),
        }),
      ),
      allowances: v.array(
        v.object({
          metric: v.string(),
          value: v.union(v.number(), v.null()),
          unit: v.string(),
          period: v.string(),
          platform: v.string(),
          excerpt: v.string(),
        }),
      ),
      overage: v.string(),
    }),
  ),
  documentation: v.array(
    v.object({
      kind: v.string(),
      scope: v.string(),
      text: v.string(),
      excerpt: v.string(),
    }),
  ),
  effectiveDate: v.union(v.string(), v.null()),
});
export const refreshStatusValidator = v.union(
  ...(
    [
      "BASELINE",
      "CHANGED",
      "UNCHANGED",
      "INCOMPLETE",
      "ERROR",
      "REPARSED",
    ] as const
  ).map((s) => v.literal(s)),
);
export const productKnowledgeTables = {
  productSources: defineTable({
    key: v.string(),
    provider: v.string(),
    canonicalUrl: v.string(),
    label: v.string(),
    enabled: v.boolean(),
    nextRefreshAt: v.number(),
    latestObservationId: v.optional(v.id("productObservations")),
    latestRunId: v.optional(v.id("productRefreshRuns")),
    lastCompletedAt: v.optional(v.number()),
    leaseToken: v.optional(v.string()),
    leaseUntil: v.optional(v.number()),
  })
    .index("by_key", ["key"])
    .index("by_enabled_and_nextRefreshAt", ["enabled", "nextRefreshAt"]),
  productObservations: defineTable({
    sourceId: v.id("productSources"),
    runId: v.id("productRefreshRuns"),
    capturedAt: v.string(),
    parserVersion: v.string(),
    semanticKey: v.string(),
    facts: offeringFactsValidator,
    rawHash: v.string(),
  }).index("by_sourceId", ["sourceId"]),
  productRefreshRuns: defineTable({
    sourceId: v.id("productSources"),
    token: v.string(),
    startedAt: v.number(),
    capturedAt: v.string(),
    parserVersion: v.string(),
    status: refreshStatusValidator,
    message: v.optional(v.string()),
    rawStorageId: v.optional(v.id("_storage")),
    rawHash: v.optional(v.string()),
    normalizedText: v.optional(v.string()),
    finalUrl: v.optional(v.string()),
    observationId: v.optional(v.id("productObservations")),
  })
    .index("by_sourceId", ["sourceId"])
    .index("by_token", ["token"]),
  productWatches: defineTable({
    userId: v.id("users"),
    sourceId: v.id("productSources"),
    enabled: v.boolean(),
  })
    .index("by_userId_and_sourceId", ["userId", "sourceId"])
    .index("by_sourceId_and_enabled", ["sourceId", "enabled"]),
};

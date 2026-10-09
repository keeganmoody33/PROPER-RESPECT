import { defineTable } from "convex/server";
import { v } from "convex/values";
export const usageConnectionTables = {
  usageSources: defineTable({ userId: v.id("users"), sourceKey: v.string(), deviceDigest: v.string(), retainOnDisconnect: v.boolean(),
    currentGrantId: v.optional(v.id("usageGrants")), context: v.union(v.literal("personal"), v.literal("work"), v.literal("unclassified")), erasing: v.optional(v.boolean()) })
    .index("by_owner_source", ["userId", "sourceKey"]),
  usageGrants: defineTable({ userId: v.id("users"), sourceId: v.id("usageSources"), scopeJson: v.string(),
    codeDigest: v.string(), deviceDigest: v.string(), publicKeyJson: v.optional(v.string()), pairExpiresAt: v.number(), expiresAt: v.number(),
    state: v.union(v.literal("pending"), v.literal("active"), v.literal("revoked")), sequence: v.number(), lastSyncedAt: v.optional(v.string()) })
    .index("by_code", ["codeDigest"]).index("by_owner", ["userId"]).index("by_source", ["sourceId"]),
  usageEvidence: defineTable({ sourceId: v.id("usageSources"), key: v.string(), fingerprint: v.string(), rowJson: v.string() })
    .index("by_source_key_fingerprint", ["sourceId", "key", "fingerprint"]).index("by_source", ["sourceId"]),
  usageReceipts: defineTable({ sourceId: v.id("usageSources"), grantId: v.id("usageGrants"), sequence: v.number(), packetId: v.string(), acceptedAt: v.string() })
    .index("by_grant_sequence", ["grantId", "sequence"]).index("by_source", ["sourceId"]),
};

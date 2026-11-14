import { defineTable } from "convex/server";
import { v } from "convex/values";
import { relationshipLevelValidator, statusValidator } from "./validators";

// Permissive on purpose: ids a product no longer lists still read, and are dropped when shown.
export const productUsesValidator = v.object({ picks: v.array(v.string()), other: v.optional(v.string()) });

export const relationshipStateValidator = v.object({
  status: statusValidator,
  level: v.optional(relationshipLevelValidator),
  goTo: v.boolean(),
  confirmed: v.boolean(),
  headline: v.string(),
  uses: v.optional(productUsesValidator),
  note: v.string(),
  startedAt: v.optional(v.string()),
  supportingUrl: v.optional(v.string()),
  activityEvidenceId: v.optional(v.id("rawEvidence")),
});

export const inventoryTables = {
  relationshipEvents: defineTable({
    userId: v.id("users"), propId: v.id("props"),
    operationId: v.string(), requestJson: v.string(), version: v.number(),
    recordedAt: v.string(), basis: v.literal("OWNER_ASSERTED"),
    before: relationshipStateValidator, after: relationshipStateValidator,
  }).index("by_prop", ["propId"])
    .index("by_prop_operation", ["propId", "operationId"]),
};

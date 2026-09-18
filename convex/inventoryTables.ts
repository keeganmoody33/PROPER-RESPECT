import { defineTable } from "convex/server";
import { v } from "convex/values";
import { statusValidator } from "./validators";

export const relationshipStateValidator = v.object({
  status: statusValidator,
  goTo: v.boolean(),
  confirmed: v.boolean(),
  headline: v.string(),
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

import { z } from "zod";
import { isHttpsUrl } from "./http-url.ts";
import { productUsesSchema } from "./product-uses.ts";
import { creditInputSchema } from "./props-credit.ts";
import { levelMatchesStatus, relationshipLevelSchema } from "./relationship-level.ts";

const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Use a real calendar date, or leave it unknown.").optional();

export const relationshipEditSchema = z.object({
  status: z.enum(["ACTIVE", "TESTING", "ARCHIVED"]),
  level: relationshipLevelSchema.optional(),
  goTo: z.boolean(),
  headline: z.string().trim().max(240),
  uses: productUsesSchema.optional(),
  credit: creditInputSchema.optional(),
  note: z.string().trim().max(4000),
  startedAt: optionalDate,
  // Zod still runs this refine after a failed url check, so it must not throw.
  supportingUrl: z.string().url().max(2048).refine(
    isHttpsUrl,
    "Use an HTTPS work sample or workflow link without credentials.",
  ).optional(),
}).refine(edit => levelMatchesStatus(edit.level, edit.status), {
  message: "This level does not match its status. Choose the level again.",
  path: ["status"],
});
export type RelationshipEdit = z.infer<typeof relationshipEditSchema>;
// Shown when an edit fails one of zod's own checks rather than a written refinement.
export const RELATIONSHIP_EDIT_FALLBACK = "These choices could not be saved. Check each field and try again.";

export const inventoryViews = ["All", "Discoveries", "Current", "Testing", "Go-to", "History", "Used before"] as const;
export type InventoryView = typeof inventoryViews[number];
export function isRelationshipConfirmed(prop: { confirmedAt?: string; visibility: string }) {
  return Boolean(prop.confirmedAt) || prop.visibility !== "DRAFT";
}
export function inInventoryView(view: InventoryView, item: {
  prop: { status: "ACTIVE" | "TESTING" | "ARCHIVED"; visibility: string; goTo?: boolean; confirmedAt?: string };
  previousStatuses: string[];
}) {
  const confirmed = isRelationshipConfirmed(item.prop);
  switch (view) {
    case "All": return true;
    case "Discoveries": return !confirmed;
    case "Current": return confirmed && item.prop.status === "ACTIVE";
    case "Testing": return confirmed && item.prop.status === "TESTING";
    case "Go-to": return confirmed && item.prop.goTo === true && item.prop.status !== "ARCHIVED";
    case "History": return confirmed && (item.previousStatuses.length > 0 || item.prop.status === "ARCHIVED");
    case "Used before": return confirmed && item.prop.status === "ARCHIVED";
  }
}

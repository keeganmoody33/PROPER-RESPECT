import { z } from "zod";

const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Use a real calendar date, or leave it unknown.").optional();

export const relationshipEditSchema = z.object({
  status: z.enum(["ACTIVE", "TESTING", "ARCHIVED"]),
  goTo: z.boolean(),
  headline: z.string().trim().max(240),
  note: z.string().trim().max(4000),
  startedAt: optionalDate,
  supportingUrl: z.string().url().max(2048).refine(value => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  }, "Use an HTTPS work sample or workflow link without credentials.").optional(),
});

export const inventoryViews = ["All", "Discoveries", "Current", "Testing", "Go-to", "History", "Archived"] as const;
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
    case "Archived": return confirmed && item.prop.status === "ARCHIVED";
  }
}

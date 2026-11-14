import { z } from "zod";
import { dayMonthYear } from "./format-period";

// A dated observation, not a promise of today's price or an allocated bundle cost.
export const costSchema = z.object({
  amount: z.number().finite().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  cadence: z.enum(["MONTHLY", "ANNUAL", "ONE_TIME", "UNKNOWN"]),
  basis: z.enum(["RECEIPT", "ESTIMATE", "OWNER_REPORTED"]),
  asOf: z.iso.date(),
  period: z.object({ start: z.iso.date(), end: z.iso.date() })
    .refine(period => period.end >= period.start, "Cost period ends before it starts.").optional(),
});

export type Cost = z.infer<typeof costSchema>;
export type CostVisibility = "PRIVATE" | "PUBLIC";

const CADENCE: Readonly<Record<Cost["cadence"], string>> = { MONTHLY: "/month", ANNUAL: "/year", ONE_TIME: " one-time", UNKNOWN: " (billing interval unknown)" };
const BASIS_TAG: Readonly<Record<Cost["basis"], string>> = { OWNER_REPORTED: "owner-reported", ESTIMATE: "estimated", RECEIPT: "from a receipt" };
const BASIS_NAME: Readonly<Record<Cost["basis"], string>> = { OWNER_REPORTED: "Owner-reported cost", ESTIMATE: "Estimated cost", RECEIPT: "Receipt cost" };

/** "$149/month", or "$149.50/month": cents only when there are some. */
function price(cost: Cost): string {
  const whole = Number.isInteger(cost.amount) ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {};
  return `${new Intl.NumberFormat("en", { style: "currency", currency: cost.currency, ...whole }).format(cost.amount)}${CADENCE[cost.cadence]}`;
}

/** A card's front: the price and who says so, in a few words. */
export function costSummary(cost: Cost): string {
  return `Costs ${price(cost)} · ${BASIS_TAG[cost.basis]}`;
}

/** A card's back: the whole dated record, in the front's words and price. */
export function costDetail(cost: Cost): string {
  const period = cost.period ? ` · ${dayMonthYear(cost.period.start)} to ${dayMonthYear(cost.period.end)}` : "";
  return `${BASIS_NAME[cost.basis]}: ${price(cost)} · as of ${dayMonthYear(cost.asOf)}${period}`;
}

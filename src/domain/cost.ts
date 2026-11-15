import { z } from "zod";
import { dayMonthYear, monthYear } from "./format-period";

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

/** How old a price can be, before today, before the front says when it was true. */
const STALE_PRICE_MONTHS = 6;
const DATE_LENGTH = "yyyy-mm-dd".length;

/** Whether `asOf` is more than six months before `today` (a calendar date or an instant). */
function staleBy(asOf: string, today: string): boolean {
  const day = new Date(`${today.slice(0, DATE_LENGTH)}T00:00:00Z`);
  const month = day.getUTCMonth() - STALE_PRICE_MONTHS;
  // Day 0 of the month after is the target month's last day, so 31 Aug goes back to 28 Feb rather than rolling into March.
  const lastDay = new Date(Date.UTC(day.getUTCFullYear(), month + 1, 0)).getUTCDate();
  const cutoff = new Date(Date.UTC(day.getUTCFullYear(), month, Math.min(day.getUTCDate(), lastDay)));
  return asOf < cutoff.toISOString().slice(0, DATE_LENGTH);
}

/** A price dated after today was never true yet, so it can't read as current. */
const datedAfter = (cost: Cost, today?: string) => today !== undefined && cost.asOf > today.slice(0, DATE_LENGTH);

/** What the card knows about a price beyond the price itself. */
export type CostContext = Readonly<{
  /** The day the card is read: a price much older says when it was true, and one dated later isn't shown as current. */
  today?: string;
  /** An invented example with no owner: its price is a sample, not owner-reported, and never ages. */
  sample?: boolean;
}>;

/** A card's front: the price and who says so, in a few words, and its month when it is old. Nothing for a price dated after today. */
export function costSummary(cost: Cost, { today, sample = false }: CostContext = {}): string | undefined {
  if (sample) return `Costs ${price(cost)} · sample`;
  if (datedAfter(cost, today)) return undefined;
  const when = today && staleBy(cost.asOf, today) ? ` · as of ${monthYear(cost.asOf)}` : "";
  return `Costs ${price(cost)} · ${BASIS_TAG[cost.basis]}${when}`;
}

/** A card's back: the whole dated record, in the front's words and price, saying so when its date is after today. */
export function costDetail(cost: Cost, { today, sample = false }: CostContext = {}): string {
  const period = cost.period ? ` · ${dayMonthYear(cost.period.start)} to ${dayMonthYear(cost.period.end)}` : "";
  const when = !sample && datedAfter(cost, today) ? `dated ${dayMonthYear(cost.asOf)}, after today` : `as of ${dayMonthYear(cost.asOf)}`;
  return `${sample ? "Sample cost" : BASIS_NAME[cost.basis]}: ${price(cost)} · ${when}${period}`;
}

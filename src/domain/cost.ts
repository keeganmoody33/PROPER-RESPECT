import { z } from "zod";

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

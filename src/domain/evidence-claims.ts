import { z } from "zod";

const common = {
  excerpt: z.string().min(1).max(4000).refine(value => value.trim().length > 0, "Excerpt is required."),
  scope: z.enum(["PERSONAL", "ORGANIZATION", "UNKNOWN"]),
  acquisition: z.enum(["SOURCE_REPORTED", "ASSISTANT_EXTRACTED", "USER_SUPPLIED"]),
};
const optionalDates = {
  date: z.iso.date().optional(),
  periodStart: z.iso.date().optional(),
  periodEnd: z.iso.date().optional(),
};
const cadence = z.enum(["MONTHLY", "ANNUAL", "ONE_TIME", "UNKNOWN"]);
export const evidenceObservationSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...common, kind: z.literal("SIGNUP"), date: z.iso.date(), periodEnd: z.iso.date().optional() }),
  z.strictObject({ ...common, kind: z.literal("FIRST_USE"), date: z.iso.date(), periodEnd: z.iso.date().optional() }),
  z.strictObject({ ...common, kind: z.literal("RECENT_USE"), date: z.iso.date(), periodEnd: z.iso.date().optional() }),
  z.strictObject({ ...common, kind: z.literal("PAID_PERIOD"), date: z.iso.date(), periodEnd: z.iso.date().optional() }),
  z.strictObject({ ...common, ...optionalDates, kind: z.literal("USAGE"), metric: z.string().trim().min(1).max(120), value: z.number().finite().nonnegative(), unit: z.string().trim().min(1).max(80) }),
  z.strictObject({ ...common, ...optionalDates, kind: z.literal("SUBSCRIPTION"), plan: z.string().trim().min(1).max(200), billingCadence: cadence.optional() }),
  z.strictObject({ ...common, ...optionalDates, kind: z.literal("PAYMENT"), amount: z.number().finite().nonnegative(), currency: z.string().regex(/^[A-Z]{3}$/).optional(), billingCadence: cadence.optional() }),
]).superRefine((value, ctx) => {
  if (["SIGNUP", "FIRST_USE", "RECENT_USE", "PAID_PERIOD"].includes(value.kind)) {
    if (value.periodEnd && (value.kind !== "PAID_PERIOD" || value.periodEnd < value.date!)) ctx.addIssue({ code: "custom", message: "A paid period must end on or after its start." });
  } else if ("periodStart" in value && value.periodStart && value.periodEnd && value.periodEnd < value.periodStart) {
    ctx.addIssue({ code: "custom", message: "A reporting period must end on or after its start." });
  }
});
export type EvidenceObservation = z.infer<typeof evidenceObservationSchema>;
export const claimVerdicts = ["CORRECT", "INCORRECT", "INCOMPLETE", "UNKNOWN"] as const;
export const claimLabels: Record<EvidenceObservation["kind"], string> = {
  SIGNUP: "Signup evidence",
  FIRST_USE: "First observed use",
  RECENT_USE: "Observed use",
  PAID_PERIOD: "Paid period",
  USAGE: "Usage evidence",
  SUBSCRIPTION: "Subscription evidence",
  PAYMENT: "Payment evidence",
};
export const acquisitionLabels: Record<EvidenceObservation["acquisition"], string> = {
  SOURCE_REPORTED: "Reported by source",
  ASSISTANT_EXTRACTED: "Extracted by assistant",
  USER_SUPPLIED: "Supplied by you",
};
export function claimCaveat(kind: EvidenceObservation["kind"]) {
  if (kind === "USAGE") return "A usage amount; an unknown measurement window stays unknown. Does not establish continuous use.";
  if (kind === "SUBSCRIPTION") return "A subscription statement does not establish payment or actual usage.";
  if (kind === "PAYMENT") return "A payment does not establish activity during the billing period or continuous use.";
  if (kind === "SIGNUP") return "Establishes signup, not first use or continuous use.";
  if (kind === "PAID_PERIOD") return "Establishes a paid period, not activity during that period.";
  if (kind === "FIRST_USE") return "Earliest observed use in the available source, not necessarily your actual start date. Does not establish continuous use.";
  return "Establishes observed activity on this date, not continuous or current use.";
}

export function githubDateObservations(activity: {
  memberSince?: string;
  days: { date: string; count: number }[];
}): EvidenceObservation[] {
  const observations: EvidenceObservation[] = [];
  const common = { scope: "PERSONAL" as const, acquisition: "SOURCE_REPORTED" as const };
  if (activity.memberSince) observations.push({ ...common, kind: "SIGNUP", date: activity.memberSince, excerpt: `"memberSince":"${activity.memberSince}"` });
  const active = activity.days.filter(day => day.count > 0).sort((a, b) => a.date.localeCompare(b.date));
  const first = active[0];
  const last = active.at(-1);
  if (first) observations.push({ ...common, kind: "FIRST_USE", date: first.date, excerpt: JSON.stringify(first) });
  if (last) observations.push({ ...common, kind: "RECENT_USE", date: last.date, excerpt: JSON.stringify(last) });
  return observations.map(value => evidenceObservationSchema.parse(value));
}
export function canUseAsStart(observation: EvidenceObservation, verdict?: string) {
  return verdict === "CORRECT" && observation.kind === "FIRST_USE" && observation.scope === "PERSONAL";
}

export function formatObservation(observation: EvidenceObservation): string {
  const event = observation.date ? `Event: ${observation.date}. ` : "";
  const period = "periodStart" in observation || ["USAGE", "SUBSCRIPTION", "PAYMENT"].includes(observation.kind)
    ? `Period: ${"periodStart" in observation ? observation.periodStart ?? "unknown" : "unknown"} – ${observation.periodEnd ?? "unknown"}`
    : observation.date + (observation.periodEnd ? ` – ${observation.periodEnd}` : "");
  if (observation.kind === "USAGE") return `${event}${observation.metric}: ${observation.value.toLocaleString("en-US")} ${observation.unit}. ${period}`;
  if (observation.kind === "SUBSCRIPTION") return `${event}${observation.plan}; billing: ${observation.billingCadence?.toLowerCase() ?? "unknown"}. ${period}`;
  if (observation.kind === "PAYMENT") return `${event}${observation.amount.toLocaleString("en-US")} ${observation.currency ?? "currency unknown"}; billing: ${observation.billingCadence?.toLowerCase() ?? "unknown"}. ${period}`;
  return period ?? "Date unknown";
}

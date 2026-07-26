import { z } from "zod";
import { attributionScopeSchema, handleSchema } from "./public-profile";

const RESERVED_HANDLES = new Set([
  "api",
  "admin",
  "onboarding",
  "sign-in",
  "sign-up",
]);

export const claimableHandleSchema = z
  .preprocess(
    (value) =>
      typeof value === "string" ? value.trim().toLowerCase() : value,
    handleSchema,
  )
  .refine((handle) => !RESERVED_HANDLES.has(handle), {
    message: "This handle is reserved.",
  });

export const approvedMetricSubscriptionSchema = z.object({
  metricKey: z.string().min(1),
  attributionScope: attributionScopeSchema,
  refreshCadence: z.literal("DAILY"),
  revokedAt: z.iso.datetime().optional(),
});

export type ApprovedMetricSubscription = z.infer<
  typeof approvedMetricSubscriptionSchema
>;

export function canRefreshMetric(
  subscription: ApprovedMetricSubscription,
  requested: {
    metricKey: string;
    attributionScope: ApprovedMetricSubscription["attributionScope"];
  },
) {
  return (
    subscription.revokedAt === undefined &&
    subscription.metricKey === requested.metricKey &&
    subscription.attributionScope === requested.attributionScope
  );
}

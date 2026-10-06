import { e2eReferenceProfile } from "@/src/data/e2e-reference-profile";
import type { PublicMeasurement } from "@/src/domain/measurements";
import type { PublicProfile } from "@/src/domain/public-profile";

export const exactMeasurements: PublicMeasurement[] = [
  {
    metric: "input_tokens", value: "9007199254740993123456789012345678901234567890", unit: "tokens",
    period: { kind: "instant", startUnixNano: "1791240000000000001", endUnixNano: "1791240000000000999" },
    scope: "UNKNOWN", coverage: "PARTIAL", temporality: "DELTA", aggregation: "NON_ADDITIVE",
    capturedAt: "2026-10-06T00:00:00.000Z", status: "measured", sample: "synthetic",
    derivation: "SOURCE_REPORTED", identityBasis: "OWNER_SUPPLIED", activityActor: "UNKNOWN",
  },
  {
    metric: "estimated_cost_usd", value: "0.000000000000000000000000001", unit: "usd",
    period: { kind: "unknown" }, scope: "ACCOUNT", coverage: "UNKNOWN", temporality: "SNAPSHOT", aggregation: "NON_ADDITIVE",
    capturedAt: "2026-10-06T00:00:00.000Z", status: "measured", sample: "synthetic",
    derivation: "SOURCE_REPORTED", identityBasis: "OWNER_SUPPLIED", activityActor: "UNKNOWN",
  },
  {
    metric: "output_tokens", value: "0", unit: "tokens",
    period: { kind: "date", start: "2026-10-05", end: "2026-10-05", timezone: null },
    scope: "WORKSPACE", coverage: "PARTIAL", temporality: "DELTA", aggregation: "NON_ADDITIVE",
    capturedAt: "2026-10-06T00:00:00.000Z", status: "measured", sample: "synthetic",
    derivation: "CUMULATIVE_DIFFERENCE", identityBasis: "OWNER_SUPPLIED", activityActor: "UNKNOWN",
  },
  {
    metric: "cache_read_tokens", value: null, unit: "tokens",
    period: { kind: "unknown" }, scope: "UNKNOWN", coverage: "UNKNOWN", temporality: "CUMULATIVE", aggregation: "NON_ADDITIVE",
    capturedAt: "2026-10-06T00:00:00.000Z", status: "baseline", sample: "unknown",
    derivation: "SOURCE_REPORTED", identityBasis: "OWNER_SUPPLIED", activityActor: "UNKNOWN",
  },
];

export function measurementProfile(): PublicProfile {
  const profile = structuredClone(e2eReferenceProfile);
  profile.cards[0].measurements = structuredClone(exactMeasurements);
  return profile;
}

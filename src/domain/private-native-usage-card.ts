import { z } from "zod";
import type { ClaudeNativeObservation, ClaudeNativeReview, ClaudeNativeRow } from "./claude-native-evidence.ts";

const invalid = () => new Error("Invalid native private projection.");
const localLabel = (kind: string) => z.string().regex(new RegExp(`^Native ${kind} [1-9][0-9]*$`));
const nano = z.string().regex(/^[1-9][0-9]{0,19}$/).refine(value => BigInt(value) <= BigInt("18446744073709551615"));
const facts = {
  scopeLabel: localLabel("scope"), streamLabel: localLabel("stream"), familyLabel: localLabel("family"),
  metric: z.enum(["input", "output", "cacheRead", "cacheCreation", "sourceCostUsd"]),
  quantity: z.string().max(650).regex(/^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$/),
  period: z.strictObject({ startUnixNano: nano, endUnixNano: nano }).refine(value => BigInt(value.startUnixNano) < BigInt(value.endUnixNano)),
  sample: z.enum(["synthetic", "owner-supplied-unverified"]),
  model: z.enum(["claude-haiku-4-5-20251001", "claude-sonnet-4-5-20250929", "claude-opus-4-1-20250805"]).nullable(),
  sourceVersion: z.string().max(32).regex(/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/).nullable(),
  temporality: z.enum(["delta", "cumulative"]),
};
const scalarValid = (value: { metric: string; quantity: string }) => value.metric === "sourceCostUsd" || !value.quantity.includes(".");
const observationSchema = z.strictObject({
  ...facts, observationLabel: localLabel("observation"),
  captures: z.array(z.strictObject({ captureLabel: localLabel("capture"), capturedAt: z.iso.datetime() })).min(1),
}).refine(scalarValid);
const rowSchema = z.strictObject({
  ...facts, status: z.enum(["baseline", "measured", "conflict"]), reasons: z.array(z.string()),
  observationLabels: z.array(localLabel("observation")).min(1).max(2),
  apiEquivalent: z.literal("unpriced"), billed: z.literal("unknown"),
}).refine(scalarValid);
const metadata = (value: z.infer<typeof rowSchema> | z.infer<typeof observationSchema>) => JSON.stringify([
  value.scopeLabel, value.streamLabel, value.familyLabel, value.metric, value.model, value.sourceVersion, value.sample, value.temporality,
]);
export const privateNativeUsageSchema = z.strictObject({
  rows: z.array(rowSchema), observations: z.array(observationSchema),
  replays: z.number().int().nonnegative(), hasConflicts: z.boolean(),
}).superRefine((lane, ctx) => {
  const observations = new Map(lane.observations.map(value => [value.observationLabel, value]));
  if (observations.size !== lane.observations.length || lane.rows.some(row =>
    new Set(row.observationLabels).size !== row.observationLabels.length || row.observationLabels.some(label => {
      const observation = observations.get(label);
      return !observation || metadata(observation) !== metadata(row);
    }))) ctx.addIssue({ code: "custom", message: "Invalid native provenance references." });
});
export type PrivateNativeUsage = z.infer<typeof privateNativeUsageSchema>;
export type PrivateNativeRow = PrivateNativeUsage["rows"][number];
export type PrivateNativeObservation = PrivateNativeUsage["observations"][number];

const knownReasons = new Set([
  "Independent metric stream; no category alignment or global total.",
  "Opaque source identity is not authenticated identity or proof of human activity.",
  "Source cost is an estimate, not an invoice or verified API-equivalent.",
  "Cache creation TTL breakdown is unknown; missing categories remain unknown.",
  "Exact model unknown or unsupported.",
  "Source version unknown; streaming count behavior unvalidated.",
  "Source version predates 2.1.214; streaming counts may be inflated.",
  "Mixed temporality in metric family; entire family quarantined.",
  "Changed source metadata or origin; entire stream quarantined.",
  "Conflicting measurement position; entire stream quarantined.",
  "Overlapping intervals or epochs; entire stream quarantined.",
  "Cumulative decrease within epoch; reset unproven and stream quarantined.",
  "Coverage gap between intervals or epochs.",
  "First cumulative observation is a baseline; no earlier usage inferred.",
  "New cumulative epoch/reset; independent baseline, no bridge.",
]);

/** Resolve source relationships into labels meaningful only within this local preview. */
export function projectPrivateNativeUsage(review: ClaudeNativeReview): PrivateNativeUsage {
  try {
    const scopes = new Map<string, string>(), streams = new Map<string, string>(), families = new Map<string, string>(), captures = new Map<string, string>();
    const label = (map: Map<string, string>, key: string, kind: string) => {
      if (!map.has(key)) map.set(key, `Native ${kind} ${map.size + 1}`);
      return map.get(key)!;
    };
    const select = (value: ClaudeNativeObservation | ClaudeNativeRow) => ({
      scopeLabel: label(scopes, value.keyScopeDigest, "scope"),
      streamLabel: label(streams, `${value.keyScopeDigest}:${value.streamDigest}`, "stream"),
      familyLabel: label(families, `${value.keyScopeDigest}:${value.familyDigest}`, "family"),
      metric: value.metric, quantity: value.quantity,
      period: { startUnixNano: value.startUnixNano, endUnixNano: value.endUnixNano },
      sample: value.sample === "synthetic" ? "synthetic" as const : "owner-supplied-unverified" as const,
      model: value.model, sourceVersion: value.sourceVersion, temporality: value.temporality,
    });
    const evidence = new Map<string, string>();
    const observations = review.observations.map(value => {
      if (evidence.has(value.evidenceDigest)) throw invalid();
      const observationLabel = `Native observation ${evidence.size + 1}`;
      evidence.set(value.evidenceDigest, observationLabel);
      return { ...select(value), observationLabel, captures: value.captureProvenance.map(capture => ({
        captureLabel: label(captures, capture.captureDigest, "capture"), capturedAt: capture.capturedAt,
      })) };
    });
    const rows = review.rows.map(value => ({
      ...select(value), status: value.status,
      reasons: [...new Set(value.reasons.map(reason => knownReasons.has(reason) ? reason : "Additional source diagnostic unavailable in this private projection."))],
      observationLabels: value.evidenceDigests.map(digest => {
        const reference = evidence.get(digest);
        if (!reference) throw invalid();
        return reference;
      }),
      apiEquivalent: "unpriced" as const, billed: "unknown" as const,
    }));
    return privateNativeUsageSchema.parse({ rows, observations, replays: review.replays, hasConflicts: review.hasConflicts });
  } catch { throw invalid(); }
}

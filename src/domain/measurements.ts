import { z } from "zod";
import { sha256 } from "@noble/hashes/sha2.js";
import { canonicalJson } from "./canonical-json.ts";
import { parseExactJson } from "./exact-json.ts";
import { normalizeNativeDecimal, parseClaudeNativeCapture, reviewClaudeNativeCaptures, type ClaudeNativeCapture } from "./claude-native-evidence.ts";
import { parseCodexUsageCapturePortable, reviewCodexUsageCaptures, type CodexUsageCapture } from "./codex-usage.ts";

export const MEASUREMENT_LIMITS = { bytes: 256_000, captures: 32, retainedBytes: 750_000, reviews: 256, rows: 8192, publicRows: 24, publicSources: 8 } as const;
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/);
const metricKey = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);
const nano = z.string().regex(/^(0|[1-9][0-9]{0,19})$/).refine(value => BigInt(value) <= BigInt("18446744073709551615"));
const scalar = z.string().max(650).refine(value => {
  try { return !value.startsWith("-") && normalizeNativeDecimal(value) === value; } catch { return false; }
}, "Use a canonical, nonnegative exact decimal string.").nullable();
export const measurementPeriodSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("unknown") }),
  z.strictObject({ kind: z.literal("date"), start: z.iso.date(), end: z.iso.date(), timezone: z.string().regex(/^[A-Za-z_]+(?:\/[A-Za-z_+-]+)*$/).max(80).nullable() }).refine(value => value.start <= value.end),
  z.strictObject({ kind: z.literal("instant"), startUnixNano: nano, endUnixNano: nano }).refine(value => BigInt(value.startUnixNano) < BigInt(value.endUnixNano)),
]);
export const measurementSourceSchema = z.strictObject({
  namespace: identifier, identityBasis: z.literal("OWNER_SUPPLIED"), sourceAlias: identifier,
  ownerAlias: identifier.nullable(), accountAlias: identifier.nullable(), workspaceAlias: identifier.nullable(), deviceAlias: identifier.nullable(),
});
const measuredShape = {
  metric: metricKey, value: scalar, unit: metricKey, period: measurementPeriodSchema,
  scope: z.enum(["ACCOUNT", "WORKSPACE", "DEVICE", "THREAD", "UNKNOWN"]),
  coverage: z.enum(["COMPLETE", "PARTIAL", "UNKNOWN"]),
  temporality: z.enum(["SNAPSHOT", "DELTA", "CUMULATIVE"]),
  aggregation: z.enum(["SNAPSHOT", "DISTINCT", "NON_ADDITIVE"]),
};
const genericRowSchema = z.strictObject({ id: identifier, ...measuredShape, overlapGroup: identifier.nullable() });
const genericCaptureSchema = z.strictObject({
  format: z.literal("proper-measurements-v1"), captureId: identifier, capturedAt: z.iso.datetime(),
  source: measurementSourceSchema, measurements: z.array(genericRowSchema).min(1).max(512),
}).refine(value => new Set(value.measurements.map(row => row.id)).size === value.measurements.length);
const dimensionsSchema = z.strictObject({ model: identifier.nullable(), reasoningEffort: identifier.nullable(), speed: identifier.nullable(), threadAlias: identifier.nullable() });
export const measurementSchema = z.strictObject({
  id: z.string().regex(/^[a-f0-9]{64}$/), ...measuredShape,
  capturedAt: z.iso.datetime(), status: z.enum(["measured", "baseline", "conflict"]),
  sample: z.enum(["synthetic", "owner-supplied", "unknown"]), derivation: z.enum(["SOURCE_REPORTED", "CUMULATIVE_DIFFERENCE", "SUMMED_RESPONSES"]),
  overlapGroup: z.string().min(1).max(256).nullable(), dimensions: dimensionsSchema,
  reasons: z.array(z.string().max(300)).max(16),
});
export type Measurement = z.infer<typeof measurementSchema>;
export const publicMeasurementSchema = z.strictObject({
  ...measuredShape, capturedAt: z.iso.datetime(), status: z.enum(["measured", "baseline"]),
  identityBasis: z.literal("OWNER_SUPPLIED"), activityActor: z.literal("UNKNOWN"),
  sample: z.enum(["synthetic", "owner-supplied", "unknown"]), derivation: z.enum(["SOURCE_REPORTED", "CUMULATIVE_DIFFERENCE", "SUMMED_RESPONSES"]),
});
export type PublicMeasurement = z.infer<typeof publicMeasurementSchema>;
export type MeasurementSource = z.infer<typeof measurementSourceSchema>;
type ImportCommon = { captureId: string; capturedAt: string; source: MeasurementSource; sourceKey: string; digest: string };
export type MeasurementImport = ImportCommon & (
  | { adapter: "claude-code"; capture: ClaudeNativeCapture }
  | { adapter: "codex"; capture: CodexUsageCapture }
  | { adapter: "metric-packet"; capture: z.infer<typeof genericCaptureSchema> }
);
export const measurementDigest = (value: unknown) => [...sha256(new TextEncoder().encode(canonicalJson(value)))].map(byte => byte.toString(16).padStart(2, "0")).join("");
const noDimensions = { model: null, reasoningEffort: null, speed: null, threadAlias: null };
const commonReasons = ["Owner-supplied aliases are not authenticated provider identity.", "Activity actor is unknown. No proof of human activity.", "Snapshots and overlapping views must not be added."];
function common(capture: unknown, source: MeasurementSource, captureId: string, capturedAt: string): ImportCommon {
  return { source, captureId, capturedAt, sourceKey: measurementDigest(source), digest: measurementDigest(capture) };
}

/** Only strict sanitized schemas cross this boundary. Raw OTLP, prompts and reports reject. */
export function parseMeasurementImport(text: string): MeasurementImport {
  try {
    const input = parseExactJson(text);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error();
    if ("format" in input && input.format === "claude-code-native-metrics-v1") {
      const capture = parseClaudeNativeCapture(text);
      const source: MeasurementSource = { namespace: "claude-code", identityBasis: "OWNER_SUPPLIED", sourceAlias: capture.keyScopeDigest, ownerAlias: null, accountAlias: null, workspaceAlias: null, deviceAlias: null };
      // Native export has no capture ID. Its reported capture instant identifies a
      // receipt within its opaque source scope; changed bytes at that position conflict.
      return { adapter: "claude-code", capture, ...common(capture, source, capture.capturedAt, capture.capturedAt) };
    }
    if ("format" in input && input.format === "proper-measurements-v1") {
      const capture = genericCaptureSchema.parse(input);
      return { adapter: "metric-packet", capture, ...common(capture, capture.source, capture.captureId, capture.capturedAt) };
    }
    const capture = parseCodexUsageCapturePortable(text);
    const source: MeasurementSource = { namespace: "codex", identityBasis: "OWNER_SUPPLIED", sourceAlias: "account-usage-read", ownerAlias: capture.scope.ownerAlias, accountAlias: capture.scope.accountAlias, workspaceAlias: null, deviceAlias: null };
    return { adapter: "codex", capture, ...common(capture, source, capture.capture.id, capture.capture.capturedAt) };
  } catch { throw new Error("Use a supported sanitized Claude, Codex, or proper-measurements-v1 JSON capture. Raw prompts, private workspace content and Markdown reports are not accepted."); }
}

function codexRows(captures: CodexUsageCapture[]): Measurement[] {
  const review = reviewCodexUsageCaptures(captures);
  if (review.accounts.some(account => account.conflicts.length)) throw new Error("Conflicting Codex capture identity.");
  const rows: Measurement[] = [];
  for (const account of review.accounts) for (const snapshot of account.snapshots) {
    const { summary, dailyUsageBuckets, threadUsage } = snapshot.response;
    const base = { capturedAt: snapshot.capture.capturedAt, period: { kind: "unknown" } as const, scope: "ACCOUNT" as const, coverage: "UNKNOWN" as const, temporality: "SNAPSHOT" as const, aggregation: "NON_ADDITIVE" as const, status: "measured" as const, sample: "unknown" as const, derivation: "SOURCE_REPORTED" as const, overlapGroup: measurementDigest([account.ownerAlias, account.accountAlias]), dimensions: noDimensions, reasons: commonReasons };
    const add = (key: string, metric: string, count: number | null, unit: string, extra: Partial<Measurement> = {}) => {
      rows.push(measurementSchema.parse({ ...base, id: measurementDigest([snapshot.metadataSha256, key]), metric, value: count === null ? null : String(count), unit, ...extra }));
    };
    add("lifetime", "lifetime_tokens", summary.lifetimeTokens, "tokens");
    add("streak", "current_streak", summary.currentStreakDays, "days");
    add("longest-streak", "longest_streak", summary.longestStreakDays, "days");
    add("peak", "peak_daily_tokens", summary.peakDailyTokens, "tokens");
    add("turn", "longest_running_turn", summary.longestRunningTurnSec, "seconds");
    for (const day of dailyUsageBuckets ?? []) add(`daily:${day.startDate}`, "daily_tokens", day.tokens, "tokens", { period: { kind: "date", start: day.startDate, end: day.startDate, timezone: null }, coverage: "PARTIAL" });
    if (threadUsage) {
      const dimensions = { ...noDimensions, threadAlias: threadUsage.threadId };
      const scope = "THREAD";
      add("thread-credit", "estimated_credits_micros", threadUsage.estimatedUsageCreditsMicros, "credit_micros", { scope, dimensions });
      add("thread-usd", "estimated_usd_micros", threadUsage.estimatedUsageUsdMicros, "usd_micros", { scope, dimensions });
      for (const [index, group] of threadUsage.groups.entries()) {
        const groupDimensions = { model: group.model, reasoningEffort: group.reasoningEffort, speed: group.speed, threadAlias: threadUsage.threadId };
        const quantities = [["input_tokens", group.inputTokens], ["cached_input_tokens", group.cachedInputTokens], ["net_new_input_tokens", group.netNewInputTokens], ["output_tokens", group.outputTokens], ["total_tokens", group.totalTokens]] as const;
        for (const [metric, count] of quantities) add(`group:${index}:${metric}`, metric, count, "tokens", { scope, dimensions: groupDimensions });
        add(`group:${index}:credit`, "estimated_credits_micros", group.estimatedUsageCreditsMicros, "credit_micros", { scope, dimensions: groupDimensions });
      }
    }
  }
  return rows;
}

/** Reconciles only one source identity; never adds accounts, snapshots or views. */
export function reviewMeasurementImports(imports: readonly MeasurementImport[]): Measurement[] {
  if (!imports.length || imports.length > MEASUREMENT_LIMITS.captures) throw new Error("Measurement history exceeds the bounded import limit.");
  if (new Set(imports.map(item => `${item.adapter}:${item.sourceKey}`)).size !== 1) throw new Error("Review one measurement source at a time.");
  let rows: Measurement[];
  const first = imports[0];
  if (first.adapter === "claude-code") {
    const captures = imports.flatMap(item => item.adapter === "claude-code" ? [item.capture] : []);
    const review = reviewClaudeNativeCaptures(captures);
    const metricNames = { input: "input_tokens", output: "output_tokens", cacheRead: "cache_read_tokens", cacheCreation: "cache_creation_tokens", sourceCostUsd: "estimated_cost_usd" };
    rows = review.rows.map(row => {
      const capturedAt = review.observations.filter(item => row.evidenceDigests.includes(item.evidenceDigest)).flatMap(item => item.captureProvenance.map(provenance => provenance.capturedAt)).sort().at(-1)!;
      return measurementSchema.parse({
        id: measurementDigest(row), metric: metricNames[row.metric], value: row.quantity, unit: row.metric === "sourceCostUsd" ? "usd" : "tokens",
        period: { kind: "instant", startUnixNano: row.startUnixNano, endUnixNano: row.endUnixNano },
        scope: "UNKNOWN", coverage: "PARTIAL", temporality: row.temporality === "delta" ? "DELTA" : "CUMULATIVE", aggregation: "NON_ADDITIVE",
        status: row.status, sample: row.sample, derivation: row.temporality === "cumulative" && row.status === "measured" ? "CUMULATIVE_DIFFERENCE" : "SOURCE_REPORTED", capturedAt, overlapGroup: row.familyDigest, dimensions: { ...noDimensions, model: row.model }, reasons: row.reasons,
      });
    });
  } else if (first.adapter === "codex") {
    rows = codexRows(imports.flatMap(item => item.adapter === "codex" ? [item.capture] : []));
  } else {
    rows = imports.flatMap(item => item.adapter === "metric-packet" ? item.capture.measurements.map(row => measurementSchema.parse({
      ...row, id: measurementDigest([item.digest, row.id]), capturedAt: item.capturedAt, status: "measured", sample: "unknown", derivation: "SOURCE_REPORTED", dimensions: noDimensions, reasons: commonReasons,
    })) : []);
  }
  if (rows.length > MEASUREMENT_LIMITS.rows) throw new Error("Too many measurement rows.");
  return rows;
}

/** Whitelist projection. Private aliases, provenance, hashes and dimensions never copy. */
export function projectMeasurement(row: Measurement): PublicMeasurement {
  if (row.status === "conflict") throw new Error("Conflicting measurements cannot be published.");
  return publicMeasurementSchema.parse({
    metric: row.metric, value: row.value, unit: row.unit, period: row.period,
    scope: row.scope, coverage: row.coverage, temporality: row.temporality, aggregation: row.aggregation,
    capturedAt: row.capturedAt, status: row.status, sample: row.sample, derivation: row.derivation, identityBasis: "OWNER_SUPPLIED", activityActor: "UNKNOWN",
  });
}

import { z } from "zod";
import type { UsageCostReport } from "./usage-cost-report.ts";
import type { ClaudeMetricObservation, ClaudeMetricRow } from "./claude-metric-evidence.ts";

export const PRIVATE_USAGE_UNSUPPORTED_NATIVE = "Native single-metric evidence is not supported by this private card preview. Use the native metrics report.";

const integer = z.string().regex(/^(0|[1-9][0-9]*)$/);
const decimal = z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]{1,12})?$/);
const fields = {
  sample: z.enum(["synthetic", "owner-supplied-unverified", "origin-unverified"]),
  model: z.string().nullable(), sourceVersion: z.string().nullable(), capturedAt: z.iso.datetime().nullable(),
  period: z.strictObject({ start: z.iso.datetime(), end: z.iso.datetime(), timezone: z.enum(["UTC", "unknown"]) }).nullable(),
  counts: z.array(z.strictObject({ label: z.string(), value: integer.nullable() })),
  sourceEstimateUsd: decimal.nullable(), reasons: z.array(z.string()),
};
const apiEquivalentSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("unpriced"), reasons: z.array(z.string()) }),
  z.strictObject({ kind: z.literal("synthetic-api-equivalent"), exactUsd: decimal, rateVersion: z.string(), rateSource: z.url() }),
]);
const rowSchema = z.strictObject({ ...fields, status: z.enum(["measured", "baseline", "conflict", "account-snapshot"]), apiEquivalent: apiEquivalentSchema, billed: z.literal("unknown") });
const observationSchema = z.strictObject({ ...fields, status: z.literal("source-observation"), temporality: z.enum(["delta", "cumulative"]) });
export const privateUsageCardSchema = z.strictObject({
  version: z.literal("private-usage-card-v1"), productSlug: z.enum(["claude-code", "codex"]),
  rows: z.array(rowSchema), observations: z.array(observationSchema),
  replays: z.number().int().nonnegative(), hasConflicts: z.boolean(), connection: z.literal("unavailable"),
});
export type PrivateUsageRow = z.infer<typeof rowSchema>;
export type PrivateUsageObservation = z.infer<typeof observationSchema>;
export type PrivateUsageCard = z.infer<typeof privateUsageCardSchema>;
export type PrivateUsagePreview = {
  version: "private-usage-preview-v1"; replays: number; hasConflicts: boolean; tools: PrivateUsageCard[];
};

const knownReasons = new Set([
  "Caller-declared stream identity and bundle alignment; not authenticated identity or human activity.",
  "Source version unknown; streaming count behavior unvalidated.",
  "Source version predates 2.1.214 or is unsupported; streaming counts may be inflated.",
  "Exact model unknown or mixed.", "Missing token categories remain unknown.",
  "Reporting timezone unknown; interval instants remain UTC.",
  "Conflicting point identity; entire logical stream quarantined.",
  "Conflicting capture identity; entire logical stream quarantined.",
  "Changed stream model, version, origin or metric identity; entire logical stream quarantined.",
  "Mixed temporality in one logical stream; overlap unresolved.",
  "Conflicting measurement position; entire logical stream quarantined.",
  "Overlapping intervals or epochs; entire logical stream quarantined.",
  "Cumulative counter or source cost decreased within epoch; reset unproven and stream quarantined.",
  "Coverage gap between intervals or epochs.",
  "First cumulative observation is a baseline; no usage inferred before it.",
  "New cumulative epoch/reset; independent baseline, no bridge.",
  "Missing endpoint prevents category difference; unknown is not zero.",
  "coverage-baseline", "coverage-conflict", "owner-data-pricing-conditions-not-verified",
  "no-explicit-synthetic-valuation-scenario", "unknown-mixed-or-unmatched-exact-model",
  "missing-client-version", "client-version-outside-reviewed-2.1.214-to-2.1.274-range",
  "reporting-timezone-unknown", "outside-dated-scenario-no-historical-rate",
  "missing-token-category", "cache-creation-ttl-unknown",
]);
const pricingReasons: Record<string, string> = {
  "coverage-baseline": "A cumulative baseline cannot be priced as interval usage.",
  "coverage-conflict": "Conflicting coverage cannot be priced.",
  "owner-data-pricing-conditions-not-verified": "Pricing conditions for owner-supplied data have not been verified.",
  "no-explicit-synthetic-valuation-scenario": "No synthetic pricing example was selected.",
  "unknown-mixed-or-unmatched-exact-model": "The exact model is unknown, mixed or outside the selected pricing example.",
  "missing-client-version": "The source client version is unknown.",
  "client-version-outside-reviewed-2.1.214-to-2.1.274-range": "The client version is outside the reviewed pricing range.",
  "reporting-timezone-unknown": "The reporting timezone is unknown.",
  "outside-dated-scenario-no-historical-rate": "The interval is outside the dated pricing example; no historical rate was established.",
  "missing-token-category": "A token category is missing; the estimate remains unpriced.",
  "cache-creation-ttl-unknown": "Cache creation duration is unknown; the estimate remains unpriced.",
};
const safeReasons = (reasons: readonly string[]) => [...new Set(reasons.map(reason => knownReasons.has(reason) ? pricingReasons[reason] ?? reason : "Additional source diagnostic unavailable in this private projection."))];
function claudeFacts(value: ClaudeMetricObservation | ClaudeMetricRow) {
  return {
    sample: value.sample === "synthetic" ? "synthetic" as const : "owner-supplied-unverified" as const,
    model: value.model, sourceVersion: value.sourceVersion, capturedAt: value.capturedAt,
    period: { start: value.start, end: value.end, timezone: value.timezone },
    counts: [
      { label: "Input tokens", value: value.counts.input },
      { label: "Output tokens", value: value.counts.output },
      { label: "Cache read tokens", value: value.counts.cacheRead },
      { label: "Cache creation tokens", value: value.counts.cacheCreation },
    ],
    sourceEstimateUsd: value.sourceCostUsd,
  };
}

/** Local presentation only: never attach this projection to a saved/public card. */
export function projectPrivateUsage(report: UsageCostReport): PrivateUsagePreview {
  if (report.nativeClaude) throw new Error(PRIVATE_USAGE_UNSUPPORTED_NATIVE);
  if (report.valuations.length !== (report.claude?.rows.length ?? 0)) throw new Error("Usage valuation count does not match reconciled rows.");
  const tools: PrivateUsageCard[] = [];
  if (report.claude) {
    const rows: PrivateUsageRow[] = report.claude.rows.map((row, index) => {
      const valuation = report.valuations[index];
      if (!valuation) throw new Error("Missing usage valuation.");
      const apiEquivalent: PrivateUsageRow["apiEquivalent"] = valuation.kind === "api-equivalent"
        && row.sample === "synthetic" && row.status === "measured"
        ? { kind: "synthetic-api-equivalent", exactUsd: valuation.exactUsd, rateVersion: valuation.rateVersion, rateSource: valuation.rateSource }
        : { kind: "unpriced", reasons: valuation.kind === "unpriced" ? safeReasons(valuation.reasons) : ["Synthetic valuation conditions not satisfied."] };
      return { ...claudeFacts(row), status: row.status, reasons: safeReasons(row.reasons), apiEquivalent, billed: "unknown" };
    });
    tools.push(privateUsageCardSchema.parse({
      version: "private-usage-card-v1", productSlug: "claude-code", rows,
      observations: report.claude.observations.map(value => ({ ...claudeFacts(value), status: "source-observation", temporality: value.temporality, reasons: ["Source observation; not additive to reconciled coverage."] })),
      replays: report.claude.replays, hasConflicts: report.claude.hasConflicts, connection: "unavailable",
    }));
  }
  if (report.codex) {
    const rows: PrivateUsageRow[] = [];
    for (const account of report.codex.accounts) {
      for (const snapshot of account.snapshots) rows.push({
        sample: "origin-unverified", model: null, sourceVersion: snapshot.source.version, capturedAt: snapshot.capture.capturedAt,
        period: null, status: "account-snapshot",
        counts: [{ label: "Lifetime tokens (account snapshot)", value: snapshot.response.summary.lifetimeTokens === null ? null : String(snapshot.response.summary.lifetimeTokens) }],
        sourceEstimateUsd: null, apiEquivalent: { kind: "unpriced", reasons: ["Account snapshot lacks model/category split, period and pricing tier."] }, billed: "unknown",
        reasons: ["Source-reported account snapshot; overlapping views are not additive.", "Capture timestamp is supplied metadata; freshness and origin are unverified."],
      });
      for (const _conflict of account.conflicts) {
        void _conflict;
        rows.push({ sample: "origin-unverified", model: null, sourceVersion: null, capturedAt: null, period: null, status: "conflict", counts: [], sourceEstimateUsd: null,
          apiEquivalent: { kind: "unpriced", reasons: ["Conflicting account snapshot variants quarantined; none selected."] }, billed: "unknown", reasons: ["Conflicting account snapshot variants quarantined; none selected."] });
      }
    }
    tools.push(privateUsageCardSchema.parse({ version: "private-usage-card-v1", productSlug: "codex", rows, observations: [], replays: report.codex.replays, hasConflicts: report.codex.accounts.some(account => account.conflicts.length > 0), connection: "unavailable" }));
  }
  return { version: "private-usage-preview-v1", replays: report.replays, hasConflicts: report.hasConflicts, tools };
}

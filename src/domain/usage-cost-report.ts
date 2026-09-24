import { parseClaudeNativeCapture, reviewClaudeNativeCaptures } from "./claude-native-evidence.ts";
import { CODEX_USAGE_LIMITS, parseCodexUsageCapture, reviewCodexUsageCaptures, formatCodexUsagePreview } from "./codex-usage.ts";
import { parseClaudeMetricsCapture, reviewClaudeMetricsCaptures } from "./claude-metric-evidence.ts";
import type { ClaudeMetricRow } from "./claude-metric-evidence.ts";

export const USAGE_REPORT_LIMITS = { files: 32, bytes: 256_000 } as const;
export const SYNTHETIC_SCENARIO = "haiku-standard-20260924";
export const USAGE_RATE = Object.freeze({
  version: "anthropic-haiku-documentation-2026-09-24-v1",
  observedOn: "2026-09-24",
  model: "claude-haiku-4-5-20251001",
  currency: "USD",
  units: "USD per 1000000 tokens",
  input: "1", output: "5", cacheRead: "0.10",
  source: "https://platform.claude.com/docs/en/models/haiku-4-5/overview",
  pricingSource: "https://platform.claude.com/docs/en/about-claude/pricing",
  assumptions: "Synthetic only: direct Anthropic API, standard synchronous tier, normal speed, global geography, at most 200K context, no additional paid features; cache creation exactly zero.",
  applicability: "Explicit same-day documentation scenario; historical effective dates are not established.",
});

type Valuation = { kind: "unpriced"; reasons: string[] } | {
  kind: "api-equivalent"; currency: "USD"; exactUsd: string; formula: string;
  rateVersion: string; rateSource: string; evidenceDigests: string[];
};
type Options = { syntheticScenario?: typeof SYNTHETIC_SCENARIO };
const invalid = () => new Error("Invalid usage report input.");
const PICO = BigInt("1000000000000");

function exactUsd(pico: bigint): string {
  return `${pico / PICO}.${String(pico % PICO).padStart(12, "0")}`;
}

function valueRow(row: ClaudeMetricRow, options: Options): Valuation {
  const reasons: string[] = [];
  if (row.status !== "measured") reasons.push(`coverage-${row.status}`);
  if (row.sample !== "synthetic") reasons.push("owner-data-pricing-conditions-not-verified");
  if (!options.syntheticScenario) reasons.push("no-explicit-synthetic-valuation-scenario");
  if (row.model !== USAGE_RATE.model) reasons.push("unknown-mixed-or-unmatched-exact-model");
  if (row.sourceVersion === null) reasons.push("missing-client-version");
  else if (!/^2\.1\.(214|21[5-9]|2[2-6][0-9]|27[0-4])$/.test(row.sourceVersion)) reasons.push("client-version-outside-reviewed-2.1.214-to-2.1.274-range");
  if (row.timezone !== "UTC") reasons.push("reporting-timezone-unknown");
  if (row.start < "2026-09-24T00:00:00.000Z" || row.end > "2026-09-25T00:00:00.000Z") reasons.push("outside-dated-scenario-no-historical-rate");
  if (Object.values(row.counts).some(value => value === null)) reasons.push("missing-token-category");
  if (row.counts.cacheCreation !== null && row.counts.cacheCreation !== "0") reasons.push("cache-creation-ttl-unknown");
  if (reasons.length) return { kind: "unpriced", reasons };
  const input = BigInt(row.counts.input!), output = BigInt(row.counts.output!), cacheRead = BigInt(row.counts.cacheRead!);
  const pico = input * BigInt(1_000_000) + output * BigInt(5_000_000) + cacheRead * BigInt(100_000);
  return {
    kind: "api-equivalent", currency: "USD", exactUsd: exactUsd(pico),
    formula: `(${input} × 1 + ${output} × 5 + ${cacheRead} × 0.10) / 1000000 USD; cacheCreation = 0`,
    rateVersion: USAGE_RATE.version, rateSource: USAGE_RATE.source, evidenceDigests: [...row.evidenceDigests],
  };
}

/** Pure local report over explicit file contents; pricing never changes source evidence. */
export function buildUsageCostReport(texts: readonly string[], options: Options = {}) {
  try {
    if (!Array.isArray(texts) || !texts.length || texts.length > USAGE_REPORT_LIMITS.files ||
        !options || Object.keys(options).some(key => key !== "syntheticScenario") ||
        (options.syntheticScenario !== undefined && options.syntheticScenario !== SYNTHETIC_SCENARIO)) throw invalid();
    const codexInputs = [], claudeInputs = [], nativeInputs = [];
    for (const text of texts) {
      if (typeof text !== "string" || text.length > USAGE_REPORT_LIMITS.bytes || new TextEncoder().encode(text).length > USAGE_REPORT_LIMITS.bytes) throw invalid();
      const route: unknown = JSON.parse(text);
      if (route && typeof route === "object" && "format" in route && route.format === "claude-code-sanitized-metrics-v1") {
        claudeInputs.push(parseClaudeMetricsCapture(text));
      } else if (route && typeof route === "object" && "format" in route && route.format === "claude-code-native-metrics-v1") {
        nativeInputs.push(parseClaudeNativeCapture(text));
      } else {
        codexInputs.push(parseCodexUsageCapture(text));
      }
    }
    if (codexInputs.length > CODEX_USAGE_LIMITS.captures) throw invalid();
    const codex = codexInputs.length ? reviewCodexUsageCaptures(codexInputs) : null;
    const claude = claudeInputs.length ? reviewClaudeMetricsCaptures(claudeInputs) : null;
    const nativeClaude = nativeInputs.length ? reviewClaudeNativeCaptures(nativeInputs) : null;
    const valuations = (claude?.rows ?? []).map(row => valueRow(row, options));
    return {
      ruleVersion: "usage-cost-report-v1", scenario: options.syntheticScenario ?? null,
      codex, claude, valuations, nativeClaude,
      replays: (codex?.replays ?? 0) + (claude?.replays ?? 0) + (nativeClaude?.replays ?? 0),
      hasConflicts: Boolean(codex?.accounts.some(account => account.conflicts.length) || claude?.hasConflicts || nativeClaude?.hasConflicts),
    };
  } catch { throw invalid(); }
}

export type UsageCostReport = ReturnType<typeof buildUsageCostReport>;
const quantity = (value: string | number | null) => value === null ? "unknown" : String(value);

export function formatUsageCostReport(report: UsageCostReport): string {
  const lines = [
    "# Private usage and cost report",
    "Local explicit-file import. No acquisition, collector, network, persistence or publication.",
    "No global total: independent coverage sets, snapshots, sessions and tools may overlap.",
    "Billed: unknown. No invoice or subscription evidence imported. Source estimates are approximate, not charges.",
    "API equivalent is a counterfactual list-price scenario, not compute cost, savings or an actual bill.",
    "Aliases and stream identities are caller-declared; an account, session or process is not proof of a human's work or productivity.",
    "Claude input/cacheRead/cacheCreation are separate source categories. Codex cached input is included in input; reasoning is included in output.",
    `Rule: ${report.ruleVersion}. Semantic replays ignored: ${report.replays}. Conflicts: ${report.hasConflicts ? "yes" : "no"}.`,
    `Valuation scenario: ${report.scenario ?? "none (all usage unpriced)"}.`,
    "",
    "| Tool / provider / sample | Model | Covered period UTC / status | Input | Output | Cache read | Cache creation | Source estimate USD | API equivalent USD | Actual billed USD | Coverage / unknown reason |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- |",
  ];
  for (const account of report.codex?.accounts ?? []) {
    for (const snapshot of account.snapshots) lines.push(
      `| Codex / OpenAI / origin unverified | unknown | unknown / account snapshot | unknown | unknown | unknown | unknown | unknown | unpriced | unknown | Source lifetime tokens ${quantity(snapshot.response.summary.lifetimeTokens)}; missing model/category split/period/tier; account ${account.accountAlias}; overlapping views below |`,
    );
    for (const conflict of account.conflicts) lines.push(`| Codex / OpenAI | unknown | conflict | unknown | unknown | unknown | unknown | unknown | unpriced | unknown | ${conflict.captureId}: incompatible variants quarantined |`);
  }
  for (const [index, row] of (report.claude?.rows ?? []).entries()) {
    const valuation = report.valuations[index];
    const reason = [...row.reasons, ...(valuation.kind === "unpriced" ? valuation.reasons : ["synthetic assumptions; bounded observed interval only"])].join("; ");
    lines.push(`| Claude Code / Anthropic / ${row.sample === "synthetic" ? "SYNTHETIC" : "owner-supplied (unverified)"} | ${row.model ?? "unknown"} | ${row.start} → ${row.end} / ${row.status} | ${quantity(row.counts.input)} | ${quantity(row.counts.output)} | ${quantity(row.counts.cacheRead)} | ${quantity(row.counts.cacheCreation)} | ${quantity(row.sourceCostUsd)} | ${valuation.kind === "api-equivalent" ? valuation.exactUsd : "unpriced"} | unknown | ${reason} |`);
  }
  for (const [index, row] of (report.claude?.rows ?? []).entries()) {
    const valuation = report.valuations[index];
    lines.push("", `## Claude row ${index + 1}: provenance and calculation`,
      `Owner/account/device: ${row.ownerAlias} / ${row.accountAlias} / ${row.deviceAlias}.`,
      `Client version: ${row.sourceVersion ?? "unknown"}. Reporting timezone: ${row.timezone}. Captured: ${row.capturedAt}.`,
      `Session/process: ${row.sessionAlias} / ${row.processAlias}. Namespace: ${row.namespace}. Stream: ${row.streamDigest}.`,
      `Evidence SHA-256: ${row.evidenceDigests.join(", ")}.`,
      row.status === "baseline" ? "Baseline counts are observed cumulative values, not measured increments." : "Derived rows are recomputed from this input batch; late arrivals can replace prior intervals.",
      valuation.kind === "api-equivalent" ? `${valuation.formula} = ${valuation.exactUsd} USD exactly (12 decimal places; no rounding). Rate: ${valuation.rateVersion}.` : `Unpriced: ${valuation.reasons.join("; ")}.`);
  }
  if (report.scenario) lines.push("", "## Explicit synthetic rate scenario", USAGE_RATE.assumptions, USAGE_RATE.applicability,
    `Observed ${USAGE_RATE.observedOn}; ${USAGE_RATE.units}: input ${USAGE_RATE.input}, output ${USAGE_RATE.output}, cacheRead ${USAGE_RATE.cacheRead}.`,
    `[Model and rates](${USAGE_RATE.source}); [pricing conditions](${USAGE_RATE.pricingSource}).`);
  if (report.claude) lines.push("", "## Claude source observations (not additive)",
    "Strict sanitized contract, not native OTLP. Original category facts and capture provenance remain separate from calculations.",
    "```json", JSON.stringify(report.claude.observations, null, 2), "```", ...report.claude.diagnostics);
  if (report.nativeClaude) {
    lines.push("", "## Native Claude metrics (independent streams)",
      "Exact exported decimal representation and Unix nanoseconds; no category alignment or global totals.",
      "Identity is locally keyed, not authenticated account coverage. Native source estimates are approximate; API equivalent unpriced; actual billed unknown.",
      "Each category arrives independently. Missing categories remain unknown; cache creation TTL is unavailable.",
      "Old clients before 2.1.214 may inflate streaming counters; unknown client versions remain unvalidated.",
      "| Metric | Model | Start Unix ns | End Unix ns | Status | Exact quantity | Coverage |",
      "| --- | --- | --- | --- | --- | --- | --- |");
    for (const row of report.nativeClaude.rows) lines.push(
      `| ${row.metric === "sourceCostUsd" ? "Source estimate USD" : row.metric} | ${row.model ?? "unknown"} | ${row.startUnixNano} | ${row.endUnixNano} | ${row.status} | ${row.quantity} | ${row.reasons.join("; ")} |`);
    lines.push("", "### Native sanitized source observations (not additive)",
      "```json", JSON.stringify(report.nativeClaude.observations, null, 2), "```", ...report.nativeClaude.diagnostics);
  }
  if (report.codex) lines.push("", "## Codex source views (not additive)", formatCodexUsagePreview(report.codex));
  return `${lines.join("\n")}\n`;
}

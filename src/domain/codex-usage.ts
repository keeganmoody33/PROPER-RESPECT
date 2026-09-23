import { z } from "zod";
import { sha256 } from "@noble/hashes/sha2.js";
import { canonicalJson } from "./canonical-json.ts";

export const CODEX_USAGE_LIMITS = { bytes: 256_000, captures: 32, days: 3660, groups: 128 } as const;
export const CODEX_USAGE_RUNTIME_ERROR = "Codex metadata preview requires JSON.parse source context (Node.js 22+).";
const invalid = () => new Error("Invalid Codex metadata capture.");
const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const unknownCount = count.nullish().transform(value => value ?? null);
// Local aliases, opaque source identifiers and bounded labels; no paths, prose or emails.
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/);
const unknownLabel = identifier.nullish().transform(value => value ?? null);
const groupSchema = z.strictObject({
  model: unknownLabel, reasoningEffort: unknownLabel, speed: unknownLabel,
  inputTokens: unknownCount, cachedInputTokens: unknownCount, netNewInputTokens: unknownCount,
  outputTokens: unknownCount, totalTokens: unknownCount, estimatedUsageCreditsMicros: count,
}).refine(group => group.inputTokens === null ||
  ((group.cachedInputTokens === null || group.cachedInputTokens <= group.inputTokens) &&
   (group.netNewInputTokens === null || group.netNewInputTokens <= group.inputTokens)));
const dailySchema = z.array(z.strictObject({ startDate: z.iso.date(), tokens: count }))
  .max(CODEX_USAGE_LIMITS.days)
  .refine(days => new Set(days.map(day => day.startDate)).size === days.length)
  .transform(days => [...days].sort((a, b) => a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
const captureSchema = z.strictObject({
  formatVersion: z.literal(1),
  source: z.strictObject({ method: z.literal("account/usage/read"), version: z.literal("0.153.4") }),
  scope: z.strictObject({ ownerAlias: identifier, accountAlias: identifier, requestedThreadId: unknownLabel }),
  capture: z.strictObject({ id: identifier, capturedAt: z.iso.datetime().transform(value => new Date(value).toISOString()) }),
  response: z.strictObject({
    summary: z.strictObject({
      lifetimeTokens: unknownCount, currentStreakDays: unknownCount, longestStreakDays: unknownCount,
      peakDailyTokens: unknownCount, longestRunningTurnSec: unknownCount,
    }),
    dailyUsageBuckets: dailySchema.nullish().transform(value => value ?? null),
    threadUsage: z.strictObject({
      threadId: identifier, estimatedUsageCreditsMicros: count, estimatedUsageUsdMicros: unknownCount,
      groups: z.array(groupSchema).max(CODEX_USAGE_LIMITS.groups),
    }).nullish().transform(value => value ?? null),
  }),
}).refine(value => !value.response.threadUsage || value.scope.requestedThreadId === value.response.threadUsage.threadId);

export type CodexUsageCapture = z.output<typeof captureSchema>;
type Snapshot = CodexUsageCapture & { metadataSha256: string };
type Conflict = { captureId: string; variantCount: number; metadataSha256: string[] };
export type CodexUsageReview = {
  adapter: "codex-account-snapshot-v1";
  replays: number;
  accounts: {
    ownerAlias: string;
    accountAlias: string;
    snapshots: Snapshot[];
    conflicts: Conflict[];
  }[];
};

// Compare the original decimal token with its parsed integer; Number alone can
// underflow or round fractional source counts before schema validation sees them.
function exactCountToken(source: string, value: number): boolean {
  if (!Number.isSafeInteger(value) || value < 0) return false;
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(source);
  if (!match) return false;
  const fraction = match[3] ?? "";
  const coefficient = `${match[2]}${fraction}`.replace(/^0+/, "");
  if (!coefficient) return value === 0;
  if (match[1]) return false;
  const exponent = Number(match[4] ?? "0");
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > CODEX_USAGE_LIMITS.bytes + 16) return false;
  const significant = coefficient.replace(/0+$/, "");
  const scale = exponent - fraction.length + coefficient.length - significant.length;
  if (scale < 0 || significant.length + scale > 16) return false;
  return BigInt(significant + "0".repeat(scale)) === BigInt(value);
}

export function parseCodexUsageCapture(text: string): CodexUsageCapture {
  let sourceContextAvailable = false;
  JSON.parse("0", (_key, value, context?: { source?: string }) => {
    sourceContextAvailable = context?.source === "0";
    return value;
  });
  if (!sourceContextAvailable) throw new Error(CODEX_USAGE_RUNTIME_ERROR);
  try {
    if (typeof text !== "string" || text.length > CODEX_USAGE_LIMITS.bytes || new TextEncoder().encode(text).byteLength > CODEX_USAGE_LIMITS.bytes) throw invalid();
    return captureSchema.parse(JSON.parse(text, (_key, value, context?: { source?: string }) => {
      if (typeof value === "number" && (!context?.source || !exactCountToken(context.source, value))) throw invalid();
      return value;
    }));
  } catch { throw invalid(); }
}

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function digest(capture: CodexUsageCapture) {
  return [...sha256(new TextEncoder().encode(canonicalJson(capture)))].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

/** Captures are snapshots, never events. No cross-capture, daily or group total is derived. */
export function reviewCodexUsageCaptures(inputs: readonly CodexUsageCapture[]): CodexUsageReview {
  if (inputs.length < 1 || inputs.length > CODEX_USAGE_LIMITS.captures) throw invalid();
  const partitions = new Map<string, Map<string, Map<string, Snapshot>>>();
  let replays = 0;
  for (const input of inputs) {
    // Revalidate callers as well as the JSON entrypoint before any retention.
    let capture: CodexUsageCapture;
    try { capture = parseCodexUsageCapture(JSON.stringify(input)); } catch { throw invalid(); }
    const { ownerAlias, accountAlias } = capture.scope;
    const partitionKey = JSON.stringify([ownerAlias, accountAlias]);
    let identities = partitions.get(partitionKey);
    if (!identities) { identities = new Map(); partitions.set(partitionKey, identities); }
    let variants = identities.get(capture.capture.id);
    if (!variants) { variants = new Map(); identities.set(capture.capture.id, variants); }
    const metadataSha256 = digest(capture);
    if (variants.has(metadataSha256)) replays++;
    else variants.set(metadataSha256, { ...capture, metadataSha256 });
  }
  const accounts = [...partitions.entries()].sort(([a], [b]) => compare(a, b)).map(([key, identities]) => {
    const [ownerAlias, accountAlias] = JSON.parse(key) as [string, string];
    const snapshots: Snapshot[] = [], conflicts: Conflict[] = [];
    for (const [captureId, variants] of [...identities.entries()].sort(([a], [b]) => compare(a, b))) {
      if (variants.size > 1) conflicts.push({ captureId, variantCount: variants.size, metadataSha256: [...variants.keys()].sort(compare) });
      else snapshots.push([...variants.values()][0]);
    }
    snapshots.sort((a, b) => compare(a.capture.capturedAt, b.capture.capturedAt) || compare(a.capture.id, b.capture.id));
    return { ownerAlias, accountAlias, snapshots, conflicts };
  });
  return { adapter: "codex-account-snapshot-v1", replays, accounts };
}

const quantity = (value: number | null) => value === null ? "unknown" : String(value);
function micros(value: number | null) {
  if (value === null) return "unknown";
  const integer = BigInt(value), scale = BigInt(1_000_000);
  return `${integer / scale}.${String(integer % scale).padStart(6, "0")}`;
}

export function formatCodexUsagePreview(review: CodexUsageReview): string {
  const lines = [
    "# Private Codex usage preview",
    "Local metadata only. No account read, upload, save or publication.",
    "Source: account/usage/read · Codex 0.153.4 · adapter codex-account-snapshot-v1",
    "Live provider semantics: unvalidated. Account/device/history coverage: incomplete or unknown.",
    "Reporting timezone: unknown. Daily buckets retain source dates; missing dates are not zero.",
    "Capture IDs and account aliases are caller supplied, not proof of provider identity or human activity.",
    "Account, daily and thread views may overlap. Do not add these snapshots or their views.",
    "Cached and net-new input are input breakdowns; group estimates are not added to thread estimates.",
    "Billed spend: unknown. Source estimates are not invoices or subscription charges.",
    "Capture times are supplied metadata; freshness has not been assessed.",
    `Exact replays ignored: ${review.replays}`,
  ];
  for (const account of review.accounts) {
    lines.push("", `## Owner: ${account.ownerAlias} / account: ${account.accountAlias}`);
    for (const conflict of account.conflicts) {
      lines.push(`CONFLICT: ${conflict.captureId} · ${conflict.variantCount} incompatible variants quarantined; none selected.`);
    }
    for (const snapshot of account.snapshots) {
      const { summary, dailyUsageBuckets: days, threadUsage: thread } = snapshot.response;
      lines.push("", `Capture: ${snapshot.capture.id} · ${snapshot.capture.capturedAt}`, `Metadata SHA-256: ${snapshot.metadataSha256}`,
        `Lifetime tokens: ${quantity(summary.lifetimeTokens)} (source-reported snapshot)`,
        `Current streak days: ${quantity(summary.currentStreakDays)}`, `Longest streak days: ${quantity(summary.longestStreakDays)}`,
        `Peak daily tokens: ${quantity(summary.peakDailyTokens)}`, `Longest running turn seconds: ${quantity(summary.longestRunningTurnSec)}`,
        `Daily buckets supplied: ${days === null ? "unknown" : days.length} (not a complete lifetime ledger)`);
      for (const day of days ?? []) lines.push(`  ${day.startDate}: ${day.tokens} tokens`);
      if (!thread) {
        lines.push(`Thread usage: unavailable${snapshot.scope.requestedThreadId ? " for requested thread" : "; request scope not supplied"}.`);
        continue;
      }
      lines.push(`Thread: ${thread.threadId} · source period unknown`,
        `Estimated credits: ${micros(thread.estimatedUsageCreditsMicros)} (${thread.estimatedUsageCreditsMicros} credit micro-units)`,
        `Estimated USD: ${micros(thread.estimatedUsageUsdMicros)}${thread.estimatedUsageUsdMicros === null ? "" : ` (${thread.estimatedUsageUsdMicros} USD micro-units)`}`,
        `Source groups: ${thread.groups.length} (disjointness unvalidated; no group sum)`);
      for (const [index, group] of thread.groups.entries()) {
        lines.push(`  Group ${index + 1}: model ${group.model ?? "unknown"}, effort ${group.reasoningEffort ?? "unknown"}, speed ${group.speed ?? "unknown"}`,
          `    Input tokens: ${quantity(group.inputTokens)}`, `    Cached input (included in input): ${quantity(group.cachedInputTokens)}`,
          `    Net-new input (input breakdown): ${quantity(group.netNewInputTokens)}`, `    Output tokens: ${quantity(group.outputTokens)}`,
          `    Reported total tokens: ${quantity(group.totalTokens)}`, `    Estimated group credits: ${micros(group.estimatedUsageCreditsMicros)}`);
        if (group.inputTokens !== null && group.outputTokens !== null && group.totalTokens !== null &&
            BigInt(group.inputTokens) + BigInt(group.outputTokens) !== BigInt(group.totalTokens)) {
          lines.push("    CAUTION: reported total differs from input + output; source values retained without correction.");
        }
      }
    }
  }
  return `${lines.join("\n")}\n`;
}

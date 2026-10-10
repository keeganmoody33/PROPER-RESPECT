import { sha256 } from "@noble/hashes/sha2.js";
import { canonicalJson } from "../domain/canonical-json.ts";
import { ExactJsonNumber, parseExactJson, type ExactJson } from "../domain/exact-json.ts";
import { historyBatchSchema, historyTimestampSchema, historyWindowSchema, type HistoryBatch, type HistoryObservation, type HistoryRow, reconcileConnectionHistory } from "../domain/connection-history.ts";
import type { CollectionRequest } from "./usage-connection.ts";

export type CodexFixtureFile = { sessionAlias: string; lines: readonly string[] };
const metrics = ["input_tokens", "cached_input_tokens", "output_tokens", "reasoning_output_tokens", "total_tokens"] as const;
function object(value: ExactJson | undefined): Record<string, ExactJson> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) && !(value instanceof ExactJsonNumber) ? value : null;
}
function counter(value: ExactJson | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (!(value instanceof ExactJsonNumber) || !/^(0|[1-9][0-9]{0,127})$/.test(value.lexeme)) throw new Error("unsupported-counter");
  return value.lexeme;
}

/** Restricted fixture contract, not a production rollout scanner. No filesystem/auth/network APIs. */
export function collectCodexHistoryFixture(request: CollectionRequest, files: readonly CodexFixtureFile[]): HistoryBatch {
  if (request.descriptor.provider !== "codex" || request.descriptor.collectorVersion !== "codex-fixture-v1") throw new Error("unsupported-source");
  if (files.length > 8) throw new Error("fixture-limit");
  const window = historyWindowSchema.parse(request.window);
  const start = Date.parse(window.start), end = Date.parse(window.end);
  let bytes = 0, lines = 0;
  const observations: HistoryObservation[] = [];
  for (const file of files) for (const line of file.lines) {
    if (request.signal.aborted) throw new Error("disconnected");
    bytes += new TextEncoder().encode(line).length;
    if (bytes > 256_000 || ++lines > 1000) throw new Error("fixture-limit");
    const record = object(parseExactJson(line));
    if (!record) throw new Error("invalid-fixture");
    // Forks, compactions and per-response records need a richer reconciler. Reject
    // those source formats instead of quietly treating inherited history as usage.
    if (record.type !== "event_msg" && record.type !== "response_item") throw new Error("unsupported-record");
    if (record.type === "response_item") continue;
    const payload = object(record.payload);
    if (!payload || payload.type !== "token_count") throw new Error("unsupported-event");
    const at = historyTimestampSchema.parse(record.timestamp), time = Date.parse(at);
    // Bounds are applied before projection. No pre-window baseline is retained.
    if (time < start || time >= end) continue;
    const info = object(payload.info), counts = object(info?.total_token_usage);
    if (!counts) throw new Error("unsupported-usage");
    const values = Object.fromEntries(metrics.map(metric => [metric, counter(counts[metric])]));
    for (const [subset, total] of [["cached_input_tokens", "input_tokens"], ["reasoning_output_tokens", "output_tokens"]]) {
      if (values[subset] !== null && values[total] !== null && BigInt(values[subset]) > BigInt(values[total])) throw new Error("invalid-subset");
    }
    for (const metric of metrics) observations.push({ stream: file.sessionAlias, at, metric, unit: "tokens", value: values[metric] });
  }
  // Only the allowlist above survives; raw records, prompts, paths and credentials do not.
  return historyBatchSchema.parse({ descriptor: request.descriptor, observations });
}


export const CODEX_ROLLOUT_METRICS = [...metrics, "cache_write_input_tokens"] as const;
type RolloutMetric = typeof CODEX_ROLLOUT_METRICS[number];
type Counts = Record<RolloutMetric, string | null>;
export type CodexRolloutFile = { lines: readonly string[] };
type ResponseRow = { thread: string; response: string; at: string; counts: Counts; status: "measured" | "conflict" };
type LegacySnapshot = { thread: string; segment: string; at: string; counts: Counts; last: Counts | null };
export type CodexRolloutHistory = {
  format: "codex-local-history-v1";
  source: { provider: "codex"; kind: "local-history"; accountAlias: null; sample: "unknown" };
  window: { start: string; end: string };
  coverage: "partial";
  responses: { rows: ResponseRow[]; totals: { metric: RolloutMetric; value: string | null }[]; replays: number };
  legacy: { rows: HistoryRow[]; totals: { metric: string; unit: string; value: string | null }[]; replays: number };
  diagnostics: {
    files: number; threads: number; inheritedResponsesExcluded: number; legacyThreadsExcluded: number;
    compactionCheckpointsIgnored: number; legacyIntervalsExcluded: number; legacyThreadsSuperseded: number;
  };
};
const opaque = (kind: string, value: string) => [...sha256(new TextEncoder().encode(`${kind}\0${value}`))].map(byte => byte.toString(16).padStart(2, "0")).join("");
function sourceId(value: ExactJson | undefined): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(value)) throw new Error("invalid-rollout-identity");
  return value;
}
function countsFrom(value: ExactJson | undefined): Counts {
  const valueObject = object(value);
  if (!valueObject) throw new Error("invalid-rollout-usage");
  const counts: Counts = {
    input_tokens: counter(valueObject.input_tokens), cached_input_tokens: counter(valueObject.cached_input_tokens),
    output_tokens: counter(valueObject.output_tokens), reasoning_output_tokens: counter(valueObject.reasoning_output_tokens),
    total_tokens: counter(valueObject.total_tokens), cache_write_input_tokens: counter(valueObject.cache_write_input_tokens),
  };
  for (const [subset, total] of [["cached_input_tokens", "input_tokens"], ["reasoning_output_tokens", "output_tokens"]] as const) {
    if (counts[subset] !== null && counts[total] !== null && BigInt(counts[subset]) > BigInt(counts[total])) throw new Error("invalid-rollout-subset");
  }
  return counts;
}
const present = (value: ExactJson | undefined) => value !== undefined && value !== null;

/**
 * Numeric projection of official rollout JSONL. No discovery, auth, writes or network.
 * The directory adapter supplies bounded files. All output is reconstructed from an
 * allowlist; source identifiers become hashes and historical account identity stays null.
 */
export function collectCodexRolloutHistory(
  request: { window: { start: string; end: string }; signal: AbortSignal }, files: readonly CodexRolloutFile[],
): CodexRolloutHistory {
  const window = historyWindowSchema.parse(request.window);
  const inWindow = (at: string) => at >= window.start && at < window.end;
  if (files.length > 64) throw new Error("rollout-limit");
  const responseVariants = new Map<string, Map<string, ResponseRow>>();
  const snapshots: LegacySnapshot[] = [];
  const threads = new Set<string>(), modernThreads = new Set<string>(), excludedLegacy = new Set<string>();
  const diagnostics = { files: files.length, threads: 0, inheritedResponsesExcluded: 0, legacyThreadsExcluded: 0,
    compactionCheckpointsIgnored: 0, legacyIntervalsExcluded: 0, legacyThreadsSuperseded: 0 };
  let bytes = 0, lineCount = 0, responseReplays = 0;
  for (const file of files) {
    let thread: string | null = null, rawThread: string | null = null, segment = "initial";
    for (const line of file.lines) {
      if (request.signal.aborted) throw new Error("disconnected");
      bytes += new TextEncoder().encode(line).length;
      if (bytes > 32 * 1024 * 1024 || ++lineCount > 100_000) throw new Error("rollout-limit");
      // Rollouts contain long prompts/tool output. Decode within the same byte,
      // depth and node limits while allowing long strings, then discard content.
      const record = object(parseExactJson(line, { maxStringLength: 256_000 }));
      if (!record || typeof record.type !== "string") throw new Error("invalid-rollout-record");
      const payload = object(record.payload);
      if (thread === null) {
        if (record.type !== "session_meta" || !payload) throw new Error("missing-rollout-header");
        rawThread = sourceId(payload.id);
        thread = opaque("thread", rawThread);
        threads.add(thread);
        // Old copied forks have no reliable usage boundary. Referenced history and
        // subagents also need provenance beyond their cumulative UI counters.
        if ([payload.forked_from_id, payload.parent_thread_id, payload.history_base, payload.subagent_history_start_ordinal].some(present)) excludedLegacy.add(thread);
        continue;
      }
      if (record.type === "session_meta") {
        // Later metadata can be an inherited parent header. It must not rename
        // the physical file's owning thread or establish a new account identity.
        if (!payload || sourceId(payload.id) !== rawThread) excludedLegacy.add(thread);
        continue;
      }
      if (record.type === "token_usage_record") {
        if (!payload) throw new Error("invalid-rollout-response");
        const owner = sourceId(payload.thread_id);
        if (owner !== rawThread) { diagnostics.inheritedResponsesExcluded++; continue; }
        modernThreads.add(thread);
        const at = historyTimestampSchema.parse(record.timestamp);
        const response = opaque("response", sourceId(payload.response_id));
        const counts = countsFrom(payload.usage);
        const row: ResponseRow = { thread, response, at, counts, status: "measured" };
        // Response identity, not timestamp, distinguishes distinct same-millisecond
        // responses. Archives and renamed files replay the same event identity.
        const key = `${thread}:${response}`;
        const variants = responseVariants.get(key) ?? new Map<string, ResponseRow>();
        const fingerprint = canonicalJson({ at, counts });
        if (variants.has(fingerprint)) responseReplays++;
        else variants.set(fingerprint, row);
        responseVariants.set(key, variants);
      } else if (record.type === "compacted") {
        diagnostics.compactionCheckpointsIgnored++;
        // The embedded latest_token_usage_record is a checkpoint of an old
        // response, never new usage. First legacy sample after this is a baseline.
        segment = opaque("compaction", historyTimestampSchema.parse(record.timestamp));
      } else if (record.type === "event_msg" && payload?.type === "token_count") {
        const info = object(payload.info);
        if (!info) continue; // A rate-limit-only notification has no usage.
        const at = historyTimestampSchema.parse(record.timestamp);
        snapshots.push({ thread, segment, at, counts: countsFrom(info.total_token_usage),
          last: object(info.last_token_usage) ? countsFrom(info.last_token_usage) : null });
      }
      // response_item, turn_context and other content/event records carry no
      // independently counted usage in this adapter.
    }
    if (thread === null) throw new Error("missing-rollout-header");
  }
  diagnostics.threads = threads.size;
  diagnostics.legacyThreadsExcluded = excludedLegacy.size;
  diagnostics.legacyThreadsSuperseded = new Set(snapshots.filter(row => modernThreads.has(row.thread)).map(row => row.thread)).size;
  const rows: ResponseRow[] = [];
  for (const variants of responseVariants.values()) {
    const conflict = variants.size > 1;
    // A conflicting date cannot make a disputed response disappear from its
    // requested window. Every in-window variant remains visibly quarantined.
    for (const row of variants.values()) if (inWindow(row.at)) rows.push({ ...row, status: conflict ? "conflict" : "measured" });
  }
  rows.sort((a, b) => a.at.localeCompare(b.at) || a.thread.localeCompare(b.thread) || a.response.localeCompare(b.response) || canonicalJson(a.counts).localeCompare(canonicalJson(b.counts)));
  const responseTotals = CODEX_ROLLOUT_METRICS.map(metric => ({ metric,
    value: rows.length === 0 || rows.some(row => row.status === "conflict" || row.counts[metric] === null) ? null
      : String(rows.reduce((sum, row) => sum + BigInt(row.counts[metric] ?? "0"), BigInt(0))),
  }));

  const byStream = new Map<string, LegacySnapshot[]>();
  for (const row of snapshots) {
    if (modernThreads.has(row.thread) || excludedLegacy.has(row.thread)) continue;
    const key = `${row.thread}:${row.segment}`, stream = byStream.get(key) ?? [];
    stream.push(row); byStream.set(key, stream);
  }
  const observations: HistoryObservation[] = [];
  const conflictStreams = new Set<string>();
  for (const [key, stream] of byStream) {
    stream.sort((a, b) => a.at.localeCompare(b.at) || canonicalJson({ counts: a.counts, last: a.last }).localeCompare(canonicalJson({ counts: b.counts, last: b.last })));
    const positions = new Map<string, Set<string>>();
    for (const row of stream) {
      const variants = positions.get(row.at) ?? new Set<string>();
      variants.add(canonicalJson({ counts: row.counts, last: row.last })); positions.set(row.at, variants);
    }
    const conflicting = [...positions.values()].some(variants => variants.size > 1);
    let previous: LegacySnapshot | null = null, continuity = 0;
    for (const row of stream) {
      const same = previous !== null && canonicalJson(previous.counts) === canonicalJson(row.counts);
      if (previous && !same) {
        // UI totals can be estimated or filled to a context limit. Admit an
        // increase only when every known counter agrees with last_token_usage.
        const syntheticTotal = row.last !== null && row.last.input_tokens === "0" && row.last.output_tokens === "0" &&
          row.last.total_tokens !== null && BigInt(row.last.total_tokens) > BigInt(0);
        const verified = !syntheticTotal && row.last !== null && CODEX_ROLLOUT_METRICS.every(metric => {
          const before = previous?.counts[metric], after = row.counts[metric], last = row.last?.[metric];
          if (before === null && after === null && last === null) return true;
          return before !== null && before !== undefined && after !== null && last !== null && last !== undefined &&
            BigInt(after) >= BigInt(before) && BigInt(after) - BigInt(before) === BigInt(last);
        });
        if (!verified) { continuity++; diagnostics.legacyIntervalsExcluded++; }
      }
      const identity = opaque("legacy-stream", `${key}:${continuity}`);
      if (conflicting) conflictStreams.add(identity);
      for (const metric of CODEX_ROLLOUT_METRICS) observations.push({ stream: identity, at: row.at, metric, unit: "tokens", value: row.counts[metric] });
      previous = row;
    }
  }
  const legacy = reconcileConnectionHistory(observations);
  const legacyRows = legacy.rows.filter(row => inWindow(row.at)).map(row => conflictStreams.has(row.stream)
    ? { ...row, status: "conflict" as const, delta: null } : row);
  const legacyTotals = CODEX_ROLLOUT_METRICS.map(metric => {
    const matching = legacyRows.filter(row => row.metric === metric);
    return { metric, unit: "tokens", value: matching.some(row => row.status === "conflict") || !matching.some(row => row.delta !== null) ? null
      : String(matching.reduce((sum, row) => sum + BigInt(row.delta ?? "0"), BigInt(0))) };
  });
  if (rows.length > 10_000 || legacyRows.length > 60_000) throw new Error("rollout-output-limit");
  if (request.signal.aborted) throw new Error("disconnected");
  return { format: "codex-local-history-v1", source: { provider: "codex", kind: "local-history", accountAlias: null, sample: "unknown" },
    window, coverage: "partial", responses: { rows, totals: responseTotals, replays: responseReplays },
    legacy: { rows: legacyRows, totals: legacyTotals, replays: legacy.replays }, diagnostics };
}

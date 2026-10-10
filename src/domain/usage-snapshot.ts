import { sha256 } from "@noble/hashes/sha2.js";
import { z } from "zod";
import { canonicalJson } from "./canonical-json.ts";
import { CODEX_METRICS } from "./collector-contract.ts";
import { historyTimestampSchema } from "./connection-history.ts";
import { measurementDigest, measurementSchema, type Measurement } from "./measurements.ts";
import { digest, digestSchema, evidenceKey, numericEvidenceSchema, type NumericEvidence } from "./usage-sync.ts";

export const USAGE_SNAPSHOT_ALGORITHM = "codex-response-groups-v1";
export const USAGE_SNAPSHOT_LIMITS = Object.freeze({ pageSize: 200, rows: 200000, bytes: 64 * 1024 * 1024 });
const DAY_MS = 86400_000;
export const usageSnapshotWindowSchema = z.strictObject({ start: historyTimestampSchema, end: historyTimestampSchema })
  .refine(window => window.start.endsWith("T00:00:00.000Z") && window.end.endsWith("T00:00:00.000Z")
    && Date.parse(window.end) > Date.parse(window.start) && Date.parse(window.end) - Date.parse(window.start) <= 7 * DAY_MS,
  "Select one to seven whole UTC days, with an exclusive end.");
export type UsageSnapshotWindow = z.infer<typeof usageSnapshotWindowSchema>;
const metadataSchema = z.strictObject({ sourceKey: digestSchema, context: z.enum(["personal", "work", "unclassified"]), capturedAt: historyTimestampSchema });
type SnapshotMetadata = z.infer<typeof metadataSchema>;
const period = (window: UsageSnapshotWindow) => ({ kind: "date" as const, start: window.start.slice(0, 10), end: new Date(Date.parse(window.end) - DAY_MS).toISOString().slice(0, 10), timezone: "UTC" });
const overlapGroup = (sourceKey: string) => measurementDigest([USAGE_SNAPSHOT_ALGORITHM, sourceKey]);
const measurementId = (sourceKey: string, window: UsageSnapshotWindow, evidenceDigest: string, metric: string) =>
  measurementDigest([USAGE_SNAPSHOT_ALGORITHM, sourceKey, window.start, window.end, evidenceDigest, metric]);

export const usageSnapshotSchema = z.strictObject({
  format: z.literal("codex-history-window-v1"), algorithmVersion: z.literal(USAGE_SNAPSHOT_ALGORITHM),
  ...metadataSchema.shape, start: historyTimestampSchema, end: historyTimestampSchema, evidenceDigest: digestSchema,
  responseCount: z.number().int().min(0).max(USAGE_SNAPSHOT_LIMITS.rows), measurements: z.array(measurementSchema).length(CODEX_METRICS.length),
}).superRefine((snapshot, ctx) => {
  const window = usageSnapshotWindowSchema.safeParse({ start: snapshot.start, end: snapshot.end });
  if (!window.success) { ctx.addIssue({ code: "custom", message: "Invalid snapshot window." }); return; }
  const conflicts = snapshot.measurements.filter(row => row.status === "conflict").length;
  if (new Set(snapshot.measurements.map(row => row.metric)).size !== CODEX_METRICS.length || conflicts !== 0 && conflicts !== CODEX_METRICS.length)
    ctx.addIssue({ code: "custom", message: "Use distinct native quantities with a consistent conflict disposition." });
  for (const row of snapshot.measurements) {
    if (!(CODEX_METRICS as readonly string[]).includes(row.metric) || row.unit !== "tokens" || row.derivation !== "SUMMED_RESPONSES"
      || row.scope !== "DEVICE" || row.coverage !== "PARTIAL" || row.temporality !== "DELTA" || row.aggregation !== "NON_ADDITIVE"
      || row.sample !== "unknown" || row.status === "baseline" || row.capturedAt !== snapshot.capturedAt
      || canonicalJson(row.period) !== canonicalJson(period(window.data)) || Object.values(row.dimensions).some(value => value !== null)
      || row.overlapGroup !== overlapGroup(snapshot.sourceKey) || row.id !== measurementId(snapshot.sourceKey, window.data, snapshot.evidenceDigest, row.metric)
      || row.value !== null && !/^(0|[1-9][0-9]{0,133})$/.test(row.value)
      || row.status === "conflict" && row.value !== null || snapshot.responseCount === 0 && (row.value !== null || row.status === "conflict"))
      ctx.addIssue({ code: "custom", message: "Snapshot measurements must retain their source, window and exact response interpretation." });
  }
});
export type UsageSnapshot = z.infer<typeof usageSnapshotSchema>;

const encoder = new TextEncoder();
const hex = (bytes: Uint8Array) => [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
const invalid = () => new Error("Usage snapshot evidence is invalid, unordered, or exceeds its limit.");
type ResponseCounts = Extract<NumericEvidence, { kind: "response" }>["counts"];
type Group = { key: string; kind: NumericEvidence["kind"]; variants: number; selected: boolean; conflict: boolean; counts: ResponseCounts | null; hash: ReturnType<typeof sha256.create> };
const reasons = [
  "Partial Codex response history; missing files and periods remain unknown.",
  "Account identity is unverified; device context is an owner association.",
  "Cached input and reasoning output are subsets, not additional tokens.",
  "Overlapping snapshots are non-additive and must not be summed.",
  "Legacy cumulative counters are excluded.",
  "Activity actor is unknown; response usage is not proof of human activity.",
];

/** One source, ordered by (evidenceKey, fingerprint), exactly as the backend index.
 * Retains only one response group, one prior variant and six exact running totals.
 * Every input row consumes scan budget, including duplicates and excluded history.
 */
export function createUsageSnapshotAccumulator(input: UsageSnapshotWindow) {
  const window = usageSnapshotWindowSchema.parse(input);
  const evidenceHash = sha256.create().update(encoder.encode(canonicalJson([USAGE_SNAPSHOT_ALGORITHM])));
  const totals = CODEX_METRICS.map(() => BigInt(0)), unknown = CODEX_METRICS.map(() => false);
  let group: Group | null = null, previousKey = "", previousFingerprint = "", previousJson = "";
  let scannedRows = 0, scannedBytes = 0, responseCount = 0, conflict = false;
  let state: "open" | "failed" | "finished" = "open";
  const flush = () => {
    if (!group || group.kind !== "response" || !group.selected) return;
    responseCount++;
    evidenceHash.update(encoder.encode(canonicalJson([group.key, group.variants, hex(group.hash.digest())]) + "\n"));
    if (group.variants > 1 || group.conflict) { conflict = true; return; }
    for (const [index, metric] of CODEX_METRICS.entries()) {
      const value = group.counts?.[metric] ?? null;
      if (value === null) unknown[index] = true;
      else totals[index] += BigInt(value);
    }
  };
  return {
    add(inputRow: NumericEvidence): void {
      if (state !== "open") throw invalid();
      try {
        if (++scannedRows > USAGE_SNAPSHOT_LIMITS.rows) throw invalid();
        const row = numericEvidenceSchema.parse(inputRow), json = canonicalJson(row), bytes = encoder.encode(json);
        scannedBytes += bytes.length;
        if (scannedBytes > USAGE_SNAPSHOT_LIMITS.bytes) throw invalid();
        const key = evidenceKey(row), fingerprint = digest(json);
        if (key < previousKey || key === previousKey && fingerprint < previousFingerprint) throw invalid();
        if (key === previousKey && fingerprint === previousFingerprint) {
          if (json !== previousJson) throw invalid();
          return;
        }
        if (!group || group.key !== key) {
          flush();
          group = { key, kind: row.kind, variants: 0, selected: false, conflict: false, counts: row.kind === "response" ? row.counts : null, hash: sha256.create() };
        }
        if (group.kind !== row.kind) throw invalid();
        group.variants++;
        group.hash.update(encoder.encode(fingerprint + "\n"));
        if (row.kind === "response") {
          group.selected ||= row.at >= window.start && row.at < window.end;
          group.conflict ||= row.status === "conflict";
        }
        previousKey = key; previousFingerprint = fingerprint; previousJson = json;
      } catch { state = "failed"; throw invalid(); }
    },
    finish(inputMetadata: SnapshotMetadata): UsageSnapshot {
      if (state !== "open") throw invalid();
      try {
        const metadata = metadataSchema.parse(inputMetadata);
        flush();
        const evidenceDigest = hex(evidenceHash.digest());
        const measurements: Measurement[] = CODEX_METRICS.map((metric, index) => ({
          id: measurementId(metadata.sourceKey, window, evidenceDigest, metric), metric,
          value: conflict || unknown[index] || responseCount === 0 ? null : String(totals[index]), unit: "tokens", period: period(window),
          scope: "DEVICE", coverage: "PARTIAL", temporality: "DELTA", aggregation: "NON_ADDITIVE", sample: "unknown", derivation: "SUMMED_RESPONSES",
          status: conflict ? "conflict" : "measured", capturedAt: metadata.capturedAt, overlapGroup: overlapGroup(metadata.sourceKey),
          dimensions: { model: null, reasoningEffort: null, speed: null, threadAlias: null },
          reasons: [...reasons, ...(conflict ? ["Conflicting response variants block all selected totals."] : responseCount === 0 ? ["No modern response evidence falls within the selected window."] : unknown[index] ? ["At least one selected native response lacks this quantity."] : [])],
        }));
        const result = usageSnapshotSchema.parse({ format: "codex-history-window-v1", algorithmVersion: USAGE_SNAPSHOT_ALGORITHM, ...metadata, ...window, evidenceDigest, responseCount, measurements });
        state = "finished";
        return result;
      } catch { state = "failed"; throw invalid(); }
    },
  };
}

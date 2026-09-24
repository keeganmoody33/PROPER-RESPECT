import { z } from "zod";
import { sha256 } from "@noble/hashes/sha2.js";
import { canonicalJson } from "./canonical-json.ts";

export const CLAUDE_METRIC_LIMITS = { bytes: 256_000, captures: 32, bundles: 1024, aggregateBundles: 2048 } as const;
const invalid = () => new Error("Invalid Claude metrics capture.");
const alias = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/);
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const integer = z.string().regex(/^(0|[1-9][0-9]{0,29})$/);
const usd = z.string().regex(/^(0|[1-9][0-9]{0,29})(\.[0-9]{1,12})?$/);
const instant = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/).refine(value => {
  const time = new Date(value);
  return Number.isFinite(time.getTime()) && time.toISOString() === value;
});
const categories = ["input", "output", "cacheRead", "cacheCreation"] as const;
const countsSchema = z.strictObject({ input: integer.nullable(), output: integer.nullable(), cacheRead: integer.nullable(), cacheCreation: integer.nullable() });
const bundleSchema = z.strictObject({
  id: alias, streamDigest: digestSchema, sessionAlias: alias, processAlias: alias, model: alias.nullable(),
  metricStreams: z.strictObject({ input: digestSchema.nullable(), output: digestSchema.nullable(), cacheRead: digestSchema.nullable(), cacheCreation: digestSchema.nullable(), cost: digestSchema.nullable() }),
  temporality: z.enum(["delta", "cumulative"]), start: instant, end: instant,
  counts: countsSchema, sourceCostUsd: usd.nullable(),
}).refine(value => value.start < value.end && categories.every(key => value.counts[key] === null || value.metricStreams[key] !== null) && (value.sourceCostUsd === null || value.metricStreams.cost !== null));
const captureSchema = z.strictObject({
  format: z.literal("claude-code-sanitized-metrics-v1"), captureId: alias, capturedAt: instant,
  sample: z.enum(["synthetic", "owner-supplied"]), sourceVersion: alias.nullable(),
  ownerAlias: alias, accountAlias: alias, deviceAlias: alias, timezone: z.enum(["UTC", "unknown"]), namespace: alias,
  identity: z.literal("caller-declared-full-stream"), alignment: z.literal("same-interval-disjoint-categories"), counterSemantics: z.literal("monotonic"),
  bundles: z.array(bundleSchema).min(1).max(CLAUDE_METRIC_LIMITS.bundles),
});
export type ClaudeMetricsCapture = z.infer<typeof captureSchema>;
export type ClaudeMetricBundle = z.infer<typeof bundleSchema>;
type Header = Omit<ClaudeMetricsCapture, "bundles" | "captureId">;
export type ClaudeMetricObservation = Header & ClaudeMetricBundle & {
  evidenceDigest: string;
  captureProvenance: { captureId: string; capturedAt: string; captureDigest: string }[];
};
export type ClaudeMetricRow = Header & ClaudeMetricBundle & {
  status: "baseline" | "measured" | "conflict";
  reasons: string[];
  evidenceDigests: string[];
};
export type ClaudeMetricsReview = {
  observations: ClaudeMetricObservation[]; rows: ClaudeMetricRow[];
  replays: number; hasConflicts: boolean; diagnostics: string[];
};
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const digest = (value: unknown) => [...sha256(new TextEncoder().encode(canonicalJson(value)))].map(byte => byte.toString(16).padStart(2, "0")).join("");
const picounits = (value: string) => { const [whole, fraction = ""] = value.split("."); return BigInt(whole) * BigInt(1_000_000_000_000) + BigInt(fraction.padEnd(12, "0")); };
const formatUsd = (value: bigint) => {
  const whole = value / BigInt(1_000_000_000_000), fraction = String(value % BigInt(1_000_000_000_000)).padStart(12, "0").replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""}`;
};

/** Explicit sanitized aligned metrics, not native OTLP. No acquisition or text retention. */
export function parseClaudeMetricsCapture(text: string): ClaudeMetricsCapture {
  try {
    if (typeof text !== "string" || text.length > CLAUDE_METRIC_LIMITS.bytes || new TextEncoder().encode(text).byteLength > CLAUDE_METRIC_LIMITS.bytes) throw invalid();
    return captureSchema.parse(JSON.parse(text));
  } catch { throw invalid(); }
}

const scopeKey = (value: Header) => JSON.stringify([value.ownerAlias, value.accountAlias, value.deviceAlias, value.namespace]);
const streamKey = (value: Header & ClaudeMetricBundle) => JSON.stringify([scopeKey(value), value.streamDigest]);
const observationOrder = (a: ClaudeMetricObservation, b: ClaudeMetricObservation) => compare(streamKey(a), streamKey(b)) || compare(a.start, b.start) || compare(a.end, b.end) || compare(a.evidenceDigest, b.evidenceDigest);
function caveats(value: ClaudeMetricObservation): string[] {
  const reasons = ["Caller-declared stream identity and bundle alignment; not authenticated identity or human activity."];
  if (value.sourceVersion === null) reasons.push("Source version unknown; streaming count behavior unvalidated.");
  else {
    const version = /^(\d+)\.(\d+)\.(\d+)$/.exec(value.sourceVersion);
    if (!version || Number(version[1]) < 2 || (Number(version[1]) === 2 && (Number(version[2]) < 1 || (Number(version[2]) === 1 && Number(version[3]) < 214)))) reasons.push("Source version predates 2.1.214 or is unsupported; streaming counts may be inflated.");
  }
  if (value.model === null || value.model === "mixed") reasons.push("Exact model unknown or mixed.");
  if (categories.some(key => value.counts[key] === null)) reasons.push("Missing token categories remain unknown.");
  if (value.timezone === "unknown") reasons.push("Reporting timezone unknown; interval instants remain UTC.");
  return reasons;
}

/** Pure full-batch recomputation. A conflict quarantines its entire logical stream. */
export function reviewClaudeMetricsCaptures(inputs: readonly ClaudeMetricsCapture[]): ClaudeMetricsReview {
  if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > CLAUDE_METRIC_LIMITS.captures) throw invalid();
  let captures: ClaudeMetricsCapture[];
  try { captures = inputs.map(input => parseClaudeMetricsCapture(JSON.stringify(input))); } catch { throw invalid(); }
  if (captures.reduce((sum, value) => sum + value.bundles.length, 0) > CLAUDE_METRIC_LIMITS.aggregateBundles) throw invalid();
  const identities = new Map<string, Map<string, Set<string>>>();
  const facts = new Map<string, ClaudeMetricObservation>();
  const streamReasons = new Map<string, Set<string>>();
  const pointIds = new Map<string, string>();
  let replays = 0;
  const conflict = (key: string, reason: string) => { const reasons = streamReasons.get(key) ?? new Set<string>(); reasons.add(reason); streamReasons.set(key, reasons); };
  for (const capture of captures) {
    const { bundles, captureId, ...header } = capture;
    const captureDigest = digest({ ...capture, bundles: [...bundles].sort((a, b) => compare(canonicalJson(a), canonicalJson(b))) });
    const identity = JSON.stringify([scopeKey(header), captureId]);
    const variants = identities.get(identity) ?? new Map<string, Set<string>>();
    const streams = variants.get(captureDigest) ?? new Set<string>();
    variants.set(captureDigest, streams); identities.set(identity, variants);
    for (const bundle of bundles) {
      const key = streamKey({ ...header, ...bundle }); streams.add(key);
      // Capture time and caller point IDs are provenance, not measurement facts.
      const { capturedAt: _captureTime, ...semanticHeader } = header;
      const { id: _pointId, ...semanticBundle } = bundle;
      void _captureTime; void _pointId;
      const semantic = { ...semanticHeader, ...semanticBundle };
      // Equivalent exact decimal encodings are the same source quantity.
      if (semantic.sourceCostUsd !== null) semantic.sourceCostUsd = formatUsd(picounits(semantic.sourceCostUsd));
      const evidenceDigest = digest(semantic);
      const idKey = JSON.stringify([key, bundle.id]);
      const previousId = pointIds.get(idKey);
      if (previousId !== undefined && previousId !== evidenceDigest) conflict(key, "Conflicting point identity; entire logical stream quarantined.");
      pointIds.set(idKey, evidenceDigest);
      const provenance = { captureId, capturedAt: header.capturedAt, captureDigest };
      const existing = facts.get(evidenceDigest);
      if (existing) {
        replays++;
        if (!existing.captureProvenance.some(value => canonicalJson(value) === canonicalJson(provenance))) existing.captureProvenance.push(provenance);
        if (header.capturedAt < existing.capturedAt) existing.capturedAt = header.capturedAt;
        if (bundle.id < existing.id) existing.id = bundle.id;
      } else facts.set(evidenceDigest, { ...header, ...bundle, sourceCostUsd: semantic.sourceCostUsd, evidenceDigest, captureProvenance: [provenance] });
    }
  }
  for (const variants of identities.values()) if (variants.size > 1) for (const streams of variants.values()) for (const key of streams) conflict(key, "Conflicting capture identity; entire logical stream quarantined.");
  const observations = [...facts.values()].sort(observationOrder);
  const streams = new Map<string, ClaudeMetricObservation[]>();
  for (const observation of observations) {
    observation.captureProvenance.sort((a, b) => compare(canonicalJson(a), canonicalJson(b)));
    const key = streamKey(observation), stream = streams.get(key) ?? [];
    stream.push(observation); streams.set(key, stream);
  }
  const rows: ClaudeMetricRow[] = [];
  for (const [key, stream] of streams) {
    const byPosition = new Map<string, string>();
    const semantics = new Set(stream.map(value => canonicalJson({ sample: value.sample, sourceVersion: value.sourceVersion, model: value.model, timezone: value.timezone, sessionAlias: value.sessionAlias, metricStreams: value.metricStreams })));
    if (semantics.size > 1) conflict(key, "Changed stream model, version, origin or metric identity; entire logical stream quarantined.");
    if (new Set(stream.map(value => value.temporality)).size > 1) conflict(key, "Mixed temporality in one logical stream; overlap unresolved.");
    for (const value of stream) {
      const position = JSON.stringify([value.start, value.end]);
      if (byPosition.has(position) && byPosition.get(position) !== value.evidenceDigest) conflict(key, "Conflicting measurement position; entire logical stream quarantined.");
      byPosition.set(position, value.evidenceDigest);
    }
    const cumulative = stream[0].temporality === "cumulative";
    const epochs = new Map<string, ClaudeMetricObservation[]>();
    for (const value of stream) {
      const epochKey = cumulative ? JSON.stringify([value.processAlias, value.start]) : value.evidenceDigest;
      const epoch = epochs.get(epochKey) ?? []; epoch.push(value); epochs.set(epochKey, epoch);
    }
    const epochLists = [...epochs.values()].map(epoch => epoch.sort((a,b) => compare(a.end,b.end) || compare(a.evidenceDigest,b.evidenceDigest)))
      .sort((a,b) => compare(a[0].start,b[0].start) || compare(a[0].end,b[0].end));
    let precedingEnd: string | null = null;
    for (const epoch of epochLists) {
      const first = epoch[0], last = epoch[epoch.length - 1];
      if (precedingEnd !== null && first.start < precedingEnd) conflict(key, "Overlapping intervals or epochs; entire logical stream quarantined.");
      if (precedingEnd === null || last.end > precedingEnd) precedingEnd = last.end;
      if (cumulative) {
        const known: Partial<Record<typeof categories[number], bigint>> = {};
        let knownCost: bigint | null = null;
        for (const point of epoch) {
          let decreased = false;
          for (const category of categories) if (point.counts[category] !== null) {
            const value = BigInt(point.counts[category]!);
            if (known[category] !== undefined && value < known[category]!) decreased = true;
            known[category] = value;
          }
          if (point.sourceCostUsd !== null) {
            const value = picounits(point.sourceCostUsd);
            if (knownCost !== null && value < knownCost) decreased = true;
            knownCost = value;
          }
          if (decreased) conflict(key, "Cumulative counter or source cost decreased within epoch; reset unproven and stream quarantined.");
        }
      }
    }
    const conflicts = [...(streamReasons.get(key) ?? [])].sort(compare);
    if (conflicts.length) {
      for (const observation of stream) {
        const { evidenceDigest, captureProvenance: _provenance, ...value } = observation;
        void _provenance;
        rows.push({ ...value, status: "conflict", reasons: [...caveats(observation), ...conflicts], evidenceDigests: [evidenceDigest] });
      }
      continue;
    }
    precedingEnd = null;
    for (const epoch of epochLists) {
      for (let index = 0; index < epoch.length; index++) {
        const observation = epoch[index], { evidenceDigest, captureProvenance: _provenance, ...value } = observation;
        void _provenance;
        const reasons = caveats(observation);
        if (index === 0 && precedingEnd !== null && value.start > precedingEnd) reasons.push("Coverage gap between intervals or epochs.");
        if (!cumulative) rows.push({ ...value, status: "measured", reasons, evidenceDigests: [evidenceDigest] });
        else if (index === 0) {
          reasons.push("First cumulative observation is a baseline; no usage inferred before it.");
          if (precedingEnd !== null) reasons.push("New cumulative epoch/reset; independent baseline, no bridge.");
          rows.push({ ...value, status: "baseline", reasons, evidenceDigests: [evidenceDigest] });
        } else {
          const previous = epoch[index-1];
          const counts = Object.fromEntries(categories.map(category => [category, previous.counts[category] === null || value.counts[category] === null ? null : String(BigInt(value.counts[category]!) - BigInt(previous.counts[category]!))])) as ClaudeMetricBundle["counts"];
          if (categories.some(category=>counts[category]===null)) reasons.push("Missing endpoint prevents category difference; unknown is not zero.");
          rows.push({ ...value, start: previous.end, counts, sourceCostUsd: previous.sourceCostUsd === null || value.sourceCostUsd === null ? null : formatUsd(picounits(value.sourceCostUsd)-picounits(previous.sourceCostUsd)), status:"measured", reasons, evidenceDigests:[previous.evidenceDigest,evidenceDigest] });
        }
      }
      precedingEnd=epoch[epoch.length-1].end;
    }
  }
  rows.sort((a,b)=>compare(streamKey(a),streamKey(b)) || compare(a.end,b.end) || compare(a.start,b.start) || compare(a.evidenceDigests.join(),b.evidenceDigests.join()));
  const diagnostics = [...new Set([...streamReasons.values()].flatMap(value=>[...value]))].sort(compare);
  return { observations, rows, replays, hasConflicts: streamReasons.size > 0, diagnostics };
}

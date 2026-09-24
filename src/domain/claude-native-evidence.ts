import { z } from "zod";
import { sha256 } from "@noble/hashes/sha2.js";
import { canonicalJson } from "./canonical-json.ts";
import { parseExactJson } from "./exact-json.ts";

export const NATIVE_LIMITS = { bytes: 256000, captures: 32, points: 1024, aggregatePoints: 2048 } as const;
export const NATIVE_MODELS = ["claude-haiku-4-5-20251001", "claude-sonnet-4-5-20250929", "claude-opus-4-1-20250805"] as const;
const invalid = () => new Error("Invalid native metrics capture.");
export function normalizeNativeDecimal(text: string): string {
  if (typeof text !== "string" || text.length > 800) throw invalid();
  const match = /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]+))?(?:[eE]([+-]?[0-9]+))?$/.exec(text);
  if (!match || (match[4]?.length ?? 0) > 4) throw invalid();
  const exponent = Number(match[4] ?? 0);
  if (Math.abs(exponent) > 324) throw invalid();
  const digits = (match[2] + (match[3] ?? "")).replace(/^0+/, "");
  if (!digits) return "0";
  if (digits.replace(/0+$/, "").length > 128) throw invalid();
  const position = digits.length + exponent - (match[3]?.length ?? 0);
  let result = position <= 0 ? `0.${"0".repeat(-position)}${digits}` : position >= digits.length ? digits + "0".repeat(position-digits.length) : `${digits.slice(0,position)}.${digits.slice(position)}`;
  if (result.includes(".")) result = result.replace(/0+$/, "").replace(/\.$/, "");
  if (result.length > 650) throw invalid();
  return match[1] + result;
}
const hex = z.string().regex(/^[a-f0-9]{64}$/);
const nano = z.string().regex(/^[1-9][0-9]{0,19}$/).refine(value => BigInt(value) <= BigInt("18446744073709551615"));
const quantity = z.string().transform((value, ctx) => {
  try { const result = normalizeNativeDecimal(value); if (result.startsWith("-")) throw invalid(); return result; }
  catch { ctx.addIssue({ code: "custom", message: "Invalid quantity" }); return z.NEVER; }
});
const pointSchema = z.strictObject({
  streamDigest: hex, familyDigest: hex,
  metric: z.enum(["input", "output", "cacheRead", "cacheCreation", "sourceCostUsd"]),
  model: z.enum(NATIVE_MODELS).nullable(), sourceVersion: z.string().max(32).regex(/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/).nullable(),
  temporality: z.enum(["delta", "cumulative"]), startUnixNano: nano, endUnixNano: nano, quantity,
}).refine(value => BigInt(value.startUnixNano) < BigInt(value.endUnixNano) && (value.metric === "sourceCostUsd" || !value.quantity.includes(".")));
const captureSchema = z.strictObject({
  format: z.literal("claude-code-native-metrics-v1"), sample: z.enum(["synthetic", "owner-supplied"]),
  capturedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/).refine(value => { const date = new Date(value); return Number.isFinite(date.getTime()) && date.toISOString() === value; }),
  keyScopeDigest: hex, points: z.array(pointSchema).min(1).max(NATIVE_LIMITS.points),
});
export type ClaudeNativeCapture = z.infer<typeof captureSchema>;
export type ClaudeNativePoint = z.infer<typeof pointSchema>;
type Fact = ClaudeNativePoint & Pick<ClaudeNativeCapture, "sample" | "keyScopeDigest">;
export type ClaudeNativeObservation = Fact & { evidenceDigest: string; captureProvenance: { captureDigest: string; capturedAt: string }[] };
export type ClaudeNativeRow = Fact & { status: "baseline" | "measured" | "conflict"; reasons: string[]; evidenceDigests: string[] };
export type ClaudeNativeReview = { observations: ClaudeNativeObservation[]; rows: ClaudeNativeRow[]; replays: number; hasConflicts: boolean; diagnostics: string[] };
export function parseClaudeNativeCapture(text: string): ClaudeNativeCapture {
  try {
    if (typeof text !== "string" || text.length > NATIVE_LIMITS.bytes || new TextEncoder().encode(text).byteLength > NATIVE_LIMITS.bytes) throw invalid();
    return captureSchema.parse(parseExactJson(text));
  } catch { throw invalid(); }
}
const compare = (a: string,b: string) => a < b ? -1 : a > b ? 1 : 0;
const compareNano = (a: string,b: string) => BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0;
const digest = (value: unknown) => [...sha256(new TextEncoder().encode(canonicalJson(value)))].map(x=>x.toString(16).padStart(2,"0")).join("");
const streamKey = (p: Fact) => `${p.keyScopeDigest}:${p.streamDigest}`;
const familyKey = (p: Fact) => `${p.keyScopeDigest}:${p.familyDigest}`;
const order = (a: Fact,b: Fact) => compare(streamKey(a),streamKey(b)) || compareNano(a.startUnixNano,b.startUnixNano) || compareNano(a.endUnixNano,b.endUnixNano);
function subtract(a: string,b: string): string {
  const [aw,af=""] = a.split("."), [bw,bf=""] = b.split(".");
  const scale = Math.max(af.length,bf.length);
  const difference = BigInt(aw + af.padEnd(scale,"0")) - BigInt(bw + bf.padEnd(scale,"0"));
  const negative = difference < BigInt(0), digits = String(negative ? -difference : difference).padStart(scale+1,"0");
  const plain = scale ? `${digits.slice(0,-scale)}.${digits.slice(-scale)}`.replace(/0+$/,"").replace(/\.$/,"") : digits;
  return (negative ? "-" : "") + plain;
}
function caveats(point: Fact): string[] {
  const reasons = ["Independent metric stream; no category alignment or global total.", "Opaque source identity is not authenticated identity or proof of human activity.", "Source cost is an estimate, not an invoice or verified API-equivalent.", "Cache creation TTL breakdown is unknown; missing categories remain unknown."];
  if (point.model === null) reasons.push("Exact model unknown or unsupported.");
  if (point.sourceVersion === null) reasons.push("Source version unknown; streaming count behavior unvalidated.");
  else {
    const [major,minor,patch] = point.sourceVersion.split(".").map(BigInt);
    if (major < BigInt(2) || (major === BigInt(2) && (minor < BigInt(1) || (minor === BigInt(1) && patch < BigInt(214))))) reasons.push("Source version predates 2.1.214; streaming counts may be inflated.");
  }
  return reasons;
}
/** Recompute a bounded complete batch; arrivals and report rendering never mutate facts. */
export function reviewClaudeNativeCaptures(inputs: readonly ClaudeNativeCapture[]): ClaudeNativeReview {
  let captures: ClaudeNativeCapture[];
  try {
    if (!Array.isArray(inputs) || !inputs.length || inputs.length > NATIVE_LIMITS.captures) throw invalid();
    captures = inputs.map(value => parseClaudeNativeCapture(JSON.stringify(value)));
    if (captures.reduce((n,c)=>n+c.points.length,0) > NATIVE_LIMITS.aggregatePoints) throw invalid();
  } catch { throw invalid(); }
  const facts = new Map<string, ClaudeNativeObservation>();
  let replays = 0;
  for (const capture of captures) {
    const captureDigest = digest({ ...capture, points: [...capture.points].sort((a,b)=>compare(canonicalJson(a),canonicalJson(b))) });
    for (const point of capture.points) {
      const fact = { ...point, sample: capture.sample, keyScopeDigest: capture.keyScopeDigest };
      const evidenceDigest = digest(fact), provenance = { captureDigest, capturedAt: capture.capturedAt };
      const previous = facts.get(evidenceDigest);
      if (previous) { replays++; if (!previous.captureProvenance.some(p=>canonicalJson(p)===canonicalJson(provenance))) previous.captureProvenance.push(provenance); }
      else facts.set(evidenceDigest,{ ...fact, evidenceDigest, captureProvenance:[provenance] });
    }
  }
  const observations = [...facts.values()].sort((a,b)=>order(a,b)||compare(a.evidenceDigest,b.evidenceDigest));
  const streams = new Map<string,ClaudeNativeObservation[]>(), families = new Map<string,Set<string>>(), conflicts = new Map<string,Set<string>>();
  const conflict = (key: string,reason: string) => { const reasons = conflicts.get(key) ?? new Set<string>(); reasons.add(reason); conflicts.set(key,reasons); };
  for (const observation of observations) {
    observation.captureProvenance.sort((a,b)=>compare(canonicalJson(a),canonicalJson(b)));
    const key = streamKey(observation), stream = streams.get(key) ?? []; stream.push(observation); streams.set(key,stream);
    const family = families.get(familyKey(observation)) ?? new Set<string>(); family.add(observation.temporality); families.set(familyKey(observation),family);
  }
  const rows: ClaudeNativeRow[] = [];
  for (const [key,stream] of streams) {
    if (stream.some(p=>families.get(familyKey(p))!.size > 1)) conflict(key,"Mixed temporality in metric family; entire family quarantined.");
    if (new Set(stream.map(p=>canonicalJson([p.familyDigest,p.metric,p.model,p.sourceVersion,p.sample,p.temporality]))).size > 1) conflict(key,"Changed source metadata or origin; entire stream quarantined.");
    const positions = new Map<string,string>();
    for (const p of stream) { const position = `${p.startUnixNano}:${p.endUnixNano}`; if (positions.has(position) && positions.get(position)!==p.evidenceDigest) conflict(key,"Conflicting measurement position; entire stream quarantined."); positions.set(position,p.evidenceDigest); }
    const cumulative = stream[0].temporality === "cumulative", epochs = new Map<string,ClaudeNativeObservation[]>();
    for (const p of stream) { const epochKey = cumulative ? p.startUnixNano : p.evidenceDigest, epoch = epochs.get(epochKey) ?? []; epoch.push(p); epochs.set(epochKey,epoch); }
    const orderedEpochs = [...epochs.values()].map(epoch=>epoch.sort((a,b)=>compareNano(a.endUnixNano,b.endUnixNano)||compare(a.evidenceDigest,b.evidenceDigest))).sort((a,b)=>order(a[0],b[0]));
    let previousEnd: string | null = null;
    for (const epoch of orderedEpochs) {
      if (previousEnd !== null && compareNano(epoch[0].startUnixNano,previousEnd)<0) conflict(key,"Overlapping intervals or epochs; entire stream quarantined.");
      previousEnd = epoch[epoch.length-1].endUnixNano;
      if (cumulative) for (let i=1;i<epoch.length;i++) if (subtract(epoch[i].quantity,epoch[i-1].quantity).startsWith("-")) conflict(key,"Cumulative decrease within epoch; reset unproven and stream quarantined.");
    }
    const errors = [...(conflicts.get(key) ?? [])].sort(compare);
    if (errors.length) {
      for (const { evidenceDigest,captureProvenance,...fact } of stream) { void captureProvenance; rows.push({...fact,status:"conflict",reasons:[...caveats(fact),...errors],evidenceDigests:[evidenceDigest]}); }
      continue;
    }
    previousEnd = null;
    for (const epoch of orderedEpochs) {
      for (let i=0;i<epoch.length;i++) {
        const { evidenceDigest,captureProvenance,...fact } = epoch[i]; void captureProvenance;
        const reasons = caveats(fact);
        if (i===0 && previousEnd!==null && compareNano(fact.startUnixNano,previousEnd)>0) reasons.push("Coverage gap between intervals or epochs.");
        if (!cumulative) rows.push({...fact,status:"measured",reasons,evidenceDigests:[evidenceDigest]});
        else if (i===0) {
          reasons.push("First cumulative observation is a baseline; no earlier usage inferred.");
          if (previousEnd!==null) reasons.push("New cumulative epoch/reset; independent baseline, no bridge.");
          rows.push({...fact,status:"baseline",reasons,evidenceDigests:[evidenceDigest]});
        } else rows.push({...fact,startUnixNano:epoch[i-1].endUnixNano,quantity:subtract(fact.quantity,epoch[i-1].quantity),status:"measured",reasons,evidenceDigests:[epoch[i-1].evidenceDigest,evidenceDigest]});
      }
      previousEnd = epoch[epoch.length-1].endUnixNano;
    }
  }
  rows.sort((a,b)=>order(a,b)||compare(a.evidenceDigests.join(),b.evidenceDigests.join()));
  return { observations,rows,replays,hasConflicts:conflicts.size>0,diagnostics:[...new Set([...conflicts.values()].flatMap(x=>[...x]))].sort(compare) };
}

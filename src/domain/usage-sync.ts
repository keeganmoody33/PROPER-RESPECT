import { z } from "zod";
import { sha256 } from "@noble/hashes/sha2.js";
import { canonicalJson } from "./canonical-json.ts";
import { historyTimestampSchema } from "./connection-history.ts";
import { CODEX_METRICS, codexResponseRowSchema, codexLegacyRowSchema } from "./collector-contract.ts";

export const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const secretSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const digest = (value: string) => [...sha256(new TextEncoder().encode(value))].map(byte => byte.toString(16).padStart(2, "0")).join("");
export const metricSchema = z.enum(CODEX_METRICS);
export const numericEvidenceSchema = z.discriminatedUnion("kind", [
  codexResponseRowSchema.safeExtend({ kind: z.literal("response") }),
  codexLegacyRowSchema.safeExtend({ kind: z.literal("legacy"), thread: digestSchema }),
]);
export type NumericEvidence = z.infer<typeof numericEvidenceSchema>;
export const grantScopeSchema = z.strictObject({
  sourceKey: digestSchema, deviceDigest: digestSchema, context: z.enum(["personal", "work", "unclassified"]),
  accountIdentity: z.literal("unverified"), provider: z.literal("codex"),
  start: historyTimestampSchema, end: historyTimestampSchema, expiresAt: historyTimestampSchema,
  retainOnDisconnect: z.boolean(), destination: z.literal("https://utmost-mongoose-374.convex.cloud"),
}).refine(scope => Date.parse(scope.start) < Date.parse(scope.end)
  && Date.parse(scope.end) - Date.parse(scope.start) <= 366 * 86400_000
  && Date.parse(scope.end) <= Date.parse(scope.expiresAt));
export type GrantScope = z.infer<typeof grantScopeSchema>;
export const usagePacketSchema = z.strictObject({
  version: z.literal("proper-respect-codex-sync-v1"), sourceKey: digestSchema,
  sequence: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  start: historyTimestampSchema, end: historyTimestampSchema, coverage: z.literal("partial"),
  rows: z.array(numericEvidenceSchema).max(200),
}).refine(packet => Date.parse(packet.start) < Date.parse(packet.end) && Date.parse(packet.end) - Date.parse(packet.start) <= 7 * 86400_000
  && packet.rows.every(row => row.at >= packet.start && row.at < packet.end));
export type UsagePacket = z.infer<typeof usagePacketSchema>;
export const packetId = (packet: UsagePacket) => digest(canonicalJson(packet));
export const evidenceKey = (row: NumericEvidence) => row.kind === "response"
  ? digest(canonicalJson([row.kind, row.thread, row.response]))
  : digest(canonicalJson([row.kind, row.stream, row.metric, row.at]));

/** Variants persist across packets, windows and pairing generations. */
export function privateUsageTotals(rows: readonly NumericEvidence[]) {
  const groups = new Map<string, NumericEvidence[]>();
  const modernThreads = new Set(rows.filter(row => row.kind === "response").map(row => row.thread));
  for (const row of rows) {
    if (row.kind === "legacy" && modernThreads.has(row.thread)) continue;
    const key = evidenceKey(row), variants = groups.get(key) ?? [];
    if (!variants.some(item => canonicalJson(item) === canonicalJson(row))) variants.push(row);
    groups.set(key, variants);
  }
  const totals = (kind: NumericEvidence["kind"]) => metricSchema.options.map(metric => {
    let sum = BigInt(0), measured = false, conflict = false, unknown = false;
    for (const variants of groups.values()) {
      const row = variants[0];
      if (!row || row.kind !== kind || (row.kind === "legacy" && row.metric !== metric)) continue;
      if (variants.length > 1 || variants.some(item => item.status === "conflict")) { conflict = true; continue; }
      const value = row.kind === "response" ? row.counts[metric] : row.delta;
      if (value !== null) { measured = true; sum += BigInt(value); }
      else if (row.kind === "response") unknown = true;
    }
    return { metric, value: conflict || unknown || !measured ? null : String(sum), conflict };
  });
  const times = rows.map(row => row.at).sort();
  return { responses: totals("response"), legacy: totals("legacy"), coverage: "partial", accountIdentity: "unverified",
    earliestAt: times[0] ?? null, latestAt: times[times.length - 1] ?? null, evidenceVariants: rows.length };
}

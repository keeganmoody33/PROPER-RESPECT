import { sha256 } from "@noble/hashes/sha2.js";
import { z } from "zod";
import { canonicalJson } from "./canonical-json.ts";
import { historyTimestampSchema, historyWindowSchema } from "./connection-history.ts";

export { historyWindowSchema };
export const COLLECTOR_LIMITS = Object.freeze({ bytes: 8 * 1024 * 1024, chunkBytes: 256_000, chunks: 128, rows: 100_000 });
export const CODEX_METRICS = ["input_tokens", "cached_input_tokens", "output_tokens", "reasoning_output_tokens", "total_tokens", "cache_write_input_tokens"] as const;
export const CURSOR_METRICS = ["requests", "input_tokens", "cached_input_tokens", "output_tokens", "total_tokens", "usage_cost_usd"] as const;
const nativeMetricSchema = z.enum([...CODEX_METRICS, "requests", "usage_cost_usd"]);
const alias = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const integer = z.string().regex(/^(0|[1-9][0-9]{0,127})$/);
const scalar = z.string().regex(/^(0|[1-9][0-9]{0,127})(\.[0-9]{0,17}[1-9])?$/);
const count = z.number().int().nonnegative().max(1_000_000);
const account = z.discriminatedUnion("kind", [z.strictObject({ kind: z.literal("UNKNOWN") }), z.strictObject({ kind: z.literal("OWNER_ASSOCIATED"), alias })]);
const descriptorFields = { sourceId: alias, deviceId: alias, collectorVersion: alias, context: z.enum(["PERSONAL", "WORK"]), account, sample: z.enum(["synthetic", "unknown"]).default("unknown") };
export const connectionDescriptorSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...descriptorFields, kind: z.literal("codex-local-history"), provider: z.literal("codex") }),
  z.strictObject({ ...descriptorFields, kind: z.literal("cursor-complete-export"), provider: z.literal("cursor") }),
]);
export type ConnectionDescriptor = z.infer<typeof connectionDescriptorSchema>;
export const grantSchema = z.strictObject({
  connectionId: alias, descriptor: connectionDescriptorSchema, generation: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  window: historyWindowSchema, expiresAt: historyTimestampSchema,
  allowedMetrics: z.array(nativeMetricSchema).min(1).max(8), checkpoint: hash.nullable(),
}).superRefine((grant, ctx) => {
  const allowed: readonly string[] = grant.descriptor.provider === "codex" ? CODEX_METRICS : CURSOR_METRICS;
  if (new Set(grant.allowedMetrics).size !== grant.allowedMetrics.length || grant.allowedMetrics.some(metric => !allowed.includes(metric))) ctx.addIssue({ code: "custom", message: "Choose distinct metrics supported by this source." });
});
export type CollectorGrant = z.infer<typeof grantSchema>;

const countsSchema = z.strictObject({ input_tokens: integer.nullable(), cached_input_tokens: integer.nullable(), output_tokens: integer.nullable(), reasoning_output_tokens: integer.nullable(), total_tokens: integer.nullable(), cache_write_input_tokens: integer.nullable() }).superRefine((value, ctx) => {
  for (const [subset, total] of [["cached_input_tokens", "input_tokens"], ["reasoning_output_tokens", "output_tokens"]] as const) if (value[subset] !== null && value[total] !== null && BigInt(value[subset]) > BigInt(value[total])) ctx.addIssue({ code: "custom", message: "Invalid native subset." });
});
export const codexResponseRowSchema = z.strictObject({ thread: hash, response: hash, at: historyTimestampSchema, counts: countsSchema, status: z.enum(["measured", "conflict"]) });
export const codexLegacyRowSchema = z.strictObject({ thread: hash.optional(), stream: hash, metric: z.enum(CODEX_METRICS), unit: z.literal("tokens"), at: historyTimestampSchema, value: integer.nullable(), delta: integer.nullable(), status: z.enum(["baseline", "measured", "unknown", "conflict"]) }).superRefine((row, ctx) => {
  if (row.status !== "measured" && row.delta !== null || row.status === "unknown" && row.value !== null || row.status === "baseline" && row.value === null || row.status === "measured" && (row.delta === null || row.value === null || BigInt(row.delta) > BigInt(row.value))) ctx.addIssue({ code: "custom", message: "Invalid legacy accounting state." });
});
const codexTotal = z.strictObject({ metric: z.enum(CODEX_METRICS), value: integer.nullable() });
const legacyTotal = codexTotal.extend({ unit: z.literal("tokens") });
const codexSource = z.strictObject({ provider: z.literal("codex"), kind: z.literal("local-history"), accountAlias: z.null(), sample: z.literal("unknown") });
const diagnostics = z.strictObject({ files: count, threads: count, inheritedResponsesExcluded: count, legacyThreadsExcluded: count, compactionCheckpointsIgnored: count, legacyIntervalsExcluded: count, legacyThreadsSuperseded: count });
const codexHeaderSchema = z.strictObject({ format: z.literal("codex-local-history-v1"), source: codexSource, window: historyWindowSchema, coverage: z.literal("partial"), responses: z.strictObject({ totals: z.array(codexTotal).length(6), replays: count }), legacy: z.strictObject({ totals: z.array(legacyTotal).length(6), replays: count }), diagnostics });
export const codexRolloutReviewSchema = codexHeaderSchema.extend({ responses: z.strictObject({ rows: z.array(codexResponseRowSchema).max(10_000), totals: z.array(codexTotal).length(6), replays: count }), legacy: z.strictObject({ rows: z.array(codexLegacyRowSchema).max(60_000), totals: z.array(legacyTotal).length(6), replays: count }) }).superRefine((review, ctx) => {
  for (const group of [review.responses, review.legacy]) if (new Set(group.totals.map(row => row.metric)).size !== 6) ctx.addIssue({ code: "custom", message: "All distinct native totals are required." });
  const inWindow = (at: string) => at >= review.window.start && at < review.window.end;
  if (review.responses.rows.some(row => !inWindow(row.at)) || review.legacy.rows.some(row => !inWindow(row.at))) ctx.addIssue({ code: "custom", message: "Review rows exceed the approved window." });
  for (const total of review.responses.totals) {
    const rows = review.responses.rows;
    const expected = !rows.length || rows.some(row => row.status === "conflict" || row.counts[total.metric] === null) ? null : String(rows.reduce((sum, row) => sum + BigInt(row.counts[total.metric] ?? "0"), BigInt(0)));
    if (total.value !== expected) ctx.addIssue({ code: "custom", message: "Response total does not match native rows." });
  }
  for (const total of review.legacy.totals) {
    const rows = review.legacy.rows.filter(row => row.metric === total.metric);
    const expected = rows.some(row => row.status === "conflict") || !rows.some(row => row.delta !== null) ? null : String(rows.reduce((sum, row) => sum + BigInt(row.delta ?? "0"), BigInt(0)));
    if (total.value !== expected) ctx.addIssue({ code: "custom", message: "Legacy total does not match retained intervals." });
  }
  const responseGroups = new Map<string, typeof review.responses.rows>();
  for (const row of review.responses.rows) { const id = `${row.thread}:${row.response}`; const rows = responseGroups.get(id) ?? []; rows.push(row); responseGroups.set(id, rows); }
  for (const rows of responseGroups.values()) if (new Set(rows.map(row => canonicalJson({ at: row.at, counts: row.counts }))).size !== rows.length || rows.length > 1 && rows.some(row => row.status !== "conflict")) ctx.addIssue({ code: "custom", message: "Response identity variants must remain distinct and quarantined." });
  const legacyPositions = new Map<string, typeof review.legacy.rows>();
  for (const row of review.legacy.rows) { const id = canonicalJson([row.stream, row.metric, row.at]); const rows = legacyPositions.get(id) ?? []; rows.push(row); legacyPositions.set(id, rows); }
  for (const rows of legacyPositions.values()) if (new Set(rows.map(row => row.value)).size !== rows.length || rows.length > 1 && rows.some(row => row.status !== "conflict")) ctx.addIssue({ code: "custom", message: "Legacy positions cannot duplicate or conceal conflicting variants." });
});

export const cursorReportRowSchema = z.strictObject({ id: alias, at: historyTimestampSchema, metric: z.enum(CURSOR_METRICS), value: scalar.nullable(), unit: z.enum(["tokens", "requests", "usd"]), kind: z.enum(["NATIVE_QUANTITY", "SOURCE_COST_ESTIMATE"]) }).superRefine((row, ctx) => {
  const isCost = row.metric === "usage_cost_usd";
  if (row.unit !== (isCost ? "usd" : row.metric === "requests" ? "requests" : "tokens") || row.kind !== (isCost ? "SOURCE_COST_ESTIMATE" : "NATIVE_QUANTITY") || !isCost && row.value !== null && !integer.safeParse(row.value).success) ctx.addIssue({ code: "custom", message: "Use the native metric's exact unit and interpretation." });
});
const cursorHeaderSchema = z.strictObject({ format: z.literal("cursor-complete-report-v1"), reportId: alias, source: z.strictObject({ provider: z.literal("cursor"), kind: z.literal("owner-supplied-report"), accountAlias: z.null(), sample: z.literal("unknown") }), window: historyWindowSchema, coverage: z.literal("partial"), complete: z.literal(true) });
export const cursorCompleteReportSchema = cursorHeaderSchema.extend({ rows: z.array(cursorReportRowSchema).max(COLLECTOR_LIMITS.rows) }).superRefine((review, ctx) => {
  if (new Set(review.rows.map(row => row.id)).size !== review.rows.length || review.rows.some(row => row.at < review.window.start || row.at >= review.window.end)) ctx.addIssue({ code: "custom", message: "Report row identities must be distinct and within the selected window." });
});
export type CursorCompleteReport = z.infer<typeof cursorCompleteReportSchema>;
export const reviewSchema = z.discriminatedUnion("format", [codexRolloutReviewSchema, cursorCompleteReportSchema]);
export type CollectorReview = z.infer<typeof reviewSchema>;
const headerSchema = z.discriminatedUnion("format", [codexHeaderSchema, cursorHeaderSchema]);
export const reviewRowSchema = z.discriminatedUnion("kind", [z.strictObject({ kind: z.literal("codex-response"), row: codexResponseRowSchema }), z.strictObject({ kind: z.literal("codex-legacy"), row: codexLegacyRowSchema }), z.strictObject({ kind: z.literal("cursor-measurement"), row: cursorReportRowSchema })]);
const typedRowSchema = reviewRowSchema;
export type CollectorRow = z.infer<typeof typedRowSchema>;
const encodedBytes = (value: unknown) => new TextEncoder().encode(canonicalJson(value)).length;
export const collectorDigest = (value: unknown) => [...sha256(new TextEncoder().encode(canonicalJson(value)))].map(byte => byte.toString(16).padStart(2, "0")).join("");
export const digest = collectorDigest;
export const chunkSchema = z.strictObject({ format: z.literal("collector-review-chunk-v1"), batchId: hash, id: hash, index: z.number().int().nonnegative().max(COLLECTOR_LIMITS.chunks - 1), rows: z.array(typedRowSchema).min(1).max(COLLECTOR_LIMITS.rows) }).refine(value => encodedBytes(value) <= COLLECTOR_LIMITS.chunkBytes, "Chunk exceeds the typed payload limit.");
export type ReviewChunk = z.infer<typeof chunkSchema>;
export const manifestSchema = z.strictObject({
  format: z.literal("collector-review-manifest-v1"), connectionId: alias, generation: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), descriptorDigest: hash, window: historyWindowSchema,
  batchId: hash, digest: hash, expectedCheckpoint: hash.nullable(), nextCheckpoint: hash, review: headerSchema,
  chunks: z.array(z.strictObject({ id: hash, index: z.number().int().nonnegative().max(COLLECTOR_LIMITS.chunks - 1), digest: hash, rows: z.number().int().positive().max(COLLECTOR_LIMITS.rows) })).max(COLLECTOR_LIMITS.chunks), bytes: z.number().int().nonnegative().max(COLLECTOR_LIMITS.bytes),
}).superRefine((value, ctx) => {
  if (encodedBytes(value) > COLLECTOR_LIMITS.chunkBytes || value.chunks.some((chunk, index) => chunk.index !== index) || new Set(value.chunks.map(chunk => chunk.id)).size !== value.chunks.length || canonicalJson(value.window) !== canonicalJson(value.review.window)) ctx.addIssue({ code: "custom", message: "Invalid complete review manifest." });
});
export type ReviewManifest = z.infer<typeof manifestSchema>;
export const receiptSchema = z.strictObject({ format: z.literal("collector-commit-receipt-v1"), connectionId: alias, generation: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), batchId: hash, digest: hash, checkpoint: hash, committedAt: historyTimestampSchema });
export type CommitReceipt = z.infer<typeof receiptSchema>;
export const deliveryStatusSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("COMMITTED"), receipt: receiptSchema }),
  z.strictObject({ kind: z.literal("READY"), checkpoint: hash.nullable() }),
  z.strictObject({ kind: z.literal("STALE"), checkpoint: hash.nullable() }),
]);
export type DeliveryStatus = z.infer<typeof deliveryStatusSchema>;

export function assertGrantActive({ grant, now }: { grant: CollectorGrant; now: number }) {
  if (!Number.isFinite(now) || now >= Date.parse(grant.expiresAt)) throw new Error("Collector access expired.");
}
export function assertReviewAuthorized({ grant, review }: { grant: CollectorGrant; review: CollectorReview }) {
  if (grant.descriptor.provider !== review.source.provider || canonicalJson(grant.window) !== canonicalJson(review.window)) throw new Error("Review does not match its approved source and window.");
  const allowed = new Set<string>(grant.allowedMetrics);
  if (review.format === "codex-local-history-v1") {
    if (review.responses.rows.some(row => CODEX_METRICS.some(metric => !allowed.has(metric) && row.counts[metric] !== null)) || review.responses.totals.some(row => !allowed.has(row.metric) && row.value !== null) || review.legacy.rows.some(row => !allowed.has(row.metric)) || review.legacy.totals.some(row => !allowed.has(row.metric) && row.value !== null)) throw new Error("Review exceeds the approved native metrics.");
  } else if (review.rows.some(row => !allowed.has(row.metric))) throw new Error("Report exceeds the approved native metrics.");
}
function header(review: CollectorReview): z.infer<typeof headerSchema> {
  if (review.format === "codex-local-history-v1") return { ...review, responses: { totals: review.responses.totals, replays: review.responses.replays }, legacy: { totals: review.legacy.totals, replays: review.legacy.replays } };
  return { format: review.format, reportId: review.reportId, source: review.source, window: review.window, coverage: review.coverage, complete: review.complete };
}
const chunkId = (batchId: string, index: number, rows: CollectorRow[]) => collectorDigest([batchId, index, rows]);
const batchIdentity = (value: Pick<ReviewManifest, "connectionId" | "generation" | "descriptorDigest" | "digest" | "expectedCheckpoint" | "nextCheckpoint">) => collectorDigest([value.connectionId, value.generation, value.descriptorDigest, value.digest, value.expectedCheckpoint, value.nextCheckpoint]);
const checkpointIdentity = (value: Pick<ReviewManifest, "connectionId" | "generation" | "descriptorDigest" | "expectedCheckpoint" | "digest" | "window">) => collectorDigest(["collector-checkpoint-v1", value.connectionId, value.generation, value.descriptorDigest, value.expectedCheckpoint, value.digest, value.window]);
export function assertManifestIdentity({ manifest: input }: { manifest: unknown }): ReviewManifest {
  const manifest = manifestSchema.parse(input);
  if (batchIdentity(manifest) !== manifest.batchId || checkpointIdentity(manifest) !== manifest.nextCheckpoint) throw new Error("Complete review identity mismatch.");
  return manifest;
}

export function buildReviewDelivery(input: { grant: CollectorGrant; review: unknown }): { manifest: ReviewManifest; chunks: ReviewChunk[] } {
  const grant = grantSchema.parse(input.grant), review = reviewSchema.parse(input.review);
  assertReviewAuthorized({ grant, review });
  const bytes = encodedBytes(review);
  if (bytes > COLLECTOR_LIMITS.bytes) throw new Error("Review exceeds the complete payload limit.");
  const reviewDigest = collectorDigest(review), descriptorDigest = collectorDigest(grant.descriptor);
  const position = { connectionId: grant.connectionId, generation: grant.generation, descriptorDigest, digest: reviewDigest, expectedCheckpoint: grant.checkpoint, window: review.window };
  const identity = { ...position, nextCheckpoint: checkpointIdentity(position) };
  const batchId = batchIdentity(identity);
  const rows: CollectorRow[] = review.format === "codex-local-history-v1" ? [...review.responses.rows.map(row => ({ kind: "codex-response" as const, row })), ...review.legacy.rows.map(row => ({ kind: "codex-legacy" as const, row }))] : review.rows.map(row => ({ kind: "cursor-measurement" as const, row }));
  const chunks: ReviewChunk[] = [];
  let current: CollectorRow[] = [], size = 0;
  const flush = () => {
    if (!current.length) return;
    const index = chunks.length;
    chunks.push(chunkSchema.parse({ format: "collector-review-chunk-v1", batchId, id: chunkId(batchId, index, current), index, rows: current }));
    current = []; size = 0;
  };
  for (const row of rows) { const bytes = encodedBytes(row) + 1; if (size + bytes > COLLECTOR_LIMITS.chunkBytes - 1024) flush(); current.push(row); size += bytes; }
  flush();
  const manifest = manifestSchema.parse({ format: "collector-review-manifest-v1", ...identity, window: review.window, batchId, review: header(review), chunks: chunks.map(chunk => ({ id: chunk.id, index: chunk.index, digest: collectorDigest(chunk), rows: chunk.rows.length })), bytes });
  return { manifest, chunks };
}

export function assembleReview(input: { manifest: unknown; chunks: readonly unknown[] }): CollectorReview {
  const manifest = assertManifestIdentity({ manifest: input.manifest });
  if (input.chunks.length !== manifest.chunks.length) throw new Error("Complete review identity mismatch.");
  const chunks = input.chunks.map(chunk => chunkSchema.parse(chunk)).sort((a, b) => a.index - b.index);
  const rows: CollectorRow[] = [];
  for (const [index, chunk] of chunks.entries()) {
    const expected = manifest.chunks[index];
    if (chunk.batchId !== manifest.batchId || chunk.index !== index || chunk.id !== expected.id || chunk.id !== chunkId(chunk.batchId, chunk.index, chunk.rows) || collectorDigest(chunk) !== expected.digest || chunk.rows.length !== expected.rows) throw new Error("Complete review chunk mismatch.");
    rows.push(...chunk.rows);
  }
  let value: unknown;
  if (manifest.review.format === "codex-local-history-v1") {
    if (rows.some(row => row.kind === "cursor-measurement")) throw new Error("Review contains a different source's rows.");
    value = { ...manifest.review, responses: { ...manifest.review.responses, rows: rows.flatMap(row => row.kind === "codex-response" ? [row.row] : []) }, legacy: { ...manifest.review.legacy, rows: rows.flatMap(row => row.kind === "codex-legacy" ? [row.row] : []) } };
  } else {
    if (rows.some(row => row.kind !== "cursor-measurement")) throw new Error("Report contains a different source's rows.");
    value = { ...manifest.review, rows: rows.flatMap(row => row.kind === "cursor-measurement" ? [row.row] : []) };
  }
  const review = reviewSchema.parse(value);
  if (encodedBytes(review) !== manifest.bytes || collectorDigest(review) !== manifest.digest || manifest.nextCheckpoint !== checkpointIdentity(manifest)) throw new Error("Complete review integrity mismatch.");
  return review;
}

export function assertMatchingReceipt({ manifest, receipt: input }: { manifest: ReviewManifest; receipt: unknown }): CommitReceipt {
  const receipt = receiptSchema.parse(input);
  if (receipt.connectionId !== manifest.connectionId || receipt.generation !== manifest.generation || receipt.batchId !== manifest.batchId || receipt.digest !== manifest.digest || receipt.checkpoint !== manifest.nextCheckpoint) throw new Error("Durable acknowledgment does not match this pending review.");
  return receipt;
}

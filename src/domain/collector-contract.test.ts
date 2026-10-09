import { expect, it } from "vitest";
import { collectCodexRolloutHistory } from "../local/codex-history-collector.ts";
import { assembleReview, assertMatchingReceipt, buildReviewDelivery, collectorDigest, COLLECTOR_LIMITS, connectionDescriptorSchema, cursorCompleteReportSchema, grantSchema, reviewSchema } from "./collector-contract.ts";

const window = { start: "2026-10-01T00:00:00.000Z", end: "2026-10-08T00:00:00.000Z" };
const descriptor = { kind: "codex-local-history", provider: "codex", sourceId: "source-one", deviceId: "device-one", collectorVersion: "codex-rollout-v1", context: "PERSONAL", account: { kind: "UNKNOWN" } };
const grant = () => grantSchema.parse({ connectionId: "connection-one", descriptor, generation: 1, window, expiresAt: "2026-10-09T00:00:00.000Z", allowedMetrics: ["total_tokens"], checkpoint: null });
const review = () => collectCodexRolloutHistory({ window, signal: new AbortController().signal }, []);

it("uses strict separate descriptors and never admits authenticated historical identity", () => {
  expect(connectionDescriptorSchema.parse(descriptor).account.kind).toBe("UNKNOWN");
  expect(connectionDescriptorSchema.safeParse({ ...descriptor, account: { kind: "VERIFIED", alias: "work" } }).success).toBe(false);
  expect(connectionDescriptorSchema.safeParse({ ...descriptor, path: "/private/path" }).success).toBe(false);
  expect(connectionDescriptorSchema.safeParse({ ...descriptor, provider: "cursor" }).success).toBe(false);
});

it("round trips a typed complete review with deterministic delivery identity", () => {
  const delivery = buildReviewDelivery({ grant: grant(), review: review() });
  expect(delivery).toEqual(buildReviewDelivery({ grant: grant(), review: review() }));
  expect(assembleReview(delivery)).toEqual(review());
  expect(delivery.manifest.expectedCheckpoint).toBeNull();
});

it("rejects arbitrary fields, false totals and mismatched durable acknowledgments", () => {
  const value = review();
  expect(reviewSchema.safeParse({ ...value, prompts: ["private"] }).success).toBe(false);
  expect(reviewSchema.safeParse({ ...value, responses: { ...value.responses, totals: value.responses.totals.map(row => ({ ...row, value: "100" })) } }).success).toBe(false);
  const delivery = buildReviewDelivery({ grant: grant(), review: value });
  const receipt = { format: "collector-commit-receipt-v1", connectionId: "connection-one", generation: 1, batchId: delivery.manifest.batchId, digest: delivery.manifest.digest, checkpoint: delivery.manifest.nextCheckpoint, committedAt: "2026-10-02T00:00:00.000Z" };
  expect(() => assertMatchingReceipt({ manifest: delivery.manifest, receipt })).not.toThrow();
  expect(() => assertMatchingReceipt({ manifest: delivery.manifest, receipt: { ...receipt, generation: 2 } })).toThrow();
});

it("chunks real typed rows within bounds and rejects incomplete, tampered and cross-source delivery", () => {
  const value = review();
  value.responses.rows = Array.from({ length: 2000 }, (_, index) => ({ thread: collectorDigest("thread"), response: collectorDigest(index), at: "2026-10-02T00:00:00.000Z", counts: { input_tokens: null, cached_input_tokens: null, output_tokens: null, reasoning_output_tokens: null, total_tokens: "1", cache_write_input_tokens: null }, status: "measured" }));
  value.responses.totals = value.responses.totals.map(row => ({ ...row, value: row.metric === "total_tokens" ? "2000" : null }));
  const delivery = buildReviewDelivery({ grant: grant(), review: value });
  expect(delivery.chunks.length).toBeGreaterThan(1);
  expect(delivery.chunks.every(chunk => new TextEncoder().encode(JSON.stringify(chunk)).length <= COLLECTOR_LIMITS.chunkBytes)).toBe(true);
  expect(assembleReview({ manifest: delivery.manifest, chunks: [...delivery.chunks].reverse() })).toEqual(value);
  expect(() => assembleReview({ manifest: delivery.manifest, chunks: delivery.chunks.slice(1) })).toThrow();
  expect(() => assembleReview({ manifest: delivery.manifest, chunks: [{ ...delivery.chunks[0], rows: [{ kind: "codex-response", row: { ...value.responses.rows[0], prompt: "private" } }] }, ...delivery.chunks.slice(1)] })).toThrow();
  expect(() => assembleReview({ manifest: { ...delivery.manifest, connectionId: "other" }, chunks: delivery.chunks })).toThrow();
});

it("never treats a complete supplied Cursor report as authenticated account coverage or a bill", () => {
  const report = { format: "cursor-complete-report-v1", reportId: "report-one", source: { provider: "cursor", kind: "owner-supplied-report", accountAlias: null, sample: "unknown" }, window, complete: true, coverage: "partial", rows: [
    { id: "one", at: "2026-10-02T00:00:00.000Z", metric: "usage_cost_usd", value: "0.123456789123456789", unit: "usd", kind: "SOURCE_COST_ESTIMATE" },
    { id: "two", at: "2026-10-02T00:00:00.000Z", metric: "requests", value: null, unit: "requests", kind: "NATIVE_QUANTITY" },
  ] };
  expect(cursorCompleteReportSchema.parse(report).rows[0].value).toBe("0.123456789123456789");
  expect(cursorCompleteReportSchema.safeParse({ ...report, complete: false }).success).toBe(false);
  expect(cursorCompleteReportSchema.safeParse({ ...report, rows: [{ ...report.rows[0], kind: "ACTUAL_CHARGE" }] }).success).toBe(false);
  expect(cursorCompleteReportSchema.safeParse({ ...report, rows: [{ ...report.rows[1], value: "0.5" }] }).success).toBe(false);
  expect(cursorCompleteReportSchema.safeParse({ ...report, rows: [report.rows[1], report.rows[1]] }).success).toBe(false);
});

it("rejects source, native-metric and history-window expansion outside approval", () => {
  const value = review();
  value.responses.rows = [{ thread: collectorDigest("thread"), response: collectorDigest("response"), at: "2026-10-02T00:00:00.000Z", counts: { input_tokens: "1", cached_input_tokens: null, output_tokens: null, reasoning_output_tokens: null, total_tokens: "1", cache_write_input_tokens: null }, status: "measured" }];
  value.responses.totals = value.responses.totals.map(row => ({ ...row, value: row.metric === "total_tokens" || row.metric === "input_tokens" ? "1" : null }));
  expect(() => buildReviewDelivery({ grant: grant(), review: value })).toThrow("approved native metrics");
  expect(() => buildReviewDelivery({ grant: grant(), review: { ...review(), window: { ...window, start: "2026-10-02T00:00:00.000Z" } } })).toThrow("approved source and window");
});

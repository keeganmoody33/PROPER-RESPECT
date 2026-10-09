import { expect, it } from "vitest";
import { canonicalJson } from "./canonical-json.ts";
import { CODEX_METRICS } from "./collector-contract.ts";
import { measurementSchema, parseMeasurementImport, projectMeasurement, publicMeasurementSchema } from "./measurements.ts";
import { digest, evidenceKey, type NumericEvidence } from "./usage-sync.ts";
import { createUsageSnapshotAccumulator, usageSnapshotSchema, usageSnapshotWindowSchema, USAGE_SNAPSHOT_ALGORITHM, USAGE_SNAPSHOT_LIMITS } from "./usage-snapshot.ts";

const window = { start: "2026-10-01T00:00:00.000Z", end: "2026-10-08T00:00:00.000Z" };
const metadata = { sourceKey: "a".repeat(64), context: "personal" as const, capturedAt: "2026-10-09T00:00:00.000Z" };
const response = (id = 1, value: string | null = "10", at = "2026-10-02T00:00:00.000Z"): Extract<NumericEvidence, { kind: "response" }> => ({
  kind: "response", thread: "b".repeat(64), response: id.toString(16).padStart(64, "0"), at, status: "measured",
  counts: { input_tokens: value, cached_input_tokens: "0", output_tokens: "0", reasoning_output_tokens: "0", total_tokens: value, cache_write_input_tokens: "0" },
});
const ordered = (rows: NumericEvidence[]) => rows.sort((a, b) => {
  const aKey = evidenceKey(a), bKey = evidenceKey(b);
  if (aKey !== bKey) return aKey < bKey ? -1 : 1;
  return digest(canonicalJson(a)) < digest(canonicalJson(b)) ? -1 : digest(canonicalJson(a)) === digest(canonicalJson(b)) ? 0 : 1;
});
function snapshot(rows: NumericEvidence[], input = metadata) {
  const accumulator = createUsageSnapshotAccumulator(window);
  for (const row of ordered(rows)) accumulator.add(row);
  return accumulator.finish(input);
}
const tokenValue = (result: ReturnType<typeof snapshot>) => result.measurements.find(row => row.metric === "total_tokens")?.value;

it("sums exact modern response quantities while keeping scope, period and disclosure limitations", () => {
  const result = snapshot([response(1, "9007199254740993123456789"), response(2, "11")]);
  expect(tokenValue(result)).toBe("9007199254740993123456800");
  expect(result).toMatchObject({ format: "codex-history-window-v1", algorithmVersion: USAGE_SNAPSHOT_ALGORITHM, ...metadata, ...window });
  expect(result.measurements).toHaveLength(CODEX_METRICS.length);
  expect(result.responseCount).toBe(2);
  for (const row of result.measurements) {
    expect(row).toMatchObject({ derivation: "SUMMED_RESPONSES", scope: "DEVICE", coverage: "PARTIAL", aggregation: "NON_ADDITIVE", sample: "unknown", status: "measured", period: { kind: "date", start: "2026-10-01", end: "2026-10-07", timezone: "UTC" } });
    expect(row.reasons.join(" ")).toMatch(/unverified/i);
    expect(measurementSchema.safeParse(row).success).toBe(true);
    expect(publicMeasurementSchema.safeParse(projectMeasurement(row)).success).toBe(true);
  }
});

it("quarantines an inside-window response when its conflicting variant falls outside the window", () => {
  const inside = response(1, "10"), outside = response(1, "20", "2026-09-30T23:59:59.999Z");
  const result = snapshot([inside, outside, response(2, "30")]);
  expect(result.measurements.every(row => row.status === "conflict" && row.value === null)).toBe(true);
  expect(result.responseCount).toBe(2);
  expect(() => projectMeasurement(result.measurements[0])).toThrow();
  expect(result.evidenceDigest).not.toBe(snapshot([inside, response(2, "30")]).evidenceDigest);
  expect(snapshot([inside, { ...outside, at: window.end }]).measurements.every(row => row.status === "conflict")).toBe(true);
});

it("preserves explicit conflict status and distinguishes unknown, measured zero and absent evidence", () => {
  expect(snapshot([{ ...response(), status: "conflict" }]).measurements.every(row => row.status === "conflict" && row.value === null)).toBe(true);
  expect(tokenValue(snapshot([response(1, null), response(2, "5")]))).toBeNull();
  expect(tokenValue(snapshot([response(1, "0")]))).toBe("0");
  expect(snapshot([]).measurements.every(row => row.value === null)).toBe(true);
  expect(snapshot([]).responseCount).toBe(0);
  expect(snapshot([response(1, null)]).responseCount).toBe(1);
});

it("deduplicates adjacent replay without making capture time or unrelated windows part of evidence identity", () => {
  const row = response(), first = snapshot([row]);
  const second = snapshot([row, row, response(2, "5", window.end)], { ...metadata, capturedAt: "2026-10-10T00:00:00.000Z" });
  expect(second.evidenceDigest).toBe(first.evidenceDigest);
  expect(second.measurements.map(item => item.id)).toEqual(first.measurements.map(item => item.id));
  expect(tokenValue(second)).toBe("10");
  expect(second.responseCount).toBe(1);
});

it("excludes legacy rows and keeps source-specific identities separate", () => {
  const legacy: NumericEvidence = { kind: "legacy", stream: "d".repeat(64), thread: "b".repeat(64), metric: "total_tokens", unit: "tokens", at: "2026-10-02T00:00:00.000Z", value: "900", delta: "800", status: "measured" };
  const first = snapshot([response()]), withLegacy = snapshot([legacy, response()]);
  expect(withLegacy).toEqual(first);
  expect(snapshot([legacy]).measurements.every(row => row.value === null)).toBe(true);
  const other = snapshot([response()], { ...metadata, sourceKey: "c".repeat(64) });
  expect(other.measurements.map(row => row.id)).not.toEqual(first.measurements.map(row => row.id));
});

it("rejects raw fields, invalid windows, unordered keys or variants, and any reuse after failure or finish", () => {
  for (const invalid of [{ ...window, start: "2026-10-01T00:00:01Z" }, { ...window, end: "2026-10-09T00:00:00Z" }, { ...window, end: window.start }, { ...window, prompt: "private" }]) expect(usageSnapshotWindowSchema.safeParse(invalid).success).toBe(false);
  const pairs = [ordered([response(1), response(2)]), ordered([response(1, "1"), response(1, "2")])];
  for (const rows of pairs) {
    const accumulator = createUsageSnapshotAccumulator(window);
    accumulator.add(rows[1]);
    expect(() => accumulator.add(rows[0])).toThrow();
    expect(() => accumulator.finish(metadata)).toThrow();
  }
  const raw = createUsageSnapshotAccumulator(window);
  const rawRow = { ...response(), prompt: "private" };
  expect(() => raw.add(rawRow)).toThrow();
  expect(() => raw.finish(metadata)).toThrow();
  const done = createUsageSnapshotAccumulator(window); done.finish(metadata);
  expect(() => done.add(response())).toThrow();
  expect(() => done.finish(metadata)).toThrow();
});

it("validates snapshot semantics as well as rejecting extra metadata and raw fields", () => {
  const valid = snapshot([response()]);
  expect(usageSnapshotSchema.safeParse(valid).success).toBe(true);
  expect(() => parseMeasurementImport(JSON.stringify(valid))).toThrow();
  for (const invalid of [{ ...valid, prompt: "private" }, { ...valid, measurements: [{ ...valid.measurements[0], derivation: "SOURCE_REPORTED" }] }, { ...valid, measurements: valid.measurements.map(row => ({ ...row, period: { kind: "unknown" } })) }, { ...valid, measurements: valid.measurements.map(row => ({ ...row, value: "1.5" })) }, { ...valid, sourceKey: "not-a-source-key" }]) expect(usageSnapshotSchema.safeParse(invalid).success).toBe(false);
});

it("streams 105246 distinct responses without a retained row array or page-sized cutoff", () => {
  const count = 105246;
  const positions = Array.from({ length: count }, (_, index) => ({ index, key: evidenceKey(response(index + 1, "1")) })).sort((a, b) => a.key < b.key ? -1 : 1);
  const accumulator = createUsageSnapshotAccumulator(window);
  for (const { index } of positions) accumulator.add(response(index + 1, "1"));
  const result = accumulator.finish(metadata);
  expect(tokenValue(result)).toBe(String(count));
  expect(result.responseCount).toBe(count);
  expect(USAGE_SNAPSHOT_LIMITS).toEqual({ pageSize: 200, rows: 200000, bytes: 64 * 1024 * 1024 });
}, 30000);

it("includes every selected group's variant in the digest across page boundaries", () => {
  const variants = ordered([response(1, "10"), response(1, "20", "2026-09-01T00:00:00.000Z"), response(1, "30", window.end)]);
  const accumulator = createUsageSnapshotAccumulator(window);
  // A backend page boundary does not end the current evidence identity group.
  for (const page of [[variants[0]], [variants[1], variants[1]], [variants[2]]]) for (const row of page) accumulator.add(row);
  const all = accumulator.finish(metadata);
  expect(all).toEqual(snapshot([...variants]));
  expect(all.responseCount).toBe(1);
  expect(all.evidenceDigest).not.toBe(snapshot(variants.slice(0, 2)).evidenceDigest);
  expect(all.evidenceDigest).not.toBe(snapshot(variants.slice(1)).evidenceDigest);
});

it("charges even replayed or excluded input against the row scan bound and fails closed", () => {
  const legacy: NumericEvidence = { kind: "legacy", stream: "d".repeat(64), thread: "b".repeat(64), metric: "total_tokens", unit: "tokens", at: "2026-09-02T00:00:00.000Z", value: "0", delta: "0", status: "measured" };
  const accumulator = createUsageSnapshotAccumulator(window);
  for (let index = 0; index < USAGE_SNAPSHOT_LIMITS.rows; index++) accumulator.add(legacy);
  expect(() => accumulator.add(legacy)).toThrow(/limit/);
  expect(() => accumulator.finish(metadata)).toThrow();
}, 30000);

it("enforces the byte scan bound independently of the row bound", () => {
  const huge = "9".repeat(128), row = response(1, huge);
  for (const metric of CODEX_METRICS) row.counts[metric] = huge;
  const bytes = new TextEncoder().encode(canonicalJson(row)).length;
  const allowed = Math.floor(USAGE_SNAPSHOT_LIMITS.bytes / bytes);
  expect(allowed).toBeLessThan(USAGE_SNAPSHOT_LIMITS.rows);
  const accumulator = createUsageSnapshotAccumulator(window);
  for (let index = 0; index < allowed; index++) accumulator.add(row);
  expect(() => accumulator.add(row)).toThrow(/limit/);
  expect(() => accumulator.finish(metadata)).toThrow();
}, 30000);

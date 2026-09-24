import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildUsageCostReport, SYNTHETIC_SCENARIO } from "./usage-cost-report.ts";
import { privateUsageCardSchema, projectPrivateUsage } from "./private-usage-card.ts";
import type { ClaudeNativeCapture, ClaudeNativePoint } from "./claude-native-evidence.ts";

const huge = "900719925474099312345678901234";
const tiny = "0.00000000000000000001234567890123456789";
const point = (overrides: Partial<ClaudeNativePoint> = {}): ClaudeNativePoint => ({
  streamDigest: "a".repeat(64), familyDigest: "b".repeat(64), metric: "input", model: null,
  sourceVersion: null, temporality: "delta", startUnixNano: "1790244000000000001", endUnixNano: "1790244000000000100", quantity: huge, ...overrides,
});
const capture = (points = [point()], overrides: Partial<ClaudeNativeCapture> = {}): ClaudeNativeCapture => ({
  format: "claude-code-native-metrics-v1", sample: "synthetic", capturedAt: "2026-09-24T12:00:00.000Z", keyScopeDigest: "c".repeat(64), points, ...overrides,
});
const report = (...captures: ClaudeNativeCapture[]) => buildUsageCostReport(captures.map(value => JSON.stringify(value)));
const lane = (...captures: ClaudeNativeCapture[]) => projectPrivateUsage(report(...captures)).tools[0].nativeClaude!;

describe("native private scalar projection", () => {
  it("preserves native-only and every mixed lane in one Claude card with no alignment or valuation", () => {
    const native = capture([point(), point({ streamDigest: "d".repeat(64), familyDigest: "e".repeat(64), metric: "sourceCostUsd", quantity: tiny, startUnixNano: "1790244000000000004", endUnixNano: "1790244000000000108" })]);
    for (const extra of [[], [readFileSync("tests/fixtures/usage-cost/priced-synthetic.json", "utf8"), readFileSync("tests/fixtures/usage-cost/codex-account-synthetic.json", "utf8")]]) {
      const preview = projectPrivateUsage(buildUsageCostReport([JSON.stringify(native), ...extra], { syntheticScenario: SYNTHETIC_SCENARIO }));
      expect(preview.tools.filter(card => card.productSlug === "claude-code")).toHaveLength(1);
      const card = preview.tools[0];
      expect(card.nativeClaude!.rows.map(row => row.quantity)).toEqual([huge, tiny]);
      expect(card.nativeClaude!.rows.map(row => row.period.startUnixNano)).toEqual(["1790244000000000001", "1790244000000000004"]);
      expect(card.nativeClaude!.rows.every(row => row.apiEquivalent === "unpriced" && row.billed === "unknown")).toBe(true);
      expect(card.rows).toHaveLength(extra.length ? 1 : 0);
      expect(preview.tools).toHaveLength(extra.length ? 2 : 1);
    }
  });
  it("preserves scoped stream/family identity without original identifiers", () => {
    const a = capture(), b = capture([point()], { keyScopeDigest: "d".repeat(64) });
    const value = lane(a, b);
    expect(new Set(value.rows.map(row => row.streamLabel)).size).toBe(2);
    expect(new Set(value.rows.map(row => row.familyLabel)).size).toBe(2);
    expect(new Set(value.rows.map(row => row.scopeLabel)).size).toBe(2);
    for (const digest of ["a", "b", "c", "d"]) expect(JSON.stringify(value)).not.toContain(digest.repeat(64));
    expect(JSON.stringify(value)).not.toMatch(/Digest|keyScope|evidenceDigests|captureProvenance/);
  });
  it("retains both endpoints and all capture timestamps without inventing a row capture", () => {
    const start = "1790244000000000001";
    const first = point({ temporality: "cumulative", quantity: "7" });
    const second = point({ temporality: "cumulative", endUnixNano: "1790244000000000200", quantity: "10" });
    const value = lane(capture([first, second]), capture([first], { capturedAt: "2026-09-24T13:00:00.000Z" }));
    expect(value.replays).toBe(1);
    expect(value.rows.map(row => row.status)).toEqual(["baseline", "measured"]);
    expect(value.rows[1].quantity).toBe("3");
    expect(value.rows[1].period.startUnixNano).toBe(first.endUnixNano);
    expect(value.rows[0].period.startUnixNano).toBe(start);
    expect(value.rows[1].observationLabels).toEqual(value.observations.map(row => row.observationLabel));
    expect(value.observations[0].captures.map(item => item.capturedAt).sort()).toEqual(["2026-09-24T12:00:00.000Z", "2026-09-24T13:00:00.000Z"]);
    expect(value.rows[1]).not.toHaveProperty("capturedAt");
    expect(value.rows[1].streamLabel).toBe(value.rows[0].streamLabel);
  });
  it("preserves zero, unknown model/version and every native reason safely", () => {
    const original = report(capture([point({ quantity: "0" })]));
    const before = original.nativeClaude!.rows[0].reasons;
    original.nativeClaude!.rows[0].reasons.push("PRIVATE_DIAGNOSTIC");
    const value = projectPrivateUsage(original).tools[0].nativeClaude!;
    expect(value.rows[0]).toMatchObject({ quantity: "0", model: null, sourceVersion: null });
    for (const reason of before.filter(reason => reason !== "PRIVATE_DIAGNOSTIC")) expect(value.rows[0].reasons).toContain(reason);
    expect(JSON.stringify(value)).not.toContain("PRIVATE_DIAGNOSTIC");
  });
  it("preserves resets, gaps, overlaps, decreases and mixed-temporality quarantine", () => {
    const first = point({ temporality: "cumulative", quantity: "7" });
    const cases = [
      [first, point({ temporality: "cumulative", startUnixNano: "1790244000000000200", endUnixNano: "1790244000000000300", quantity: "1" })],
      [point(), point({ endUnixNano: "1790244000000000200" })],
      [first, point({ temporality: "cumulative", endUnixNano: "1790244000000000200", quantity: "1" })],
      [first, point({ streamDigest: "e".repeat(64) })],
    ];
    for (const points of cases) {
      const source = report(capture(points)), value = projectPrivateUsage(source).tools[0].nativeClaude!;
      expect(value.hasConflicts).toBe(source.nativeClaude!.hasConflicts);
      expect(value.rows.map(row => [row.quantity, row.status, row.reasons])).toEqual(source.nativeClaude!.rows.map(row => [row.quantity, row.status, row.reasons]));
    }
  });
  it("rejects broken and foreign evidence references instead of partial provenance", () => {
    for (const mutation of ["missing", "foreign"] as const) {
      const source = report(capture([point(), point({ streamDigest: "d".repeat(64) })]));
      source.nativeClaude!.rows[0].evidenceDigests = [mutation === "missing" ? "f".repeat(64) : source.nativeClaude!.observations[1].evidenceDigest];
      expect(() => projectPrivateUsage(source)).toThrow("Invalid native private projection.");
    }
  });
  it("accepts the full native decimal and nanosecond bounds without coercion", () => {
    const exact = `0.${"0".repeat(323)}1`;
    const value = lane(capture([point({ metric: "sourceCostUsd", quantity: exact, endUnixNano: "18446744073709551615" })]));
    expect(value.rows[0].quantity).toBe(exact);
    expect(value.rows[0].period.endUnixNano).toBe("18446744073709551615");
  });
  it("strictly rejects malformed runtime native projections and native lanes on Codex", () => {
    const card = projectPrivateUsage(report(capture())).tools[0];
    const row = card.nativeClaude!.rows[0];
    for (const patch of [{ quantity: 12 }, { quantity: "1.2" }, { period: { startUnixNano: "1", endUnixNano: "1" } }, { streamDigest: "a".repeat(64) }, { observationLabels: ["Native observation 999"] }]) {
      expect(privateUsageCardSchema.safeParse({ ...card, nativeClaude: { ...card.nativeClaude, rows: [{ ...row, ...patch }] } }).success).toBe(false);
    }
    expect(privateUsageCardSchema.safeParse({ ...card, productSlug: "codex" }).success).toBe(false);
  });
});

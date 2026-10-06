import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { parseMeasurementImport, reviewMeasurementImports, projectMeasurement } from "./measurements";

const source = { namespace: "synthetic-tool", identityBasis: "OWNER_SUPPLIED", sourceAlias: "export", ownerAlias: null, accountAlias: "account-a", workspaceAlias: null, deviceAlias: null };
const row = { id: "m1", metric: "words", value: "9007199254740993123456789", unit: "words", period: { kind: "unknown" }, scope: "ACCOUNT", coverage: "UNKNOWN", temporality: "SNAPSHOT", aggregation: "NON_ADDITIVE", overlapGroup: null };
const generic = (changes = {}) => JSON.stringify({ format: "proper-measurements-v1", captureId: "capture-1", capturedAt: "2026-10-01T00:00:00.000Z", source, measurements: [row], ...changes });
const native = (quantity: string, end: string, extra = {}) => JSON.stringify({ format: "claude-code-native-metrics-v1", sample: "owner-supplied", capturedAt: "2026-10-01T00:00:00.000Z", keyScopeDigest: "a".repeat(64), points: [{ streamDigest: "b".repeat(64), familyDigest: "c".repeat(64), metric: "input", model: null, sourceVersion: "2.1.214", temporality: "cumulative", startUnixNano: "1000000000000000001", endUnixNano: end, quantity, ...extra }] });

describe("exact product-independent sanitized measurements", () => {
  test("preserves huge integers, tiny decimals, unknown, zero, scope and native intervals", () => {
    for (const value of [row.value, "0.0000000000000000000000000000000000000000001", "0", null]) {
      const input = parseMeasurementImport(generic({ measurements: [{ ...row, value, scope: "DEVICE", period: { kind: "instant", startUnixNano: "1000000000000000001", endUnixNano: "1000000000000000002" } }] }));
      const result = reviewMeasurementImports([input]);
      expect(result[0]).toMatchObject({ value, scope: "DEVICE", period: { startUnixNano: "1000000000000000001", endUnixNano: "1000000000000000002" } });
    }
  });
  test("uses Claude reconciliation across captures, retaining cumulative baseline and exact delta", () => {
    const inputs = [parseMeasurementImport(native("9007199254740993000", "1000000000000000002")), parseMeasurementImport(native("9007199254740993001", "1000000000000000003"))];
    expect(reviewMeasurementImports(inputs).map(item => [item.status, item.value])).toEqual([["baseline", "9007199254740993000"], ["measured", "1"]]);
    const conflict = parseMeasurementImport(native("9007199254740993999", "1000000000000000003"));
    expect(reviewMeasurementImports([...inputs, conflict]).every(item => item.status === "conflict")).toBe(true);
  });
  test("uses actual Codex sanitized captures and preserves daily zero and unknown without summing", () => {
    const capture = parseMeasurementImport(readFileSync("tests/fixtures/codex-usage/account-snapshot.json", "utf8"));
    const rows = reviewMeasurementImports([capture]);
    expect(rows.filter(item => item.metric === "daily_tokens").map(item => item.value)).toEqual(["1200", "0"]);
    expect(rows.find(item => item.metric === "longest_running_turn")?.value).toBeNull();
    expect(rows.filter(item => item.metric === "lifetime_tokens")).toHaveLength(1);
    expect(capture.source.identityBasis).toBe("OWNER_SUPPLIED");
    expect(capture.source.accountAlias).toBe("synthetic-account");
  });
  test("allows workspace rows, device seconds and uncatalogued namespaces on the same contract", () => {
    for (const [metric, unit, scope] of [["distinct_rows", "rows", "WORKSPACE"], ["app_duration", "seconds", "DEVICE"], ["tokens", "tokens", "ACCOUNT"]]) {
      const parsed = parseMeasurementImport(generic({ measurements: [{ ...row, metric, unit, scope, aggregation: "DISTINCT" }] }));
      expect(reviewMeasurementImports([parsed])[0]).toMatchObject({ metric, unit, scope });
    }
  });
  test("rejects raw content, duplicate keys, numeric scalar coercion and fictional report JSON", () => {
    for (const text of [generic({ prompt: "private prompt" }), generic({ measurements: [{ ...row, value: 42 }] }), generic().replace('"capture-1"', '"capture-1","captureId":"capture-2"'), JSON.stringify({ report: "usage-cost", totalTokens: 42 }), "# Usage cost report\n42 tokens"]) {
      expect(() => parseMeasurementImport(text)).toThrow();
    }
  });
  test("projects an explicit bounded allowlist without private source or dimensions", () => {
    const measured = reviewMeasurementImports([parseMeasurementImport(generic())])[0];
    const projected = projectMeasurement(measured);
    expect(projected.value).toBe(row.value);
    expect(projected).not.toHaveProperty("id");
    expect(projected).not.toHaveProperty("overlapGroup");
    expect(projected).not.toHaveProperty("dimensions");
    expect(projected).not.toHaveProperty("source");
    expect(projected.identityBasis).toBe("OWNER_SUPPLIED");
  });
});

test("synthetic native status and exact tiny source estimate remain explicit in public projection", () => {
  const input = JSON.parse(native("0.00000000000000000000000000000000000001", "1000000000000000002", { metric: "sourceCostUsd", temporality: "delta" }));
  input.sample = "synthetic";
  const row = reviewMeasurementImports([parseMeasurementImport(JSON.stringify(input))])[0];
  expect(projectMeasurement(row)).toMatchObject({ metric: "estimated_cost_usd", value: "0.00000000000000000000000000000000000001", sample: "synthetic", derivation: "SOURCE_REPORTED" });
});

test("portable Codex parsing rejects duplicate fields and unsafe numeric tokens before rounding", () => {
  const fixture = readFileSync("tests/fixtures/codex-usage/account-snapshot.json", "utf8");
  for (const token of ["9007199254740991.1", "1e-999", "9007199254740992", "1.0000000000000001"]) {
    expect(() => parseMeasurementImport(fixture.replace('"lifetimeTokens": 1200', `"lifetimeTokens": ${token}`))).toThrow();
  }
  expect(() => parseMeasurementImport(fixture.replace('"lifetimeTokens": 1200', '"lifetimeTokens": 1200, "lifetimeTokens": 0'))).toThrow();
});

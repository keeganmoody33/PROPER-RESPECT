import { describe, expect, it } from "vitest";
import { normalizeNativeDecimal, parseClaudeNativeCapture, reviewClaudeNativeCaptures } from "./claude-native-evidence.ts";
const point = (extra = {}) => ({ streamDigest: "a".repeat(64), familyDigest: "b".repeat(64), metric: "input", model: null, sourceVersion: "2.1.274", temporality: "delta", startUnixNano: "1000000000000000001", endUnixNano: "1000000000000000002", quantity: "5", ...extra });
const capture = (points = [point()], extra = {}) => ({ format: "claude-code-native-metrics-v1", sample: "synthetic", capturedAt: "2026-09-24T00:00:00.000Z", keyScopeDigest: "c".repeat(64), points, ...extra });
const parse = (value: unknown) => parseClaudeNativeCapture(JSON.stringify(value));
describe("native evidence", () => {
  it("normalizes exact decimals without binary rounding", () => {
    expect(normalizeNativeDecimal("1.2300e-4")).toBe("0.000123");
    expect(normalizeNativeDecimal("-0.0")).toBe("0");
    expect(normalizeNativeDecimal("9007199254740993")).toBe("9007199254740993");
    expect(() => normalizeNativeDecimal("1e325")).toThrow();
  });
  it("keeps nanoseconds and rejects unknown fields/unsafe shapes", () => {
    expect(parse(capture()).points[0].endUnixNano).toBe("1000000000000000002");
    for (const p of [point({ quantity: "-1" }), point({ quantity: "0.5" }), point({ startUnixNano: "0" }), point({ endUnixNano: "18446744073709551616" }), point({ model: "SECRET" })]) expect(() => parse(capture([p]))).toThrow("Invalid native metrics capture.");
    expect(() => parseClaudeNativeCapture(JSON.stringify(capture()).replace('"quantity":"5"', '"quantity":"5","quantity":"6"'))).toThrow();
  });
  it("deduplicates normalized facts retaining capture provenance", () => {
    const a = parse(capture([point({ metric: "sourceCostUsd", quantity: "1.00" })]));
    const b = parse(capture([point({ metric: "sourceCostUsd", quantity: "1e0" })], { capturedAt: "2026-09-24T00:01:00.000Z" }));
    const r = reviewClaudeNativeCaptures([a,b]);
    expect(r.replays).toBe(1); expect(r.observations[0].captureProvenance).toHaveLength(2); expect(r.rows[0].quantity).toBe("1");
    expect(reviewClaudeNativeCaptures([b,a])).toEqual(r);
  });
  it("quarantines conflicting positions and overlapping delta intervals", () => {
    for (const p of [point({ quantity: "6" }), point({ endUnixNano: "1000000000000000003" })]) {
      const r = reviewClaudeNativeCaptures([parse(capture([point(),p]))]);
      expect(r.hasConflicts).toBe(true); expect(r.rows.every(x => x.status === "conflict")).toBe(true);
    }
  });
  it("cumulative baseline, exact increment, reset and gap", () => {
    const pts = [point({ temporality: "cumulative", quantity: "9007199254740993" }), point({ temporality: "cumulative", endUnixNano: "1000000000000000004", quantity: "9007199254740995" }), point({ temporality: "cumulative", startUnixNano: "1000000000000000005", endUnixNano: "1000000000000000006", quantity: "1" })];
    const r = reviewClaudeNativeCaptures([parse(capture(pts))]);
    expect(r.rows.map(x=>x.status)).toEqual(["baseline","measured","baseline"]); expect(r.rows[1].quantity).toBe("2"); expect(r.rows[2].reasons.join()).toContain("gap");
  });
  it("quarantines cumulative decreases and mixed-temporality families", () => {
    const first = point({ temporality: "cumulative" });
    expect(reviewClaudeNativeCaptures([parse(capture([first, point({ temporality: "cumulative", endUnixNano: "1000000000000000003", quantity: "4" })]))]).hasConflicts).toBe(true);
    const r = reviewClaudeNativeCaptures([parse(capture([first,point({ streamDigest: "d".repeat(64) })]))]);
    expect(r.rows.every(x=>x.status==="conflict")).toBe(true);
  });
  it("does not align independently arriving categories", () => {
    const r = reviewClaudeNativeCaptures([parse(capture([point(),point({ streamDigest:"d".repeat(64), familyDigest:"e".repeat(64), metric:"output", startUnixNano:"1000000000000000002",endUnixNano:"1000000000000000007" })]))]);
    expect(r.rows).toHaveLength(2); expect(r.hasConflicts).toBe(false);
  });
  it("subtracts decimal source estimates exactly", () => {
    const r = reviewClaudeNativeCaptures([parse(capture([
      point({ metric:"sourceCostUsd",temporality:"cumulative",quantity:"0.1000000000000000001" }),
      point({ metric:"sourceCostUsd",temporality:"cumulative",quantity:"0.3000000000000000003",endUnixNano:"1000000000000000004" }),
    ]))]);
    expect(r.rows[1].quantity).toBe("0.2000000000000000002");
  });
  it("rejects numeric sanitized fields and never exposes invalid content", () => {
    for (const value of [capture([point({ quantity:123 })]),capture([point({ sourceVersion:"SECRET@example.com" })]),capture([], { secret:"PRIVATE_SENTINEL" })]) {
      try { parse(value); throw new Error("accepted"); } catch (error) { expect(String(error)).toBe("Error: Invalid native metrics capture."); }
    }
  });
  it("quarantines changed origin and metadata across positions", () => {
    const a = parse(capture());
    for (const b of [parse(capture([point({startUnixNano:"1000000000000000002",endUnixNano:"1000000000000000003"})],{sample:"owner-supplied"})),parse(capture([point({startUnixNano:"1000000000000000002",endUnixNano:"1000000000000000003",sourceVersion:"2.1.200"})]))]) {
      expect(reviewClaudeNativeCaptures([a,b]).rows.every(x=>x.status==="conflict")).toBe(true);
    }
  });
  it("quarantines overlapping cumulative epochs", () => {
    const r=reviewClaudeNativeCaptures([parse(capture([point({temporality:"cumulative",endUnixNano:"1000000000000000008"}),point({temporality:"cumulative",startUnixNano:"1000000000000000003",endUnixNano:"1000000000000000009"})]))]);
    expect(r.hasConflicts).toBe(true);
  });
  it("keeps scopes separate and old/unknown-client limitations visible", () => {
    const a=parse(capture([point({sourceVersion:null})]));
    const b=parse(capture([point({sourceVersion:"2.1.213"})],{keyScopeDigest:"f".repeat(64)}));
    const r=reviewClaudeNativeCaptures([a,b]);
    expect(r.hasConflicts).toBe(false); expect(r.rows[0].reasons.join()).toContain("unknown"); expect(r.rows[1].reasons.join()).toContain("inflated");
  });
  it("enforces bounded batches and decimal work", () => {
    expect(()=>reviewClaudeNativeCaptures([])).toThrow();
    expect(()=>reviewClaudeNativeCaptures(Array(33).fill(parse(capture())))).toThrow();
    expect(()=>normalizeNativeDecimal("1".repeat(129))).toThrow();
    expect(normalizeNativeDecimal("1e-324")).toBe("0."+"0".repeat(323)+"1");
    expect(()=>normalizeNativeDecimal("1e99999999999")).toThrow();
  });

});

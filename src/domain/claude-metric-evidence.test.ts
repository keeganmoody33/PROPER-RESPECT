import { describe, expect, test } from "vitest";
import { parseClaudeMetricsCapture, reviewClaudeMetricsCaptures } from "./claude-metric-evidence";

const bundle = (id = "point-1", start = "2026-09-24T00:00:00.000Z", end = "2026-09-24T00:01:00.000Z", input = "100") => ({
  id, metricStreams: { input:"1".repeat(64),output:"2".repeat(64),cacheRead:"3".repeat(64),cacheCreation:"4".repeat(64),cost:"5".repeat(64) }, streamDigest: "a".repeat(64), sessionAlias: "session", processAlias: "process", model: "claude-haiku-4-5-20251001",
  temporality: "cumulative", start, end, counts: { input, output: "10", cacheRead: "0", cacheCreation: "0" }, sourceCostUsd: "0.000000000001",
});
const capture = (...bundles: unknown[]) => ({
  format: "claude-code-sanitized-metrics-v1", captureId: "capture-1", capturedAt: "2026-09-24T01:00:00.000Z", sample: "synthetic", sourceVersion: "2.1.214",
  ownerAlias: "owner", accountAlias: "account", deviceAlias: "device", timezone: "UTC", namespace: "namespace", identity: "caller-declared-full-stream", alignment:"same-interval-disjoint-categories",counterSemantics:"monotonic", bundles,
});
const parse = (value: unknown) => parseClaudeMetricsCapture(JSON.stringify(value));
const review = (...values: unknown[]) => reviewClaudeMetricsCaptures(values.map(parse));

describe("sanitized Claude metrics evidence", () => {
  test("baselines cumulative counters and subtracts exactly with both endpoints", () => {
    const first = bundle(), last = bundle("point-2", first.start, "2026-09-24T00:02:00.000Z", "160");
    last.sourceCostUsd = "0.000000000003";
    const result = review(capture(last, first));
    expect(result.rows.map(row => row.status)).toEqual(["baseline", "measured"]);
    expect(result.rows[1].counts.input).toBe("60");
    expect(result.rows[1].sourceCostUsd).toBe("0.000000000002");
    expect(result.rows[1].evidenceDigests).toHaveLength(2);
    expect(result.observations.map(row => row.counts.input).sort()).toEqual(["100", "160"]);
  });
  test("deduplicates renamed exports semantically and records capture provenance", () => {
    const first = capture(bundle()), again = { ...first, captureId: "capture-2", capturedAt: "2026-09-24T02:00:00.000Z" };
    const result = review(first, again);
    expect(result.observations).toHaveLength(1);
    expect(result.replays).toBe(1);
    expect(result.rows).toHaveLength(1);
  });
  test("quarantines capture identity conflicts without bridging", () => {
    const a = bundle(), b = bundle("point-2", a.start, "2026-09-24T00:02:00.000Z", "130"), c = bundle("point-3", a.start, "2026-09-24T00:03:00.000Z", "160");
    const result = review(capture(a,b,c), capture(a,{ ...b, counts:{ ...b.counts,input:"140" } },c));
    expect(result.hasConflicts).toBe(true);
    expect(result.rows.every(row => row.status === "conflict")).toBe(true);
  });
  test("same position with new id, changed origin, version or model conflicts", () => {
    const first = capture(bundle());
    for (const changed of [
      { ...first, sample: "owner-supplied" }, { ...first, sourceVersion: "2.1.213" },
      capture({ ...bundle("other"), model: "mixed" }), capture({ ...bundle("other"), counts: { ...bundle().counts, input: "101" } }),
    ]) expect(review(first, { ...changed, captureId: "other-capture" }).hasConflicts).toBe(true);
  });
  test("changed IDs cannot turn same semantic fact into a second measurement", () => {
    const first = capture(bundle());
    const result = review(first, { ...capture(bundle("renamed")), captureId:"other" });
    expect(result.observations).toHaveLength(1);
    expect(result.replays).toBe(1);
  });
  test("same-epoch decrease quarantines entire stream including later recovery", () => {
    const a = bundle(), b = bundle("point-2", a.start,"2026-09-24T00:02:00.000Z", "90"), c = bundle("point-3", a.start,"2026-09-24T00:03:00.000Z", "160");
    expect(review(capture(a,b,c)).rows.every(row => row.status === "conflict")).toBe(true);
    b.counts.input = "110"; b.sourceCostUsd = "0";
    expect(review(capture(a,b,c)).hasConflicts).toBe(true);
  });
  test("new nonoverlapping epochs baseline; overlapping epochs and mixed temporality conflict", () => {
    const a=bundle(), b=bundle("second","2026-09-24T00:02:00.000Z","2026-09-24T00:03:00.000Z","20");
    const ok=review(capture(a,b));
    expect(ok.rows.map(row=>row.status)).toEqual(["baseline","baseline"]);
    expect(ok.rows[1].reasons.join(" ")).toMatch(/reset|epoch/);
    expect(ok.rows[1].reasons.join(" ")).toMatch(/gap/);
    expect(review(capture(a,{...b,start:"2026-09-24T00:00:30.000Z",processAlias:"other"})).hasConflicts).toBe(true);
    expect(review(capture(a,{...b,temporality:"delta"})).hasConflicts).toBe(true);
  });
  test("delta overlaps quarantine stream; adjacency and gaps remain distinct", () => {
    const a={...bundle(),temporality:"delta"}, b={...bundle("second",a.end,"2026-09-24T00:02:00.000Z"),temporality:"delta"};
    expect(review(capture(a,b)).rows.every(row=>row.status==="measured")).toBe(true);
    expect(review(capture(a,{...b,start:"2026-09-24T00:00:30.000Z"})).hasConflicts).toBe(true);
    expect(review(capture(a,{...b,start:"2026-09-24T00:01:30.000Z"})).rows[1].reasons.join(" ")).toContain("gap");
  });
  test("null endpoint remains unknown and late arrival deterministic", () => {
    const a=bundle(), b=bundle("second",a.start,"2026-09-24T00:02:00.000Z","130"), c=bundle("third",a.start,"2026-09-24T00:03:00.000Z","160");
    const withNull={...b,counts:{...b.counts,input:null},sourceCostUsd:null};
    const result=review(capture(a,withNull,c));
    expect(result.rows.map(row=>row.counts.input)).toEqual(["100",null,null]);
    expect(review(capture(c,a,b))).toEqual(review(capture(a,b,c)));
  });
  test("large counts remain exact and scope partitions remain independent", () => {
    const a={...bundle(),temporality:"delta",counts:{...bundle().counts,input:"999999999999999999999999999999"}};
    const result=review(capture(a),{...capture(a),accountAlias:"other"});
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].counts.input).toBe(a.counts.input);
    expect(result.hasConflicts).toBe(false);
  });
  test("retains unknown version/model with explicit reasons", () => {
    const result=review({...capture({...bundle(),model:null}),sourceVersion:null});
    expect(result.rows[0].reasons.join(" ")).toMatch(/version/);
    expect(result.rows[0].model).toBeNull();
  });
  test("missing observations do not conceal a known decrease", () => {
    const a=bundle(), b={...bundle("second",a.start,"2026-09-24T00:02:00.000Z"),counts:{...a.counts,input:null},sourceCostUsd:null};
    const c=bundle("third",a.start,"2026-09-24T00:03:00.000Z","90");
    expect(review(capture(a,b,c)).hasConflicts).toBe(true);
  });
  test("aggregate bounds reject over 2048 bundles", () => {
    const many=Array.from({length:1024},(_,index)=>bundle(`point-${index}`));
    // Byte cap is independently stricter for this fixture shape; repeated small captures exercise aggregate cap.
    const small=parse(capture(...many.slice(0,70)));
    expect(()=>reviewClaudeMetricsCaptures(Array(30).fill(small))).toThrow("Invalid Claude metrics capture.");
  });
  test("strict parser bounds and fixed diagnostics", () => {
    const good=capture(bundle());
    for(const value of [
      {...good,prompt:"PRIVATE_SENTINEL"}, {...good,identity:"verified"}, {...good,ownerAlias:"private@example.com"},
      {...good,capturedAt:"2026-09-24T01:00:00.000001Z"}, {...good,timezone:"America/New_York"},
      capture({...bundle(),end:bundle().start}), capture({...bundle(),counts:{...bundle().counts,input:"01"}}),
      capture({...bundle(),counts:{...bundle().counts,input:"1".repeat(31)}}), capture({...bundle(),sourceCostUsd:"0.1234567890123"}),
    ]) expect(()=>parse(value)).toThrow("Invalid Claude metrics capture.");
    expect(()=>parseClaudeMetricsCapture("x".repeat(256001))).toThrow("Invalid Claude metrics capture.");
    expect(()=>reviewClaudeMetricsCaptures([good as never])).not.toThrow();
    expect(()=>reviewClaudeMetricsCaptures([{...good,prompt:"secret"} as never])).toThrow("Invalid Claude metrics capture.");
    expect(()=>reviewClaudeMetricsCaptures(Array(33).fill(parse(good)))).toThrow();
  });
});

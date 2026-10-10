import { describe, expect, it, vi } from "vitest";
import { assembleReview, buildReviewDelivery, CURSOR_METRICS } from "../domain/collector-contract";
import {
  acceptCursorReportCsv,
  CURSOR_REPORT_LIMITS,
  parseCursorCompleteReportCsv,
  replaceCursorCompleteReport,
} from "./cursor-report-adapter";

const source = {
  provider: "cursor", kind: "owner-supplied-report", accountAlias: null, sample: "unknown",
} as const;
const window = { start: "2026-10-01T00:00:00Z", end: "2026-10-03T00:00:00Z" };
const supplied = (csv = "timestamp,requests\n2026-10-01T01:00:00Z,2\n") => ({
  csv, reportId: "synthetic-cursor-report", source, window, complete: true,
});
const value = (report: ReturnType<typeof parseCursorCompleteReportCsv>, metric: string, index = 0) =>
  report.rows.filter(row => row.metric === metric)[index]?.value;

describe("complete supplied Cursor reports", () => {
  it("parses native quantities and source cost estimates independently of Codex counters", () => {
    const report = parseCursorCompleteReportCsv(supplied(
      "timestamp,model,requests,input_tokens,cached_input_tokens,output_tokens,total_tokens,usage_cost_usd\r\n" +
      "2026-10-01T01:00:00.123Z,synthetic-model,3,100,40,25,125,0.125\r\n",
    ));
    expect(report).toMatchObject({
      format: "cursor-complete-report-v1", complete: true, coverage: "partial", source,
      window: { start: "2026-10-01T00:00:00.000Z", end: "2026-10-03T00:00:00.000Z" },
    });
    expect(report.rows).toHaveLength(6);
    expect(value(report, "requests")).toBe("3");
    expect(value(report, "total_tokens")).toBe("125");
    expect(report.rows.find(row => row.metric === "usage_cost_usd")).toMatchObject({
      value: "0.125", unit: "usd", kind: "SOURCE_COST_ESTIMATE",
    });
    expect(report.rows.some(row => row.metric.includes("charge") || row.metric.includes("payment"))).toBe(false);
  });

  it("decodes quoted commas, escaped quotes and multiline labels without retaining labels", () => {
    const report = parseCursorCompleteReportCsv(supplied(
      '\uFEFF"timestamp","model","requests"\r\n' +
      '"2026-10-01T01:00:00Z","private, ""owner@example.test""\nlabel",2\r\n',
    ));
    expect(value(report, "requests")).toBe("2");
    expect(JSON.stringify(report)).not.toContain("owner@example.test");
    expect(JSON.stringify(report)).not.toContain("private");
  });

  it("preserves equal rows as separate supplied observations", () => {
    const report = parseCursorCompleteReportCsv(supplied(
      "timestamp,requests\n2026-10-01T01:00:00Z,2\n2026-10-01T01:00:00Z,2\n",
    ));
    expect(report.rows).toHaveLength(12);
    const requests = report.rows.filter(row => row.metric === "requests");
    expect(requests.map(row => row.value)).toEqual(["2", "2"]);
    expect(new Set(requests.map(row => row.id)).size).toBe(2);
  });

  it("preserves integers above Number precision and exact decimal money", () => {
    const huge = "9".repeat(128);
    const report = parseCursorCompleteReportCsv(supplied(
      `timestamp,requests,input_tokens,usage_cost_usd\n2026-10-01T01:00:00Z,9007199254740993,${huge},${huge}.123456789123456789\n`,
    ));
    expect(value(report, "requests")).toBe("9007199254740993");
    expect(value(report, "input_tokens")).toBe(huge);
    expect(value(report, "usage_cost_usd")).toBe(`${huge}.123456789123456789`);
  });

  it("canonicalizes decimal spelling without binary rounding", () => {
    const report = parseCursorCompleteReportCsv(supplied(
      "timestamp,usage_cost_usd\n2026-10-01T01:00:00Z,0.000100000000000000\n2026-10-01T02:00:00Z,123.000\n",
    ));
    expect(value(report, "usage_cost_usd")).toBe("0.0001");
    expect(value(report, "usage_cost_usd", 1)).toBe("123");
  });

  it("keeps absent columns and blank cells unknown while explicit zero is measured", () => {
    const report = parseCursorCompleteReportCsv(supplied(
      "timestamp,input_tokens,usage_cost_usd\n2026-10-01T01:00:00Z,0,0.00\n2026-10-01T02:00:00Z,,\n",
    ));
    expect(value(report, "requests")).toBeNull();
    expect(value(report, "total_tokens")).toBeNull();
    expect(value(report, "input_tokens")).toBe("0");
    expect(value(report, "input_tokens", 1)).toBeNull();
    expect(value(report, "usage_cost_usd")).toBe("0");
    expect(value(report, "usage_cost_usd", 1)).toBeNull();
  });

  it("accepts a complete header-only report without manufacturing zero quantities", () => {
    expect(parseCursorCompleteReportCsv(supplied("timestamp,requests\n")).rows).toEqual([]);
  });

  it.each([
    "timestamp,requests\n2026-10-01T01:00:00Z,\"2",
    'timestamp,requests\n2026-10-01T01:00:00Z,"2"junk\n',
    'timestamp,requests\n2026-10-01T01:00:00Z,2"\n',
    "timestamp,requests\r2026-10-01T01:00:00Z,2",
    "timestamp,requests\n2026-10-01T01:00:00Z\n",
    "timestamp,requests\n2026-10-01T01:00:00Z,2,3\n",
    "timestamp,requests\n2026-10-01T01:00:00Z,2\n\n",
    "timestamp,requests,requests\n2026-10-01T01:00:00Z,2,2\n",
    "timestamp,requests,email\n2026-10-01T01:00:00Z,2,private@example.test\n",
    "requests\n2\n",
    "timestamp,model\n2026-10-01T01:00:00Z,synthetic\n",
    "",
  ])("rejects malformed or unsupported CSV %s", csv => {
    expect(() => parseCursorCompleteReportCsv(supplied(csv))).toThrow();
  });

  it.each(["-1", "1.5", "01", "+1", " 1", "1 ", "1e3", "NaN", "null", "9".repeat(129)])(
    "rejects noncanonical native quantity %s", requests => {
      expect(() => parseCursorCompleteReportCsv(supplied(
        `timestamp,requests\n2026-10-01T01:00:00Z,${requests}\n`,
      ))).toThrow();
    },
  );

  it.each(["-0.1", ".1", "01.2", "1e-3", "1e3", "Infinity", "1.", "0.1234567890123456789"])(
    "rejects unsupported source cost %s", cost => {
      expect(() => parseCursorCompleteReportCsv(supplied(
        `timestamp,usage_cost_usd\n2026-10-01T01:00:00Z,${cost}\n`,
      ))).toThrow();
    },
  );

  it.each([
    "2026-10-01T01:00:00", "2026-10-01T01:00:00+00:00", "2026-10-01",
    "2026-10-01T01:00:00.0001Z", "2026-09-30T23:59:59Z", "2026-10-03T00:00:00Z",
  ])("rejects ambiguous, too-precise or out-of-window timestamp %s", at => {
    expect(() => parseCursorCompleteReportCsv(supplied(`timestamp,requests\n${at},2\n`))).toThrow();
  });

  it("rejects partial files, invalid windows, unsupported sources and claimed account identity", () => {
    const input = supplied();
    for (const changed of [
      { ...input, complete: false },
      { ...input, complete: undefined },
      { ...input, coverage: "complete" },
      { ...input, window: { start: window.end, end: window.start } },
      { ...input, window: { start: window.start, end: "2026-10-09T00:00:00Z" } },
      { ...input, source: { ...source, provider: "codex" } },
      { ...input, source: { ...source, kind: "team-admin-api" } },
      { ...input, source: { ...source, accountAlias: "claimed-owner" } },
      { ...input, source: { ...source, sample: "synthetic" } },
    ]) expect(() => parseCursorCompleteReportCsv(changed)).toThrow();
  });

  it("enforces byte, field and row bounds before acceptance", () => {
    expect(() => parseCursorCompleteReportCsv(supplied("a".repeat(CURSOR_REPORT_LIMITS.bytes + 1)))).toThrow();
    const unicodeCsv = "timestamp,model,requests\n" +
      `2026-10-01T01:00:00Z,${"\u65E5".repeat(100)},2\n`.repeat(850);
    expect(unicodeCsv.length).toBeLessThan(CURSOR_REPORT_LIMITS.bytes);
    expect(new TextEncoder().encode(unicodeCsv).length).toBeGreaterThan(CURSOR_REPORT_LIMITS.bytes);
    expect(() => parseCursorCompleteReportCsv(supplied(unicodeCsv))).toThrow();
    expect(() => parseCursorCompleteReportCsv(supplied(
      `timestamp,model,requests\n2026-10-01T01:00:00Z,${"a".repeat(CURSOR_REPORT_LIMITS.fieldCharacters + 1)},2\n`,
    ))).toThrow();
    expect(() => parseCursorCompleteReportCsv(supplied(
      "timestamp,requests\n" + "2026-10-01T01:00:00Z,2\n".repeat(CURSOR_REPORT_LIMITS.sourceRows + 1),
    ))).toThrow();
    expect(() => parseCursorCompleteReportCsv(supplied("timestamp,requests\n\u0000,2\n"))).toThrow();
    expect(() => parseCursorCompleteReportCsv(supplied("timestamp,model,requests\n2026-10-01T01:00:00Z,\uD800,2\n"))).toThrow();
  });

  it("replaces the same source/window only after the entire report validates", () => {
    const initial = parseCursorCompleteReportCsv(supplied());
    const retained = [initial];
    const replacement = acceptCursorReportCsv(retained, {
      ...supplied("timestamp,requests\n2026-10-01T01:00:00Z,7\n"), reportId: "replacement",
    });
    expect(replacement.reports).toHaveLength(1);
    expect(value(replacement.reports[0], "requests")).toBe("7");
    expect(value(retained[0], "requests")).toBe("2");
    expect(() => acceptCursorReportCsv(retained, supplied(
      "timestamp,requests\n2026-10-01T01:00:00Z,7\n2026-10-01T02:00:00Z,invalid\n",
    ))).toThrow();
    expect(retained).toEqual([initial]);
    expect(() => replaceCursorCompleteReport(retained, { ...initial, complete: false })).toThrow();
    expect(retained).toEqual([initial]);
  });

  it("keeps overlapping report views separate and never adds their quantities", () => {
    const first = parseCursorCompleteReportCsv(supplied());
    const second = parseCursorCompleteReportCsv({
      ...supplied(), reportId: "overlap",
      window: { start: "2026-10-01T01:00:00Z", end: "2026-10-04T00:00:00Z" },
    });
    const reports = replaceCursorCompleteReport([first], second);
    expect(reports).toHaveLength(2);
    expect(reports.map(report => value(report, "requests"))).toEqual(["2", "2"]);
    expect(replaceCursorCompleteReport(reports, second)).toHaveLength(2);
  });

  it("does not acquire credentials, raw files or Codex fixture data", () => {
    vi.stubEnv("CURSOR_API_KEY", "synthetic-unused-key");
    vi.stubEnv("CONVEX_DEPLOY_KEY", "synthetic-unused-key");
    try {
      expect(parseCursorCompleteReportCsv(supplied()).source).toEqual(source);
      expect(JSON.stringify(parseCursorCompleteReportCsv(supplied()))).not.toContain("synthetic-unused-key");
    } finally { vi.unstubAllEnvs(); }
  });

  it("round-trips a complete report through the shared bounded delivery contract", () => {
    const review = parseCursorCompleteReportCsv(supplied(
      "timestamp,requests\n" + "2026-10-01T01:00:00Z,2\n".repeat(CURSOR_REPORT_LIMITS.sourceRows),
    ));
    const delivery = buildReviewDelivery({
      review,
      grant: {
        connectionId: "synthetic-cursor-connection", generation: 1, window: review.window,
        expiresAt: "2026-10-03T00:00:00.000Z", allowedMetrics: [...CURSOR_METRICS], checkpoint: null,
        descriptor: {
          sourceId: "synthetic-report", deviceId: "synthetic-device", collectorVersion: "cursor-report-v1",
          context: "PERSONAL", account: { kind: "UNKNOWN" }, sample: "unknown",
          kind: "cursor-complete-export", provider: "cursor",
        },
      },
    });
    expect(delivery.chunks.length).toBeGreaterThan(1);
    expect(assembleReview(delivery)).toEqual(review);
    expect(delivery.chunks.flatMap(chunk => chunk.rows).every(row => row.kind === "cursor-measurement")).toBe(true);
    expect(review.rows.filter(row => row.metric === "requests")).toHaveLength(CURSOR_REPORT_LIMITS.sourceRows);
  });
});

import { z } from "zod";
import {
  cursorCompleteReportSchema,
  type CursorCompleteReport,
} from "../domain/collector-contract.ts";

export const CURSOR_REPORT_LIMITS = Object.freeze({
  bytes: 256_000,
  sourceRows: 1000,
  fieldCharacters: 1024,
});

const inputSchema = z.strictObject({
  csv: z.string(),
  reportId: z.string(),
  source: z.unknown(),
  window: z.unknown(),
  complete: z.literal(true),
});

const quantityMetrics = [
  "requests", "input_tokens", "cached_input_tokens", "output_tokens", "total_tokens",
] as const;
const metricColumns = [...quantityMetrics, "usage_cost_usd"] as const;
const allowedColumns = new Set<string>(["timestamp", "model", ...metricColumns]);
const invalid = () => new Error("Invalid complete Cursor CSV report.");

/** Bounded RFC 4180 fields. Labels are decoded transiently, never sent downstream. */
function csvRecords(input: string): string[][] {
  if (input.length > CURSOR_REPORT_LIMITS.bytes ||
      new TextEncoder().encode(input).length > CURSOR_REPORT_LIMITS.bytes ||
      /\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(input)) throw invalid();
  const text = input.startsWith("\uFEFF") ? input.slice(1) : input;
  if (text.length === 0) throw invalid();
  const records: string[][] = [];
  let record: string[] = [], field = "";
  let mode: "unquoted" | "quoted" | "closed" = "unquoted";
  const append = (value: string) => {
    field += value;
    if (field.length > CURSOR_REPORT_LIMITS.fieldCharacters) throw invalid();
  };
  const finishField = () => {
    record.push(field);
    if (record.length > allowedColumns.size) throw invalid();
    field = "";
    mode = "unquoted";
  };
  const finishRecord = () => {
    finishField();
    records.push(record);
    if (records.length > CURSOR_REPORT_LIMITS.sourceRows + 1) throw invalid();
    record = [];
  };
  for (let offset = 0; offset < text.length; offset++) {
    const character = text[offset];
    if (mode === "quoted") {
      if (character === '"') {
        if (text[offset + 1] === '"') { append('"'); offset++; }
        else mode = "closed";
      } else append(character);
      continue;
    }
    if (character === ",") { finishField(); continue; }
    if (character === "\n" || character === "\r") {
      if (character === "\r") {
        if (text[offset + 1] !== "\n") throw invalid();
        offset++;
      }
      finishRecord();
      continue;
    }
    if (mode === "closed") throw invalid();
    if (character === '"') {
      if (field.length > 0) throw invalid();
      mode = "quoted";
    } else append(character);
  }
  if (mode === "quoted") throw invalid();
  if (field.length > 0 || record.length > 0 || mode === "closed") finishRecord();
  return records;
}

function exactQuantity(value: string | undefined): string | null {
  if (value === undefined || value === "") return null;
  if (!/^(0|[1-9][0-9]{0,127})$/.test(value)) throw invalid();
  return value;
}

function exactCostEstimate(value: string | undefined): string | null {
  if (value === undefined || value === "") return null;
  if (!/^(0|[1-9][0-9]{0,127})(?:\.[0-9]{1,18})?$/.test(value)) throw invalid();
  // Normalize decimal spelling without converting through a binary number.
  return value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value;
}

/** Complete means the supplied file, while historical account coverage stays partial. */
export function parseCursorCompleteReportCsv(input: unknown): CursorCompleteReport {
  const supplied = inputSchema.parse(input);
  const review = cursorCompleteReportSchema.parse({
    format: "cursor-complete-report-v1",
    reportId: supplied.reportId,
    source: supplied.source,
    window: supplied.window,
    coverage: "partial",
    complete: supplied.complete,
    rows: [],
  });
  const [header, ...records] = csvRecords(supplied.csv);
  if (!header || header.length === 0 || new Set(header).size !== header.length ||
      header.some(column => !allowedColumns.has(column)) || !header.includes("timestamp") ||
      !header.some(column => metricColumns.some(metric => metric === column))) throw invalid();
  const indexes = new Map(header.map((column, index) => [column, index]));
  const rows: CursorCompleteReport["rows"] = [];
  for (const [index, record] of records.entries()) {
    if (record.length !== header.length) throw invalid();
    const cell = (column: string): string | undefined => {
      const position = indexes.get(column);
      return position === undefined ? undefined : record[position];
    };
    const at = cell("timestamp");
    if (at === undefined || at === "") throw invalid();
    for (const metric of quantityMetrics) rows.push({
      id: `cursor:row:${index}:${metric}`,
      at,
      metric,
      value: exactQuantity(cell(metric)),
      unit: metric === "requests" ? "requests" : "tokens",
      kind: "NATIVE_QUANTITY",
    });
    rows.push({
      id: `cursor:row:${index}:usage_cost_usd`,
      at,
      metric: "usage_cost_usd",
      value: exactCostEstimate(cell("usage_cost_usd")),
      unit: "usd",
      kind: "SOURCE_COST_ESTIMATE",
    });
  }
  return cursorCompleteReportSchema.parse({ ...review, rows });
}

/** The caller supplies one approved connection's retained reports; windows are views. */
export function replaceCursorCompleteReport(
  retained: readonly CursorCompleteReport[],
  incoming: unknown,
): CursorCompleteReport[] {
  const review = cursorCompleteReportSchema.parse(incoming);
  const key = (report: CursorCompleteReport) => JSON.stringify([report.source, report.window]);
  const incomingKey = key(review);
  return [...retained.filter(report => key(report) !== incomingKey), review];
}

/** Parsing all rows precedes replacement, so a truncated or invalid file changes nothing. */
export function acceptCursorReportCsv(retained: readonly CursorCompleteReport[], input: unknown) {
  const review = parseCursorCompleteReportCsv(input);
  return { review, reports: replaceCursorCompleteReport(retained, review) };
}

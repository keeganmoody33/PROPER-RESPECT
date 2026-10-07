import { createHash } from "node:crypto";
import { canonicalJson } from "../../domain/canonical-json.ts";
import { instant } from "./decode.ts";
import type { CursorEvent, CursorReport } from "./types.ts";

// The existing collector's metric vocabulary; no additional transport or receiver.
export const CURSOR_COLLECTOR_METRICS = [
  "requests", "input_tokens", "cached_input_tokens", "output_tokens", "total_tokens", "usage_cost_usd",
] as const;
export type CursorCollectorMetric = typeof CURSOR_COLLECTOR_METRICS[number];
export type CursorCollectorSelection = {
  reportId: string;
  sourceId: string;
  window: { start: string; end: string };
  allowedMetrics: readonly CursorCollectorMetric[];
  suppliedFileComplete: true;
};

/** Pin one schema/account/workspace/filter/billing view to one approved connection. */
export function cursorCollectorSourceId(report: CursorReport): string {
  const scope = [report.source, report.identityBasis, report.schema, report.filters, report.billingWindow];
  return `cursor:${createHash("sha256").update(canonicalJson(scope)).digest("hex")}`;
}

function value(event: CursorEvent, metric: CursorCollectorMetric): string | null {
  switch (metric) {
    case "input_tokens": return event.tokens.input;
    case "cached_input_tokens": return event.tokens.cacheRead;
    case "output_tokens": return event.tokens.output;
    case "total_tokens": return event.tokens.total;
    // Cursor request units may be fractional billing units, not request counts.
    case "requests": return null;
    // None of our source money fields asserts the collector's cost-estimate meaning.
    case "usage_cost_usd": return null;
  }
}

/**
 * Project a trusted normalizer result through the caller's actual collector schema.
 * Keep the original private report separately: the shared review cannot carry its
 * source attribution, literal CSV input categories, billing metadata or costs.
 * This is neither acquisition, authorization, persistence nor a delivery checkpoint.
 */
export function projectCursorCollectorReport<T>(
  report: CursorReport,
  selection: CursorCollectorSelection,
  validateReview: (input: unknown) => T,
): { review: T; sourceId: string; omitted: string[] } {
  const invalid = () => new Error("Cursor report cannot project into this approved collector view.");
  if (report.kind !== "events" || selection.suppliedFileComplete !== true ||
      report.schema === "cursor-admin-events-2026-10-06" && report.coverage.completeness !== "complete") throw invalid();
  const sourceId = cursorCollectorSourceId(report);
  if (selection.sourceId !== sourceId) throw invalid();
  const start = instant(selection.window.start), end = instant(selection.window.end);
  const duration = Date.parse(end) - Date.parse(start);
  if (duration <= 0 || duration > 7 * 86_400_000 || start < report.window.start ||
      Date.parse(end) - 1 > Date.parse(report.window.end)) throw invalid();
  const allowed = selection.allowedMetrics;
  if (!Array.isArray(allowed) || allowed.length === 0 || new Set(allowed).size !== allowed.length ||
      allowed.some(metric => !CURSOR_COLLECTOR_METRICS.includes(metric))) throw invalid();
  const metrics = CURSOR_COLLECTOR_METRICS.filter(metric => allowed.includes(metric));
  const rows = report.events.flatMap((event, index) => event.at < start || event.at >= end ? [] : metrics.map(metric => ({
    // Ordinals belong to this complete report view, never to a stable provider event.
    id: `cursor:row:${index}:${metric}`,
    at: event.at,
    metric,
    value: value(event, metric),
    unit: metric === "usage_cost_usd" ? "usd" : metric === "requests" ? "requests" : "tokens",
    kind: metric === "usage_cost_usd" ? "SOURCE_COST_ESTIMATE" : "NATIVE_QUANTITY",
  })));
  const review = validateReview({
    format: "cursor-complete-report-v1",
    reportId: selection.reportId,
    source: { provider: "cursor", kind: "owner-supplied-report", accountAlias: null, sample: "unknown" },
    window: { start, end },
    // Supplied-file completeness does not prove historical account coverage.
    coverage: "partial",
    complete: true,
    rows,
  });
  return { review, sourceId, omitted: [
    "private-source-scope-and-filters", "billing-window", "provider-labels-and-identifiers",
    "cache-write-tokens", "csv-input-category-interpretation", "request-billing-units",
    "reported-costs-and-charges", "provider-coverage-details",
    ...(start !== report.window.start || Date.parse(end) - 1 !== Date.parse(report.window.end) ? ["outside-approved-window"] : []),
  ] };
}

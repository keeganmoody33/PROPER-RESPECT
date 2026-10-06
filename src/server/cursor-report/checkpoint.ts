import { createHash } from "node:crypto";
import { canonicalJson } from "../../domain/canonical-json.ts";
import { instant } from "./decode.ts";
import type { CursorReport } from "./types.ts";

/** One Cursor source/schema/filter/window slot, never a cumulative event ledger. */
export type CursorReportCheckpoint = {
  rule: "cursor-complete-report-replacement-v1";
  sourceKey: string;
  reportKey: string;
  observedAt: string;
  report: CursorReport;
};
export type CursorReplacement =
  | { status: "replaced" | "replay"; checkpoint: CursorReportCheckpoint }
  | { status: "blocked"; reason: "incomplete-report" | "invalid-report" | "different-source" | "different-report" | "stale-report" | "conflicting-capture"; checkpoint: CursorReportCheckpoint | null };
const digest = (value: unknown) => createHash("sha256").update(canonicalJson(value)).digest("hex");
function keys(report: CursorReport) {
  const { capturedAt: _capturedAt, contentDigest, ...content } = report;
  if (instant(report.capturedAt) !== report.capturedAt || digest(content) !== contentDigest) throw new Error();
  const sourceKey = digest([report.source, report.identityBasis]);
  const reportKey = digest([sourceKey, report.schema, report.window, report.billingWindow, report.filters]);
  return { sourceKey, reportKey };
}
function immutable<T>(value: T): T {
  if (value && typeof value === "object") { for (const child of Object.values(value)) immutable(child); Object.freeze(value); }
  return value;
}

/** Pure replacement proposal. The caller owns approved storage/transport, never this module. */
export function replaceCursorReport(retained: CursorReportCheckpoint | null, incoming: CursorReport): CursorReplacement {
  const blocked = (reason: Extract<CursorReplacement, { status: "blocked" }>["reason"]): CursorReplacement => ({ status: "blocked", reason, checkpoint: retained });
  try {
    const current = keys(incoming);
    if (retained) {
      const prior = keys(retained.report);
      if (retained.rule !== "cursor-complete-report-replacement-v1" || retained.sourceKey !== prior.sourceKey || retained.reportKey !== prior.reportKey) return blocked("invalid-report");
      if (instant(retained.observedAt) !== retained.observedAt || retained.observedAt < retained.report.capturedAt) return blocked("invalid-report");
      if (current.sourceKey !== retained.sourceKey) return blocked("different-source");
      if (current.reportKey !== retained.reportKey) return blocked("different-report");
    }
    // CSV count assertions do not prove export completeness. Only validated Admin pages qualify.
    if (incoming.coverage.completeness !== "complete" || incoming.coverage.basis !== "provider-pagination") return blocked("incomplete-report");
    if (retained) {
      if (incoming.contentDigest === retained.report.contentDigest) return { status: "replay", checkpoint: incoming.capturedAt > retained.observedAt
        ? immutable({ ...retained, observedAt: incoming.capturedAt }) : retained };
      if (incoming.capturedAt < retained.observedAt) return blocked("stale-report");
      if (incoming.capturedAt === retained.observedAt) return blocked("conflicting-capture");
    }
    const report = immutable(structuredClone(incoming));
    return { status: "replaced", checkpoint: immutable({ rule: "cursor-complete-report-replacement-v1", ...current, observedAt: incoming.capturedAt, report }) };
  } catch { return blocked("invalid-report"); }
}

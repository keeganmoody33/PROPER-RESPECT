import { createHash } from "node:crypto";
import { canonicalJson } from "../../domain/canonical-json.ts";
import { type ExactJson } from "../../domain/exact-json.ts";
import { bool, checkBytes, count, csvDecimal, csvRecords, epoch, instant, invalid, json, object, quantity, text } from "./decode.ts";
import {
  CURSOR_REPORT_LIMITS, type CursorBillingWindow, type CursorContext, type CursorCoverage,
  type CursorEvent, type CursorFilters, type CursorReport, type CursorTokens, type CursorWindow,
} from "./types.ts";

const alias = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,63}$/;
function strictKeys(value: unknown, allowed: readonly string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) throw invalid();
}
function context(input: CursorContext): CursorContext {
  strictKeys(input, ["source", "capturedAt", "billingWindow"]);
  const source = input.source;
  strictKeys(source, ["ownerAlias", "accountAlias", "workspaceAlias", "sourceAlias", "scope", "sample"]);
  for (const key of ["ownerAlias", "accountAlias", "sourceAlias"] as const) if (typeof source[key] !== "string" || !alias.test(source[key])) throw invalid();
  if (source.scope !== "personal-account" && source.scope !== "team-workspace") throw invalid();
  if (source.sample !== "synthetic" && source.sample !== "owner-supplied") throw invalid();
  if (source.scope === "personal-account" ? source.workspaceAlias !== null : typeof source.workspaceAlias !== "string" || !alias.test(source.workspaceAlias)) throw invalid();
  const billing = input.billingWindow;
  let billingWindow: CursorBillingWindow | null = null;
  if (billing !== null) {
    strictKeys(billing, ["start", "end", "basis"]);
    if (billing.basis !== "owner-supplied" && billing.basis !== "source-reported") throw invalid();
    billingWindow = { start: instant(billing.start), end: billing.end === null ? null : instant(billing.end), basis: billing.basis };
    if (billingWindow.end !== null && billingWindow.end <= billingWindow.start) throw invalid();
  }
  return { source: { ...source }, capturedAt: instant(input.capturedAt), billingWindow };
}
function window(input: CursorWindow): CursorWindow {
  strictKeys(input, ["start", "end", "bounds"]);
  if (input.bounds !== "inclusive") throw invalid();
  const start = instant(input.start), end = instant(input.end), duration = Date.parse(end) - Date.parse(start) + 1;
  if (duration < 1 || duration > CURSOR_REPORT_LIMITS.windowMs) throw invalid();
  return { start, end, bounds: "inclusive" };
}
function inWindow(at: string, range: CursorWindow) { if (at < range.start || at > range.end) throw invalid(); }
function filters(input: CursorFilters): CursorFilters {
  strictKeys(input, ["userId", "email", "serviceAccountId", "cloudAgentId", "automationId", "hostingType"]);
  const result: CursorFilters = {};
  for (const [key, value] of Object.entries(input)) {
    const checked = text(value as ExactJson, true)!;
    if (key === "userId" && !/^(0|[1-9][0-9]{0,127})$/.test(checked)) throw invalid();
    if (key === "hostingType" && !["CLOUD", "SELF_HOSTED", "SELF_HOSTED_POOL", "SELF_HOSTED_MACHINE"].includes(checked)) throw invalid();
    Object.assign(result, { [key]: checked });
  }
  return result;
}
function base(input: CursorContext) {
  return { format: "proper-cursor-report-v1" as const, ...input, identityBasis: "owner-supplied-unverified" as const };
}
function finish<T extends Omit<CursorReport, "contentDigest">>(report: T): T & { contentDigest: string } {
  // Capture time does not create new usage; content identity belongs to the report.
  const content = { ...report, capturedAt: undefined };
  return { ...report, contentDigest: createHash("sha256").update(canonicalJson(content)).digest("hex") };
}
function emptyTokens(): CursorTokens {
  return { input: null, cacheWrite: null, cacheRead: null, output: null, total: null, inputWithCacheWrite: null, inputWithoutCacheWrite: null };
}
function emptyEvent(): Omit<CursorEvent, "at" | "model" | "position"> {
  return {
    userEmail: null, kind: null, maxMode: null, isTokenBasedCall: null, isChargeable: null, isHeadless: null,
    serviceAccountId: null, serviceAccountName: null, cloudAgentId: null, automationId: null, conversationId: null,
    tokens: emptyTokens(), requestUnits: null, modelCostCents: null, reportedChargeCents: null, cursorTokenFeeCents: null,
    discountPercentOff: null, reportedCostUsd: null, costToYouUsd: null, costLabel: null, costToYouLabel: null, cashPaid: null,
  };
}
const universalMissing = ["stable-event-id", "local-workspace-attribution", "cash-paid", "invoice-reconciliation", "atomic-report-snapshot", "earliest-available-history"];
function eventMissing(events: CursorEvent[], csv: boolean): string[] {
  const missing = [...universalMissing];
  const categories = csv ? ["inputWithCacheWrite", "inputWithoutCacheWrite", "cacheRead", "output", "total"] as const
    : ["input", "cacheWrite", "cacheRead", "output"] as const;
  for (const key of categories) if (!events.length || events.some(row => row.tokens[key] === null)) missing.push(`tokens:${key}`);
  if (csv) missing.push("authenticated-account-identity", "csv-input-category-interpretation", "provider-export-completeness");
  else missing.push("tokens:total");
  if (events.some(row => csv ? row.reportedCostUsd === null : row.reportedChargeCents === null)) missing.push("some-event-costs");
  return missing;
}
function pagesBounded(pages: readonly string[]) { if (!pages.length || pages.length > CURSOR_REPORT_LIMITS.pages) throw invalid(); checkBytes(pages); }
function coverage(present: number[], totalPages: number, totalRows: number, returnedRows: number, missing: string[]): CursorCoverage {
  if (returnedRows > CURSOR_REPORT_LIMITS.rows || returnedRows > totalRows) throw invalid();
  return { completeness: present.length === Math.max(1, totalPages) && returnedRows === totalRows ? "complete" : "partial",
    basis: "provider-pagination", returnedRows, expectedRows: totalRows, pagesPresent: present, expectedPages: totalPages,
    atomicSnapshot: "unproven", missing };
}

/** Pure decode of explicitly supplied official report pages. Does not acquire data. */
export function normalizeCursorAdminEvents(pages: readonly string[], input: CursorContext, requestedFilters: CursorFilters = {}): CursorReport {
  pagesBounded(pages);
  const metadata = context(input), filter = filters(requestedFilters);
  if (metadata.source.scope !== "team-workspace" || metadata.billingWindow?.basis === "source-reported") throw invalid();
  const decoded = pages.map(page => {
    const raw = json(page), pagination = object(raw.pagination), period = object(raw.period);
    const total = count(raw.totalUsageEventsCount, Number.MAX_SAFE_INTEGER);
    const numPages = count(pagination.numPages, Number.MAX_SAFE_INTEGER), pageSize = count(pagination.pageSize, 1000, 1);
    const currentPage = count(pagination.currentPage, Math.max(1, numPages), 1);
    if (numPages !== Math.ceil(total / pageSize) && !(total === 0 && numPages === 1)) throw invalid();
    if (bool(pagination.hasNextPage) !== (currentPage < numPages) || bool(pagination.hasPreviousPage) !== (currentPage > 1)) throw invalid();
    const range = window({ start: epoch(period.startDate), end: epoch(period.endDate), bounds: "inclusive" });
    const remaining = Math.max(0, total - (currentPage - 1) * pageSize);
    if (!Array.isArray(raw.usageEvents) || raw.usageEvents.length > Math.min(pageSize, remaining)) throw invalid();
    return { total, numPages, pageSize, currentPage, range, rows: raw.usageEvents };
  }).sort((a, b) => a.currentPage - b.currentPage);
  const first = decoded[0], present = decoded.map(page => page.currentPage);
  if (new Set(present).size !== present.length || decoded.some(page => page.total !== first.total || page.numPages !== first.numPages
    || page.pageSize !== first.pageSize || canonicalJson(page.range) !== canonicalJson(first.range))) throw invalid();
  if (decoded.reduce((sum, page) => sum + page.rows.length, 0) > CURSOR_REPORT_LIMITS.rows) throw invalid();
  const events = decoded.flatMap(page => page.rows.map((item, index): CursorEvent => {
    const row = object(item), at = epoch(row.timestamp, true);
    inWindow(at, first.range);
    const tokens = row.tokenUsage === undefined || row.tokenUsage === null ? null : object(row.tokenUsage);
    const result: CursorEvent = { ...emptyEvent(), position: { page: page.currentPage, row: index + 1 }, at,
      userEmail: text(row.userEmail, true), model: text(row.model, true)!, kind: text(row.kind, true),
      maxMode: bool(row.maxMode), isTokenBasedCall: bool(row.isTokenBasedCall), isChargeable: bool(row.isChargeable), isHeadless: bool(row.isHeadless),
      serviceAccountId: text(row.serviceAccountId), serviceAccountName: text(row.serviceAccountName), cloudAgentId: text(row.cloudAgentId),
      automationId: text(row.automationId), conversationId: text(row.conversationId), requestUnits: quantity(row.requestsCosts),
      modelCostCents: quantity(tokens?.totalCents), reportedChargeCents: quantity(row.chargedCents), cursorTokenFeeCents: quantity(row.cursorTokenFee),
      discountPercentOff: quantity(tokens?.discountPercentOff),
      tokens: { ...emptyTokens(), input: quantity(tokens?.inputTokens, true), output: quantity(tokens?.outputTokens, true),
        cacheWrite: quantity(tokens?.cacheWriteTokens, true), cacheRead: quantity(tokens?.cacheReadTokens, true) },
    };
    if (result.discountPercentOff !== null) {
      const [whole, fraction] = result.discountPercentOff.split(".");
      if (BigInt(whole) > BigInt(100) || (whole === "100" && fraction !== undefined)) throw invalid();
    }
    // Filters are part of report identity. Check fields whose response attribution is available.
    for (const key of ["email", "serviceAccountId", "cloudAgentId", "automationId"] as const) {
      const expected = filter[key], actual = key === "email" ? result.userEmail : result[key];
      const wildcard = (key === "cloudAgentId" || key === "automationId") && expected === "*";
      if (expected !== undefined && (wildcard ? actual === null : actual !== expected)) throw invalid();
    }
    return result;
  }));
  return finish({ ...base(metadata), schema: "cursor-admin-events-2026-10-06", kind: "events", window: first.range, filters: filter, events,
    coverage: coverage(present, first.numPages, first.total, events.length, eventMissing(events, false)) });
}

/** Current-cycle spend is a separate, overlapping view; never an events total. */
export function normalizeCursorAdminSpend(pages: readonly { page: number; text: string }[], input: CursorContext,
  options: { pageSize: number; searchTerm?: string }): CursorReport {
  pagesBounded(pages.map(page => page.text));
  const metadata = context(input);
  if (metadata.source.scope !== "team-workspace") throw invalid();
  strictKeys(options, ["pageSize", "searchTerm"]);
  if (!Number.isSafeInteger(options.pageSize) || options.pageSize < 1 || options.pageSize > CURSOR_REPORT_LIMITS.rows) throw invalid();
  const searchTerm = options.searchTerm === undefined ? undefined : text(options.searchTerm, true)!;
  const decoded = pages.map(page => {
    strictKeys(page, ["page", "text"]);
    const raw = json(page.text), total = count(raw.totalMembers, Number.MAX_SAFE_INTEGER), totalPages = count(raw.totalPages, Number.MAX_SAFE_INTEGER);
    if (!Number.isSafeInteger(page.page) || page.page < 1 || page.page > Math.max(1, totalPages)) throw invalid();
    if (searchTerm === undefined && totalPages !== Math.ceil(total / options.pageSize) && !(total === 0 && totalPages === 1)) throw invalid();
    if (!Array.isArray(raw.teamMemberSpend) || raw.teamMemberSpend.length > options.pageSize) throw invalid();
    if (searchTerm === undefined && raw.teamMemberSpend.length > Math.max(0, total - (page.page - 1) * options.pageSize)) throw invalid();
    return { page: page.page, total, totalPages, start: epoch(raw.subscriptionCycleStart), rows: raw.teamMemberSpend };
  }).sort((a, b) => a.page - b.page);
  const first = decoded[0], present = decoded.map(page => page.page);
  if (new Set(present).size !== present.length || decoded.some(page => page.total !== first.total || page.totalPages !== first.totalPages || page.start !== first.start)) throw invalid();
  if (decoded.reduce((sum, page) => sum + page.rows.length, 0) > CURSOR_REPORT_LIMITS.rows) throw invalid();
  if (metadata.billingWindow && metadata.billingWindow.start !== first.start) throw invalid();
  const billingWindow: CursorBillingWindow = { start: first.start, end: metadata.billingWindow?.end ?? null,
    basis: metadata.billingWindow?.end ? "owner-supplied" : "source-reported" };
  const spend = decoded.flatMap(page => page.rows.map((item, index) => {
    const row = object(item);
    return { position: { page: page.page, row: index + 1 }, userId: text(row.userId, true)!, userEmail: text(row.email, true)!,
      name: text(row.name), role: text(row.role), onDemandSpendCents: quantity(row.spendCents), overallSpendCents: quantity(row.overallSpendCents),
      fastPremiumRequests: quantity(row.fastPremiumRequests, true), hardLimitOverrideDollars: quantity(row.hardLimitOverrideDollars),
      monthlyLimitDollars: quantity(row.monthlyLimitDollars), effectivePerUserLimitDollars: quantity(row.effectivePerUserLimitDollars), cashPaid: null };
  }));
  // Spend rows identify members. Duplicate member IDs indicate overlapping/drifting pages.
  if (new Set(spend.map(row => row.userId)).size !== spend.length) throw invalid();
  const reportCoverage = coverage(present, first.totalPages, first.total, spend.length,
    [...universalMissing, "token-categories", ...(billingWindow.end === null ? ["billing-cycle-end"] : [])]);
  if (searchTerm !== undefined) {
    reportCoverage.completeness = present.length === Math.max(1, first.totalPages) ? "unknown" : "partial";
    reportCoverage.expectedRows = null;
    reportCoverage.missing.push("search-member-count-semantics");
  }
  return finish({ ...base(metadata), billingWindow, schema: "cursor-admin-spend-2026-10-06", kind: "spend", window: null,
    filters: searchTerm === undefined ? {} : { searchTerm }, reportedMemberCount: first.total, spend, coverage: reportCoverage });
}

const tokenHeaders = ["Input (w/ Cache Write)", "Input (w/o Cache Write)", "Cache Read", "Output Tokens", "Total Tokens"];
const csvHeaders = [
  ["Date", "Model", ...tokenHeaders, "Cost", "Cost to you"],
  ["Date", "Kind", "Model", "Max Mode", ...tokenHeaders, "Cost"],
  ["Date", "Cloud Agent ID", "Automation ID", "Kind", "Model", "Max Mode", ...tokenHeaders, "Cost"],
];
function cellQuantity(cell: string): string | null { return cell.trim() === "" ? null : csvDecimal(cell.trim()); }
function cellTokens(cell: string): string | null {
  const value = cellQuantity(cell);
  if (value?.includes(".")) throw invalid();
  return value;
}
function cost(cell: string): { value: string | null; label: string | null } {
  const value = cell.trim();
  if (!value) return { value: null, label: null };
  if (["Included", "Free", "-"].includes(value)) return { value: null, label: value };
  return { value: csvDecimal(value.startsWith("$") ? value.slice(1) : value), label: null };
}

/** Observed dashboard exports, with explicit account/window provenance from the caller. */
export function normalizeCursorCsv(csv: string, input: CursorContext, options: { window: CursorWindow; expectedRows?: number }): CursorReport {
  const metadata = context(input);
  if (metadata.billingWindow?.basis === "source-reported") throw invalid();
  strictKeys(options, ["window", "expectedRows"]);
  const range = window(options.window), [headers, ...rows] = csvRecords(csv);
  const version = csvHeaders.findIndex(candidate => canonicalJson(headers) === canonicalJson(candidate)) + 1;
  if (!version || rows.some(row => row.length !== headers.length)) throw invalid();
  if (options.expectedRows !== undefined && (!Number.isSafeInteger(options.expectedRows) || options.expectedRows < 0 || options.expectedRows > CURSOR_REPORT_LIMITS.rows || options.expectedRows !== rows.length)) throw invalid();
  const events = rows.map((cells, index): CursorEvent => {
    const row = Object.fromEntries(headers.map((header, column) => [header, cells[column]]));
    const at = instant(row.Date), model = text(row.Model, true)!;
    inWindow(at, range);
    const mode = row["Max Mode"]?.trim() ?? "";
    if (!["", "Yes", "No"].includes(mode)) throw invalid();
    const reported = cost(row.Cost), toYou = cost(row["Cost to you"] ?? "");
    return { ...emptyEvent(), position: { page: null, row: index + 1 }, at, model, kind: text(row.Kind),
      cloudAgentId: text(row["Cloud Agent ID"]?.trim() || undefined), automationId: text(row["Automation ID"]?.trim() || undefined),
      maxMode: mode === "" ? null : mode === "Yes", reportedCostUsd: reported.value, costLabel: reported.label,
      costToYouUsd: toYou.value, costToYouLabel: toYou.label,
      tokens: { ...emptyTokens(), inputWithCacheWrite: cellTokens(row[tokenHeaders[0]]), inputWithoutCacheWrite: cellTokens(row[tokenHeaders[1]]),
        cacheRead: cellTokens(row[tokenHeaders[2]]), output: cellTokens(row[tokenHeaders[3]]), total: cellTokens(row[tokenHeaders[4]]) },
    };
  });
  return finish({ ...base(metadata), schema: "cursor-dashboard-csv-observed-2026-10-06", kind: "events", csvVersion: version as 1 | 2 | 3,
    window: range, filters: {}, events, coverage: { completeness: "unknown", basis: options.expectedRows === undefined ? "unspecified-export" : "export-assertion",
      returnedRows: rows.length, expectedRows: options.expectedRows ?? null, pagesPresent: [], expectedPages: null,
      atomicSnapshot: "unproven", missing: eventMissing(events, true) } });
}

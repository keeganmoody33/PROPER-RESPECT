/** Private report values, never a hosted measurement or a public sharing payload. */
export type CursorSource = {
  ownerAlias: string;
  accountAlias: string;
  workspaceAlias: string | null;
  sourceAlias: string;
  scope: "personal-account" | "team-workspace";
  sample: "synthetic" | "owner-supplied";
};
export type CursorWindow = { start: string; end: string; bounds: "inclusive" };
export type CursorBillingWindow = { start: string; end: string | null; basis: "owner-supplied" | "source-reported" };
export type CursorContext = {
  source: CursorSource;
  capturedAt: string;
  billingWindow: CursorBillingWindow | null;
};
export type CursorFilters = {
  userId?: string;
  email?: string;
  serviceAccountId?: string;
  cloudAgentId?: string;
  automationId?: string;
  hostingType?: "CLOUD" | "SELF_HOSTED" | "SELF_HOSTED_POOL" | "SELF_HOSTED_MACHINE";
};
export type CursorTokens = {
  input: string | null;
  cacheWrite: string | null;
  cacheRead: string | null;
  output: string | null;
  total: string | null;
  // CSV labels are kept literally. Upstreams disagree about their interpretation.
  inputWithCacheWrite: string | null;
  inputWithoutCacheWrite: string | null;
};
export type CursorEvent = {
  // Position in this report only. It is neither a provider event ID nor a replay key.
  position: { page: number | null; row: number };
  at: string;
  userEmail: string | null;
  model: string;
  kind: string | null;
  maxMode: boolean | null;
  isTokenBasedCall: boolean | null;
  isChargeable: boolean | null;
  isHeadless: boolean | null;
  serviceAccountId: string | null;
  serviceAccountName: string | null;
  cloudAgentId: string | null;
  automationId: string | null;
  conversationId: string | null;
  tokens: CursorTokens;
  requestUnits: string | null;
  modelCostCents: string | null;
  reportedChargeCents: string | null;
  cursorTokenFeeCents: string | null;
  discountPercentOff: string | null;
  reportedCostUsd: string | null;
  costToYouUsd: string | null;
  costLabel: string | null;
  costToYouLabel: string | null;
  cashPaid: null;
};
export type CursorSpend = {
  position: { page: number; row: number };
  userId: string;
  userEmail: string;
  name: string | null;
  role: string | null;
  onDemandSpendCents: string | null;
  overallSpendCents: string | null;
  fastPremiumRequests: string | null;
  hardLimitOverrideDollars: string | null;
  monthlyLimitDollars: string | null;
  effectivePerUserLimitDollars: string | null;
  cashPaid: null;
};
export type CursorCoverage = {
  completeness: "complete" | "partial" | "unknown";
  basis: "provider-pagination" | "export-assertion" | "unspecified-export";
  returnedRows: number;
  expectedRows: number | null;
  pagesPresent: number[];
  expectedPages: number | null;
  atomicSnapshot: "unproven";
  missing: string[];
};
type ReportBase = {
  format: "proper-cursor-report-v1";
  source: CursorSource;
  identityBasis: "owner-supplied-unverified";
  capturedAt: string;
  billingWindow: CursorBillingWindow | null;
  coverage: CursorCoverage;
  // Only allowlisted normalized fields contribute. Never use this as an event ID.
  contentDigest: string;
};
export type CursorReport = ReportBase & (
  | { schema: "cursor-admin-events-2026-10-06"; kind: "events"; window: CursorWindow; filters: CursorFilters; events: CursorEvent[] }
  | { schema: "cursor-dashboard-csv-observed-2026-10-06"; kind: "events"; csvVersion: 1 | 2 | 3; window: CursorWindow; filters: Record<string, never>; events: CursorEvent[] }
  | { schema: "cursor-admin-spend-2026-10-06"; kind: "spend"; window: null; filters: { searchTerm?: string }; reportedMemberCount: number; spend: CursorSpend[] }
);
export const CURSOR_REPORT_LIMITS = Object.freeze({ bytes: 256_000, rows: 1000, pages: 16, windowMs: 31 * 86_400_000 });

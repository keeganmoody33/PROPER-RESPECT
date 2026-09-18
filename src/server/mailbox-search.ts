import { canonicalCatalogSenderDomains } from "../domain/discovery";

export const MAILBOX_SCAN_MODES = ["KNOWN_PRODUCTS", "HISTORY", "INCREMENTAL"] as const;
export type MailboxScanMode = typeof MAILBOX_SCAN_MODES[number];
export function isMailboxScanMode(value: string): value is MailboxScanMode {
  return MAILBOX_SCAN_MODES.some(mode => mode === value);
}
export const MAILBOX_PAGE_LIMIT = 5;
export const MAILBOX_DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000;
const OVERLAP_SECONDS = 2 * 24 * 60 * 60;
const INITIAL_WINDOW_SECONDS = 30 * 24 * 60 * 60;

/** Freeze relative time into an explicit query; never reuse a token for a new query. */
export function mailboxSearchWindow(mode: MailboxScanMode, now: number, completedThrough?: number) {
  const before = Math.floor(now / 1000);
  if (!Number.isSafeInteger(before) || before <= 0) throw new Error("Invalid mailbox search time.");
  if (completedThrough !== undefined && (!Number.isSafeInteger(completedThrough) || completedThrough < 0 || completedThrough > before)) {
    throw new Error("Invalid mailbox coverage boundary.");
  }
  const domains = mode === "KNOWN_PRODUCTS" ? canonicalCatalogSenderDomains() : [];
  const after = mode === "INCREMENTAL" ? Math.max(0, (completedThrough ?? before - INITIAL_WINDOW_SECONDS) - OVERLAP_SECONDS) : undefined;
  const query = [
    ...(domains.length ? [`{${domains.map(domain => `from:${domain}`).join(" ")}}`] : []),
    ...(after === undefined ? [] : [`after:${after}`]),
    `before:${before}`,
  ].join(" ");
  return { query, queryKey: JSON.stringify(["gmail-search-v1", mode, query]), before, after };
}

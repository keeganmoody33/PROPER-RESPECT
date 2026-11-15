import type { ActivityModule } from "./public-profile";

const MONTH = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
const YEAR = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "UTC" });

/** A calendar date or an ISO instant, as the UTC date it names; undefined when it isn't a real one ("2026-02-30"). */
function utcDate(value: string): Date | undefined {
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value.slice(0, 10) ? date : undefined;
}

/** "1 Sep 2026", for a date or an instant, read in UTC; as written when it isn't a real date. */
export function dayMonthYear(value: string): string {
  const date = utcDate(value);
  return date ? `${date.getUTCDate()} ${MONTH.format(date)} ${YEAR.format(date)}` : value;
}

/** "2023", for a date; as written when it isn't a real date. */
export function yearOf(value: string): string {
  const date = utcDate(value);
  return date ? YEAR.format(date) : value;
}

/** "Aug 2026", for a date or an instant, read in UTC. */
export function monthYear(value: string): string {
  const date = utcDate(value);
  return date ? `${MONTH.format(date)} ${YEAR.format(date)}` : value;
}

const DAY_MS = 86_400_000;
/** Shorter than this, counted inclusively, a period reads as its days: two days at the end of August are not "Aug 2026". */
const DAYS_FOR_MONTHS = 28;

/** A period as a visitor reads it: "30–31 Aug 2026" under four weeks, else "Aug 2026", "Jun–Aug 2026" or "Mar 2023 – Aug 2026". */
export function formatPeriod(from: string, to: string): string {
  // A period stored backwards reads with its ends in order, not as the one day it would otherwise collapse to.
  if (!utcDate(from) || !utcDate(to)) return `${from} to ${to}`;
  const [start, end] = to < from ? [to, from] : [from, to];
  const [first, last] = [utcDate(start)!, utcDate(end)!];
  const [startMonth, endMonth] = [MONTH.format(first), MONTH.format(last)];
  const [startYear, endYear] = [YEAR.format(first), YEAR.format(last)];
  const days = Math.round((Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate()) - Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate())) / DAY_MS) + 1;
  if (days < DAYS_FOR_MONTHS) {
    if (days <= 1) return dayMonthYear(end);
    if (startYear !== endYear) return `${dayMonthYear(start)} – ${dayMonthYear(end)}`;
    if (startMonth !== endMonth) return `${first.getUTCDate()} ${startMonth} – ${dayMonthYear(end)}`;
    return `${first.getUTCDate()}–${dayMonthYear(end)}`;
  }
  if (startYear !== endYear) return `${startMonth} ${startYear} – ${endMonth} ${endYear}`;
  return startMonth === endMonth ? `${endMonth} ${endYear}` : `${startMonth}–${endMonth} ${endYear}`;
}

/** A snapshot stored as fresh stops reading as current this many days after it was captured. */
const FRESH_FOR_DAYS = 30;

/**
 * What a card's front says about a snapshot that isn't fresh: when it was last updated, and whether the last refresh failed.
 * Fresh is the word stored at capture, so more than 30 days before `today` (a calendar date) it says its age too.
 */
export function freshnessNote(freshness: ActivityModule["freshness"], capturedAt: string, { today }: { today?: string } = {}): string | undefined {
  const captured = utcDate(capturedAt.slice(0, 10));
  const aged = today !== undefined && captured !== undefined && Date.parse(`${today.slice(0, 10)}T00:00:00Z`) - captured.getTime() > FRESH_FOR_DAYS * DAY_MS;
  if (freshness === "FRESH" && !aged) return undefined;
  const updated = `last updated ${dayMonthYear(capturedAt)}`;
  return freshness === "ERROR" ? `${updated} · refresh failed` : updated;
}

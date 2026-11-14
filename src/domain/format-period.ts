import type { ActivityModule } from "./public-profile";

const MONTH = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
const YEAR = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "UTC" });

/** A calendar date or an ISO instant, as the UTC date it names; undefined when it isn't a real one ("2026-02-30"). */
function utcDate(value: string): Date | undefined {
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value.slice(0, 10) ? date : undefined;
}

/** "Aug 2026", for a date or an instant, read in UTC. */
export function monthYear(value: string): string {
  const date = utcDate(value);
  return date ? `${MONTH.format(date)} ${YEAR.format(date)}` : value;
}

/** A period as a visitor reads it: "Aug 2026", "Jun–Aug 2026" or "Mar 2023 – Aug 2026". */
export function formatPeriod(start: string, end: string): string {
  const [first, last] = [utcDate(start), utcDate(end)];
  if (!first || !last) return `${start} to ${end}`;
  const [startMonth, endMonth] = [MONTH.format(first), MONTH.format(last)];
  const [startYear, endYear] = [YEAR.format(first), YEAR.format(last)];
  if (startYear !== endYear) return `${startMonth} ${startYear} – ${endMonth} ${endYear}`;
  return startMonth === endMonth ? `${endMonth} ${endYear}` : `${startMonth}–${endMonth} ${endYear}`;
}

/** What a card's front says about a snapshot that isn't fresh: when it was last updated, and whether the last refresh failed. */
export function freshnessNote(freshness: ActivityModule["freshness"], capturedAt: string): string | undefined {
  if (freshness === "FRESH") return undefined;
  const updated = `last updated ${monthYear(capturedAt)}`;
  return freshness === "ERROR" ? `${updated} · refresh failed` : updated;
}

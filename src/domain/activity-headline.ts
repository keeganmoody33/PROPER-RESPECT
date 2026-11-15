import type { ActivityModule } from "./public-profile";
import { dayMonthYear } from "./format-period";
import { isHttpUrl } from "./http-url";
import { contributionCalendarCoverage } from "./contribution-calendar-coverage";

type Cadence = "day" | "week" | "month";

/**
 * The units that say each point counts what happened in one period, so the points add up to a total, matched as the whole unit in any case.
 * Any other unit ("min", "records", "%", "requests per day") or none could be a level or a rate, and adding those up would invent a number.
 */
const COUNT_PER_PERIOD: Readonly<Record<string, Cadence>> = {
  "per day": "day", daily: "day", "/day": "day",
  "per week": "week", weekly: "week", "/week": "week",
  "per month": "month", monthly: "month", "/month": "month",
};

/** The period each point counts, when its unit says so. */
export function seriesCadence(unit: string | undefined): Cadence | undefined {
  if (unit === undefined) return undefined;
  const key = unit.trim().toLowerCase();
  // Own keys only: "constructor" or "__proto__" must not find an inherited property.
  return Object.hasOwn(COUNT_PER_PERIOD, key) ? COUNT_PER_PERIOD[key] : undefined;
}

const DAY_MS = 86_400_000;
const DAYS_IN_WEEK = 7;
const utc = (date: string) => new Date(`${date}T00:00:00Z`);

/** The last day a point counts: the day itself, the week's seventh day, or the month's last day. */
export function cadenceEnd(date: string, cadence: Cadence | undefined): string {
  const start = utc(date);
  if (!cadence || cadence === "day" || !Number.isFinite(start.getTime())) return date;
  const end = cadence === "week" ? new Date(start.getTime() + (DAYS_IN_WEEK - 1) * DAY_MS) : new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  return end.toISOString().slice(0, 10);
}

const MONTHS_IN_YEAR = 12;
const monthIndex = (date: Date) => date.getUTCFullYear() * MONTHS_IN_YEAR + date.getUTCMonth();

/** Whether `next` is the period straight after `previous`: the next day, the next week, or the same day of the next month. */
function nextPeriod(previous: string, next: string, cadence: Cadence): boolean {
  const [from, to] = [utc(previous), utc(next)];
  if (cadence === "month") return to.getUTCDate() === from.getUTCDate() && monthIndex(to) - monthIndex(from) === 1;
  return to.getTime() - from.getTime() === (cadence === "week" ? DAYS_IN_WEEK : 1) * DAY_MS;
}

type Point = Readonly<{ date: string; value: number }>;
/** The most decimals a total keeps: a sum of cents stays in cents, and floating-point dust never shows. */
const MAX_DECIMALS = 2;

/**
 * A series as its headline reads it. The schema allows any order, gaps and repeated dates, so the points are put in date order
 * with one per date (a repeated date's later entry wins, as the newer record), and the series says whether they run one per period back to back.
 */
export type NormalizedSeries = Readonly<{
  points: readonly Point[];
  cadence?: Cadence;
  contiguous: boolean;
  decimals: number;
  hasNegative: boolean;
}>;

export function normalizeSeries(points: readonly Point[], unit: string | undefined): NormalizedSeries {
  const byDate = new Map(points.map(point => [point.date, point.value]));
  const sorted = [...byDate].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
  const cadence = seriesCadence(unit);
  const contiguous = Boolean(cadence) && sorted.every((point, index) => index === 0 || nextPeriod(sorted[index - 1].date, point.date, cadence!));
  const decimals = Math.min(MAX_DECIMALS, Math.max(0, ...sorted.map(point => (String(point.value).split(".")[1] ?? "").length)));
  return { points: sorted, cadence, contiguous, decimals, hasNegative: sorted.some(point => point.value < 0) };
}

type Figure = Readonly<{ value: number; label: string }>;
/**
 * A card's biggest number and the words after it, which say what kind of number it is. A stored figure that disagrees with
 * the days drawn beside it stands apart as `reported`, since nothing says which span it covers.
 */
export type ActivityHeadline = Figure & Readonly<{ reported?: Figure }>;

/**
 * Whether a series' points each count what happened in their period, so they add up. Nothing a card stores says so (a unit
 * like "daily" fits a follower count as well as a run count), so only presentation data that knows its series declares it.
 */
export type HeadlineOptions = Readonly<{ countsPerPeriod?: boolean }>;

/** How many of a collection's works the front links; the back lists the rest. */
export const FRONT_ARTIFACT_LIMIT = 3;

/** Whether `words` appears in `text` as whole words, in any case: "followers" in "new followers", not "s" in "response time". */
export function hasWord(text: string, words: string): boolean {
  // Splits at runs of spaces or underscores: "input_tokens" and "input tokens" are both ["input", "tokens"]; "in-put" stays one word.
  // https://regex101.com/?regex=%5B%5Cs_%5D%2B&testString=input_tokens%20per%20day
  const wordBreak = /[\s_]+/;
  const wanted = words.trim().toLowerCase().split(wordBreak);
  const found = text.toLowerCase().split(wordBreak);
  return found.some((_, start) => wanted.every((word, offset) => found[start + offset] === word));
}

/** The label, then the unit unless the label already says it as a whole word. */
function withUnit(label: string, unit?: string): string {
  if (!unit) return label;
  return hasWord(label, unit) ? label : `${label} · ${unit}`;
}
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const roundTo = (value: number, decimals: number) => Number(value.toFixed(decimals));

function seriesHeadline(activity: Extract<ActivityModule, { kind: "timeSeries" }>, pastUse: boolean, { countsPerPeriod = false }: HeadlineOptions): ActivityHeadline | undefined {
  const series = normalizeSeries(activity.points, activity.unit);
  const latest = series.points.at(-1);
  if (!latest) return undefined;
  const { cadence } = series;
  const peak = Math.max(...series.points.map(point => point.value));
  // Paused or stopped, the latest point is the pause itself: the peak says what the use was, when there was any.
  if (pastUse && peak > 0) return { value: peak, label: `${cadence ? `${activity.label} a ${cadence}` : withUnit(activity.label, activity.unit)} at its peak` };
  if (!pastUse && countsPerPeriod && cadence && !series.hasNegative) {
    const total = roundTo(series.points.reduce((sum, point) => sum + point.value, 0), series.decimals);
    const span = series.contiguous ? plural(series.points.length, cadence) : plural(series.points.length, "data point");
    return { value: total, label: `${activity.label} over ${span}` };
  }
  // A level, a rate or a series that goes negative doesn't add up: its newest value, with the day it was true.
  return { value: latest.value, label: `${withUnit(activity.label, activity.unit)} · as of ${dayMonthYear(latest.date)}` };
}

const AS_REPORTED = " · as reported";

/** The calendar's drawn days lead; a stored total they don't add up to is kept apart. */
function calendarHeadline(activity: Extract<ActivityModule, { kind: "contributionCalendar" }>): ActivityHeadline {
  const drawn = contributionCalendarCoverage(activity)?.days.reduce((sum, day) => sum + day.count, 0);
  if (drawn === undefined || drawn === activity.total) return { value: activity.total, label: "contributions" };
  return { value: drawn, label: "contributions", reported: { value: activity.total, label: `contributions${AS_REPORTED}` } };
}

/** The owner names their own figure, so it leads while it matches the bars drawn (their sum or their active days); otherwise the active days do. */
function codingHeadline(activity: Extract<ActivityModule, { kind: "codingActivity" }>): ActivityHeadline {
  const owner = { value: activity.primary.value, label: withUnit(activity.primary.label, activity.primary.unit) };
  if (!activity.days?.length) return owner;
  const activeDays = activity.days.filter(day => day.count > 0).length;
  const sum = activity.days.reduce((total, day) => total + day.count, 0);
  if (owner.value === activeDays || owner.value === sum) return owner;
  return { value: activeDays, label: activeDays === 1 ? "active day" : "active days", reported: { value: owner.value, label: `${owner.label}${AS_REPORTED}` } };
}

/** What a card leads with: a period's total where the points add up, otherwise what they can honestly say. */
export function activityHeadline(activity: ActivityModule, pastUse: boolean, options: HeadlineOptions = {}): ActivityHeadline | undefined {
  switch (activity.kind) {
    case "contributionCalendar": return calendarHeadline(activity);
    case "headlineMetrics": return { value: activity.primary.value, label: withUnit(activity.primary.label, activity.primary.unit) };
    case "codingActivity": return codingHeadline(activity);
    case "timeSeries": return seriesHeadline(activity, pastUse, options);
    case "artifactCollection": {
      // Never fewer than the works the back lists, and past the few the front links, how many it shows.
      const value = Math.max(activity.total, activity.artifacts.length);
      const shown = Math.min(FRONT_ARTIFACT_LIMIT, activity.artifacts.filter(artifact => isHttpUrl(artifact.url)).length);
      const label = value === 1 ? "linked work" : "linked works";
      return { value, label: shown > 0 && shown < value ? `${label} · ${shown} shown` : label };
    }
    case "reviewActivity": return { value: activity.reviews, label: "reviews" };
  }
}

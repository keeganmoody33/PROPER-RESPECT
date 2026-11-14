import type { ActivityModule } from "./public-profile";
import { dayMonthYear } from "./format-period";
import { isHttpUrl } from "./http-url";

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
  return unit === undefined ? undefined : COUNT_PER_PERIOD[unit.trim().toLowerCase()];
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

/** A card's biggest number and the words after it, which say what kind of number it is. */
export type ActivityHeadline = Readonly<{ value: number; label: string }>;

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

function seriesHeadline(activity: Extract<ActivityModule, { kind: "timeSeries" }>, pastUse: boolean): ActivityHeadline | undefined {
  const series = normalizeSeries(activity.points, activity.unit);
  const latest = series.points.at(-1);
  if (!latest) return undefined;
  const { cadence } = series;
  // Paused or stopped, the latest point is the pause itself: the peak says what the use was.
  if (pastUse) return { value: Math.max(...series.points.map(point => point.value)), label: `${cadence ? `${activity.label} a ${cadence}` : withUnit(activity.label, activity.unit)} at its peak` };
  if (cadence && !series.hasNegative) {
    const total = roundTo(series.points.reduce((sum, point) => sum + point.value, 0), series.decimals);
    const span = series.contiguous ? plural(series.points.length, cadence) : plural(series.points.length, "data point");
    return { value: total, label: `${activity.label} over ${span}` };
  }
  // A level, a rate or a series that goes negative doesn't add up: its newest value, with the day it was true.
  return { value: latest.value, label: `${withUnit(activity.label, activity.unit)} · as of ${dayMonthYear(latest.date)}` };
}

/** What a card leads with: a period's total where the points add up, otherwise what they can honestly say. */
export function activityHeadline(activity: ActivityModule, pastUse: boolean): ActivityHeadline | undefined {
  switch (activity.kind) {
    case "contributionCalendar": return { value: activity.total, label: "contributions" };
    case "headlineMetrics":
    case "codingActivity": return { value: activity.primary.value, label: withUnit(activity.primary.label, activity.primary.unit) };
    case "timeSeries": return seriesHeadline(activity, pastUse);
    case "artifactCollection": {
      // The count and the list the front shows agree: past the few it links, the label says how many it shows.
      const shown = Math.min(FRONT_ARTIFACT_LIMIT, activity.artifacts.filter(artifact => isHttpUrl(artifact.url)).length);
      const label = activity.total === 1 ? "linked work" : "linked works";
      return { value: activity.total, label: shown < activity.total ? `${label} · ${shown} shown` : label };
    }
    case "reviewActivity": return { value: activity.reviews, label: "reviews" };
  }
}

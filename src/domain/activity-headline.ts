import type { ActivityModule } from "./public-profile";

type Cadence = "day" | "week" | "month";

/**
 * The units that say each point counts what happened in one period, so the points add up to a total.
 * Any other unit ("min", "records", "%") or none could be a level or a rate, and adding those up would invent a number.
 */
const COUNT_PER_PERIOD: Readonly<Record<string, Cadence>> = { "per day": "day", "per week": "week", "per month": "month" };

/** The period each point counts, when its unit says so. */
export function seriesCadence(unit: string | undefined): Cadence | undefined {
  return unit === undefined ? undefined : COUNT_PER_PERIOD[unit.trim().toLowerCase()];
}

const DAY_MS = 86_400_000;
const DAYS_IN_WEEK = 7;

/** The last day a point counts: the day itself, the week's seventh day, or the month's last day. */
export function cadenceEnd(date: string, cadence: Cadence | undefined): string {
  const start = new Date(`${date}T00:00:00Z`);
  if (!cadence || cadence === "day" || !Number.isFinite(start.getTime())) return date;
  const end = cadence === "week" ? new Date(start.getTime() + (DAYS_IN_WEEK - 1) * DAY_MS) : new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  return end.toISOString().slice(0, 10);
}

/** A card's biggest number and the words after it, which say what kind of number it is. */
export type ActivityHeadline = Readonly<{ value: number; label: string }>;

const ONE_DECIMAL = 10;
const withUnit = (label: string, unit?: string) => unit ? `${label} · ${unit}` : label;
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

function seriesHeadline(activity: Extract<ActivityModule, { kind: "timeSeries" }>, pastUse: boolean): ActivityHeadline | undefined {
  const values = activity.points.map(point => point.value);
  if (!values.length) return undefined;
  const cadence = seriesCadence(activity.unit);
  // Paused or stopped, the latest point is the pause itself: the peak says what the use was.
  if (pastUse) return { value: Math.max(...values), label: `${cadence ? `${activity.label} a ${cadence}` : withUnit(activity.label, activity.unit)} at its peak` };
  if (cadence) return { value: values.reduce((sum, value) => sum + value, 0), label: `${activity.label} over ${plural(values.length, cadence)}` };
  if (values.length === 1) return { value: values[0], label: withUnit(activity.label, activity.unit) };
  const average = Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * ONE_DECIMAL) / ONE_DECIMAL;
  return { value: average, label: `${withUnit(activity.label, activity.unit)}, average of ${values.length}` };
}

/** What a card leads with: a period's total where the points add up, otherwise what they can honestly say. */
export function activityHeadline(activity: ActivityModule, pastUse: boolean): ActivityHeadline | undefined {
  switch (activity.kind) {
    case "contributionCalendar": return { value: activity.total, label: "contributions" };
    case "headlineMetrics":
    case "codingActivity": return { value: activity.primary.value, label: withUnit(activity.primary.label, activity.primary.unit) };
    case "timeSeries": return seriesHeadline(activity, pastUse);
    case "artifactCollection": return { value: activity.total, label: activity.total === 1 ? "linked work" : "linked works" };
    case "reviewActivity": return { value: activity.reviews, label: "reviews" };
  }
}

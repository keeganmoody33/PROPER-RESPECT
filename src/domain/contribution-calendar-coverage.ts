import type { ActivityModule } from "./public-profile";
import { dayMonthYear } from "./format-period";

type Contributions = Extract<ActivityModule, { kind: "contributionCalendar" }>;

export function contributionCalendarCoverage(activity: Contributions) {
  if (activity.days.length === 0) return undefined;
  // One day per date, as the grid draws one cell for it: a repeated date's later entry wins, as the newer record.
  const days = [...new Map(activity.days.map(day => [day.date, day])).values()].sort((a, b) => a.date.localeCompare(b.date));
  const firstSupplied = new Date(`${days[0].date}T00:00:00Z`);
  const lastSupplied = new Date(`${days.at(-1)!.date}T00:00:00Z`);
  const periodStart = new Date(`${activity.period?.start}T00:00:00Z`);
  const periodEnd = new Date(`${activity.period?.end}T00:00:00Z`);
  const enclosingPeriod = Number.isFinite(periodStart.getTime()) && Number.isFinite(periodEnd.getTime())
    && periodStart.toISOString().slice(0, 10) === activity.period?.start
    && periodEnd.toISOString().slice(0, 10) === activity.period?.end
    && periodStart <= firstSupplied && periodEnd >= lastSupplied;
  const first = enclosingPeriod ? periodStart : firstSupplied;
  const last = (enclosingPeriod ? periodEnd : lastSupplied).getTime();
  const missingDays = Math.round((last - first.getTime()) / 86_400_000) + 1 - new Set(days.map(day => day.date)).size;
  const suppliedRange = !activity.period || activity.period.start !== days[0].date || activity.period.end !== days.at(-1)!.date
    ? `Daily counts: ${dayMonthYear(days[0].date)} – ${dayMonthYear(days.at(-1)!.date)}` : undefined;
  const gapNote = missingDays > 0
    ? `${missingDays} ${missingDays === 1 ? "day has" : "days have"} no supplied count; blank spaces are not zero activity.` : undefined;
  return { days, first, last, suppliedRange, gapNote };
}

export type MonthTotal = Readonly<{ month: string; total: number; activeDays: number; days: number }>;

/** The days' counts added up per calendar month ("2026-08"), in date order, with how many of each month's days had any. */
export function monthlyTotals(days: readonly Readonly<{ date: string; count: number }>[]): MonthTotal[] {
  const months = new Map<string, { total: number; activeDays: number; days: number }>();
  for (const day of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    const month = months.get(day.date.slice(0, 7)) ?? { total: 0, activeDays: 0, days: 0 };
    months.set(day.date.slice(0, 7), { total: month.total + day.count, activeDays: month.activeDays + (day.count > 0 ? 1 : 0), days: month.days + 1 });
  }
  return [...months].map(([month, totals]) => ({ month, ...totals }));
}

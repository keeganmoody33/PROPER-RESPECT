import type { ActivityModule } from "./public-profile";

type Contributions = Extract<ActivityModule, { kind: "contributionCalendar" }>;

export function contributionCalendarCoverage(activity: Contributions) {
  if (activity.days.length === 0) return undefined;
  const days = [...activity.days].sort((a, b) => a.date.localeCompare(b.date));
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
    ? `Daily counts: ${days[0].date} – ${days.at(-1)!.date}` : undefined;
  const gapNote = missingDays > 0
    ? `${missingDays} ${missingDays === 1 ? "day has" : "days have"} no supplied count; blank spaces are not zero activity.` : undefined;
  return { days, first, last, suppliedRange, gapNote };
}

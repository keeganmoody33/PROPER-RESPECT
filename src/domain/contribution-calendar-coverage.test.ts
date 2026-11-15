import { expect, test } from "vitest";
import { contributionCalendarCoverage, monthlyTotals } from "./contribution-calendar-coverage";

test("a calendar's days add up month by month, in date order, with the days that had any", () => {
  expect(monthlyTotals([
    { date: "2026-01-02", count: 0 }, { date: "2025-12-31", count: 4 }, { date: "2026-01-01", count: 3 }, { date: "2026-01-03", count: 2 },
  ])).toEqual([
    { month: "2025-12", total: 4, activeDays: 1, days: 1 },
    { month: "2026-01", total: 5, activeDays: 2, days: 3 },
  ]);
  expect(monthlyTotals([])).toEqual([]);
});

test("a calendar that repeats a date counts it once, its later entry winning, as it draws one cell for it", () => {
  const days = [{ date: "2026-07-20", count: 3, level: 2 }, { date: "2026-07-21", count: 1, level: 1 }, { date: "2026-07-20", count: 5, level: 3 }];
  const coverage = contributionCalendarCoverage({ attributionScope: "PERSONAL", capturedAt: "2026-07-22T00:00:00.000Z", freshness: "FRESH", provenanceLabel: "Sample",
    kind: "contributionCalendar", total: 6, period: { start: "2026-07-20", end: "2026-07-21" }, days });
  expect(coverage?.days).toEqual([{ date: "2026-07-20", count: 5, level: 3 }, { date: "2026-07-21", count: 1, level: 1 }]);
  expect(monthlyTotals(coverage!.days)).toEqual([{ month: "2026-07", total: 6, activeDays: 2, days: 2 }]);
});

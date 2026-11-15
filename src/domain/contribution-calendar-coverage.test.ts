import { expect, test } from "vitest";
import { monthlyTotals } from "./contribution-calendar-coverage";

test("a calendar's days add up month by month, in date order, with the days that had any", () => {
  expect(monthlyTotals([
    { date: "2026-01-02", count: 0 }, { date: "2025-12-31", count: 4 }, { date: "2026-01-01", count: 3 }, { date: "2026-01-03", count: 2 },
  ])).toEqual([
    { month: "2025-12", total: 4, activeDays: 1, days: 1 },
    { month: "2026-01", total: 5, activeDays: 2, days: 3 },
  ]);
  expect(monthlyTotals([])).toEqual([]);
});

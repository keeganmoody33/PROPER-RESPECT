import { expect, test } from "vitest";
import { activityHeadline, seriesCadence } from "./activity-headline";
import type { ActivityModule } from "./public-profile";

const common = { attributionScope: "PERSONAL", capturedAt: "2026-09-01T00:00:00.000Z", freshness: "STALE", provenanceLabel: "Sample" } as const;
const series = (unit: string | undefined, values: readonly number[], label = "requests served"): ActivityModule => ({
  ...common, kind: "timeSeries", label, ...(unit === undefined ? {} : { unit }),
  points: values.map((value, index) => ({ date: `2026-08-${String(index + 1).padStart(2, "0")}`, value })),
});

test("a count per day, week or month adds up; any other unit, or none, does not", () => {
  expect(["per day", "Per Week", " per month ", "min", "records", "sessions", "per hour", "%", undefined].map(seriesCadence)).toEqual([
    "day", "week", "month", undefined, undefined, undefined, undefined, undefined, undefined,
  ]);
});

test("a count per period leads with its total over the points it covers", () => {
  expect(activityHeadline(series("per day", [2840, 2610, 7120]), false)).toEqual({ value: 12570, label: "requests served over 3 days" });
  expect(activityHeadline(series("per week", [120, 160]), false)).toEqual({ value: 280, label: "requests served over 2 weeks" });
  expect(activityHeadline(series("per month", [40]), false)).toEqual({ value: 40, label: "requests served over 1 month" });
});

test("a series whose unit doesn't add up leads with its one observation, or the average of several, and says which", () => {
  expect(activityHeadline(series("min", [45], "Minutes recorded"), false)).toEqual({ value: 45, label: "Minutes recorded · min" });
  expect(activityHeadline(series("min", [45, 50, 52], "Minutes recorded"), false)).toEqual({ value: 49, label: "Minutes recorded · min, average of 3" });
  expect(activityHeadline(series(undefined, [1, 2], "Trend"), false)).toEqual({ value: 1.5, label: "Trend, average of 2" });
});

test("a paused or stopped card leads with its peak, since its latest point is the pause", () => {
  expect(activityHeadline(series("per week", [312, 341, 0, 0], "workflow runs"), true)).toEqual({ value: 341, label: "workflow runs a week at its peak" });
  expect(activityHeadline(series("per day", [3, 9, 0]), true)).toEqual({ value: 9, label: "requests served a day at its peak" });
  expect(activityHeadline(series("min", [45, 50, 0], "Minutes recorded"), true)).toEqual({ value: 50, label: "Minutes recorded · min at its peak" });
});

test("no observations is no number, not zero; a recorded zero stays zero", () => {
  expect(activityHeadline(series("per week", []), false)).toBeUndefined();
  expect(activityHeadline(series("min", [0], "Minutes recorded"), false)).toEqual({ value: 0, label: "Minutes recorded · min" });
});

test("every other kind leads with its own total, whatever the card's level", () => {
  const kinds: ActivityModule[] = [
    { ...common, kind: "contributionCalendar", total: 37, days: [] },
    { ...common, kind: "headlineMetrics", primary: { label: "domains registered", value: 23 }, supporting: [] },
    { ...common, kind: "codingActivity", primary: { label: "sessions", value: 120, unit: "this month" }, supporting: [] },
    { ...common, kind: "artifactCollection", total: 3, artifacts: [] },
    { ...common, kind: "reviewActivity", reviews: 17, bugsCaught: 3, severity: [], points: [] },
  ];
  expect(kinds.map(activity => activityHeadline(activity, true))).toEqual([
    { value: 37, label: "contributions" },
    { value: 23, label: "domains registered" },
    { value: 120, label: "sessions · this month" },
    { value: 3, label: "artifacts" },
    { value: 17, label: "reviews" },
  ]);
});

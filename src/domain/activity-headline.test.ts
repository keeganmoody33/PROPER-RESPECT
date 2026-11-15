import { expect, test } from "vitest";
import { activityHeadline, seriesCadence } from "./activity-headline";
import type { ActivityModule } from "./public-profile";

/** The homepage samples declare their series as per-period counts; a stored card cannot. */
const COUNTS = { countsPerPeriod: true } as const;

const common = { attributionScope: "PERSONAL", capturedAt: "2026-09-01T00:00:00.000Z", freshness: "STALE", provenanceLabel: "Sample" } as const;
const series = (unit: string | undefined, values: readonly number[], label = "requests served"): ActivityModule => ({
  ...common, kind: "timeSeries", label, ...(unit === undefined ? {} : { unit }),
  points: values.map((value, index) => ({ date: `2026-08-${String(index + 1).padStart(2, "0")}`, value })),
});

const dated = (unit: string | undefined, points: readonly (readonly [string, number])[], label = "requests served"): ActivityModule => ({
  ...common, kind: "timeSeries", label, ...(unit === undefined ? {} : { unit }), points: points.map(([date, value]) => ({ date, value })),
});

test("a count per day, week or month adds up, read from one whole-string table in any case; any other unit, or none, does not", () => {
  expect(["per day", "Per Week", " per month ", "daily", "WEEKLY", "Monthly", "/day", "/Week", "/month"].map(seriesCadence)).toEqual([
    "day", "week", "month", "day", "week", "month", "day", "week", "month",
  ]);
  expect(["min", "records", "sessions", "per hour", "%", "per day average", "requests per day", "dailyish", "/days", "constructor", "__proto__", "toString", "hasOwnProperty", undefined].map(seriesCadence)).toEqual(Array(14).fill(undefined));
});

test("a count per period leads with its total over the points it covers", () => {
  expect(activityHeadline(series("per day", [2840, 2610, 7120]), false, COUNTS)).toEqual({ value: 12570, label: "requests served over 3 days" });
  expect(activityHeadline(dated("per week", [["2026-08-03", 120], ["2026-08-10", 160]]), false, COUNTS)).toEqual({ value: 280, label: "requests served over 2 weeks" });
  expect(activityHeadline(series("per month", [40]), false, COUNTS)).toEqual({ value: 40, label: "requests served over 1 month" });
});

test("a series whose unit doesn't add up leads with its latest value and that value's date, never an average of a running level", () => {
  expect(activityHeadline(series("followers", [100, 200, 300], "followers"), false)).toEqual({ value: 300, label: "followers · as of 3 Aug 2026" });
  expect(activityHeadline(series(undefined, [100, 200, 300], "followers"), false)).toEqual({ value: 300, label: "followers · as of 3 Aug 2026" });
  expect(activityHeadline(series("min", [45], "Minutes recorded"), false)).toEqual({ value: 45, label: "Minutes recorded · min · as of 1 Aug 2026" });
});

test("a total counts the distinct dates present, says data points when they are not one per period back to back, and lets a repeated date's last entry win", () => {
  // Gaps: three days spread over a week are three data points, not three days.
  expect(activityHeadline(dated("per day", [["2026-08-01", 5], ["2026-08-04", 5], ["2026-08-07", 5]]), false, COUNTS)).toEqual({ value: 15, label: "requests served over 3 data points" });
  // Out of order but back to back: still three days.
  expect(activityHeadline(dated("per day", [["2026-08-03", 1], ["2026-08-01", 2], ["2026-08-02", 3]]), false, COUNTS)).toEqual({ value: 6, label: "requests served over 3 days" });
  // A repeated date counts once, with its later entry: 2 + 7, over two days.
  expect(activityHeadline(dated("per day", [["2026-08-01", 2], ["2026-08-02", 4], ["2026-08-02", 7]]), false, COUNTS)).toEqual({ value: 9, label: "requests served over 2 days" });
  expect(activityHeadline(dated("per week", [["2026-08-03", 1], ["2026-08-17", 1]]), false, COUNTS)).toEqual({ value: 2, label: "requests served over 2 data points" });
  expect(activityHeadline(dated("per month", [["2026-06-01", 1], ["2026-07-01", 1], ["2026-08-01", 1]]), false, COUNTS)).toEqual({ value: 3, label: "requests served over 3 months" });
  // A running level's latest is the newest date, wherever it sits in the list.
  expect(activityHeadline(dated("followers", [["2026-08-31", 300], ["2026-08-01", 100]], "followers"), false)).toEqual({ value: 300, label: "followers · as of 31 Aug 2026" });
});

test("a total is rounded to the precision of its points, at most two decimals", () => {
  expect(activityHeadline(series("per day", [0.1, 0.2]), false, COUNTS)).toEqual({ value: 0.3, label: "requests served over 2 days" });
  expect(activityHeadline(series("per day", [1.005, 2.0049]), false, COUNTS)?.value).toBe(3.01);
  expect(activityHeadline(series("per day", [1, 2]), false, COUNTS)?.value).toBe(3);
});

test("a series with a negative value is not summed into a total: it leads with its latest value", () => {
  expect(activityHeadline(series("per day", [5, -2, 4]), false, COUNTS)).toEqual({ value: 4, label: "requests served · per day · as of 3 Aug 2026" });
});

test("a paused or stopped card leads with its peak, since its latest point is the pause", () => {
  expect(activityHeadline(series("per week", [312, 341, 0, 0], "workflow runs"), true)).toEqual({ value: 341, label: "workflow runs a week at its peak" });
  expect(activityHeadline(series("per day", [3, 9, 0]), true)).toEqual({ value: 9, label: "requests served a day at its peak" });
  expect(activityHeadline(series("min", [45, 50, 0], "Minutes recorded"), true)).toEqual({ value: 50, label: "Minutes recorded · min at its peak" });
});

test("no observations is no number, not zero; a recorded zero stays zero", () => {
  expect(activityHeadline(series("per week", []), false)).toBeUndefined();
  expect(activityHeadline(series("min", [0], "Minutes recorded"), false)).toEqual({ value: 0, label: "Minutes recorded · min · as of 1 Aug 2026" });
});

test("every other kind leads with its own total, whatever the card's level", () => {
  const kinds: ActivityModule[] = [
    { ...common, kind: "contributionCalendar", total: 37, days: [] },
    { ...common, kind: "headlineMetrics", primary: { label: "domains registered", value: 23 }, supporting: [] },
    { ...common, kind: "codingActivity", primary: { label: "sessions", value: 120, unit: "this month" }, supporting: [] },
    { ...common, kind: "artifactCollection", total: 3, artifacts: [1, 2, 3].map(index => ({ title: `Work ${index}`, url: `https://example.com/${index}` })) },
    { ...common, kind: "reviewActivity", reviews: 17, bugsCaught: 3, severity: [], points: [] },
  ];
  expect(kinds.map(activity => activityHeadline(activity, true))).toEqual([
    { value: 37, label: "contributions" },
    { value: 23, label: "domains registered" },
    { value: 120, label: "sessions · this month" },
    { value: 3, label: "linked works" },
    { value: 17, label: "reviews" },
  ]);
});

test("linked works say how many of them the front shows when the stored total is more", () => {
  const works = (total: number, urls: readonly string[]): ActivityModule => ({ ...common, kind: "artifactCollection", total, artifacts: urls.map((url, index) => ({ title: `Work ${index}`, url })) });
  const links = ["https://a.example/1", "https://a.example/2", "https://a.example/3", "https://a.example/4"];
  expect(activityHeadline(works(12, links), false)).toEqual({ value: 12, label: "linked works · 3 shown" });
  expect(activityHeadline(works(2, ["https://a.example/1", "ftp://a.example/2"]), false)).toEqual({ value: 2, label: "linked works · 1 shown" });
  expect(activityHeadline(works(1, ["https://a.example/1"]), false)).toEqual({ value: 1, label: "linked work" });
});

test("a stored card never sums a series: a unit alone cannot tell a count from a level, so it leads with its latest value and date", () => {
  expect(activityHeadline(series("daily", [1000, 1010], "followers"), false)).toEqual({ value: 1010, label: "followers · daily · as of 2 Aug 2026" });
  expect(activityHeadline(series("per day", [500, 510], "active users"), false)).toEqual({ value: 510, label: "active users · per day · as of 2 Aug 2026" });
  // Declared counts still need a unit that names their period.
  expect(activityHeadline(series("followers", [1000, 1010], "followers"), false, COUNTS)).toEqual({ value: 1010, label: "followers · as of 2 Aug 2026" });
});

test("a paused card claims a peak only when some point is above zero; otherwise its latest value and date", () => {
  expect(activityHeadline(series("per week", [-3, -5], "runs"), true)).toEqual({ value: -5, label: "runs · per week · as of 2 Aug 2026" });
  expect(activityHeadline(series("per week", [0, 0], "runs"), true)).toEqual({ value: 0, label: "runs · per week · as of 2 Aug 2026" });
  expect(activityHeadline(series("per week", [-3, 4, 0], "runs"), true)).toEqual({ value: 4, label: "runs a week at its peak" });
});

const calendar = (total: number, counts: readonly number[]): ActivityModule => ({
  ...common, kind: "contributionCalendar", total, period: { start: "2026-07-20", end: "2026-07-26" },
  days: counts.map((count, index) => ({ date: `2026-07-${20 + index}`, count, level: Math.min(4, count) })),
});

test("a calendar leads with the days it draws; a stored total that disagrees stands apart, named as reported", () => {
  expect(activityHeadline(calendar(523, [1, 4, 2, 7, 2, 5, 1]), false)).toEqual({ value: 22, label: "contributions", reported: { value: 523, label: "contributions · as reported" } });
  expect(activityHeadline(calendar(22, [1, 4, 2, 7, 2, 5, 1]), false)).toEqual({ value: 22, label: "contributions" });
  expect(activityHeadline(calendar(37, []), false)).toEqual({ value: 37, label: "contributions" });
});

const coding = (primary: { label: string; value: number; unit?: string }, counts?: readonly number[]): ActivityModule => ({
  ...common, kind: "codingActivity", primary, supporting: [],
  ...(counts ? { days: counts.map((count, index) => ({ date: `2026-07-${20 + index}`, count, level: Math.min(4, count) })) } : {}),
});

test("coding activity keeps the owner's figure when it agrees with the bars drawn; otherwise it leads with the active days drawn, the figure named as reported", () => {
  expect(activityHeadline(coding({ label: "active days", value: 3 }, [2, 0, 5, 1]), false)).toEqual({ value: 3, label: "active days" });
  expect(activityHeadline(coding({ label: "sessions", value: 8 }, [2, 0, 5, 1]), false)).toEqual({ value: 8, label: "sessions" });
  expect(activityHeadline(coding({ label: "sessions", value: 523, unit: "this year" }, [2, 0, 5, 1]), false))
    .toEqual({ value: 3, label: "active days", reported: { value: 523, label: "sessions · this year · as reported" } });
  expect(activityHeadline(coding({ label: "sessions", value: 523 }), false)).toEqual({ value: 523, label: "sessions" });
});

test("linked works never count fewer than the works listed, and never say none are shown", () => {
  const works = (total: number, count: number): ActivityModule => ({ ...common, kind: "artifactCollection", total,
    artifacts: Array.from({ length: count }, (_, index) => ({ title: `Work ${index}`, url: `https://a.example/${index}` })) });
  expect(activityHeadline(works(2, 6), false)).toEqual({ value: 6, label: "linked works · 3 shown" });
  expect(activityHeadline(works(0, 1), false)).toEqual({ value: 1, label: "linked work" });
  expect(activityHeadline(works(5, 0), false)).toEqual({ value: 5, label: "linked works" });
});

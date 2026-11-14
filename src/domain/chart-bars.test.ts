import { expect, test } from "vitest";
import { chartBars, MAX_CHART_BARS, type ChartBar } from "./chart-bars";

const DAY_MS = 86_400_000;
const FIRST_DAY = Date.parse("2026-07-01");
const MONTH_OF_DAYS = 31;
const QUARTER_OF_DAYS = 90;
const THREE_BARS = 3;

/** Daily points from 2026-07-01, read from a space-separated list of values. */
const days = (values: string) => values.split(" ").map(Number).map((value, index) => ({
  date: new Date(FIRST_DAY + index * DAY_MS).toISOString().split("T")[0],
  value,
}));
const counting = (length: number) => days(Array.from({ length }, (_, index) => index).join(" "));
/** Each bar as "first day..last day = value (points)". */
const shown = (bars: readonly ChartBar[]) => bars.map(bar => `${bar.start}..${bar.end} = ${bar.value} (${bar.points})`);

test("a series no longer than the limit keeps one bar per point", () => {
  expect(shown(chartBars(days("3 0 5")))).toEqual([
    "2026-07-01..2026-07-01 = 3 (1)",
    "2026-07-02..2026-07-02 = 0 (1)",
    "2026-07-03..2026-07-03 = 5 (1)",
  ]);
  expect(chartBars(counting(MONTH_OF_DAYS))).toHaveLength(MONTH_OF_DAYS);
});

test("a month of days is the most a chart draws", () => {
  expect(MAX_CHART_BARS).toBe(MONTH_OF_DAYS);
});

test("a longer series shares bars between consecutive points, each bar their average", () => {
  expect(shown(chartBars(days("1 3 5 7 2 4"), THREE_BARS))).toEqual([
    "2026-07-01..2026-07-02 = 2 (2)",
    "2026-07-03..2026-07-04 = 6 (2)",
    "2026-07-05..2026-07-06 = 3 (2)",
  ]);
});

test("an uneven split still covers every point once and in order, and a fuller bar never reads as a rise", () => {
  expect(shown(chartBars(days("4 4 4 4 4 4 4"), THREE_BARS))).toEqual([
    "2026-07-01..2026-07-02 = 4 (2)",
    "2026-07-03..2026-07-04 = 4 (2)",
    "2026-07-05..2026-07-07 = 4 (3)",
  ]);
});

test("a 90-day snapshot becomes 31 bars that cover every day and end on its last", () => {
  const bars = chartBars(counting(QUARTER_OF_DAYS));
  expect(bars).toHaveLength(MONTH_OF_DAYS);
  expect(bars.reduce((total, bar) => total + bar.points, 0)).toBe(QUARTER_OF_DAYS);
  expect(shown([bars[0], bars.at(-1)!])).toEqual([
    "2026-07-01..2026-07-02 = 0.5 (2)",
    "2026-09-26..2026-09-28 = 88 (3)",
  ]);
});

test("no points draw no bars", () => {
  expect(chartBars([])).toEqual([]);
});

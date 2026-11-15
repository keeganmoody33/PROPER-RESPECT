export type ChartPoint = Readonly<{ date: string; value: number }>;
/** One drawn bar: the points from start to end, and their average. */
export type ChartBar = Readonly<{ start: string; end: string; value: number; points: number }>;

/** A month of days, one bar each, is the most a card's chart draws. */
export const MAX_CHART_BARS = 31;

/** A series in date order, one point a date: where a date is stored twice, its last entry stands. */
export function byDate(points: readonly ChartPoint[]): ChartPoint[] {
  return [...new Map(points.map(point => [point.date, point.value]))].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
}

/**
 * The bars for a series, never more than maxBars. A longer series splits into that many runs of consecutive points,
 * each drawn as its points' average: a bar keeps the unit of a single point (a day, a week, one observation),
 * so a run holding one point fewer than its neighbours never reads as a drop.
 */
export function chartBars(stored: readonly ChartPoint[], maxBars = MAX_CHART_BARS): ChartBar[] {
  const points = byDate(stored);
  const count = Math.min(points.length, maxBars);
  return Array.from({ length: count }, (_, bar) => {
    const run = points.slice(Math.floor((bar * points.length) / count), Math.floor(((bar + 1) * points.length) / count));
    const total = run.reduce((sum, point) => sum + point.value, 0);
    return { start: run[0].date, end: run[run.length - 1].date, value: total / run.length, points: run.length };
  });
}

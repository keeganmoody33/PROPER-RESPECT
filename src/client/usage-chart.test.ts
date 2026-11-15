import { load } from "cheerio";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ProfileLoading } from "../../components/profile-loading";
import { ProductCardSkeleton } from "../../components/product-card-skeleton";
import { coverageDays, UsageChart, usageChartLog } from "../../components/usage-chart";

test("coverage days are inclusive and reject inverted ranges", () => {
  expect(coverageDays({ start: "2026-09-01", end: "2026-09-15" })).toBe(15);
  expect(coverageDays({ start: "2026-09-01", end: "2026-09-01" })).toBe(1);
  expect(coverageDays({ start: "2026-09-15", end: "2026-09-01" })).toBeUndefined();
});

test("the chart log names source, period, and loading without a score or rank", () => {
  expect(usageChartLog({
    source: "github",
    period: { start: "2026-09-01", end: "2026-09-30" },
    loading: true,
  })).toBe("GITHUB · 30D · LOADING");
  expect(usageChartLog({ source: "personal", period: { start: "2026-09-01", end: "2026-09-15" } })).toBe("PERSONAL · 15D");
  expect(usageChartLog({ source: "  ", loading: true })).toBe("LOADING");
  expect(usageChartLog({
    source: "github",
    period: { start: "2026-09-15", end: "2026-09-01", label: "Last 12 months" },
    loading: true,
  })).toBe("GITHUB · LAST 12 MONTHS · LOADING");
  const log = usageChartLog({ source: "github", period: { start: "2026-09-01", end: "2026-09-30" }, loading: true });
  expect(log).not.toMatch(/score|rank|rating|leaderboard/i);
});

test("a loading chart draws dashed slots and never invents values", () => {
  const $ = load(renderToStaticMarkup(createElement(UsageChart, {
    loading: true,
    log: "GITHUB · 30D · LOADING",
  })));

  expect($(".usage-chart").attr("data-state")).toBe("skeleton");
  expect($(".activity-bars")).toHaveLength(0);
  expect($("[data-skeleton-bar]")).toHaveLength(30);
  expect($("[data-skeleton-bar][title]")).toHaveLength(0);
  expect($(".usage-chart-log").text()).toBe("GITHUB · 30D · LOADING");
  expect($.text()).not.toMatch(/score|rank|1,240|example sessions/i);
});

test("supplied points stay on the resolved chart and keep their titles", () => {
  const $ = load(renderToStaticMarkup(createElement(UsageChart, {
    label: "Minutes recorded",
    unit: "min",
    points: [{ date: "2026-09-15", value: 45 }],
    log: "PERSONAL · 15D",
  })));

  expect($(".usage-chart").attr("data-state")).toBe("resolved");
  expect($(".activity-bars").attr("aria-label")).toBe("Minutes recorded trend");
  expect($(".activity-bars").attr("role")).toBe("img");
  expect($(".activity-bars > span")).toHaveLength(1);
  expect($(".activity-bars > span").attr("title")).toBe("15 Sep 2026: 45 min");
  expect($(".activity-bars > span").attr("style")).toMatch(/--bar-height:\s*100%/);
});

const MONTH_OF_BARS = 31;
const TWO_MONTHS_OF_DAYS = 62;
const DAY_MS = 86_400_000;
const QUIET_DAY = 3;
const BUSY_DAY = 6;

test("a series longer than a month draws a month of bars, each titled with its days' average, and narrows the gaps", () => {
  const points = Array.from({ length: TWO_MONTHS_OF_DAYS }, (_, index) => ({
    date: new Date(Date.parse("2026-07-01") + index * DAY_MS).toISOString().split("T")[0],
    value: [QUIET_DAY, BUSY_DAY][index % [QUIET_DAY, BUSY_DAY].length],
  }));
  const $ = load(renderToStaticMarkup(createElement(UsageChart, { label: "Sessions", unit: "sessions", points })));

  expect($(".activity-bars > span")).toHaveLength(MONTH_OF_BARS);
  expect($(".activity-bars > span").first().attr("title")).toBe("1 Jul 2026 to 2 Jul 2026: 4.5 sessions on average");
  expect($(".activity-bars").attr("style")).toBe("--bar-gap:2px");
});

test("a loading chart does not inject placeholder metric values", () => {
  const $ = load(renderToStaticMarkup(createElement(UsageChart, {
    loading: true,
    log: "GITHUB · 30D · LOADING",
  })));

  expect($(".activity-hero")).toHaveLength(0);
  expect($("[data-skeleton-bar]").text()).toBe("");
  expect($("[data-skeleton-bar][title], [data-skeleton-bar][aria-label]")).toHaveLength(0);
  expect($(".usage-chart").text()).not.toMatch(/(?:^|[\s·])(?:0|—|–)(?:$|[\s·])/);
});

test("skeleton cards do not inject placeholder metric values", () => {
  const $ = load(renderToStaticMarkup(createElement(ProductCardSkeleton, {
    label: "Loading your private collection…",
    log: "COLLECTION · LOADING",
  })));

  expect($(".activity-hero, .activity-bars")).toHaveLength(0);
  expect($("[data-skeleton-bar][title], [data-skeleton-bar][aria-label]")).toHaveLength(0);
  expect($("[data-skeleton-bar]").text()).toBe("");
  const readable = `${$(".visually-hidden").text()} ${$(".usage-chart-log").text()}`;
  expect(readable).not.toMatch(/(?:^|[\s·])(?:0|—|–)(?:$|[\s·])/);
});

test("skeleton cards keep the existing status copy for assistive tech", () => {
  const label = "Loading your private collection…";
  const $ = load(renderToStaticMarkup(createElement(ProductCardSkeleton, {
    label,
    log: "COLLECTION · LOADING",
    count: 3,
  })));

  const status = $("[role='status']");
  expect(status.attr("aria-busy")).toBe("true");
  expect(status.find(".visually-hidden").text()).toBe(label);
  expect($(".product-card-skeleton")).toHaveLength(3);
  expect($("[data-skeleton-bar]").length).toBeGreaterThan(0);
  expect($.text()).not.toMatch(/score|rank|rating/i);
});

test("the public profile loading fallback uses skeleton cards and the shared collection label", () => {
  const $ = load(renderToStaticMarkup(createElement(ProfileLoading)));

  expect($("[role='status']").attr("aria-busy")).toBe("true");
  expect($(".visually-hidden").text()).toContain("Loading shared product collection…");
  expect($(".usage-chart-log").text()).toBe("PROFILE · LOADING");
  expect($(".product-card-skeleton")).toHaveLength(3);
  expect($.text()).not.toMatch(/score|rank/i);
});

test("a zero bar is marked as zero, so it draws as a stub on the baseline instead of an empty gap", () => {
  const $ = load(renderToStaticMarkup(createElement(UsageChart, {
    points: [{ date: "2026-08-03", value: 0 }, { date: "2026-08-10", value: 9200 }, { date: "2026-08-17", value: 0 }],
    label: "pages crawled", unit: "per week",
  })));
  expect($(".activity-bars > span").map((_, bar) => $(bar).attr("data-zero") ?? "no").get()).toEqual(["", "no", ""]);
  expect($(".visually-hidden tbody tr").map((_, row) => $(row).children().last().text()).get()).toEqual(["0 per week", "9,200 per week", "0 per week"]);
  // Each row is headed by when it starts, so a screen reader names the row as it reads its value.
  expect($(".visually-hidden tbody th[scope=row]").map((_, cell) => $(cell).text()).get()).toEqual(["3 Aug 2026", "10 Aug 2026", "17 Aug 2026"]);
});

test("a bar's title and table row read in plain dates and grouped numbers", () => {
  const $ = load(renderToStaticMarkup(createElement(UsageChart, { points: [{ date: "2026-08-01", value: 2840 }], label: "requests served", unit: "per day" })));
  expect($(".activity-bars > span").attr("title")).toBe("1 Aug 2026: 2,840 per day");
  // A one-day bar is one date, not a From and a To that are the same.
  expect($(".visually-hidden tbody tr").children().toArray().map(cell => [cell.tagName, $(cell).text()])).toEqual([["th", "1 Aug 2026"], ["td", "2,840 per day"]]);
});

const barHeights = ($: ReturnType<typeof load>) => $(".activity-bars > span").map((_, bar) => $(bar).attr("style")!.match(/--bar-height:\s*([\d.]+)%/)![1]).get().map(Number);

test("a series of values all below one scales to its own largest value, so its bars stand tall", () => {
  const $ = load(renderToStaticMarkup(createElement(UsageChart, {
    points: [0.001, 0.002, 0.004].map((value, index) => ({ date: `2026-08-0${index + 1}`, value })), label: "latency", unit: "s per day",
  })));
  expect(barHeights($)).toEqual([25, 50, 100]);
});

test("a value below zero draws as a stub on the baseline, and the table says so", () => {
  const $ = load(renderToStaticMarkup(createElement(UsageChart, {
    points: [{ date: "2026-08-03", value: -3 }, { date: "2026-08-10", value: 6 }], label: "net signups", unit: "per week",
  })));
  expect($(".activity-bars > span").map((_, bar) => $(bar).attr("data-below-zero") ?? "no").get()).toEqual(["", "no"]);
  expect(barHeights($)).toEqual([0, 100]);
  expect($(".visually-hidden caption").text()).toBe("net signups, one row per bar. A value below zero is drawn as a stub on the baseline.");
  expect($(".visually-hidden tbody tr").first().children().last().text()).toBe("-3 per week");
});

test("an average below one keeps its significant digits, so 62 days of 0.004 s never read as zero", () => {
  const points = Array.from({ length: 62 }, (_, index) => ({ date: new Date(Date.UTC(2026, 6, 1 + index)).toISOString().slice(0, 10), value: 0.004 }));
  const $ = load(renderToStaticMarkup(createElement(UsageChart, { points, label: "latency", unit: "s" })));
  expect($(".activity-bars > span").first().attr("title")).toBe("1 Jul 2026 to 2 Jul 2026: 0.004 s on average");
  expect($(".visually-hidden tbody tr").first().children().last().text()).toBe("0.004 s on average");
  // An average of one or more still reads to one decimal place.
  const busy = load(renderToStaticMarkup(createElement(UsageChart, { points: points.map((point, index) => ({ ...point, value: index % 2 ? 2 : 1 })), unit: "s" })));
  expect(busy(".visually-hidden tbody tr").first().children().last().text()).toBe("1.5 s on average");
});

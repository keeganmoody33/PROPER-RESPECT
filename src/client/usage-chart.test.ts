import { load } from "cheerio";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import ProfileLoading from "../../app/[handle]/loading";
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
  expect($(".activity-bars > span")).toHaveLength(1);
  expect($(".activity-bars > span").attr("title")).toBe("2026-09-15: 45 min");
  expect($(".activity-bars > span").attr("style")).toMatch(/--bar-height:\s*100%/);
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

test("the public profile loading route uses skeleton cards and the shared collection label", () => {
  const $ = load(renderToStaticMarkup(createElement(ProfileLoading)));

  expect($("[role='status']").attr("aria-busy")).toBe("true");
  expect($(".visually-hidden").text()).toContain("Loading shared product collection…");
  expect($(".usage-chart-log").text()).toBe("PROFILE · LOADING");
  expect($(".product-card-skeleton")).toHaveLength(3);
  expect($.text()).not.toMatch(/score|rank/i);
});

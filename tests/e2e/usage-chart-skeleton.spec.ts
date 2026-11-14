import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { buildSync } from "esbuild";
import { expect, test } from "@playwright/test";
import type { PublicProfile } from "../../src/domain/public-profile";

const points = Array.from({ length: 30 }, (_, index) => ({
  date: new Date(Date.UTC(2026, 8, 1 + index)).toISOString().slice(0, 10),
  value: Math.round(8 + 20 * Math.abs(Math.sin(index * 1.7)) * ((index % 7 > 4) ? 0.5 : 1)),
}));

const card: PublicProfile["cards"][number] = {
  product: {
    slug: "example-tool",
    name: "Example Tool",
    domain: "example.com",
    description: "A synthetic time-series fixture.",
  },
  status: "ACTIVE",
  headline: "An owner-described relationship.",
  note: "Synthetic retained explanation.",
  activity: {
    kind: "timeSeries",
    label: "Sessions",
    unit: "sessions",
    points,
    attributionScope: "PERSONAL",
    capturedAt: "2026-10-01T09:00:00.000Z",
    freshness: "FRESH",
    provenanceLabel: "Synthetic fixture",
    period: { start: "2026-09-01", end: "2026-09-30" },
  },
};

const QUARTER_DAYS = 90;
const MAX_BARS = 31;
const DAY_MS = 86_400_000;
const QUARTER_START = "2026-07-03";
const NARROWEST_WIDTH = 320;
const PHONE_WIDTH = 390;
const PHONE_WIDTHS = [NARROWEST_WIDTH, PHONE_WIDTH];
const PHONE_HEIGHT = 900;
// A 90-day snapshot, as a connected account can return: more points than a phone-width card has room for at 4px each.
const quarter: PublicProfile["cards"][number] = {
  ...card,
  activity: {
    ...card.activity!,
    kind: "timeSeries", label: "Sessions", unit: "sessions",
    points: Array.from({ length: QUARTER_DAYS }, (_, index) => ({ date: new Date(Date.parse(QUARTER_START) + index * DAY_MS).toISOString().split("T")[0], value: points[index % points.length].value })),
    period: { start: QUARTER_START, end: "2026-09-30" },
  },
};

const bundle = (fixture: PublicProfile["cards"][number]) => buildSync({
  stdin: {
    contents: `import { createElement } from "react";
      import { createRoot } from "react-dom/client";
      import { ProductCard } from "./components/product-card";
      import { ProductCardSkeleton } from "./components/product-card-skeleton";
      const card = ${JSON.stringify(fixture)};
      createRoot(document.getElementById("root")).render(createElement("div", { className: "stack" },
        createElement("p", { className: "before-copy" }, "Previously: Loading your private collection…"),
        createElement(ProductCardSkeleton, { label: "Loading your private collection…", log: "COLLECTION · LOADING", count: 2 }),
        createElement("div", { className: "card-grid" },
          createElement(ProductCard, { card, index: 0, expandedActivity: true }),
        ),
      ));`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  platform: "browser",
  format: "iife",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
});
const compiled = bundle(card);

async function mount(page: import("@playwright/test").Page, theme: "light" | "dark", script = compiled) {
  await page.setContent(`<!doctype html><html lang="en" data-theme="${theme}"><head><title>Usage chart fixture</title></head><body><main><h1>Usage chart fixture</h1><div id="root"></div></main></body></html>`);
  await page.addStyleTag({ content: readFileSync("app/globals.css", "utf8") });
  await page.addScriptTag({ content: script.outputFiles[0].text });
}

for (const theme of ["light", "dark"] as const) {
  test(`blueprint skeleton and resolved time series at 1280px (${theme})`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 1100 });
    await mount(page, theme);

    const status = page.getByRole("status").filter({ hasText: "Loading your private collection…" });
    await expect(status).toHaveCount(1);
    await expect(status).toHaveAttribute("aria-busy", "true");
    await expect(page.locator(".product-card-skeleton")).toHaveCount(2);
    await expect(page.locator(".product-card-skeleton .usage-chart-log")).toHaveText("COLLECTION · LOADING");
    await expect(page.locator(".product-card-skeleton-status")).not.toContainText(/score|rank|rating/i);
    await expect(page.locator("[data-skeleton-bar]").first()).toBeVisible();
    await expect(page.locator(".product-card-skeleton .activity-hero")).toHaveCount(0);
    await expect(page.locator(".product-card-skeleton [data-skeleton-bar][title]")).toHaveCount(0);
    await expect(page.locator(".product-card-skeleton .usage-chart-log")).not.toHaveText(/^(?:0|—|–)$/);

    const card = page.locator(".product-card").first();
    const front = card.locator(".card-front");
    await expect(front.getByRole("img", { name: "Sessions trend" })).toBeVisible();
    await expect(front.locator(".activity-bars > span")).toHaveCount(30);
    // Layout height, so the card's turn-in animation doesn't skew it.
    expect(await front.locator(".usage-chart").evaluate(chart => (chart as HTMLElement).offsetHeight)).toBe(64);
    await expect(front.locator(".usage-chart-log, .blueprint-dim")).toHaveCount(0);
    await card.getByRole("button", { name: "Details", exact: true }).click();
    const back = card.locator(".card-back");
    const bars = back.locator(".activity-bars > span");
    await expect(bars).toHaveCount(30);
    await expect(back.locator(".usage-chart")).toHaveAttribute("data-state", "resolved");
    await expect(back.locator(".usage-chart")).toHaveAttribute("data-ready", "true");
    await expect(card.locator(".activity-meta")).toContainText("Snapshot recorded 2026-10-01");
    await expect(card).not.toContainText(/score|rank|rating/i);

    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`usage-chart-${theme}.png`),
      fullPage: true,
      animations: "disabled",
    });
  });
}

test("reduced motion swaps the blueprint for bars without a grow animation", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mount(page, "dark");

  const card = page.locator(".product-card").first();
  await expect(card.locator(".card-front .activity-bars > span").first()).toHaveCSS("animation-name", "none");
  await card.getByRole("button", { name: "Details", exact: true }).click();
  const chart = card.locator(".card-back .usage-chart");
  await expect(chart).toHaveAttribute("data-ready", "true");
  const bars = card.locator(".card-back .activity-bars > span");
  await expect(bars).toHaveCount(30);
  await expect(bars.first()).toHaveCSS("animation-name", "none");
  await expect(card.locator(".usage-chart-blueprint")).toHaveCount(0);
});

PHONE_WIDTHS.forEach(width => test(`a 90-day series fits a ${width}px card as ${MAX_BARS} bars on both faces`, async ({ page }) => {
  await page.setViewportSize({ width, height: PHONE_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mount(page, "dark", bundle(quarter));
  const card = page.locator(".product-card").first();
  const fits = (face: string) => card.locator(`${face} .activity-bars`).evaluate(chart => ({
    overflow: chart.scrollWidth - chart.clientWidth,
    lastBarPastEdge: Math.max(0, Math.round(chart.lastElementChild!.getBoundingClientRect().right - chart.getBoundingClientRect().right)),
  }));
  await expect(card.locator(".card-front .activity-bars > span")).toHaveCount(MAX_BARS);
  expect(await fits(".card-front")).toEqual({ overflow: 0, lastBarPastEdge: 0 });
  // A screen reader reads the same bars as rows, with the dates and averages the chart keeps in hover titles.
  const rows = card.locator(".card-front").getByRole("table", { name: "Sessions, one row per bar" }).getByRole("row");
  await expect(rows).toHaveCount(MAX_BARS + 1);
  await expect(rows.nth(1).getByRole("cell")).toHaveText(["2026-07-03", "2026-07-04", "18 sessions on average"]);
  await card.getByRole("button", { name: "Details", exact: true }).click();
  await expect(card.locator(".card-back .activity-bars > span")).toHaveCount(MAX_BARS);
  expect(await fits(".card-back")).toEqual({ overflow: 0, lastBarPastEdge: 0 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}));

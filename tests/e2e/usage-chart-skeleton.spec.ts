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

const compiled = buildSync({
  stdin: {
    contents: `import { createElement } from "react";
      import { createRoot } from "react-dom/client";
      import { ProductCard } from "./components/product-card";
      import { ProductCardSkeleton } from "./components/product-card-skeleton";
      const card = ${JSON.stringify(card)};
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

async function mount(page: import("@playwright/test").Page, theme: "light" | "dark") {
  await page.setContent(`<!doctype html><html lang="en" data-theme="${theme}"><head><title>Usage chart fixture</title></head><body><main><h1>Usage chart fixture</h1><div id="root"></div></main></body></html>`);
  await page.addStyleTag({ content: readFileSync("app/globals.css", "utf8") });
  await page.addScriptTag({ content: compiled.outputFiles[0].text });
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

    const card = page.locator(".product-card").first();
    await card.getByRole("button", { name: "Details", exact: true }).click();
    const bars = card.locator(".activity-bars > span");
    await expect(bars).toHaveCount(30);
    await expect(card.locator(".usage-chart")).toHaveAttribute("data-state", "resolved");
    await expect(card.locator(".usage-chart")).toHaveAttribute("data-ready", "true");
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
  await card.getByRole("button", { name: "Details", exact: true }).click();
  const chart = card.locator(".usage-chart");
  await expect(chart).toHaveAttribute("data-ready", "true");
  const bars = card.locator(".activity-bars > span");
  await expect(bars).toHaveCount(30);
  await expect(bars.first()).toHaveCSS("animation-name", "none");
  await expect(card.locator(".usage-chart-blueprint")).toHaveCount(0);
});

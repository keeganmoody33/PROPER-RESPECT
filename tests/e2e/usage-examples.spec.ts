import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const width of [1440, 390, 320]) test(`usage slideshow keeps metrics and caveats distinct at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await expect(carousel.getByRole("button", { name: "Play slideshow" })).toBeVisible();
  await expect(carousel.getByRole("article", { name: "GitHub card" })).toContainText("contributions");
  const calendar = carousel.locator(".card-front .contribution-calendar");
  await expect(calendar.locator("[data-date]")).toHaveCount(365);
  await expect(calendar.locator(".contribution-months span")).toHaveText(["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"]);
  const geometry = await calendar.evaluate(element => {
    const scroll = element.querySelector(".contribution-scroll")!;
    const cells = [...element.querySelectorAll("[data-date]")];
    const first = cells[0].getBoundingClientRect();
    const monday = element.querySelector(".contribution-weekdays span:nth-child(2)")!.getBoundingClientRect();
    const october = element.querySelector('[data-date="2025-10-01"]')!.getBoundingClientRect();
    const octoberLabel = element.querySelector(".contribution-months span:nth-child(2)")!.getBoundingClientRect();
    return { cellWidth: first.width, cellHeight: first.height, mondayY: monday.y, firstY: first.y, octoberX: october.x, labelX: octoberLabel.x, scrollWidth: scroll.scrollWidth, clientWidth: scroll.clientWidth };
  });
  expect(geometry.cellWidth).toBe(10);
  expect(geometry.cellHeight).toBe(10);
  expect(Math.abs(geometry.mondayY - geometry.firstY)).toBeLessThan(1);
  expect(Math.abs(geometry.octoberX - geometry.labelX)).toBeLessThan(1);
  if (width <= 390) {
    expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth);
    const scroll = calendar.getByRole("region", { name: "Contribution calendar; scroll horizontally to see the full period" });
    await scroll.focus();
    await expect(scroll).toBeFocused();
    const initialScrollLeft = await scroll.evaluate(element => element.scrollLeft);
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => scroll.evaluate(element => element.scrollLeft)).toBeGreaterThan(initialScrollLeft);
    expect(await page.evaluate(() => window.scrollX)).toBe(0);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await carousel.screenshot({ path: testInfo.outputPath(`2026-09-21-github-${width}.png`) });
  for (const [name, text, caveat] of [
    ["Clay", "1,200 Distinct rows enriched", "Clay import is not available here yet."],
    ["Wispr Flow", "28.4K Total words dictated", "Total words are cumulative"],
    ["Claude Code", "3.4M Recorded tokens", "Claude Code import is not available here yet."],
  ]) {
    await carousel.getByRole("button", { name, exact: true }).click();
    const card = carousel.getByRole("article", { name: `${name} card` });
    await expect(card).toBeVisible();
    await expect(card).toContainText(text);
    await expect(carousel).toContainText(caveat);
    await expect(carousel).toContainText("Sample data / No account connected");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 1440) expect((await new AxeBuilder({ page }).include('[aria-label="Product usage examples"]').analyze()).violations).toEqual([]);
    await carousel.screenshot({ path: testInfo.outputPath(`2026-09-21-${name.toLowerCase().replaceAll(" ", "-")}-${width}.png`) });
  }
  await expect(carousel).toContainText("Cache read");
  await expect(carousel).toContainText("2.7M");
  await carousel.getByRole("button", { name: "Next example" }).click();
  await expect(carousel.getByRole("article", { name: "GitHub card" })).toBeVisible();
  await carousel.getByRole("button", { name: "Previous example" }).click();
  await expect(carousel.getByRole("article", { name: "Claude Code card" })).toBeVisible();
  await carousel.getByRole("button", { name: "Details", exact: true }).click();
  await expect(carousel.getByRole("button", { name: "Close details" })).toBeVisible();
  await carousel.getByRole("button", { name: "Clay", exact: true }).click();
  await expect(carousel.getByRole("button", { name: "Details", exact: true })).toBeVisible();
});

test("slideshow plays only on request and pauses for keyboard interaction", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await page.clock.fastForward(16000);
  await expect(carousel.getByRole("article", { name: "GitHub card" })).toBeVisible();
  await carousel.getByRole("button", { name: "Play slideshow" }).click();
  await page.clock.fastForward(8100);
  await expect(carousel.getByRole("article", { name: "Clay card" })).toBeVisible();
  await carousel.getByRole("button", { name: "Details", exact: true }).focus();
  await expect(carousel.getByRole("button", { name: "Play slideshow" })).toBeVisible();
  await page.clock.fastForward(16000);
  await expect(carousel.getByRole("article", { name: "Clay card" })).toBeVisible();
});

import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const width of [1440, 390, 320]) test(`usage slideshow keeps metrics and caveats distinct at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await expect(carousel.getByRole("button", { name: "Play slideshow" })).toBeVisible();
  await expect(carousel.getByRole("article", { name: "GitHub card" })).toContainText("65 contributions");
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

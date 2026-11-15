import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** Tab stops from the skip link to the call to action: the slideshow's controls, chooser and shown card come first. */
const MAX_TAB_STOPS_TO_START = 30;
for (const width of [1440, 390, 320]) test(`homepage preserves collection and profile entry at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const brandAssets: string[] = [];
  // The example cards' logos and typefaces come through this site's own routes, so nothing leaves it.
  page.on("request", request => {
    const { hostname, pathname } = new URL(request.url());
    if (!hostname.match(/^(127\.0\.0\.1|localhost)$/)) external.push(request.url());
    else if (pathname.startsWith("/api/brand-")) brandAssets.push(pathname);
  });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const fontFaces = await page.evaluate(() => ["h1", ".site-navigation"].map(selector => {
    const element = document.querySelector(selector)!;
    const family = getComputedStyle(element).fontFamily.split(",")[0].trim().replace(/["']/g, "");
    const faces = [...document.fonts].filter(face => face.family.replace(/["']/g, "") === family);
    return { family, statuses: faces.map(face => face.status) };
  }));
  expect(fontFaces[0].family).toMatch(/archivo/i);
  expect(await page.locator("body").evaluate(element => getComputedStyle(element).fontFamily)).toMatch(/archivo/i);
  expect(fontFaces[1].family).toMatch(/mono/i);
  for (const face of fontFaces) expect(face.statuses).toEqual(["loaded"]);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your tools.Your track record.");
  await expect(page.getByRole("img", { name: /Blueprint/ })).toHaveCount(0);
  await expect(page.getByRole("article", { name: "Clay card" })).toBeVisible();
  await expect(page.getByText("Inside a card", { exact: true })).toBeVisible();
  const bump = page.getByRole("img", { name: "Two fists meeting at a bright red diamond" });
  await bump.scrollIntoViewIfNeeded();
  await expect(bump).toBeVisible();
  await expect.poll(() => bump.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.evaluate(() => scrollTo(0, 0));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#page-content")).toBeFocused();
  // The examples come right after the heading, in the page's order as on a phone's screen; the call to action follows them.
  await page.keyboard.press("Tab");
  // A phone's examples row starts at Play; a wider screen's controls start at the arrows.
  await expect(page.getByRole("button", { name: width > 600 ? "Previous example" : "Play slideshow" })).toBeFocused();
  const start = page.getByRole("link", { name: "Start your collection", exact: true }).first();
  for (let stops = 0; stops < MAX_TAB_STOPS_TO_START && !(await start.evaluate(link => link === document.activeElement)); stops++) await page.keyboard.press("Tab");
  await expect(start).toBeFocused();
  await expect(page.getByRole("link", { name: "Start your collection", exact: true }).first()).toHaveAttribute("href", "/app/collection");
  await expect(page.getByRole("link", { name: "View Keegan’s shared collection" })).toHaveAttribute("href", "/lecturesfrom");
  expect(external).toEqual([]);
  expect(brandAssets.some(path => path.startsWith("/api/brand-images/"))).toBe(true);
  expect(errors).toEqual([]);
  if (width === 1440) expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("heading", { level: 1 }).click();
  await page.screenshot({ path: testInfo.outputPath(`2026-09-21-homepage-${width}.png`), fullPage: true });
  await page.getByRole("link", { name: "View Keegan’s shared collection" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Keegan Moody");
  await page.goto("/");
  await page.getByRole("link", { name: "Start your collection", exact: true }).first().click();
  await expect(page).toHaveURL(/\/app\/collection$/);
});


test("existing collection links retain callback query values", async ({ page }) => {
  await page.goto("/onboarding?gmail=connected");
  await expect(page).toHaveURL(/\/app\/collection\?gmail=connected$/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

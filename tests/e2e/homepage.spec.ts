import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** The hero's link to Keegan's page and the closing one. */
const PAGE_LINKS = 2;
/** Tab stops from the skip link to the call to action: the slideshow's controls, chooser and shown card come first. */
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
  expect(fontFaces[1].family).toMatch(/archivo/i);
  for (const face of fontFaces) expect(face.statuses).toEqual(["loaded"]);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Every tool you've used counts.");
  await expect(page.getByRole("img", { name: /Blueprint/ })).toHaveCount(0);
  await expect(page.getByRole("article", { name: "GitHub card" })).toBeVisible();
  // The one line under the heading: beside the card on a wide screen, under it on a phone.
  await expect(page.getByText("Even the ones you stopped. One page for what you run, what you've tested and what you've moved on from, with the usage behind it.", { exact: true })).toBeVisible();
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
  // The way to start comes right after the heading, in the page's order as on a phone's screen; the examples follow it.
  const start = page.getByRole("link", { name: "Start your collection", exact: true }).first();
  await page.keyboard.press("Tab");
  await expect(start).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "See Keegan’s tooling page" }).first()).toBeFocused();
  await page.keyboard.press("Tab");
  // A phone's examples row starts at Play; a wider screen's controls start at the arrows.
  await expect(page.getByRole("button", { name: width > 600 ? "Previous example" : "Play slideshow" })).toBeFocused();
  await expect(page.getByRole("link", { name: "Start your collection", exact: true }).first()).toHaveAttribute("href", "/app/collection");
  // Both links to Keegan's public page call it a page, never a collection.
  await expect(page.getByRole("link", { name: "See Keegan’s tooling page" })).toHaveCount(PAGE_LINKS);
  expect(await page.getByRole("link", { name: "collection" }).evaluateAll(links => links.map(link => link.getAttribute("href")).filter(href => href !== "/app/collection"))).toEqual([]);
  await expect(page.getByRole("link", { name: "See Keegan’s tooling page" }).first()).toHaveAttribute("href", "/lecturesfrom");
  expect(external).toEqual([]);
  expect(brandAssets.some(path => path.startsWith("/api/brand-images/"))).toBe(true);
  expect(errors).toEqual([]);
  if (width === 1440) expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("heading", { level: 1 }).click();
  await page.screenshot({ path: testInfo.outputPath(`2026-09-21-homepage-${width}.png`), fullPage: true });
  await page.getByRole("link", { name: "See Keegan’s tooling page" }).first().click();
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

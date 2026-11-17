import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Fixture mode: the reference page plus two invented people, Synthetic Sam and Synthetic Ria, with no backend.
const PHONE = { width: 390, height: 844 };
const NARROW = { width: 320, height: 720 };
const WIDE = { width: 1440, height: 900 };
const SCREENSHOT_WIDE = { width: 1280, height: 900 };

const NOT_FOUND = 404;
const atPath = (path: string) => (url: URL) => url.pathname + url.search === path;
const fitsWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

[WIDE, PHONE].forEach(size => test(`search finds a person and a tool at ${size.width}px, by keyboard, with no sideways scroll`, async ({ page }) => {
  await page.setViewportSize(size);
  await page.goto("/search");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Search people and tools");
  await expect(page.getByRole("tab", { name: "People" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel").getByRole("link")).toHaveText(["Keegan Moody@lecturesfrom", "Synthetic Ria@synthetic-ria", "Synthetic Sam@synthetic-sam"]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole("searchbox", { name: "Name, handle or tool" }).fill("sam");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(atPath("/search?q=sam"));
  await expect(page.getByRole("tabpanel").getByRole("link")).toHaveText(["Synthetic Sam@synthetic-sam"]);

  await page.getByRole("searchbox", { name: "Name, handle or tool" }).fill("clay");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(atPath("/search?q=clay"));
  await page.getByRole("tab", { name: "People" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Tools" })).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(atPath("/search?q=clay&tab=tools"));
  await expect(page.getByRole("tabpanel").getByRole("link")).toHaveText(["Clay1 person uses it now · 1 person used it before"]);
  expect(await fitsWidth(page)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
}));

test("search holds at 320px and in dark mode", async ({ page }) => {
  await page.setViewportSize(NARROW);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/search?q=clay&tab=tools");
  await expect(page.getByRole("tab", { name: "Tools" })).toHaveAttribute("aria-selected", "true");
  expect(await fitsWidth(page)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("a tool page shows who uses it now and who used it before, each opening their page", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto("/tools/clay");
  expect(await page.title()).toContain("Clay: who uses it");
  const now = page.getByRole("region", { name: "Uses it now" });
  const before = page.getByRole("region", { name: "Used before" });
  await expect(now.getByRole("link")).toHaveText(["Synthetic Sam@synthetic-sam · Daily"]);
  await expect(before.getByRole("link")).toHaveText(["Synthetic Ria@synthetic-ria · Stopped using"]);
  expect(await fitsWidth(page)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await before.getByRole("link").first().click();
  await expect(page).toHaveURL(atPath("/synthetic-ria"));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Synthetic Ria");
  expect((await page.goto("/tools/no-such-tool"))?.status()).toBe(NOT_FOUND);
});

test("a card's tool name on a listed page opens its tool page, and the homepage points at search", async ({ page }) => {
  await page.goto("/lecturesfrom");
  await page.locator(".card-front .card-tool-link", { hasText: "Wispr Flow" }).click();
  await expect(page).toHaveURL(atPath("/tools/wisprflow"));
  await expect(page.getByRole("region", { name: "Uses it now" }).getByRole("link")).toHaveText(["Keegan Moody@lecturesfrom · Using"]);
  await page.goto("/");
  await page.getByRole("region", { name: "See what other people run." }).getByRole("link", { name: "Search people and tools" }).click();
  await expect(page).toHaveURL(atPath("/search"));
});

test("sample cards on the homepage and an unlisted page never link to a tool page", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".card-tool-link")).toHaveCount(0);
  await page.goto("/keegan");
  await expect(page.locator(".product-card").first()).toBeVisible();
  await expect(page.locator(".card-tool-link")).toHaveCount(0);
});

test("screenshots of search and a tool page, light, at 1280 and 390", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "light" });
  const shots = [SCREENSHOT_WIDE, PHONE].flatMap(size => [["search", "/search?q=clay&tab=tools", size], ["search-people", "/search", size], ["tool-clay", "/tools/clay", size]] as const);
  await shots.reduce<Promise<void>>(async (done, [name, path, size]) => {
    await done;
    await page.setViewportSize(size);
    await page.goto(path);
    await page.screenshot({ path: testInfo.outputPath(`${name}-${size.width}.png`), fullPage: true });
  }, Promise.resolve());
});

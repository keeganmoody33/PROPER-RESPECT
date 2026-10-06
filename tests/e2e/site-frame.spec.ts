import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

for (const width of [1440, 460, 390, 320]) test(`Origins and branded footer remain usable at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await expect(navigation.getByRole("link", { name: "Origins", exact: true })).toBeVisible();
  const footer = page.locator(".site-footer");
  await expect(footer.getByRole("link", { name: "Proper Respect home" })).toBeVisible();
  await expect(footer.locator("img")).toHaveAttribute("src", /PR-mark-black/);
  await expect(footer.getByRole("heading")).toHaveText(["Product", "Company", "Resources"]);
  await expect(footer.getByRole("link", { name: "Terms", exact: true })).toHaveAttribute("href", "/about/terms");
  await expect(footer.getByRole("link", { name: "How evidence works", exact: true })).toHaveAttribute("href", "/about/methodology");
  await expect(footer.getByRole("link", { name: /Help|Social/ })).toHaveCount(0);
  await expect(footer.locator(".site-footer-placeholder")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await navigation.getByRole("link", { name: "Origins", exact: true }).click();
  await expect(page).toHaveURL(/\/about\/origins$/);
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText("Giving credit its context");
  await expect(heading).toHaveAccessibleName("Giving credit its context");
  await expect(page.getByRole("heading", { name: "What it means here" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The language we borrow" })).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://public.example/about/origins");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Origins nesting preserves existing public handle routes", async ({ page, request }) => {
  for (const handle of ["about", "origins"]) {
    const response = await page.goto(`/${handle}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Existing ${handle} owner`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://public.example/${handle}`);
  }
  const sitemap = await request.get("/sitemap.xml");
  expect(await sitemap.text()).toContain("/about/origins");
});

const TALLY = {
  since: "2026-10-06T12:00:00.000Z",
  presumedHuman: 1200,
  automated: 335,
  unidentified: 5,
  byCategory: {
    presumed_human: 1200,
    search_engine_crawler: 120,
    ai_training_crawler: 90,
    ai_search_indexer: 40,
    ai_assistant_fetch: 30,
    seo_crawler: 20,
    link_preview: 15,
    monitoring: 10,
    unattributed_automation: 10,
    undeclared: 5,
  },
};

for (const width of [1440, 320]) test(`Footer tally opens its breakdown inline at ${width}px`, async ({ page }) => {
  await page.route("**/api/tally", route => route.fulfill({ json: TALLY }));
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/");
  const tally = page.locator(".site-footer .site-tally");
  await expect(tally.getByText("Requests served since Oct 6, 2026")).toBeVisible();
  const humans = tally.getByRole("button", { name: "Presumed human", exact: true });
  const bots = tally.getByRole("button", { name: "Automated", exact: true });
  const unidentified = tally.getByRole("button", { name: "Unidentified", exact: true });
  await expect(humans).toHaveAttribute("aria-pressed", "true");
  const count = tally.locator(".site-tally-count");
  await expect(count).toHaveAccessibleName("Presumed human requests 1,200 Breakdown");
  await count.click();
  await expect(count).toHaveAttribute("aria-expanded", "true");
  const panel = tally.locator(".site-tally-panel");
  await expect(panel.getByRole("list", { name: "Requests by type" }).getByRole("button")).toHaveCount(10);
  await expect(panel.getByText("proper-respect.com has served 1,540 page requests since Oct 6, 2026")).toBeVisible();
  await bots.click();
  await expect(bots).toHaveAttribute("aria-pressed", "true");
  await expect(count).toHaveAccessibleName("Automated requests 335 Close");
  await unidentified.click();
  await expect(unidentified).toHaveAttribute("aria-pressed", "true");
  await expect(count).toHaveAccessibleName("Unidentified requests 5 Close");
  await expect(panel.locator(".site-tally-detail p").first()).toHaveText(/Unidentified\. Sent no identification at all\./);
  await panel.getByRole("button", { name: /Link preview/ }).focus();
  await expect(panel.locator(".site-tally-detail p").first()).toHaveText(/Link preview\. Identifies itself as a link-preview client/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const since of [null, "invalid-date"]) test(`Footer tally does not invent a start date for ${since}`, async ({ page }) => {
  await page.route("**/api/tally", route => route.fulfill({ json: { ...TALLY, since } }));
  await page.goto("/");
  const tally = page.locator(".site-footer .site-tally");
  await expect(tally.getByText("Requests served", { exact: true })).toBeVisible();
  await expect(tally.getByText(/since launch/)).toHaveCount(0);
});

for (const width of [1440, 320]) for (const theme of ["light", "dark"]) test(`Footer tally keyboard focus and theme at ${width}px ${theme}`, async ({ page }) => {
  await page.route("**/api/tally", route => route.fulfill({ json: TALLY }));
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/");
  await page.getByRole("combobox", { name: "Appearance" }).first().selectOption(theme);
  const tally = page.locator(".site-footer .site-tally");
  const count = tally.locator(".site-tally-count");
  await count.click();
  const unidentified = tally.getByRole("button", { name: "Unidentified", exact: true });
  await unidentified.focus();
  await page.keyboard.press("Enter");
  await expect(count).toHaveAccessibleName("Unidentified requests 5 Close");
  expect(await unidentified.evaluate(button => getComputedStyle(button).outlineWidth)).toBe("3px");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const date = new Date().toISOString().slice(0, 10);
  const directory = `docs/verification/${date}-request-tally-assets`;
  await mkdir(directory, { recursive: true });
  await tally.screenshot({ path: `${directory}/footer-${width}-${theme}.png` });
});

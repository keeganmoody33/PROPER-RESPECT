import { expect, test } from "@playwright/test";

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
  automated: 340,
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
  await expect(tally.getByText("Requests served since Oct 6")).toBeVisible();
  const humans = tally.getByRole("button", { name: "Humans", exact: true });
  const bots = tally.getByRole("button", { name: "Not humans", exact: true });
  await expect(humans).toHaveAttribute("aria-pressed", "true");
  const count = tally.locator(".site-tally-count");
  await expect(count).toHaveAccessibleName("Presumed human requests 1,200 Breakdown");
  await count.click();
  await expect(count).toHaveAttribute("aria-expanded", "true");
  const panel = tally.locator(".site-tally-panel");
  await expect(panel.getByRole("list", { name: "Requests by type" }).getByRole("button")).toHaveCount(10);
  await expect(panel.getByText("proper-respect.com has served 1,540 page requests since Oct 6")).toBeVisible();
  await bots.click();
  await expect(bots).toHaveAttribute("aria-pressed", "true");
  await expect(count).toHaveAccessibleName("Automated requests 340 Close");
  await panel.getByRole("button", { name: /Link preview/ }).focus();
  await expect(panel.getByText("Spec id: link_preview")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

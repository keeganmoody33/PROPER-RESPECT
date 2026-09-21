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
  await expect(footer.getByRole("link", { name: /Help|Contact|Privacy|Terms|Social/ })).toHaveCount(0);
  await expect(footer.locator(".site-footer-placeholder")).toHaveCount(5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await navigation.getByRole("link", { name: "Origins", exact: true }).click();
  await expect(page).toHaveURL(/\/about\/origins$/);
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText("Where it comes from.");
  await expect(heading).toHaveAccessibleName("Where it comes from.");
  await expect(page.getByText("The story behind Proper Respect belongs here. Coming soon.")).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
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
  expect(await sitemap.text()).not.toContain("/about/origins");
});

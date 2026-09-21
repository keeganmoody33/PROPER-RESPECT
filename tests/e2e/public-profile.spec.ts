import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("visitor sees the approved public reference projection", async ({
  page,
}) => {
  await page.goto("/keegan");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Keegan Moody",
    }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "GitHub" })).toBeVisible();
  await expect(page.getByText("Keegan Moody")).toBeVisible();
  await expect(page.getByText("Draft source record")).toHaveCount(0);
  await expect(page.getByText("Private source record")).toHaveCount(0);

  const trigger = page.getByRole("button", { name: "Details" }).first();
  await trigger.click();
  await expect(page.getByText("2026-07-20 to 2026-07-26", { exact: true })).toBeVisible();
  await expect(page.getByText(/Estimated cost:.*12\.34.*as of 2026-07-26/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "See Keegan on GitHub ↗", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close details" }).click();
  await expect(trigger).toBeFocused();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test("unknown handles receive a privacy-safe not-found state", async ({
  page,
}) => {
  const response = await page.goto("/no-such-linker");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Nothing is published here." }),
  ).toBeVisible();
  await expect(page.getByText(/source record/i)).toHaveCount(0);
});

for (const handle of ["collection", "app"]) test(`existing /${handle} public profiles remain reachable`, async ({ page }, testInfo) => {
  const response = await page.goto(`/${handle}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: `Existing ${handle} owner` })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://public.example/${handle}`);
  await expect(page.getByRole("link", { name: "Open your private collection →" })).toHaveAttribute("href", "/app/collection");
  await page.screenshot({ path: testInfo.outputPath(`2026-09-21-legacy-${handle}-profile.png`), fullPage: true });
});

test("private collection has a separate noindex route", async ({ page }, testInfo) => {
  const response = await page.goto("/app/collection");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Authentication is ready to configure." })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByText("Synthetic published profile for route compatibility checks.")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("2026-09-21-private-collection.png"), fullPage: true });
});

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("visitor sees the approved public reference projection", async ({
  page,
}) => {
  await page.goto("/keegan");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "The stack, with receipts.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "GitHub" })).toBeVisible();
  await expect(page.getByText("Keegan Moody")).toBeVisible();
  await expect(page.getByText("Draft source record")).toHaveCount(0);
  await expect(page.getByText("Private source record")).toHaveCount(0);

  const trigger = page.getByRole("button", { name: "Details" }).first();
  await trigger.click();
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
  await page.goto("/no-such-linker");
  await expect(
    page.getByRole("heading", { name: "Nothing is published here." }),
  ).toBeVisible();
  await expect(page.getByText(/source record/i)).toHaveCount(0);
});

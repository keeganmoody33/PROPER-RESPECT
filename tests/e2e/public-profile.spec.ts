import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("visitor sees the seeded profile through the live Convex seam", async ({
  page,
}) => {
  await page.goto("/keegan");

  await expect(
    page.getByRole("heading", { level: 1, name: "Keegan Moody" }),
  ).toBeVisible();
  const canonicalProducts = [
    { name: "GitHub", mark: "GH" },
    { name: "Wispr Flow", mark: "WF" },
    { name: "NotebookLM", mark: "NL" },
    { name: "Devin Desktop", mark: "DD" },
  ];
  for (const product of canonicalProducts) {
    await expect(
      page.getByRole("heading", { level: 3, name: product.name }),
    ).toBeVisible();
    const card = page.locator(".product-card").filter({
      has: page.getByRole("heading", { level: 3, name: product.name }),
    });
    await expect(card.locator(".product-mark")).toHaveText(product.mark);
  }
  const indexes = await page.locator(".card-index").allTextContents();
  expect(new Set(indexes).size).toBe(indexes.length);
  await expect(page.getByText("Draft source record")).toHaveCount(0);
  await expect(page.getByText("Private source record")).toHaveCount(0);

  const trigger = page
    .getByRole("button", { name: "Read the card back" })
    .first();
  await trigger.click();
  await expect(
    page.getByRole("link", { name: /See Keegan on GitHub/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close card back" }).click();
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

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

test("canonical card labels stay within their cards at responsive widths", async ({
  page,
}) => {
  for (const viewport of [
    { width: 1101, height: 900 },
    { width: 320, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/keegan");

    for (const card of await page.locator(".product-card").all()) {
      const contentFits = await card.evaluate((element) => {
        const cardRect = element.getBoundingClientRect();
        const copy = element.querySelector<HTMLElement>(".card-copy");
        const heading = element.querySelector<HTMLElement>("h3");
        const status = element.querySelector<HTMLElement>(".status-row");

        return (
          copy !== null &&
          heading !== null &&
          status !== null &&
          copy.scrollWidth <= copy.clientWidth &&
          heading.scrollWidth <= heading.clientWidth &&
          status.scrollWidth <= status.clientWidth &&
          heading.getBoundingClientRect().right <= cardRect.right &&
          status.getBoundingClientRect().right <= cardRect.right
        );
      });

      expect(contentFits).toBe(true);
    }
  }
});

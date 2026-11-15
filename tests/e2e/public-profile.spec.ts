import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("a legacy public URL redirects to the canonical profile and metadata", async ({ page }) => {
  await page.goto("/legacy-profile-url");
  await expect(page).toHaveURL(/\/lecturesfrom$/);
  await expect(page.getByRole("heading", { level: 1, name: "Keegan Moody" })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://public.example/lecturesfrom");
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", "https://public.example/lecturesfrom");
});

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
  // The headline is the week the calendar draws: its seven days add up to 22.
  const githubFront = page.locator(".product-card", { has: page.getByRole("heading", { name: "GitHub" }) }).locator(".card-front");
  await expect(githubFront.locator(".card-activity-preview > p").first()).toHaveText("22 contributions");
  await expect(githubFront.locator(".card-activity-reported")).toHaveCount(0);
  // Stored as fresh on 26 Jul 2026, and more than 30 days old now, so it says when it was last updated.
  await expect(githubFront.locator(".card-activity-coverage")).toHaveText("20–26 Jul 2026 · last updated 26 Jul 2026");

  const trigger = page.getByRole("button", { name: "Details" }).first();
  await trigger.click();
  // The back says the cost and dates in plain words; the exact period is folded under How this was measured.
  await expect(page.getByText(/Estimated cost:.*12\.34.*as of 26 Jul 2026/)).toBeVisible();
  const back = page.locator('.card-back:not([hidden])');
  await back.getByRole("button", { name: "How this was measured" }).click();
  // Exact to the day: plain dates, with the stored value in each <time datetime>.
  await expect(back.getByText("20 Jul 2026 to 26 Jul 2026", { exact: true })).toBeVisible();
  await expect(back.locator(".activity-meta time[datetime='2026-07-20']")).toHaveText("20 Jul 2026");
  await expect(
    page.getByRole("link", { name: "See Keegan on GitHub ↗", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close details" }).click();
  await expect(trigger).toBeFocused();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

const DESKTOP_WIDTH = 1280;
const PHONE_WIDTH = 390;
const VIEWPORT_HEIGHT = 1000;
[DESKTOP_WIDTH, PHONE_WIDTH].forEach(width => test(`a visitor sees what each product does for its owner at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/keegan");
  const github = page.locator(".product-card", { has: page.getByRole("heading", { name: "GitHub" }) });
  await expect(github.getByText("I use it to", { exact: true })).toBeVisible();
  await expect(github.getByRole("list", { name: "What I use it for" }).getByRole("listitem"))
    .toHaveText(["host my code and its history", "review and merge pull requests"]);
  await expect(page.getByRole("list", { name: "What I use it for" })).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath(`2026-11-13-published-uses-${width}-light.png`), fullPage: true, animations: "disabled" });
}));

const MIN_TARGET_PX = 44;
const MIN_TEXT_PX = 12;
[DESKTOP_WIDTH, PHONE_WIDTH].forEach(width => test(`a visitor sees who put the owner on a product, and can report the credit, at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/keegan");
  const github = page.locator(".product-card", { has: page.getByRole("heading", { name: "GitHub" }) });
  const credit = github.locator(".card-front .card-credit");
  await expect(credit.locator(".card-credit-line")).toHaveText("Props to @lecturesfrom · Proper Respect");
  await expect(credit.getByRole("link", { name: "@lecturesfrom", exact: true })).toHaveAttribute("href", "https://proper-respect.com/lecturesfrom");
  await expect(credit.getByRole("link", { name: "Not you? Report", exact: true })).toHaveAttribute(
    "href", "mailto:33@lecturesfrom.com?subject=Report%20credit%20on%20proper-respect.com%2Fkeegan%20%C2%B7%20GitHub",
  );
  if (width === PHONE_WIDTH) {
    const heights = await credit.getByRole("link").evaluateAll(links => links.map(link => link.getBoundingClientRect().height));
    expect(heights.map(height => height >= MIN_TARGET_PX)).toEqual([true, true]);
  }
  const fontSizes = await credit.locator(".card-credit-line, .card-credit-report").evaluateAll(nodes => nodes.map(node => parseFloat(getComputedStyle(node).fontSize)));
  expect(fontSizes.every(size => size >= MIN_TEXT_PX)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await github.screenshot({ path: testInfo.outputPath(`2026-11-15-published-credit-${width}-light.png`), animations: "disabled" });
}));

test("a public profile links to a report address for that page", async ({ page }) => {
  await page.goto("/keegan");
  await expect(page.getByRole("link", { name: "Report this page" })).toHaveAttribute(
    "href", "mailto:33@lecturesfrom.com?subject=Report%20proper-respect.com%2Fkeegan",
  );
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

test(`at ${PHONE_WIDTH}px a calendar that fits its card says nothing about scrolling`, async ({ page }) => {
  await page.setViewportSize({ width: PHONE_WIDTH, height: VIEWPORT_HEIGHT });
  await page.goto("/keegan");
  const calendar = page.locator(".product-card", { has: page.getByRole("heading", { name: "GitHub" }) }).locator(".card-front .contribution-calendar");
  await expect(calendar.locator(".contribution-grid")).toBeVisible();
  // The fixture's one week fits the card, so there is nothing earlier to scroll to.
  expect(await calendar.locator(".contribution-scroll").evaluate(scroll => scroll.scrollWidth > scroll.clientWidth)).toBe(false);
  await expect(calendar.getByText("Scroll for earlier months")).toBeHidden();
  // Nor does a screen reader or the Tab key hear that it scrolls.
  const region = calendar.getByRole("region", { name: "Contribution calendar", exact: true });
  await expect(region).toBeVisible();
  await expect(region).not.toHaveAttribute("tabindex");
});

/** How far turning a card in view may move the page or the card: its back may run longer below, never shift what is read. */
const MAX_TURN_SHIFT_PX = 20;
/** Where the card's top sits on the screen when Details is pressed: at the top, mid-screen, and low with its foot below. */
const CARD_TOPS_PX = [10, 300, 600];
for (const width of [DESKTOP_WIDTH, PHONE_WIDTH]) test(`at ${width}px turning a real card in view moves neither the page nor the card more than ${MAX_TURN_SHIFT_PX}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/keegan");
  for (const name of ["GitHub", "Wispr Flow"]) for (const top of CARD_TOPS_PX) {
    const card = page.getByRole("article", { name: `${name} card` });
    await card.evaluate((article, offset) => scrollBy(0, article.getBoundingClientRect().top - offset), top);
    const before = await card.evaluate(article => ({ scroll: scrollY, top: article.getBoundingClientRect().top,
      detailsBelow: article.querySelector(".card-front .card-button")!.getBoundingClientRect().bottom > innerHeight }));
    // A position where Details is off the screen can't be pressed without scrolling first.
    if (before.top < 0 || before.detailsBelow) continue;
    await card.getByRole("button", { name: "Details", exact: true }).click();
    await expect(card.getByRole("button", { name: "Close details" })).toBeVisible();
    const after = await card.evaluate(article => ({ scroll: scrollY, top: article.getBoundingClientRect().top }));
    expect(Math.abs(after.scroll - before.scroll), `${name} at ${top}px`).toBeLessThanOrEqual(MAX_TURN_SHIFT_PX);
    expect(Math.abs(after.top - before.top), `${name} at ${top}px`).toBeLessThanOrEqual(MAX_TURN_SHIFT_PX);
    await card.getByRole("button", { name: "Close details" }).click();
  }
});

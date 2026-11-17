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
  // The homepage's canonical link leaves with the homepage: a page never keeps two.
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://public.example/about/origins");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

const TAP_TARGET = 44;
const TEXT_CONTRAST = 4.5;
const MARKER_CONTRAST = 3;

// Same-page anchors leave the phone header; the footer still links them.
for (const width of [390, 320]) test(`every header link reads in full and is tappable at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  const links = navigation.getByRole("link");
  await expect(links).toHaveText(["Origins", "Sign in", "Your collection"]);
  const frame = (await navigation.boundingBox())!;
  let widest = { name: "", width: 0 };
  for (const link of await links.all()) {
    const box = (await link.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(frame.x - 0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(frame.x + frame.width + 0.5);
    expect(box.height).toBeGreaterThanOrEqual(TAP_TARGET);
    expect(await link.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    if (box.width > widest.width) widest = { name: (await link.textContent())!, width: Math.round(box.width) };
  }
  expect(await navigation.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect((await page.locator(".site-header").getByRole("combobox", { name: "Appearance" }).boundingBox())!.height).toBeGreaterThanOrEqual(TAP_TARGET);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const footer = page.getByRole("navigation", { name: "Footer navigation" });
  await expect(footer.getByRole("link", { name: "How it works", exact: true })).toHaveAttribute("href", "/#how-it-works");
  await expect(footer.getByRole("link", { name: "Usage examples", exact: true })).toHaveAttribute("href", "/#example");
  testInfo.annotations.push({ type: "widest header link", description: `${widest.name} ${widest.width}px of ${Math.round(frame.width)}px` });
});

test("wide screens keep the same-page header anchors", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link")).toHaveText(["How it works", "Example", "Origins", "Sign in", "Your collection"]);
});

/** WCAG relative luminance contrast between two computed "rgb(r, g, b)" colours. */
function contrast(first: string, second: string) {
  const luminance = (color: string) => {
    const [r, g, b] = color.slice(color.indexOf("(") + 1, color.indexOf(")")).split(",").slice(0, 3).map(part => Number(part) / 255)
      .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

for (const width of [1440, 390]) for (const theme of ["light", "dark"]) test(`About rail marks the current page legibly at ${width}px in ${theme}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/");
  await page.getByRole("combobox", { name: "Appearance" }).first().selectOption(theme);
  await page.goto("/about/privacy");
  const current = page.getByRole("navigation", { name: "About Proper Respect" }).locator('a[aria-current="page"]');
  await expect(current).toHaveText("Privacy");
  const colors = await current.evaluate((element, side) => {
    const style = getComputedStyle(element);
    // The first opaque surface behind the link: its own fill, or the page it sits on.
    let surface: Element = element;
    while (surface.parentElement && getComputedStyle(surface).backgroundColor === "rgba(0, 0, 0, 0)") surface = surface.parentElement;
    return { text: style.color, background: getComputedStyle(surface).backgroundColor, marker: style.getPropertyValue(`border-${side}-color`) };
  }, width > 800 ? "left" : "bottom");
  const text = contrast(colors.text, colors.background);
  const marker = contrast(colors.marker, colors.background);
  expect(text).toBeGreaterThanOrEqual(TEXT_CONTRAST);
  expect(marker).toBeGreaterThanOrEqual(MARKER_CONTRAST);
  testInfo.annotations.push({ type: "about rail contrast", description: `text ${text.toFixed(2)}:1, marker ${marker.toFixed(2)}:1` });
});

const QUICK_VISITS = 3;

test("a visitor who leaves the homepage at once lands on a page with one canonical link", async ({ page }) => {
  for (let visit = 0; visit < QUICK_VISITS; visit++) {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Origins", exact: true }).click();
    await expect(page).toHaveURL(/\/about\/origins$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Giving credit its context");
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://public.example/about/origins");
  }
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

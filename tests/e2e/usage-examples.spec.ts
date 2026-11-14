import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const width of [1440, 390, 320]) test(`usage slideshow keeps metrics and caveats distinct at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await expect(carousel.getByRole("button", { name: "Play slideshow" })).toBeVisible();
  await expect(carousel.getByRole("article", { name: "GitHub card" })).toContainText("contributions");
  const calendar = carousel.locator(".card-front .contribution-calendar");
  await expect(calendar.locator("[data-date]")).toHaveCount(365);
  await expect(calendar.locator(".contribution-months span")).toHaveText(["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"]);
  const geometry = await calendar.evaluate(element => {
    const scroll = element.querySelector(".contribution-scroll")!;
    const cells = [...element.querySelectorAll("[data-date]")];
    const first = cells[0].getBoundingClientRect();
    const monday = element.querySelector(".contribution-weekdays span:nth-child(2)")!.getBoundingClientRect();
    const october = element.querySelector('[data-date="2025-10-01"]')!.getBoundingClientRect();
    const octoberLabel = element.querySelector(".contribution-months span:nth-child(2)")!.getBoundingClientRect();
    return { cellWidth: first.width, cellHeight: first.height, mondayY: monday.y, firstY: first.y, octoberX: october.x, labelX: octoberLabel.x, scrollWidth: scroll.scrollWidth, clientWidth: scroll.clientWidth };
  });
  expect(geometry.cellWidth).toBe(10);
  expect(geometry.cellHeight).toBe(10);
  expect(Math.abs(geometry.mondayY - geometry.firstY)).toBeLessThan(1);
  expect(Math.abs(geometry.octoberX - geometry.labelX)).toBeLessThan(1);
  if (width <= 390) {
    expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth);
    const scroll = calendar.getByRole("region", { name: "Contribution calendar; scroll horizontally to see the full period" });
    await scroll.focus();
    await expect(scroll).toBeFocused();
    const initialScrollLeft = await scroll.evaluate(element => element.scrollLeft);
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => scroll.evaluate(element => element.scrollLeft)).toBeGreaterThan(initialScrollLeft);
    expect(await page.evaluate(() => window.scrollX)).toBe(0);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (width === 1440) expect((await new AxeBuilder({ page }).include('[aria-label="Product usage examples"]').analyze()).violations).toEqual([]);
  await expect(carousel.locator("[data-current=true] [data-capability]")).toHaveText("A year of contributions");
  await carousel.screenshot({ path: testInfo.outputPath(`2026-09-21-github-${width}.png`) });
  const slideBox = () => carousel.locator("[aria-roledescription=slide]").first().evaluate(element => element.parentElement!.getBoundingClientRect().height);
  const githubHeight = await slideBox();
  // The top line and button are typed as written; each card's measured site, or the house default, sets their case.
  for (const [name, text, labelCase, buttonCase, capability] of [
    ["Claude Code", "Daily · since 2025", "uppercase", "uppercase", "Coding days"],
    ["Firecrawl", "Weekly · since 2025", "none", "none", "Referral link, disclosed"],
    ["Exa", "Weekly · since 2025", "none", "none", "A demo link on the back"],
    ["Cloudflare", "Daily · since 2020", "uppercase", "none", "Go-to, with what it costs"],
    ["Porkbun", "Occasionally · since 2021", "uppercase", "uppercase", "Running totals"],
    ["Spider", "Occasionally · since 2026", "uppercase", "uppercase", "Affiliate link, disclosed"],
    ["Docker", "Weekly · since 2020", "none", "none", "A list of linked work"],
    ["Open Places", "Occasionally · since 2026", "none", "none", "Used now and then"],
    ["Grok Bot", "Testing · since 2026", "uppercase", "uppercase", "Still testing"],
    ["Elicit", "Stopped using · started 2026", "uppercase", "none", "Stopped using, and why"],
    ["Context.dev", "Testing · since 2026", "none", "none", "Testing, week by week"],
    ["n8n", "Paused · started 2024", "uppercase", "uppercase", "Paused, and why"],
    ["Clay", "Daily · since 2023", "none", "none", "Published usage numbers"],
  ]) {
    const toggle = carousel.getByRole("button", { name, exact: true });
    // The chooser says what each example shows, as the toggle's description, so its name stays the product's.
    await expect(toggle).toHaveAccessibleDescription(capability);
    await toggle.click();
    await expect(carousel.locator("[data-current=true] [data-capability]")).toHaveText(capability);
    const card = carousel.getByRole("article", { name: `${name} card` });
    await expect(card).toBeVisible();
    await expect(card).toContainText(text);
    await expect(card.locator(".card-title .eyebrow")).toHaveCSS("text-transform", labelCase);
    await expect(card.locator(".card-button")).toHaveCSS("text-transform", buttonCase);
    await expect(card).not.toContainText("contributions");
    await expect(carousel.locator("[data-current=true]")).toContainText("Sample data / No account connected");
    expect(await slideBox()).toBe(githubHeight);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 1440) expect((await new AxeBuilder({ page }).include('[aria-label="Product usage examples"]').analyze()).violations).toEqual([]);
    await carousel.screenshot({ path: testInfo.outputPath(`2026-09-21-${name.toLowerCase().replaceAll(" ", "-")}-${width}.png`) });
    await expect(card.locator(".card-front .card-link-disclosure")).toHaveText(FRONT_DISCLOSURE[name] ?? []);
    const back = BACK_TEXT[name];
    if (!back) continue;
    await card.getByRole("button", { name: "Details", exact: true }).click();
    await expect(card.locator(".card-back .status-row")).not.toContainText(/CANONICAL|AFFILIATE|REFERRAL|INVITE/);
    for (const text of back) await expect(card.locator(".card-back")).toContainText(text);
    if (width === 1440) expect((await new AxeBuilder({ page }).include('[aria-label="Product usage examples"]').analyze()).violations).toEqual([]);
    await card.getByRole("button", { name: "Close details" }).click();
  }
  await carousel.getByRole("button", { name: "Next example" }).click();
  await expect(carousel.getByRole("article", { name: "GitHub card" })).toBeVisible();
  await carousel.getByRole("button", { name: "Previous example" }).click();
  await expect(carousel.getByRole("article", { name: "Clay card" })).toBeVisible();
  await carousel.getByRole("button", { name: "Details", exact: true }).click();
  await expect(carousel.getByRole("button", { name: "Close details" })).toBeVisible();
  await carousel.getByRole("button", { name: "n8n", exact: true }).click();
  await expect(carousel.getByRole("button", { name: "Details", exact: true })).toBeVisible();
});

/** What a card discloses next to its outbound arrow, and what its back shows beyond the front: one capability per example. */
const FRONT_DISCLOSURE: Readonly<Record<string, string>> = { Firecrawl: "Referral link", Spider: "Affiliate link" };
const BACK_TEXT: Readonly<Record<string, readonly string[]>> = {
  Firecrawl: ["Weekly · Referral link", "Open Firecrawl ↗Referral link"],
  Exa: ["Weekly · Direct link", "Demo ↗exa.ai"],
  Cloudflare: ["Owner-selected go-to", "Owner-reported cost: $5.00/month · as of 2026-09-01"],
  Docker: ["Sample Compose apps (awesome-compose) ↗", "Official Postgres image ↗", "Multi-stage build guide ↗"],
  n8n: ["Paused · Direct link", "Paused while my nightly jobs move to plain cron."],
  Clay: ["Daily · Direct link", "Owner-reported cost: $149.00/month · as of 2026-09-01", "Rows enriched2140000", "Tables built86", "Credits used48500", "See how I use it ↗clay.com"],
};

const DESKTOP_WIDTH = 1440;
const PHONE_WIDTH = 390;
const VIEWPORT_HEIGHT = 1000;

// Each brand's own surface colour, from its committed snapshot; the default card is rgb(37, 37, 31) in Arial.
// A weekly sample draws bars in the brand's accent; a total shows metrics.
const BRANDED = [
  { name: "Firecrawl", slug: "firecrawl", background: "rgb(249, 249, 249)", bars: "rgb(255, 76, 0)", logo: "square" },
  { name: "Cloudflare", slug: "cloudflare", background: "rgb(255, 255, 255)", bars: "rgb(255, 94, 31)", logo: "wordmark" },
  { name: "n8n", slug: "n8n", background: "rgb(250, 250, 250)", bars: undefined, logo: "wordmark" },
  { name: "Clay", slug: "clay", background: "rgb(255, 255, 255)", bars: undefined, logo: "app-icon" },
] as const;
const WEEKS = 12;
const CODING_DAYS = 31;
const NARROWEST_WIDTH = 320;

[DESKTOP_WIDTH, PHONE_WIDTH].forEach(width => test(`branded example cards wear their brand, say what they're used for and show a sample chart or metrics at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  for (const brand of BRANDED) {
    await carousel.getByRole("button", { name: brand.name, exact: true }).click();
    const card = carousel.getByRole("article", { name: `${brand.name} card` });
    await expect(card).toBeVisible();
    await expect(card).toHaveCSS("background-color", brand.background);
    const font = await card.locator(".card-headline").evaluate(element => getComputedStyle(element).fontFamily);
    expect(font.replaceAll('"', "").startsWith(`PRBrand-${brand.slug}-`)).toBe(true);
    const logo = card.locator(".product-logo img");
    await expect(logo).toBeVisible();
    await expect.poll(() => logo.evaluate(image => (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
    // A wordmark stands in for the visible name; either way the heading still names the product. Clay's reviewed app icon outranks its stored brand.
    await expect(card.getByRole("heading", { level: 2, name: brand.name, exact: true })).toHaveCount(1);
    const slot = { square: ".card-topline > .product-logo:not([data-logo-layout])", "app-icon": ".card-topline > .product-logo[data-logo-layout=app-icon]", wordmark: ".card-title .product-logo[data-logo-layout=wordmark]" };
    await expect(card.locator(slot[brand.logo])).toBeVisible();
    await expect(card.getByText("I use it to")).toBeVisible();
    expect(await card.getByRole("list", { name: "What I use it for" }).getByRole("listitem").count()).toBeGreaterThanOrEqual(2);
    if (brand.bars) {
      const bars = card.locator(".card-front .activity-bars > span");
      await expect(bars).toHaveCount(WEEKS);
      await expect(bars.last()).toHaveCSS("background-color", brand.bars);
      await expect(card.locator(".card-front .activity-bars")).toHaveAttribute("role", "img");
    } else if (brand.name === "Clay") {
      // Clay publishes exact numbers instead: the first on the front, the rest behind Details.
      await expect(card.locator(".card-front .usage-measurement-measurement")).toHaveCount(1);
      await expect(card.locator(".card-front")).toContainText("2 more reported measurements in Details.");
      await expect(card.locator(".card-front")).toContainText("Synthetic sample. Not real account activity.");
      continue;
    } else {
      await expect(card.locator(".card-front .activity-preview-metrics")).toBeVisible();
    }
    await expect(card).toContainText("stale");
  }
}));

[DESKTOP_WIDTH, PHONE_WIDTH].forEach(width => test(`every example card closes up around its content at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  const stage = carousel.locator("[aria-roledescription=slide]").first().locator("..");
  const stageHeight = (await stage.boundingBox())!.height;
  for (const name of ["GitHub", "Claude Code", "Firecrawl", "Grok Bot", "Clay"]) {
    await carousel.getByRole("button", { name, exact: true }).click();
    const card = carousel.getByRole("article", { name: `${name} card` });
    await expect(card).toBeVisible();
    // Consecutive parts of the front sit at the front's own row spacing plus their margins: nothing holds space open.
    const overflows = await card.locator(".card-front").evaluate(front => {
      const rowGap = parseFloat(getComputedStyle(front).rowGap);
      const parts = [...front.children];
      return parts.slice(1).map((part, index) => {
        const previous = parts[index];
        const allowed = rowGap + parseFloat(getComputedStyle(previous).marginBottom) + parseFloat(getComputedStyle(part).marginTop) + 1;
        return part.getBoundingClientRect().top - previous.getBoundingClientRect().bottom - allowed;
      }).filter(excess => excess > 0);
    });
    expect(overflows).toEqual([]);
    // The card fits its content; the slideshow around it did not move.
    expect((await stage.boundingBox())!.height).toBe(stageHeight);
  }
}));

test("slideshow advances on its own quietly, pauses on hover and focus, and stops when asked", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  const stage = carousel.locator("[aria-roledescription=slide]").first().locator("..");
  await expect(carousel.getByRole("article", { name: "GitHub card" })).toBeVisible();
  await expect(carousel.getByRole("button", { name: "Pause slideshow" })).toBeVisible();
  await expect(stage).toHaveAttribute("aria-live", "off");
  await page.clock.fastForward(8100);
  await expect(carousel.getByRole("article", { name: "Claude Code card" })).toBeVisible();
  await carousel.hover();
  await expect(stage).toHaveAttribute("aria-live", "polite");
  await page.clock.fastForward(16000);
  await expect(carousel.getByRole("article", { name: "Claude Code card" })).toBeVisible();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(8100);
  await expect(carousel.getByRole("article", { name: "Firecrawl card" })).toBeVisible();
  await carousel.getByRole("button", { name: "Details", exact: true }).focus();
  await page.clock.fastForward(16000);
  await expect(carousel.getByRole("article", { name: "Firecrawl card" })).toBeVisible();
  await page.locator("#homepage-content").focus();
  await page.clock.fastForward(8100);
  await expect(carousel.getByRole("article", { name: "Exa card" })).toBeVisible();
  const toggle = carousel.getByRole("button", { name: /slideshow$/ });
  await toggle.focus();
  await expect(toggle).toHaveText("Pause slideshow");
  await page.clock.fastForward(16000);
  await expect(carousel.getByRole("article", { name: "Exa card" })).toBeVisible();
  await toggle.press("Enter");
  await expect(toggle).toHaveText("Play slideshow");
  await page.clock.fastForward(16000);
  await expect(carousel.getByRole("article", { name: "Exa card" })).toBeVisible();
  await toggle.press("Enter");
  await expect(toggle).toHaveText("Pause slideshow");
  await expect(toggle).toBeFocused();
  await page.clock.fastForward(8100);
  await expect(carousel.getByRole("article", { name: "Cloudflare card" })).toBeVisible();
  await carousel.getByRole("button", { name: "Next example" }).focus();
  await page.clock.fastForward(16000);
  await expect(carousel.getByRole("article", { name: "Cloudflare card" })).toBeVisible();
});

test("slideshow never advances on its own for a visitor who prefers reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await expect(carousel.getByRole("button", { name: "Play slideshow" })).toBeVisible();
  await page.clock.fastForward(24000);
  await expect(carousel.getByRole("article", { name: "GitHub card" })).toBeVisible();
});

test("the example chooser is one tab stop: arrows move, a press picks, and the picked example stays pressed", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const chooser = page.getByRole("group", { name: "Choose a product example" });
  const github = chooser.getByRole("button", { name: "GitHub", exact: true });
  const second = chooser.getByRole("button").nth(1);
  const third = chooser.getByRole("button").nth(2);
  await expect(github).toHaveAttribute("aria-pressed", "true");
  await github.focus();
  await page.keyboard.press("ArrowRight");
  await expect(second).toBeFocused();
  // Moving focus doesn't change the example; a press does.
  await expect(github).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Enter");
  await expect(second).toHaveAttribute("aria-pressed", "true");
  await expect(github).toHaveAttribute("aria-pressed", "false");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await expect(carousel.getByRole("article")).toHaveAccessibleName("Claude Code card");
  // Pressing the picked example again keeps it: one example is always shown.
  await page.keyboard.press("Enter");
  await expect(second).toHaveAttribute("aria-pressed", "true");
  // The whole group is one tab stop.
  await page.keyboard.press("Tab");
  await expect(third).not.toBeFocused();
  await expect(chooser.locator(":focus")).toHaveCount(0);
  // The arrows in the controls still move the pressed toggle.
  await carousel.getByRole("button", { name: "Next example" }).click();
  await expect(third).toHaveAttribute("aria-pressed", "true");
});

test("pressing the example already shown stops the slideshow for good", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await expect(carousel.getByRole("button", { name: "Pause slideshow" })).toBeVisible();
  const github = page.getByRole("group", { name: "Choose a product example" }).getByRole("button", { name: "GitHub", exact: true });
  await expect(github).toHaveAttribute("aria-pressed", "true");
  await github.press("Enter");
  await expect(github).toHaveAttribute("aria-pressed", "true");
  await expect(carousel.getByRole("button", { name: "Play slideshow" })).toBeVisible();
  // With focus and the pointer gone, nothing holds the slideshow but the visitor's choice.
  await page.locator("#homepage-content").focus();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(24000);
  await expect(carousel.getByRole("article", { name: "GitHub card" })).toBeVisible();
});

test("a hidden example asks for no brand font or logo until it is shown or next", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const assets = new Set<string>();
  page.on("request", request => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith("/api/brand-")) assets.add(pathname);
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  // GitHub is shown and Claude Code is next; Claude Code's verified assets are this site's own files.
  expect([...assets].sort()).toEqual([
    "/api/brand-fonts/1ab1b6a248cab8ba937f10ddd4b6cd983c88752d97371ff6c9eae613a7e21a2e.woff2",
    "/api/brand-images/c625fdf9-bcc0-4e62-a4ea-6f385a71cd16.png",
  ]);
  assets.clear();
  await page.getByRole("region", { name: "Product usage examples" }).getByRole("button", { name: "Spider", exact: true }).click();
  await page.waitForLoadState("networkidle");
  // Spider's dark icon, and Docker's square light icon because it comes next.
  expect([...assets].filter(path => path.startsWith("/api/brand-images/")).sort()).toEqual([
    "/api/brand-images/01405b60-627c-4b60-9591-03c2a2896385.png",
    "/api/brand-images/0a17c0a1-46e0-4640-af37-2f633a3dedce.svg",
  ]);
});

[NARROWEST_WIDTH, PHONE_WIDTH].forEach(width => test(`Claude Code's ${CODING_DAYS} coding days fit its card at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await carousel.getByRole("button", { name: "Claude Code", exact: true }).click();
  const chart = carousel.getByRole("article", { name: "Claude Code card" }).locator(".card-front .activity-bars");
  await expect(chart.locator("> span")).toHaveCount(CODING_DAYS);
  expect(await chart.evaluate(element => ({
    overflow: element.scrollWidth - element.clientWidth,
    lastBarPastEdge: Math.max(0, Math.round(element.lastElementChild!.getBoundingClientRect().right - element.getBoundingClientRect().right)),
  }))).toEqual({ overflow: 0, lastBarPastEdge: 0 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}));

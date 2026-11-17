import { expect, test, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** The widest screen that shows a phone's chooser row, with Play and no arrows (product-example.module.css). */
const PHONE_ONLY_MAX_PX = 600;
/** The example shown first, and the one the slideshow moves on to. Clay doesn't lead until the owner says so. */
const LEAD = "GitHub", SECOND = "Elicit";
/** The numbers a front sets large: a published one, or the one leading its activity. */
const BIG_NUMBER = ".card-front :is(.usage-measurement-stats strong, .card-activity-preview > p:first-child strong)";
for (const width of [1440, 390, 320]) test(`usage slideshow keeps metrics and caveats distinct at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await expect(carousel.getByRole("button", { name: "Play slideshow" })).toBeVisible();
  await expect(carousel.locator("[data-current=true] [data-capability]")).toHaveText(CAPABILITIES[LEAD]);
  // A phone's row keeps the names and Play; the arrows and count are for wider screens, where the row has room.
  const arrows = width > PHONE_ONLY_MAX_PX;
  const count = carousel.getByText("1 / 5", { exact: true });
  await (arrows ? expect(count).toBeVisible() : expect(count).toBeHidden());
  // Opening the rest shows them; only picking one of them puts all fourteen in play.
  await openMoreExamples(carousel);
  await (arrows ? expect(count).toBeVisible() : expect(count).toBeHidden());
  await carousel.getByRole("button", { name: "GitHub", exact: true }).click();
  await expect(carousel.getByRole("article", { name: "GitHub card" })).toContainText("contributions");
  const calendar = carousel.locator(".card-front .contribution-calendar");
  await expect(calendar.locator("[data-date]")).toHaveCount(365);
  await expect(calendar.locator(".contribution-months span")).toHaveText(["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"]);
  const geometry = await calendar.evaluate(element => {
    const scroll = element.querySelector(".contribution-scroll")!;
    const cells = [...element.querySelectorAll("[data-date]")];
    const first = cells[0].getBoundingClientRect();
    const box = scroll.getBoundingClientRect();
    const newest = cells.at(-1)!.getBoundingClientRect();
    const august = [...element.querySelectorAll(".contribution-months span")].at(-1)!.getBoundingClientRect();
    const monday = element.querySelector(".contribution-weekdays span:nth-child(2)")!.getBoundingClientRect();
    const october = element.querySelector('[data-date="2025-10-01"]')!.getBoundingClientRect();
    const octoberLabel = element.querySelector(".contribution-months span:nth-child(2)")!.getBoundingClientRect();
    return { cellWidth: first.width, cellHeight: first.height, mondayY: monday.y, firstY: first.y, octoberX: october.x, labelX: octoberLabel.x,
      scrollWidth: scroll.scrollWidth, clientWidth: scroll.clientWidth, newestInView: newest.left >= box.left && newest.right <= box.right,
      newestMonthInView: august.left >= box.left && august.right <= box.right };
  });
  // Square cells, never smaller than 7px, with the weekday and month labels on their rows and columns.
  expect(geometry.cellWidth).toBe(geometry.cellHeight);
  expect(geometry.cellWidth).toBeGreaterThanOrEqual(7);
  expect(Math.abs(geometry.mondayY - geometry.firstY)).toBeLessThan(1);
  expect(Math.abs(geometry.octoberX - geometry.labelX)).toBeLessThan(1);
  // Wherever it lands, the visitor first sees the newest week and its month.
  expect([geometry.newestInView, geometry.newestMonthInView]).toEqual([true, true]);
  if (width === 1440) expect(geometry.scrollWidth).toBe(geometry.clientWidth);
  if (width <= 390) {
    expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth);
    const scroll = calendar.getByRole("region", { name: "Contribution calendar; scroll horizontally to see the full period" });
    await scroll.focus();
    await expect(scroll).toBeFocused();
    const initialScrollLeft = await scroll.evaluate(element => element.scrollLeft);
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => scroll.evaluate(element => element.scrollLeft)).toBeLessThan(initialScrollLeft);
    expect(await page.evaluate(() => window.scrollX)).toBe(0);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(carousel.locator("[data-current=true] [data-capability]")).toHaveText("A year of contributions");
  // The screen, not the whole carousel: capturing past the screen resizes it, which lets go of a phone's held row mid-test.
  await page.screenshot({ path: testInfo.outputPath(`2026-09-21-github-${width}.png`) });
  // Picking another example never moves the controls on the screen: above the card on a wide one, held at the foot on a phone.
  const controlsTop = () => carousel.getByRole("button", { name: "Pause slideshow" }).or(carousel.getByRole("button", { name: "Play slideshow" }))
    .evaluate((element, phone) => Math.round(element.getBoundingClientRect().top + (phone ? 0 : scrollY)), !arrows);
  const githubControls = await controlsTop();
  // The top line and button are typed as written; each card's measured site, or the house default, sets their case.
  for (const [name, text, labelCase, buttonCase] of [
    ["Clay", "Daily · since 2023", "none", "none"],
    ["Cloudflare", "Daily · since 2020", "none", "none"],
    ["Docker", "Weekly · since 2024", "none", "none"],
    ["Firecrawl", "Weekly · since 2025", "none", "none"],
    ["n8n", "Paused · started 2024", "uppercase", "uppercase"],
    // Claude Code's own page sets its labels and buttons as typed.
    ["Claude Code", "Daily · since 2025", "none", "none"],
    // Exa's first screen labels its controls in mono capitals (LATENCY, CATEGORY); its buttons stay as typed.
    ["Exa", "Weekly · since 2025", "uppercase", "none"],
    ["Porkbun", "Occasionally · since 2021", "uppercase", "uppercase"],
    ["Spider", "Occasionally · since 2026", "uppercase", "uppercase"],
    ["Open Places", "Occasionally · since 2026", "none", "none"],
    ["Grok Bot", "Testing · since 2026", "uppercase", "uppercase"],
    ["Elicit", "Stopped using · started 2026", "none", "none"],
    ["Context.dev", "Testing · since 2026", "none", "none"],
  ]) {
    const toggle = carousel.getByRole("button", { name, exact: true });
    // The chooser says what each example shows, as the toggle's description, so its name stays the product's.
    await expect(toggle).toHaveAccessibleDescription(CAPABILITIES[name]);
    // A phone's row is held on the screen while the card is in view: it stays put across the pick itself.
    await toggle.scrollIntoViewIfNeeded();
    const controlsBefore = arrows ? githubControls : await controlsTop();
    await toggle.click();
    await expect(carousel.locator("[data-current=true] [data-capability]")).toHaveText(CAPABILITIES[name]);
    const card = carousel.getByRole("article", { name: `${name} card` });
    await expect(card).toBeVisible();
    await expect(card).toContainText(text);
    await expect(card.locator(".card-title .eyebrow")).toHaveCSS("text-transform", labelCase);
    await expect(card.locator(".card-button")).toHaveCSS("text-transform", buttonCase);
    await expect(card).not.toContainText("contributions");
    await expect(carousel.locator("[data-current=true]")).toContainText("Sample data / No account connected");
    expect(await controlsTop()).toBe(controlsBefore);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`2026-09-21-${name.toLowerCase().replaceAll(" ", "-")}-${width}.png`) });
    await expect(card.locator(".card-front .card-link-disclosure")).toHaveText(FRONT_DISCLOSURE[name] ?? []);
    await Promise.all((FRONT_TEXT[name] ?? []).map(text => expect(card.locator(".card-front")).toContainText(text)));
    const back = BACK_TEXT[name];
    if (!back) continue;
    await card.getByRole("button", { name: "Details", exact: true }).click();
    // A stored link type: matches "CANONICAL", not "Direct link". https://regex101.com/?regex=CANONICAL%7CAFFILIATE%7CREFERRAL%7CINVITE&testString=Weekly%20%C2%B7%20Direct%20link%0ACANONICAL
    await expect(card.locator(".card-back .status-row")).not.toContainText(/CANONICAL|AFFILIATE|REFERRAL|INVITE/);
    await Promise.all(back.map(text => expect(card.locator(".card-back")).toContainText(text)));
    await card.getByRole("button", { name: "Close details" }).click();
  }
  // With every example open, the arrows run through all fourteen and wrap.
  if (arrows) {
    await carousel.getByRole("button", { name: "Next example" }).click();
    await expect(carousel.getByRole("article", { name: `${LEAD} card` })).toBeVisible();
    await carousel.getByRole("button", { name: "Previous example" }).click();
    await expect(carousel.getByRole("article", { name: "Context.dev card" })).toBeVisible();
  } else await carousel.getByRole("button", { name: "Context.dev", exact: true }).click();
  await carousel.getByRole("button", { name: "Details", exact: true }).click();
  await expect(carousel.getByRole("button", { name: "Close details" })).toBeVisible();
  await carousel.getByRole("button", { name: "Clay", exact: true }).click();
  await expect(carousel.getByRole("button", { name: "Details", exact: true })).toBeVisible();
});

/** Each toggle's product name, without the description it carries for screen readers. */
async function toggleNames(chooser: Locator) {
  return chooser.getByRole("button").evaluateAll(buttons => buttons.map(button => button.firstChild?.textContent));
}

/** Picks Clay, which no longer leads, and returns its card once it is shown. */
async function showClay(page: Page) {
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await carousel.getByRole("group", { name: "Choose a product example" }).getByRole("button", { name: "Clay", exact: true }).click();
  const card = carousel.getByRole("article", { name: "Clay card" });
  await expect(card).toBeVisible();
  return card;
}

/** Shows the nine examples that wait behind the five featured ones. */
async function openMoreExamples(carousel: Locator) {
  await carousel.getByRole("button", { name: "More examples" }).click();
  await expect(carousel.getByRole("button", { name: "More examples" })).toHaveAttribute("aria-expanded", "true");
}

/**
 * The example on show. All fourteen slides stay mounted, so auditing the whole slideshow after every pick re-audited
 * every card each time. The slideshow is audited whole once, on load; after that, each card when it is shown.
 */
const SHOWN_EXAMPLE = '[aria-label="Product usage examples"] [data-current="true"]';

/** What each example shows, named above its card and as its chooser toggle's description. */
const CAPABILITIES: Readonly<Record<string, string>> = {
  GitHub: "A year of contributions",
  Clay: "One published number",
  "Claude Code": "Coding days",
  Firecrawl: "Referral link, disclosed",
  Exa: "A demo link on the back",
  Cloudflare: "Go-to, with what it costs",
  Porkbun: "Go-to, now and then",
  Spider: "Affiliate link, disclosed",
  Docker: "A running total",
  "Open Places": "Used now and then",
  "Grok Bot": "Still testing",
  Elicit: "Stopped using, and why",
  "Context.dev": "Testing, week by week",
  n8n: "Paused, and why",
};
/** What each label promises, said on the card's front: its cost, why it was paused or stopped, and where its demo is. */
const FRONT_TEXT: Readonly<Record<string, readonly string[]>> = {
  Clay: ["1,500,000rows enriched", "The period and how I use it, inside"],
  Cloudflare: ["Costs $5/month", "Go-to"],
  Docker: ["48,200 image pulls"],
  Exa: ["A demo link inside"],
  n8n: ["Paused while my nightly jobs move to plain cron."],
  Elicit: ["I stopped once my market study was done."],
};
/** What a card discloses next to its outbound arrow, and what its back shows beyond the front: one capability per example. */
const FRONT_DISCLOSURE: Readonly<Record<string, string>> = { Firecrawl: "Referral link", Spider: "Affiliate link" };
const BACK_TEXT: Readonly<Record<string, readonly string[]>> = {
  Firecrawl: ["Weekly · Referral link", "Open Firecrawl ↗Referral link"],
  Exa: ["Weekly · Direct link", "Demo ↗exa.ai"],
  Cloudflare: ["Go-to", "Cost: $5/month · as of 1 Sep 2026"],
  Docker: ["Weekly · Direct link", "the owner's own use · Jan 2024 – Aug 2026 · last updated 1 Sep 2026"],
  n8n: ["Paused · Direct link", "Paused while my nightly jobs move to plain cron."],
  Clay: ["Daily · Direct link", "See how I use it ↗clay.com", "How this was measured"],
};

const DESKTOP_WIDTH = 1440;
const PHONE_WIDTH = 390;
const VIEWPORT_HEIGHT = 1000;

// Its own test, so the audit's twenty-odd axe runs don't share the slideshow test's time with its checks.
test(`every example card, front and back, passes axe at ${DESKTOP_WIDTH}px`, async ({ page }) => {
  await page.setViewportSize({ width: DESKTOP_WIDTH, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await expect(carousel.getByRole("article", { name: `${LEAD} card` })).toBeVisible();
  await openMoreExamples(carousel);
  expect((await new AxeBuilder({ page }).include('[aria-label="Product usage examples"]').analyze()).violations).toEqual([]);
  for (const name of Object.keys(CAPABILITIES)) {
    await carousel.getByRole("button", { name, exact: true }).click();
    const card = carousel.getByRole("article", { name: `${name} card` });
    await expect(card).toBeVisible();
    expect((await new AxeBuilder({ page }).include(SHOWN_EXAMPLE).analyze()).violations, `${name} front`).toEqual([]);
    if (!BACK_TEXT[name]) continue;
    await card.getByRole("button", { name: "Details", exact: true }).click();
    await expect(card.getByRole("button", { name: "Close details" })).toBeVisible();
    expect((await new AxeBuilder({ page }).include(SHOWN_EXAMPLE).analyze()).violations, `${name} back`).toEqual([]);
    await card.getByRole("button", { name: "Close details" }).click();
  }
});

// Each brand's own surface colour, from its committed snapshot; the default card is rgb(37, 37, 31) in Arial.
// A sample series draws its bars, one a week or one a day, in the brand's accent, or its text colour where no accent reads on its surface
// (n8n); Clay publishes numbers instead.
const BRANDED = [
  { name: "Firecrawl", slug: "firecrawl", background: "rgb(249, 249, 249)", bars: { count: 12, color: "rgb(255, 76, 0)" }, logo: "square" },
  { name: "Cloudflare", slug: "cloudflare", background: "rgb(255, 255, 255)", bars: { count: 31, color: "rgb(255, 94, 31)" }, logo: "wordmark" },
  // n8n's pink, deepened in lightness with its hue kept, so its bars read 3:1 on its grey panel.
  { name: "n8n", slug: "n8n", background: "rgb(250, 250, 250)", bars: { count: 12, color: "rgb(183, 121, 135)" }, logo: "wordmark" },
  { name: "Clay", slug: "clay", background: "rgb(244, 243, 240)", bars: undefined, logo: "app-icon" },
] as const;
const CODING_DAYS = 31;
const NARROWEST_WIDTH = 320;

[DESKTOP_WIDTH, PHONE_WIDTH].forEach(width => test(`branded example cards wear their brand, say what they're used for in one line and show a sample chart or number at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await openMoreExamples(carousel);
  for (const brand of BRANDED) {
    await carousel.getByRole("button", { name: brand.name, exact: true }).click();
    const card = carousel.getByRole("article", { name: `${brand.name} card` });
    await expect(card).toBeVisible();
    await expect(card).toHaveCSS("background-color", brand.background);
    const font = await card.locator(".card-headline").evaluate(element => getComputedStyle(element).fontFamily);
    expect(font.replaceAll('"', "").startsWith(`PRBrand-${brand.slug}-`)).toBe(true);
    const logo = card.locator(".card-front .product-logo img");
    await expect(logo).toBeVisible();
    await expect.poll(() => logo.evaluate(image => (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
    // A wordmark stands in for the visible name; either way the heading still names the product. Clay's reviewed app icon outranks its stored brand.
    await expect(card.getByRole("heading", { level: 2, name: brand.name, exact: true })).toHaveCount(1);
    const slot = { square: ".card-topline > .product-logo:not([data-logo-layout])", "app-icon": ".card-topline > .product-logo[data-logo-layout=app-icon]", wordmark: ".card-title .product-logo[data-logo-layout=wordmark]" };
    await expect(card.locator(".card-front").locator(slot[brand.logo])).toBeVisible();
    // Its headline is its one use line; no list of uses sits beside it.
    await expect(card.locator(".card-uses")).toHaveCount(0);
    if (brand.bars) {
      const bars = card.locator(".card-front .activity-bars > span:not([data-zero])");
      await expect(card.locator(".card-front .activity-bars > span")).toHaveCount(brand.bars.count);
      await expect(bars.last()).toHaveCSS("background-color", brand.bars.color);
      await expect(card.locator(".card-front .activity-bars")).toHaveAttribute("role", "img");
    } else {
      // Clay publishes one number and nothing else: no table, no tool craft, and its note says Sample no more than the card's tag does.
      await expect(card.locator(".card-front table, .card-back table")).toHaveCount(0);
      await expect(card.locator(".card-front .usage-measurement-stats li")).toHaveText(["1,500,000rows enriched"]);
      await expect(card.locator(".card-front .usage-measurement-note")).toHaveText("Jan 2023 – Aug 2026 · how each was measured is in Details");
      // The disclosures are above the card and on its back, not on its front.
      await expect(card.locator(".card-front")).not.toContainText(/Synthetic sample|Owner-supplied evidence|more reported measurements/);
      // Its footer says what is behind Details, and the button carries the same words.
      await expect(card.locator(".card-footer > span")).toHaveText("The period and how I use it, inside");
      await expect(card.getByRole("button", { name: "Details", exact: true })).toHaveAccessibleDescription("The period and how I use it, inside");
      continue;
    }
    // Every sample was captured on 2026-09-01: the front says when, in words, not "stale".
    await expect(card.locator(".card-front [data-freshness]")).toHaveText(" · last updated 1 Sep 2026");
    // What a visitor reads under the number; the screen-reader table of bars keeps each bar's exact dates.
    expect(await card.locator(".card-front .card-activity-preview > p").allInnerTexts()).not.toContainEqual(expect.stringMatching(/stale|observation|personal activity|UTC|\d{4}-\d{2}-\d{2}/));
  }
}));

[DESKTOP_WIDTH, PHONE_WIDTH].forEach(width => test(`every example card closes up around its content at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await openMoreExamples(carousel);
  const stage = carousel.locator("[aria-roledescription=slide]").first().locator("..");
  for (const name of ["GitHub", "Clay", "Claude Code", "Firecrawl", "Docker", "Grok Bot"]) {
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
    // The frame is as tall as the shown slide: no empty band under a short card.
    const [stageHeight, slideHeight] = [(await stage.boundingBox())!.height, (await carousel.locator("[data-current=true]").boundingBox())!.height];
    expect(Math.abs(stageHeight - slideHeight)).toBeLessThan(1);
  }
}));

test("slideshow advances on its own quietly, pauses on hover and focus, and stops when asked", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  const status = carousel.locator("[data-slide-status]");
  await expect(carousel.getByRole("article", { name: "GitHub card" })).toBeVisible();
  await expect(carousel.getByRole("button", { name: "Pause slideshow" })).toBeVisible();
  await expect(status).toHaveAttribute("aria-live", "off");
  await page.clock.fastForward(8100);
  await expect(carousel.getByRole("article", { name: "Elicit card" })).toBeVisible();
  await carousel.hover();
  await expect(status).toHaveAttribute("aria-live", "polite");
  await expect(status).toHaveText("2 of 5: Elicit");
  await page.clock.fastForward(16000);
  await expect(carousel.getByRole("article", { name: "Elicit card" })).toBeVisible();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(8100);
  await expect(carousel.getByRole("article", { name: "Cloudflare card" })).toBeVisible();
  await carousel.getByRole("button", { name: "Details", exact: true }).focus();
  await page.clock.fastForward(16000);
  await expect(carousel.getByRole("article", { name: "Cloudflare card" })).toBeVisible();
  await page.locator("#homepage-content").focus();
  await page.clock.fastForward(8100);
  await expect(carousel.getByRole("article", { name: "Clay card" })).toBeVisible();
  const toggle = carousel.getByRole("button", { name: /slideshow$/ });
  await toggle.focus();
  await expect(toggle).toHaveText("Pause slideshow");
  await page.clock.fastForward(16000);
  await expect(carousel.getByRole("article", { name: "Clay card" })).toBeVisible();
  await toggle.press("Enter");
  await expect(toggle).toHaveText("Play slideshow");
  await page.clock.fastForward(16000);
  await expect(carousel.getByRole("article", { name: "Clay card" })).toBeVisible();
  await toggle.press("Enter");
  await expect(toggle).toHaveText("Pause slideshow");
  await expect(toggle).toBeFocused();
  await page.clock.fastForward(8100);
  await expect(carousel.getByRole("article", { name: "Docker card" })).toBeVisible();
  await carousel.getByRole("button", { name: "Next example" }).focus();
  await page.clock.fastForward(16000);
  await expect(carousel.getByRole("article", { name: "Docker card" })).toBeVisible();
  // Only the five featured examples take turns: after Docker it wraps to GitHub, never on to the nine behind More examples.
  await page.locator("#homepage-content").focus();
  await page.clock.fastForward(8100);
  await expect(carousel.getByRole("article", { name: "GitHub card" })).toBeVisible();
  await expect(carousel.locator("[aria-roledescription=slide]")).toHaveCount(5);
});

test("an open back holds the slideshow, wherever focus and the pointer go, until it is closed", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  const lead = carousel.getByRole("article", { name: `${LEAD} card` });
  await expect(carousel.getByRole("button", { name: "Pause slideshow" })).toBeVisible();
  await lead.getByRole("button", { name: "Details", exact: true }).click();
  await page.mouse.move(0, 0);
  await page.locator("#homepage-content").focus();
  await page.clock.fastForward(17_000);
  await expect(lead.getByRole("button", { name: "Close details" })).toBeVisible();
  await expect(carousel.locator("[data-slide-status]")).toHaveText(`1 of 5: ${LEAD}`);
  await lead.getByRole("button", { name: "Close details" }).click();
  await page.mouse.move(0, 0);
  await page.locator("#homepage-content").focus();
  await page.clock.fastForward(8100);
  await expect(carousel.getByRole("article", { name: `${SECOND} card` })).toBeVisible();
});

test("with More examples open and nothing else picked, the slideshow still takes turns among the five featured", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await expect(carousel.getByRole("button", { name: "Pause slideshow" })).toBeVisible();
  await openMoreExamples(carousel);
  // Opening the list mounts none of the nine: each mounts when it is picked or next.
  await expect(carousel.locator("[aria-roledescription=slide]")).toHaveCount(5);
  // Focus and the pointer leave the slideshow, so only the timer moves it.
  await page.locator("#homepage-content").focus();
  await page.mouse.move(0, 0);
  for (const name of [...FEATURED.slice(1), LEAD]) {
    await page.clock.fastForward(8100);
    await expect(carousel.getByRole("article", { name: `${name} card` })).toBeVisible();
  }
  await expect(carousel.getByText("1 / 5", { exact: true })).toBeVisible();
});

test("slideshow never advances on its own for a visitor who prefers reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await expect(carousel.getByRole("button", { name: "Play slideshow" })).toBeVisible();
  await page.clock.fastForward(24000);
  await expect(carousel.getByRole("article", { name: `${LEAD} card` })).toBeVisible();
});

test("the example chooser is one tab stop: arrows move, a press picks, and the picked example stays pressed", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const chooser = page.getByRole("group", { name: "Choose a product example" });
  const github = chooser.getByRole("button", { name: LEAD, exact: true });
  const second = chooser.getByRole("button").nth(1);
  const third = chooser.getByRole("button").nth(2);
  expect(await toggleNames(chooser)).toEqual([...FEATURED]);
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
  await expect(carousel.getByRole("article")).toHaveAccessibleName(`${SECOND} card`);
  // Pressing the picked example again keeps it: one example is always shown.
  await page.keyboard.press("Enter");
  await expect(second).toHaveAttribute("aria-pressed", "true");
  // The whole group is one tab stop; the next is the disclosure that shows the other nine.
  await page.keyboard.press("Tab");
  await expect(third).not.toBeFocused();
  await expect(chooser.locator(":focus")).toHaveCount(0);
  const more = carousel.getByRole("button", { name: "More examples" });
  await expect(more).toBeFocused();
  await expect(more).toHaveAttribute("aria-expanded", "false");
  // The arrows in the controls still move the pressed toggle.
  await carousel.getByRole("button", { name: "Next example" }).click();
  await expect(third).toHaveAttribute("aria-pressed", "true");
  // Opened, the nine join the same group: still one tab stop, and the arrow keys reach them from the last featured toggle.
  await more.press("Enter");
  await expect(chooser.getByRole("button")).toHaveCount(14);
  await chooser.getByRole("button", { name: FEATURED.at(-1), exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  const firecrawl = chooser.getByRole("button", { name: "Firecrawl", exact: true });
  await expect(firecrawl).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(carousel.getByRole("article")).toHaveAccessibleName("Firecrawl card");
  await expect(carousel.getByText("6 / 14", { exact: true })).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  await expect(chooser.locator(":focus")).toHaveCount(0);
  // Closing the nine while one of them is shown keeps it shown, and the slideshow's count keeps all fourteen.
  await more.click();
  await expect(chooser.getByRole("button")).toHaveCount(5);
  await expect(carousel.getByRole("article")).toHaveAccessibleName("Firecrawl card");
  await expect(carousel.getByText("6 / 14", { exact: true })).toBeVisible();
});

test("pressing the example already shown stops the slideshow for good", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await expect(carousel.getByRole("button", { name: "Pause slideshow" })).toBeVisible();
  const github = page.getByRole("group", { name: "Choose a product example" }).getByRole("button", { name: LEAD, exact: true });
  await expect(github).toHaveAttribute("aria-pressed", "true");
  await github.press("Enter");
  await expect(github).toHaveAttribute("aria-pressed", "true");
  await expect(carousel.getByRole("button", { name: "Play slideshow" })).toBeVisible();
  // With focus and the pointer gone, nothing holds the slideshow but the visitor's choice.
  await page.locator("#homepage-content").focus();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(24000);
  await expect(carousel.getByRole("article", { name: `${LEAD} card` })).toBeVisible();
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
  // GitHub's font and logo, since it is shown, and Elicit's fonts and logo, since it is next (measured 17 Nov 2026).
  expect([...assets].sort()).toEqual([
    "/api/brand-fonts/1ab1b6a248cab8ba937f10ddd4b6cd983c88752d97371ff6c9eae613a7e21a2e.woff2",
    "/api/brand-fonts/2ba924c1bb9da65e902c1360cafcc7c28b2aaf6428d08b773777701409d93852.woff2",
    "/api/brand-fonts/4bdae757061773359c9c86a5f1c9a5754b8999ab926bfdf89923a36cbf9aed8a.woff2",
    "/api/brand-images/105442cc-6552-4e6f-8b2d-6268eb13c024.png",
    "/api/brand-images/c625fdf9-bcc0-4e62-a4ea-6f385a71cd16.png",
  ]);
  assets.clear();
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  // Opening the other nine fetches nothing of theirs: each still waits until it is shown or next.
  await openMoreExamples(carousel);
  await page.waitForLoadState("networkidle");
  expect([...assets]).toEqual([]);
  await carousel.getByRole("button", { name: "Spider", exact: true }).click();
  await page.waitForLoadState("networkidle");
  // Spider's dark icon, and Open Places' icon because it comes next.
  expect([...assets].filter(path => path.startsWith("/api/brand-images/")).sort()).toEqual([
    "/api/brand-images/0a17c0a1-46e0-4640-af37-2f633a3dedce.svg",
    "/api/brand-images/d0d02048-61a8-4924-b673-caf59df86026.png",
  ]);
});

[NARROWEST_WIDTH, PHONE_WIDTH].forEach(width => test(`Claude Code's ${CODING_DAYS} coding days fit its card at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await openMoreExamples(carousel);
  await carousel.getByRole("button", { name: "Claude Code", exact: true }).click();
  const chart = carousel.getByRole("article", { name: "Claude Code card" }).locator(".card-front .activity-bars");
  await expect(chart.locator("> span")).toHaveCount(CODING_DAYS);
  expect(await chart.evaluate(element => ({
    overflow: element.scrollWidth - element.clientWidth,
    lastBarPastEdge: Math.max(0, Math.round(element.lastElementChild!.getBoundingClientRect().right - element.getBoundingClientRect().right)),
  }))).toEqual({ overflow: 0, lastBarPastEdge: 0 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}));

const FEATURED = [LEAD, SECOND, "Cloudflare", "Clay", "Docker"] as const;
const COLLAPSED_CHOOSER_LIMIT = 100;

test(`the chooser stays one short row at ${DESKTOP_WIDTH}px, so each featured card is whole in the first screen`, async ({ page }) => {
  await page.setViewportSize({ width: DESKTOP_WIDTH, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  const chooser = carousel.getByRole("group", { name: "Choose a product example" });
  expect(await toggleNames(chooser)).toEqual(FEATURED);
  // Only the featured slides are in the page until the visitor asks for the rest.
  await expect(carousel.locator("[aria-roledescription=slide]")).toHaveCount(FEATURED.length);
  const height = await carousel.locator(":scope > div").first().evaluate(element => element.getBoundingClientRect().height);
  expect(height).toBeLessThanOrEqual(COLLAPSED_CHOOSER_LIMIT);
  for (const name of FEATURED) {
    await chooser.getByRole("button", { name, exact: true }).click();
    const card = carousel.getByRole("article", { name: `${name} card` });
    await expect(card).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => scrollTo(0, 0));
    // The whole card, its footer and the padding under it included.
    const cardBottom = await card.evaluate(element => element.getBoundingClientRect().bottom);
    expect(cardBottom, name).toBeLessThanOrEqual(VIEWPORT_HEIGHT);
  }
});

test("an occasional card's empty weeks draw as stubs on the baseline, so a gap reads as zero", async ({ page }) => {
  await page.setViewportSize({ width: DESKTOP_WIDTH, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await openMoreExamples(carousel);
  await carousel.getByRole("button", { name: "Spider", exact: true }).click();
  const bars = carousel.getByRole("article", { name: "Spider card" }).locator(".card-front .activity-bars > span");
  await expect(bars).toHaveCount(12);
  const heights = await bars.evaluateAll(spans => spans.map(span => Math.round(span.getBoundingClientRect().height)));
  expect(heights.filter(height => height === 2)).toHaveLength(9);
  expect(Math.max(...heights)).toBeGreaterThan(40);
  // A stub keeps the bars' own opaque ink, so it holds the chart's contrast against the card; its height alone marks it as zero.
  // Spider draws in lines, so its bars' ink is their outline.
  const paint = await bars.evaluateAll(spans => spans.map(span => {
    const style = getComputedStyle(span), outlined = !span.hasAttribute("data-zero") && parseFloat(style.borderTopWidth) > 0;
    return { zero: span.hasAttribute("data-zero"), opacity: style.opacity, colour: outlined ? style.borderTopColor : style.backgroundColor };
  }));
  const barColour = paint.find(bar => !bar.zero)!.colour;
  const stubs = paint.filter(bar => bar.zero).map(({ opacity, colour }) => ({ opacity, colour }));
  expect(stubs).toEqual(stubs.map(() => ({ opacity: "1", colour: barColour })));
});

for (const width of [DESKTOP_WIDTH, PHONE_WIDTH, NARROWEST_WIDTH]) test(`Cloudflare's orange runs from the card's top through its headline at ${width}px: white only where the text is large, the rest in a colour that reads small`, async ({ page }) => {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await carousel.getByRole("button", { name: "Cloudflare", exact: true }).click();
  const card = carousel.getByRole("article", { name: "Cloudflare card" });
  const slab = await card.evaluate((element, largePx) => {
    const luminance = (colour: string) => {
      const [red, green, blue] = colour.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };
    const contrast = (first: string, second: string) => {
      const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
      return Math.floor((light + 0.05) / (dark + 0.05) * 100) / 100;
    };
    const topline = element.querySelector(".card-front > .card-topline")!, headline = element.querySelector(".card-front > .card-headline")!;
    const fill = getComputedStyle(topline).backgroundColor;
    const small = [...topline.querySelectorAll(".eyebrow, .card-sample-tag, .card-visit")].map(node => [node.textContent, contrast(getComputedStyle(node).color, fill)]);
    return { fill, sameFill: getComputedStyle(headline).backgroundColor === fill, slabTop: topline.getBoundingClientRect().top - element.getBoundingClientRect().top <= 1,
      headline: [getComputedStyle(headline).color, parseFloat(getComputedStyle(headline).fontSize) >= largePx, contrast(getComputedStyle(headline).color, fill)], small,
      logoTile: getComputedStyle(element.querySelector(".product-logo")!).backgroundColor };
  }, LARGE_TEXT_PX);
  expect(slab).toEqual({
    fill: "rgb(255, 94, 31)", sameFill: true, slabTop: true, headline: ["rgb(255, 255, 255)", true, 3.05],
    // Its stored wordmark alone (black, 6.9:1 on the orange) shows straight on the slab, as no white tile ever sits on cloudflare.com's.
    small: [["Daily · since 2020", 4.95], ["Sample", 4.95], ["↗", 4.95]], logoTile: "rgba(0, 0, 0, 0)",
  });
  expect(slab.headline[2]).toBeGreaterThanOrEqual(LARGE_TEXT_CONTRAST);
});

test("on a phone Firecrawl's Referral link tag takes its own row under the arrow, so the status line beside the logo stays on one line", async ({ page }) => {
  await page.setViewportSize({ width: PHONE_WIDTH, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await openMoreExamples(carousel);
  await carousel.getByRole("button", { name: "Firecrawl", exact: true }).click();
  const card = carousel.getByRole("article", { name: "Firecrawl card" });
  const header = await card.locator(".card-front > .card-topline").evaluate(topline => {
    const box = (selector: string) => topline.querySelector(selector)!.getBoundingClientRect();
    const eyebrow = topline.querySelector(".eyebrow")!, range = document.createRange();
    range.selectNodeContents(eyebrow);
    const lines = new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size;
    return { eyebrowLines: lines, tagUnderArrow: box(".card-link-disclosure").top >= box(".card-visit").bottom - 1, tagInCard: box(".card-link-disclosure").right <= topline.getBoundingClientRect().right };
  });
  expect(header).toEqual({ eyebrowLines: 1, tagUnderArrow: true, tagInCard: true });
});

/** The most of a figure's width a group separator may take; Exa's tabular comma took all of it. */
const MAX_SEPARATOR_SHARE = 0.7;
test("Exa's 36,900 sets its comma at the font's own width, not a tabular figure's, so it never reads 36 , 900", async ({ page }) => {
  await page.setViewportSize({ width: DESKTOP_WIDTH, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await openMoreExamples(carousel);
  await carousel.getByRole("button", { name: "Exa", exact: true }).click();
  const number = carousel.getByRole("article", { name: "Exa card" }).locator(".card-front .card-activity-preview > p").first().locator("strong");
  await expect(number).toHaveText("36,900");
  // Measured against a figure in the same face, so the check holds whatever fonts the machine has: a tabular comma is a figure's width.
  const ratios = await number.evaluate(element => {
    const figure = document.createRange();
    figure.setStart(element.firstChild!, 0);
    figure.setEnd(element.firstChild!, 1);
    return [...element.querySelectorAll(".figure-separator")].map(mark => mark.getBoundingClientRect().width / figure.getBoundingClientRect().width);
  });
  expect(ratios.map(ratio => ratio < MAX_SEPARATOR_SHARE)).toEqual([true]);
});

/** Each word or number in a face's text that the layout breaks across lines ("1,1 / 00"), by name and face. */
async function splitWords(card: Locator, face: "front" | "back") {
  return card.locator(`.card-${face}`).evaluate(element => [...element.querySelectorAll("*")]
    .filter(node => node.checkVisibility() && [...node.childNodes].some(child => child.nodeType === Node.TEXT_NODE && child.textContent!.trim()))
    .flatMap(node => [...node.childNodes].filter(child => child.nodeType === Node.TEXT_NODE).flatMap(text => [...text.textContent!.matchAll(/\S+/g)].filter(word => {
      const range = document.createRange();
      range.setStart(text, word.index);
      range.setEnd(text, word.index + word[0].length);
      return new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size > 1;
    }).map(word => word[0]))));
}

for (const width of [DESKTOP_WIDTH, PHONE_WIDTH, NARROWEST_WIDTH]) test(`every word and number on both faces of all fourteen cards stays whole at ${width}px`, async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await openMoreExamples(carousel);
  const split: string[] = [];
  for (const name of ALL_EXAMPLES) {
    await carousel.getByRole("group", { name: "Choose a product example" }).getByRole("button", { name, exact: true }).click();
    const card = carousel.getByRole("article", { name: `${name} card` });
    split.push(...(await splitWords(card, "front")).map(word => `${name} front: ${word}`));
    await card.getByRole("button", { name: "Details", exact: true }).click();
    split.push(...(await splitWords(card, "back")).map(word => `${name} back: ${word}`));
    await card.getByRole("button", { name: "Close details" }).click();
  }
  expect(split).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

const ADVANCE_MS = 8000;
const PHONE_HEIGHT = 844;
/** Just short of a turn, then just past it. */
const TURN_MARGIN_MS = 100;
const SHORT_HEIGHT = 200;
test("the slideshow waits for the visitor to reach it before it moves on, then moves on", async ({ page }) => {
  await page.clock.install();
  // A short window puts the slideshow below the fold even on a wide screen.
  await page.setViewportSize({ width: DESKTOP_WIDTH, height: SHORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  const current = carousel.locator("[data-current=true] [data-capability]");
  await expect(carousel.getByRole("button", { name: "Pause slideshow" })).toBeVisible();
  expect(await carousel.locator("[data-current=true] article").evaluate(element => element.getBoundingClientRect().top > innerHeight)).toBe(true);
  // Longer than a slide's turn at the top of the page, with the slideshow below the fold.
  await page.clock.runFor(ADVANCE_MS * 2);
  await carousel.locator("[data-current=true] article").scrollIntoViewIfNeeded();
  await expect(current).toHaveText(CAPABILITIES[LEAD]);
  // In view, it starts playing (its slides stop announcing themselves) and gets a whole turn before moving on.
  await expect(carousel.locator("[data-slide-status]")).toHaveAttribute("aria-live", "off");
  await page.clock.runFor(ADVANCE_MS - TURN_MARGIN_MS);
  await expect(current).toHaveText(CAPABILITIES[LEAD]);
  await page.clock.runFor(TURN_MARGIN_MS * 2);
  await expect(current).not.toHaveText(CAPABILITIES[LEAD]);
});

test("a screen reader finds one heading per card: the face it shows, never the hidden one's", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  for (const name of FEATURED) {
    await carousel.getByRole("button", { name, exact: true }).click();
    const card = carousel.getByRole("article", { name: `${name} card` });
    const headings = card.getByRole("heading", { level: 2 });
    await expect(headings).toHaveCount(1);
    expect(await headings.evaluate(heading => Boolean(heading.closest(".card-front")))).toBe(true);
    await card.getByRole("button", { name: "Details", exact: true }).click();
    await expect(headings).toHaveCount(1);
    expect(await headings.evaluate(heading => Boolean(heading.closest(".card-back")))).toBe(true);
    expect((await card.ariaSnapshot()).match(/- heading /g)).toHaveLength(1);
    await card.getByRole("button", { name: "Close details" }).click();
  }
});

/** WCAG's focus appearance: a ring stands 3:1 off what it sits on. */
const MIN_FOCUS_CONTRAST = 3;
test(`every control on both faces of all fourteen cards shows a focus ring that stands ${MIN_FOCUS_CONTRAST}:1 off what it sits on`, async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: DESKTOP_WIDTH, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await openMoreExamples(carousel);
  const faint: string[] = [];
  const audit = (card: Locator, name: string, face: "front" | "back") => card.evaluate((article, [label, side, minimum]) => {
    // A canvas reads any CSS colour (rgb, color-mix, oklab) back as sRGB bytes.
    const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    const bytes = (colour: string) => { context.clearRect(0, 0, 1, 1); context.fillStyle = colour; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data]; };
    const luminance = (colour: string) => {
      const [red, green, blue] = bytes(colour).slice(0, 3).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };
    const contrast = (first: string, second: string) => { const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a); return (light + 0.05) / (dark + 0.05); };
    // The ring is drawn outside the control, so it sits on the nearest painted box around it.
    const backdrop = (start: Element | null) => {
      for (let node = start; node; node = node.parentElement) { const fill = getComputedStyle(node).backgroundColor; if (bytes(fill)[3] === 255) return fill; }
      return getComputedStyle(document.body).backgroundColor;
    };
    const face = article.querySelector(side === "front" ? ".card-front" : ".card-back")!;
    const controls = [...face.querySelectorAll<HTMLElement>("a[href], button, summary, [tabindex]:not([tabindex='-1'])")].filter(control => control.getClientRects().length);
    return controls.flatMap(control => {
      control.focus({ preventScroll: true });
      const style = getComputedStyle(control);
      const ratio = contrast(style.outlineColor, backdrop(control.parentElement));
      return style.outlineStyle === "none" || ratio < minimum ? [`${label} ${side} "${control.textContent!.trim().slice(0, 24)}": ${style.outlineStyle} ${style.outlineColor} on ${backdrop(control.parentElement)} = ${ratio.toFixed(2)}`] : [];
    });
  }, [name, face, MIN_FOCUS_CONTRAST] as const);
  for (const name of ALL_EXAMPLES) {
    await carousel.getByRole("button", { name, exact: true }).click();
    const card = carousel.getByRole("article", { name: `${name} card` });
    // A key press first, so focus moved by script shows the keyboard's ring.
    await page.keyboard.press("Shift");
    faint.push(...await audit(card, name, "front"));
    await card.getByRole("button", { name: "Details", exact: true }).click();
    await page.keyboard.press("Shift");
    faint.push(...await audit(card, name, "back"));
    await card.getByRole("button", { name: "Close details" }).click();
  }
  expect(faint).toEqual([]);
});

for (const width of [DESKTOP_WIDTH, PHONE_WIDTH, NARROWEST_WIDTH]) test(`nothing on either face of all fourteen cards reaches past its card's sides at ${width}px`, async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await openMoreExamples(carousel);
  const outside = (card: Locator, name: string, face: "front" | "back") => card.evaluate((article, [label, side]) => {
    const edge = article.getBoundingClientRect();
    const faceElement = article.querySelector(side === "front" ? ".card-front" : ".card-back")!;
    return [...faceElement.querySelectorAll("*")].flatMap(element => {
      const box = element.getBoundingClientRect();
      // A visually hidden copy is a 1px clipped box, read by a screen reader and never seen.
      if (box.width <= 1 || box.height <= 1 || getComputedStyle(element).visibility === "hidden") return [];
      let [left, right] = [box.left, box.right];
      // What a scrolling or clipping box inside the card cuts off (the calendar's) is not seen past the card.
      for (let node = element.parentElement; node && node !== article; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.overflowX !== "visible" || style.clipPath !== "none") { const clip = node.getBoundingClientRect(); left = Math.max(left, clip.left); right = Math.min(right, clip.right); }
      }
      if (right <= left) return [];
      const past = Math.max(edge.left - left, right - edge.right);
      return past > 0.5 ? [`${label} ${side} <${element.tagName.toLowerCase()} class="${element.getAttribute("class") ?? ""}"> "${(element.textContent ?? "").trim().slice(0, 30)}" ${Math.round(past)}px past`] : [];
    });
  }, [name, face] as const);
  const past: string[] = [];
  for (const name of ALL_EXAMPLES) {
    await carousel.getByRole("button", { name, exact: true }).click();
    const card = carousel.getByRole("article", { name: `${name} card` });
    past.push(...await outside(card, name, "front"));
    await card.getByRole("button", { name: "Details", exact: true }).click();
    await expect(card.getByRole("button", { name: "Close details" })).toBeVisible();
    past.push(...await outside(card, name, "back"));
    await card.getByRole("button", { name: "Close details" }).click();
  }
  expect(past).toEqual([]);
});

/** A touch's turn: a whole turn and a margin, well short of a second turn. */
const TOUCH_TURN_MS = 8500;
test(`on a ${PHONE_WIDTH}px touch screen one tap on Play moves the slideshow on within a turn`, async ({ browser }, testInfo) => {
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: { width: PHONE_WIDTH, height: PHONE_HEIGHT }, hasTouch: true, isMobile: true, reducedMotion: "no-preference" });
  const page = await context.newPage();
  await page.clock.install();
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await expect(carousel.getByRole("article", { name: `${LEAD} card` })).toBeVisible();
  await carousel.getByRole("button", { name: "Play slideshow" }).tap();
  await expect(carousel.getByRole("button", { name: "Pause slideshow" })).toBeVisible();
  // A tap is not a hover: nothing is left holding the slideshow once the finger lifts.
  await page.clock.runFor(TOUCH_TURN_MS);
  await expect(carousel.getByRole("article", { name: `${SECOND} card` })).toBeVisible();
  await context.close();
});

/** The phone's first screen: the card starts by here, under the heading and the two actions, and its number is above the examples row held at the screen's foot. */
const PHONE_CARD_TOP_PX = 380;
test(`at ${PHONE_WIDTH}x${PHONE_HEIGHT} the heading, the way to start and the card are all in the first screen, and the card holds still`, async ({ page }) => {
  await page.clock.install();
  await page.setViewportSize({ width: PHONE_WIDTH, height: PHONE_HEIGHT });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  const card = carousel.getByRole("article", { name: `${LEAD} card` });
  await expect(card).toBeVisible();
  const first = await card.evaluate((article, number) => ({
    top: article.getBoundingClientRect().top,
    numberBottom: article.querySelector(number)!.getBoundingClientRect().bottom,
    scrolled: scrollY,
  }), BIG_NUMBER);
  expect(first.scrolled).toBe(0);
  expect(first.top).toBeLessThanOrEqual(PHONE_CARD_TOP_PX);
  // The row's visible top edge is its bar's ruled border, just above the toggles.
  const barTop = await carousel.getByRole("group", { name: "Choose a product example" }).evaluate(group => group.parentElement!.getBoundingClientRect().top);
  expect(first.numberBottom).toBeLessThanOrEqual(barTop);
  // The card says it is a sample on its own front, so a cropped screenshot still says so.
  await expect(card.locator(".card-front .card-sample-tag")).toHaveText("Sample");
  await expect(card.locator(".card-front .card-sample-tag")).toBeVisible();
  expect(first.numberBottom).toBeLessThanOrEqual(PHONE_HEIGHT);
  // In reading order and on screen: the heading, the call to action, then the examples. The heading wraps as it needs to, and a
  // phone shows the way to start without a scroll.
  const order = await page.evaluate(() => {
    const [heading, examples] = ["#homepage-title", "#example"].map(selector => document.querySelector(selector)!);
    const start = [...document.querySelectorAll("main a")].find(link => link.textContent === "Start your collection")!;
    const before = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    const [box, startBox, examplesTop] = [heading.getBoundingClientRect(), start.getBoundingClientRect(), examples.getBoundingClientRect().top];
    return { headingThenStart: before(heading, start), startThenExamples: before(start, examples),
      headingShown: box.top >= 0 && box.right <= innerWidth && box.bottom <= startBox.top,
      startShown: startBox.left >= 0 && startBox.right <= innerWidth && startBox.bottom <= examplesTop && examplesTop <= innerHeight };
  });
  expect(order).toEqual({ headingThenStart: true, startThenExamples: true, headingShown: true, startShown: true });
  // On a phone the slideshow is in view from the start, so it waits for play rather than reflowing the copy under it.
  await expect(carousel.getByRole("button", { name: "Play slideshow" })).toBeVisible();
  await page.clock.runFor(ADVANCE_MS * 2);
  await expect(card).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const width of [DESKTOP_WIDTH, PHONE_WIDTH]) test(`at ${width}px Firecrawl's headline sets its phrase in the brand's orange, as its site sets its second line, and the rest stays dark`, async ({ page }) => {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await openMoreExamples(carousel);
  await carousel.getByRole("group", { name: "Choose a product example" }).getByRole("button", { name: "Firecrawl", exact: true }).click();
  const headline = carousel.getByRole("article", { name: "Firecrawl card" }).locator(".card-front .card-headline");
  await expect(headline.locator(".card-headline-accent")).toHaveText("clean Markdown");
  // Orange reads 3:1 on the card only as large text, so the headline holds 24px wherever the phrase is orange.
  expect(await headline.evaluate(element => ({
    size: getComputedStyle(element).fontSize, headline: getComputedStyle(element).color, phrase: getComputedStyle(element.querySelector(".card-headline-accent")!).color,
  }))).toEqual({ size: "24px", headline: "rgb(38, 38, 38)", phrase: "rgb(255, 76, 0)" });
});

const NARROWEST_HEIGHT = 700;
test(`at ${NARROWEST_WIDTH}x${NARROWEST_HEIGHT} the card's number is above the examples row in the first screen`, async ({ page }) => {
  await page.setViewportSize({ width: NARROWEST_WIDTH, height: NARROWEST_HEIGHT });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  const numbers = carousel.getByRole("article", { name: `${LEAD} card` }).locator(BIG_NUMBER);
  await expect(numbers).toHaveCount(1);
  const barTop = await carousel.getByRole("group", { name: "Choose a product example" }).evaluate(group => group.parentElement!.getBoundingClientRect().top);
  const bottoms = await numbers.evaluateAll(strongs => strongs.map(strong => strong.getBoundingClientRect().bottom));
  expect(bottoms.filter(bottom => bottom > barTop)).toEqual([]);
  // The smallest phone still shows the way to start above the card, without a scroll.
  const start = (await page.getByRole("link", { name: "Start your collection", exact: true }).first().boundingBox())!;
  expect(start.y + start.height).toBeLessThanOrEqual((await carousel.boundingBox())!.y);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

/** How far a tapped chooser button may move when the card under it changes. */
const MAX_CHOOSER_SHIFT_PX = 20;
test(`at ${PHONE_WIDTH}px the examples row fades at whichever edge has more names, so it reads as a row that scrolls`, async ({ page }) => {
  await page.setViewportSize({ width: PHONE_WIDTH, height: PHONE_HEIGHT });
  await page.goto("/");
  const row = page.getByRole("region", { name: "Product usage examples" }).getByRole("group", { name: "Choose a product example" }).locator("..");
  // Each soft edge is the bar's own colour over the names, so the held bar stays solid over the card behind it.
  const edges = () => row.evaluate(element => ({ more: element.scrollWidth > element.clientWidth,
    start: Number(getComputedStyle(element, "::before").opacity), end: Number(getComputedStyle(element, "::after").opacity) }));
  expect(await edges()).toEqual({ more: true, start: 0, end: 1 });
  const edge = await row.evaluate(element => {
    const [bar, soft] = [element.getBoundingClientRect(), getComputedStyle(element, "::after")];
    return { width: parseFloat(soft.width), sticks: soft.position, clicks: soft.pointerEvents, barWidth: bar.width, content: element.scrollWidth };
  });
  expect(edge).toMatchObject({ width: 32, sticks: "sticky", clicks: "none" });
  await row.evaluate(element => element.scrollTo({ left: element.scrollWidth, behavior: "instant" }));
  await expect.poll(edges).toEqual({ more: true, start: 1, end: 0 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const width of [PHONE_WIDTH, NARROWEST_WIDTH]) test(`at ${width}px picking an example from the chooser shows its card in view, and the tapped name stays put`, async ({ page }) => {
  await page.setViewportSize({ width, height: PHONE_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  const chooser = carousel.getByRole("group", { name: "Choose a product example" });
  // The chooser is one row, held at the foot of the screen while the examples are in view, so it is always under the thumb.
  const row = (await chooser.boundingBox())!;
  expect(row.height).toBeLessThanOrEqual(MIN_TAP_PX + 8);
  expect(row.y + row.height).toBeGreaterThan(PHONE_HEIGHT - MIN_TAP_PX - 16);
  expect(row.y + row.height).toBeLessThanOrEqual(PHONE_HEIGHT);
  await openMoreExamples(carousel);
  const pick = async (name: string) => {
    const toggle = chooser.getByRole("button", { name, exact: true });
    await toggle.scrollIntoViewIfNeeded();
    const before = (await toggle.boundingBox())!.y;
    await toggle.click();
    const card = carousel.getByRole("article", { name: `${name} card` });
    await expect(card).toBeVisible();
    const top = (await card.boundingBox())!.y;
    expect(top, name).toBeGreaterThanOrEqual(0);
    expect(top, name).toBeLessThanOrEqual(PHONE_HEIGHT / 2);
    expect(Math.abs((await toggle.boundingBox())!.y - before), name).toBeLessThanOrEqual(MAX_CHOOSER_SHIFT_PX);
  };
  for (const name of ["n8n", "Context.dev", "Clay"]) await pick(name);
  // Read down a card, then pick another: the new card's top comes into view and the row stays under the thumb.
  await page.evaluate(() => scrollBy(0, 200));
  await pick("GitHub");
  await page.evaluate(() => scrollBy(0, 300));
  await pick("Cloudflare");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const width of [PHONE_WIDTH, NARROWEST_WIDTH]) test(`at ${width}px the held row lets go once the card has scrolled up, so it never covers the copy and buttons below`, async ({ page }) => {
  await page.setViewportSize({ width, height: PHONE_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  const card = carousel.getByRole("article", { name: `${LEAD} card` });
  // Only the card's last 60px at the screen's top.
  await card.evaluate(article => scrollBy(0, article.getBoundingClientRect().bottom - 60));
  const chooser = carousel.getByRole("group", { name: "Choose a product example" });
  // The browser reports the card leaving the hold zone a frame or so after the scroll.
  await expect.poll(async () => (await chooser.boundingBox())!.y).toBeLessThan(PHONE_HEIGHT / 2);
  const [rowBox, cardBox] = [(await chooser.boundingBox())!, (await card.boundingBox())!];
  expect(rowBox.y).toBeGreaterThanOrEqual(cardBox.y + cardBox.height);
  const start = page.getByRole("link", { name: "Start your collection", exact: true }).first();
  await start.scrollIntoViewIfNeeded();
  // The row never covers the call to action: a real click lands on it.
  const box = (await start.boundingBox())!;
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("a")?.textContent, [box.x + box.width / 2, box.y + box.height / 2])).toBe("Start your collection");
});

const MIN_TEXT_PX = 12;
for (const width of [DESKTOP_WIDTH, PHONE_WIDTH]) test(`Firecrawl's front says its link is a referral link, readably, under the link at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await openMoreExamples(carousel);
  await carousel.getByRole("button", { name: "Firecrawl", exact: true }).click();
  const front = carousel.getByRole("article", { name: "Firecrawl card" }).locator(".card-front");
  const link = front.getByRole("link", { name: "Open Firecrawl · Referral link (opens in a new tab)" });
  const tag = front.locator(".card-link-disclosure");
  await expect(tag).toHaveText("Referral link");
  await expect(tag).toBeVisible();
  const [arrow, label] = [(await link.boundingBox())!, (await tag.boundingBox())!];
  const fontSize = await tag.evaluate(element => parseFloat(getComputedStyle(element).fontSize));
  expect(fontSize).toBeGreaterThanOrEqual(MIN_TEXT_PX);
  // Right under the arrow: centred on it where the card has room, and on a phone on its own row, flush with the arrow's right edge.
  expect(label.y - (arrow.y + arrow.height)).toBeLessThan(MIN_TEXT_PX);
  if (width === DESKTOP_WIDTH) expect(Math.abs(label.x + label.width / 2 - (arrow.x + arrow.width / 2))).toBeLessThan(2);
  else expect(Math.abs(label.x + label.width - (arrow.x + arrow.width))).toBeLessThan(2);
});

const ALL_EXAMPLES = ["Clay", "GitHub", "Cloudflare", "Docker", "Firecrawl", "n8n", "Claude Code", "Exa", "Porkbun", "Spider", "Open Places", "Grok Bot", "Elicit", "Context.dev"] as const;
/** Words a visitor shouldn't have to decode: a raw ISO date, a status word, "observation", "artifact". https://regex101.com/?regex=%5Cd%7B4%7D-%5Cd%7B2%7D-%5Cd%7B2%7D%7Cstale%7Cobserv%7Cartifact&flags=i&testString=Observed%202026-08-31%0Alast%20updated%201%20Sep%202026 */
const JARGON = /\d{4}-\d{2}-\d{2}|stale|observ|artifact/i;
test("no card face says a raw date or a status word, in its text, titles or labels, outside How this was measured", async ({ page }) => {
  await page.setViewportSize({ width: DESKTOP_WIDTH, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await openMoreExamples(carousel);
  const found: string[] = [];
  for (const name of ALL_EXAMPLES) {
    await carousel.getByRole("button", { name, exact: true }).click();
    const card = carousel.getByRole("article", { name: `${name} card` });
    const scan = (side: string) => card.evaluate((article, face) => {
      const root = article.querySelector(face)!;
      // A closed disclosure is where exact records are allowed; its panel is hidden, so it adds no innerText.
      const attributes = [...root.querySelectorAll("[title], [aria-label]")].filter(element => !element.closest("[data-slot=collapsible-panel][hidden]"))
        .flatMap(element => [element.getAttribute("title"), element.getAttribute("aria-label")].filter((value): value is string => Boolean(value)));
      return [(root as HTMLElement).innerText, ...attributes];
    }, side);
    const texts = [...await scan(".card-front"), ...await (async () => {
      await card.getByRole("button", { name: "Details", exact: true }).click();
      const back = await scan(".card-back");
      await card.getByRole("button", { name: "Close details" }).click();
      return back;
    })()];
    found.push(...texts.flatMap(text => text.split("\n")).filter(line => JARGON.test(line)).map(line => `${name}: ${line}`));
  }
  expect(found).toEqual([]);
});

const MIN_TAP_PX = 44;
for (const width of [PHONE_WIDTH, NARROWEST_WIDTH]) test(`at ${width}px every link and button on both faces of all fourteen cards is a ${MIN_TAP_PX}px-tall target`, async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width, height: PHONE_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await openMoreExamples(carousel);
  const short: string[] = [];
  const targets = (card: Locator, face: "front" | "back") => card.locator(`.card-${face}`).locator("a, button, summary").evaluateAll(elements => elements
    .filter(element => element.checkVisibility() && element.getBoundingClientRect().height < 44)
    .map(element => `${(element.getAttribute("aria-label") ?? element.textContent ?? "").trim().slice(0, 30)} (${element.getBoundingClientRect().height.toFixed(1)}px)`));
  for (const name of ALL_EXAMPLES) {
    await carousel.getByRole("group", { name: "Choose a product example" }).getByRole("button", { name, exact: true }).click();
    const card = carousel.getByRole("article", { name: `${name} card` });
    short.push(...(await targets(card, "front")).map(target => `${name} front: ${target}`));
    await card.getByRole("button", { name: "Details", exact: true }).click();
    await card.getByRole("button", { name: "How this was measured" }).click();
    short.push(...(await targets(card, "back")).map(target => `${name} back: ${target}`));
    await card.getByRole("button", { name: "Close details" }).click();
  }
  expect(short).toEqual([]);
});

/** The least space between two links on one row, so neither reads as part of the other. */
const MIN_LINK_SPACE_PX = 12;
test(`at ${PHONE_WIDTH}px every carousel control, back link and front link is a ${MIN_TAP_PX}px target`, async ({ page }) => {
  await page.setViewportSize({ width: PHONE_WIDTH, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await openMoreExamples(carousel);
  const short = async (scope: Locator, selector: string) => (await scope.locator(selector).evaluateAll(elements => elements
    .filter(element => element.getBoundingClientRect().width > 0)
    .map(element => ({ text: element.textContent!.trim().slice(0, 24), height: Math.floor(element.getBoundingClientRect().height), width: Math.floor(element.getBoundingClientRect().width) }))))
    .filter(({ height, width }) => height < MIN_TAP_PX || width < MIN_TAP_PX);
  expect(await short(carousel, ":scope > div button")).toEqual([]);
  await carousel.getByRole("button", { name: "Docker", exact: true }).click();
  const docker = carousel.getByRole("article", { name: "Docker card" });
  await docker.getByRole("button", { name: "Details", exact: true }).click();
  // Every link on the back: the product's site and How evidence works.
  expect((await short(docker, ".card-back a")).filter(({ height }) => height < MIN_TAP_PX)).toEqual([]);
  // A work sample's link, on its own line or beside its site, is a target too.
  await docker.getByRole("button", { name: "Close details" }).click();
  for (const name of ["Exa", "Clay"]) {
    await carousel.getByRole("button", { name, exact: true }).click();
    const card = carousel.getByRole("article", { name: `${name} card` });
    await card.getByRole("button", { name: "Details", exact: true }).click();
    expect((await short(card, ".card-back a")).filter(({ height }) => height < MIN_TAP_PX), name).toEqual([]);
    await card.getByRole("button", { name: "Close details" }).click();
  }
  await carousel.getByRole("button", { name: "Docker", exact: true }).click();
  await docker.getByRole("button", { name: "Details", exact: true }).click();
  // The back's two links share a row where they fit, never run together: a clear space between them, or one under the other.
  const [open, evidence] = await Promise.all([".outbound-link", ".evidence-link"].map(selector => docker.locator(`.card-back ${selector}`).boundingBox()));
  expect(evidence!.x >= open!.x + open!.width + MIN_LINK_SPACE_PX || evidence!.y >= open!.y + open!.height).toBe(true);
  // A paid link's tag sits apart from its arrow: "Open Firecrawl ↗  Referral link", not "↗Referral link".
  await docker.getByRole("button", { name: "Close details" }).click();
  await carousel.getByRole("button", { name: "Firecrawl", exact: true }).click();
  const firecrawl = carousel.getByRole("article", { name: "Firecrawl card" });
  await firecrawl.getByRole("button", { name: "Details", exact: true }).click();
  const gap = await firecrawl.locator(".card-back .outbound-link").evaluate(link => {
    const label = link.querySelector(".card-link-disclosure")!;
    const tag = label.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(label.previousSibling!);
    const words = range.getBoundingClientRect();
    return tag.top >= words.bottom - 1 ? Infinity : tag.left - words.right;
  });
  expect(gap).toBeGreaterThanOrEqual(MIN_TEXT_PX / 2);
});

test(`at ${PHONE_WIDTH}px GitHub's calendar keeps its weekday labels and shows no month label cut at the edge`, async ({ page }) => {
  await page.setViewportSize({ width: PHONE_WIDTH, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await carousel.getByRole("button", { name: "GitHub", exact: true }).click();
  const calendar = carousel.getByRole("article", { name: "GitHub card" }).locator(".card-front .contribution-scroll");
  await expect(calendar).toBeVisible();
  const view = () => calendar.evaluate(element => {
    const box = element.getBoundingClientRect();
    const weekdays = element.querySelector(".contribution-weekdays")!.getBoundingClientRect();
    const months = [...element.querySelectorAll<HTMLElement>(".contribution-months span")].filter(label => getComputedStyle(label).visibility !== "hidden");
    return {
      weekdaysInView: weekdays.left >= box.left - 1 && weekdays.width > 0,
      cutLabels: months.filter(label => label.getBoundingClientRect().left < weekdays.right - 1).map(label => label.textContent),
    };
  });
  // Opened at the newest week, and again after scrolling back part of the way.
  await expect.poll(view).toEqual({ weekdaysInView: true, cutLabels: [] });
  await calendar.evaluate(element => { element.scrollLeft -= 37; });
  await expect.poll(view).toEqual({ weekdaysInView: true, cutLabels: [] });
});

test("opening More examples mounts none of the nine; each mounts when it is picked or comes next", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  const slides = carousel.locator("[aria-roledescription=slide]");
  await openMoreExamples(carousel);
  await expect(slides).toHaveCount(FEATURED.length);
  await carousel.getByRole("button", { name: "Spider", exact: true }).click();
  // Spider, and Open Places because it comes next.
  expect(await slides.evaluateAll(elements => elements.map(element => element.getAttribute("data-example")))).toEqual(["github", "elicit", "cloudflare", "clay", "docker", "spider", "open-places"]);
  await expect(slides.filter({ has: page.getByRole("article", { name: "Spider card" }) })).toHaveAttribute("aria-label", "11 of 14: Spider");
});

/**
 * The look of the five featured cards, held by geometry and computed style rather than pixel baselines, which differ between
 * macOS and CI's Linux: each one's brand surface, band and heading face, what its front draws, its biggest number, its sizes.
 */
const FEATURED_LOOK = [
  { name: "GitHub", slug: "github", surface: "rgb(255, 255, 255)", band: null, draws: "calendar" },
  { name: "Elicit", slug: "elicit", surface: "rgb(252, 252, 248)", band: null, draws: "per week bars" },
  { name: "Cloudflare", slug: "cloudflare", surface: "rgb(255, 255, 255)", band: "rgb(255, 94, 31)", draws: "per day bars" },
  // Clay's green hero covers the header as one slab, over its warm grey second surface.
  { name: "Clay", slug: "clay", surface: "rgb(244, 243, 240)", band: "rgb(3, 93, 68)", draws: "numbers" },
  { name: "Docker", slug: "docker", surface: "rgb(249, 250, 251)", band: "rgb(15, 17, 23)", draws: "number" },
] as const;
const MAX_FACE_DIFFERENCE_PX = 80;
const MIN_BAND_CONTRAST = 4.5, MIN_LARGE_BAND_CONTRAST = 3;

for (const width of [DESKTOP_WIDTH, PHONE_WIDTH]) test(`the five featured cards hold their look at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  const looks = [];
  for (const look of FEATURED_LOOK) {
    await carousel.getByRole("button", { name: look.name, exact: true }).click();
    const card = carousel.getByRole("article", { name: `${look.name} card` });
    await expect(card).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const front = await card.evaluate((article, minTap) => {
      const luminance = (colour: string) => {
        const [red, green, blue] = colour.match(/\d+/g)!.slice(0, 3).map(Number).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
        return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      };
      const contrast = (first: string, second: string) => {
        const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
        return (light + 0.05) / (dark + 0.05);
      };
      const face = article.querySelector<HTMLElement>(".card-front")!;
      const headline = getComputedStyle(face.querySelector(".card-headline")!);
      const bars = [...face.querySelectorAll(".activity-bars > span")];
      const draws = face.querySelector(".usage-measurement-stats") ? "numbers" : face.querySelector(".contribution-calendar") ? "calendar"
        : bars.length ? `${bars[0].getAttribute("title")!.match(/per (day|week)/)![0]} bars` : face.querySelector(".card-activity-preview strong") ? "number" : "nothing";
      // Every bit of visible text on the front, at its rendered size; the screen-reader table is not drawn.
      const walker = document.createTreeWalker(face, NodeFilter.SHOW_TEXT);
      const sizes: number[] = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement!;
        if (!node.textContent!.trim() || parent.closest(".visually-hidden") || !parent.getBoundingClientRect().width) continue;
        sizes.push(parseFloat(getComputedStyle(parent).fontSize));
      }
      const numbers = [...face.querySelectorAll(".card-activity-preview > p:first-child strong, .usage-measurement-stats strong")].map(number => Number(number.textContent!.replaceAll(",", "")));
      const targets = [...face.querySelectorAll("a, button")].map(target => target.getBoundingClientRect()).filter(box => box.width && box.height < minTap).length;
      return {
        surface: getComputedStyle(article).backgroundColor, band: article.hasAttribute("data-band") ? headline.backgroundColor : null,
        // A headline at WCAG's large size (24px, or bold at 18.66px) needs 3:1 on its band; a smaller one needs 4.5:1.
        bandContrast: article.hasAttribute("data-band") ? contrast(headline.color, headline.backgroundColor) : null,
        bandLarge: parseFloat(headline.fontSize) >= 24 || (parseFloat(headline.fontWeight) >= 700 && parseFloat(headline.fontSize) >= 18.66),
        headlineFace: headline.fontFamily.split(",")[0].replaceAll('"', ""), nameFace: getComputedStyle(face.querySelector("h2")!).fontFamily.split(",")[0].replaceAll('"', ""),
        draws, smallestText: Math.min(...sizes), biggestNumber: Math.max(...numbers), shortTargets: targets,
        height: article.getBoundingClientRect().height,
      };
    }, MIN_TAP_PX);
    await card.getByRole("button", { name: "Details", exact: true }).click();
    const back = await card.evaluate(article => {
      const box = article.getBoundingClientRect();
      const content = [...article.querySelectorAll(".card-back-content > *")].at(-1)!.getBoundingClientRect();
      return { height: box.height, contentBottom: content.bottom - box.top, logo: Boolean(article.querySelector(".card-back-topline .product-logo")) };
    });
    await card.getByRole("button", { name: "Close details" }).click();
    looks.push({
      name: look.name, surface: front.surface, band: front.band, draws: front.draws,
      faces: front.headlineFace.startsWith(`PRBrand-${look.slug}-`) && front.headlineFace.endsWith("-heading") && front.nameFace === front.headlineFace,
      bandReadable: front.bandContrast === null || front.bandContrast >= (front.bandLarge ? MIN_LARGE_BAND_CONTRAST : MIN_BAND_CONTRAST),
      textAtLeast12: front.smallestText >= MIN_TEXT_PX, leadsWithZero: front.biggestNumber === 0,
      // The card keeps its size turned over, and its back's content ends within the target of the front's height.
      // At 1440 the card keeps its size turned over, within the target. On a phone the back carries what the front can't fit
      // (Cloudflare's 31 values), so it may be taller; it never shrinks, and the turn keeps the card's top in place (tested below).
      faceDifference: back.height >= front.height - 1 && (width === PHONE_WIDTH || (Math.abs(back.height - front.height) <= MAX_FACE_DIFFERENCE_PX && back.contentBottom <= front.height + MAX_FACE_DIFFERENCE_PX)),
      backLogo: back.logo, shortTargets: width === PHONE_WIDTH ? front.shortTargets : 0,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), look.name).toBe(true);
  }
  expect(looks).toEqual(FEATURED_LOOK.map(look => ({
    name: look.name, surface: look.surface, band: look.band, draws: look.draws, faces: true, bandReadable: true,
    textAtLeast12: true, leadsWithZero: false, faceDifference: true, backLogo: true, shortTargets: 0,
  })));
  // Each card leads with its tool's own number, so two featured fronts are a number alone: Clay's published one and Docker's running total.
});

/** What each featured card takes from its measured site beyond the kit: case, number face, second surface. */
for (const width of [DESKTOP_WIDTH, PHONE_WIDTH]) test(`the featured cards carry their sites' measured feel at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  const feel = async (name: string) => {
    await carousel.getByRole("button", { name, exact: true }).click();
    const card = carousel.getByRole("article", { name: `${name} card` });
    await expect(card).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    return card.evaluate(article => {
      const style = (selector: string) => { const element = article.querySelector(selector); return element ? getComputedStyle(element) : undefined; };
      return {
        eyebrowCase: style(".card-front .eyebrow")!.textTransform,
        numberFont: style(".card-front .card-activity-preview > p:first-child strong, .card-front .usage-measurement-stats strong")!.fontFamily.split(",")[0].replaceAll('"', ""),
        numberColour: style(".card-front .card-activity-preview > p:first-child strong, .card-front .usage-measurement-stats strong")!.color,
        panel: style(".card-front :is(.contribution-calendar, .usage-chart)")?.backgroundColor,
      };
    });
  };
  const looks: Record<string, Awaited<ReturnType<typeof feel>>> = {};
  for (const name of FEATURED) looks[name] = await feel(name);
  // Neither Cloudflare's nor Clay's first screen sets its small labels in capitals, so both stay as typed.
  expect([looks.Cloudflare.eyebrowCase, looks.Clay.eyebrowCase]).toEqual(["none", "none"]);
  // GitHub's biggest number is green, as on github.com, in GitHub's own served face: the card serves no Mona Sans Mono, and a system mono spaced it like code.
  expect(looks.GitHub.numberFont).toMatch(/^PRBrand-github-\w+-heading$/);
  expect(looks.GitHub.numberColour).toBe("rgb(8, 135, 43)");
  // Clay and Docker draw no panel, only their number; GitHub's calendar framed on white.
  expect([looks.Clay.panel, looks.Docker.panel, looks.GitHub.panel]).toEqual([undefined, undefined, "rgb(255, 255, 255)"]);
});

test("GitHub's calendar draws 8px days with 2px gaps at 1440px, says on a phone that it scrolls, and reads as one summary line", async ({ page }) => {
  await page.setViewportSize({ width: DESKTOP_WIDTH, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await carousel.getByRole("button", { name: "GitHub", exact: true }).click();
  const calendar = carousel.getByRole("article", { name: "GitHub card" }).locator(".card-front .contribution-calendar");
  const cells = await calendar.evaluate(element => {
    const [first, second] = [element.querySelector('[data-date="2025-09-01"]')!, element.querySelector('[data-date="2025-09-02"]')!].map(cell => cell.getBoundingClientRect());
    return { size: Math.round(first.width), gap: Math.round(second.top - first.bottom), radius: getComputedStyle(element.querySelector("[data-date]")!).borderRadius,
      scrolls: element.querySelector(".contribution-scroll")!.scrollWidth > element.querySelector(".contribution-scroll")!.clientWidth };
  });
  expect(cells).toEqual({ size: 8, gap: 2, radius: "2px", scrolls: false });
  // One line for a screen reader, not 365 images.
  await expect(calendar.getByRole("img")).toHaveCount(0);
  await expect(calendar.locator(".contribution-summary")).toHaveText(/^\d[\d,]* contributions from 1 Sep 2025 to 31 Aug 2026, on \d+ of 365 days; the most in a day was \d+, on \d+ \w+ \d{4}\.$/);
  await expect(calendar.getByText("Scroll for earlier months")).toBeHidden();
  await page.setViewportSize({ width: PHONE_WIDTH, height: VIEWPORT_HEIGHT });
  await expect(calendar.getByText("Scroll for earlier months")).toBeVisible();
});

/** WCAG's large text: 24px and up, where a colour needs 3:1 rather than 4.5:1. */
const LARGE_TEXT_PX = 24, LARGE_TEXT_CONTRAST = 3;
test("a colour hero's slab covers the header, an inset hero rounds the card, and a brand-coloured number is large text that reads", async ({ page }) => {
  await page.setViewportSize({ width: DESKTOP_WIDTH, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  const look = async (name: string) => {
    await carousel.getByRole("button", { name, exact: true }).click();
    const card = carousel.getByRole("article", { name: `${name} card` });
    await expect(card).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    return card.evaluate((article, [largePx, largeContrast]) => {
      const luminance = (colour: string) => {
        const [red, green, blue] = colour.match(/\d+/g)!.slice(0, 3).map(Number).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
        return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      };
      const contrast = (first: string, second: string) => { const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a); return (light + 0.05) / (dark + 0.05); };
      const backdrop = (start: Element) => {
        for (let node: Element | null = start; node; node = node.parentElement) { const fill = getComputedStyle(node).backgroundColor; if (fill !== "rgba(0, 0, 0, 0)") return fill; }
        return "rgb(255, 255, 255)";
      };
      const text = getComputedStyle(article).color;
      // Every big number in a colour other than the card's text is large text at 3:1; a number that can't be is in the text colour.
      const numbers = [...article.querySelectorAll(".card-front :is(.card-activity-preview > p:first-child strong, .usage-measurement-stats strong)")].map(number => {
        const style = getComputedStyle(number);
        return style.color === text || (parseFloat(style.fontSize) >= largePx && contrast(style.color, backdrop(number)) >= largeContrast);
      });
      return { topline: getComputedStyle(article.querySelector(".card-front > .card-topline")!).backgroundColor, radius: getComputedStyle(article).borderTopLeftRadius, numbersRead: numbers.every(Boolean) };
    }, [LARGE_TEXT_PX, LARGE_TEXT_CONTRAST] as const);
  };
  const looks: Record<string, Awaited<ReturnType<typeof look>>> = {};
  for (const name of FEATURED) looks[name] = await look(name);
  // Clay's green, Docker's dark and Cloudflare's orange hero cover the whole header; Cloudflare's 16px inset slab also rounds the card.
  expect(Object.fromEntries(FEATURED.map(name => [name, looks[name].topline]))).toEqual({
    GitHub: "rgba(0, 0, 0, 0)", Elicit: "rgba(0, 0, 0, 0)", Cloudflare: "rgb(255, 94, 31)", Clay: "rgb(3, 93, 68)", Docker: "rgb(15, 17, 23)",
  });
  expect([looks.Cloudflare.radius, looks.Docker.radius]).toEqual(["16px", "18px"]);
  // A brand-coloured number that reads only 3:1 on its surface is allowed only because it is drawn at 24px or more.
  expect(Object.fromEntries(FEATURED.map(name => [name, looks[name].numbersRead]))).toEqual(Object.fromEntries(FEATURED.map(name => [name, true])));
});

test("a slab card's back keeps one slab at its top: its note under the header is not banded in the slab colour again", async ({ page }) => {
  await page.setViewportSize({ width: DESKTOP_WIDTH, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  for (const name of ["Clay", "Docker"]) {
    await carousel.getByRole("button", { name, exact: true }).click();
    const card = carousel.getByRole("article", { name: `${name} card` });
    await card.getByRole("button", { name: "Details", exact: true }).click();
    const [topline, note] = await card.evaluate(article => [".card-back-topline", ".card-back blockquote"].map(selector => getComputedStyle(article.querySelector(selector)!).backgroundColor));
    expect(note, name).not.toBe(topline);
    await card.getByRole("button", { name: "Close details" }).click();
  }
});

test("the work-sample link on Clay's back lights up in Clay's lime on hover, not the card's black", async ({ page }) => {
  await page.setViewportSize({ width: DESKTOP_WIDTH, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const clay = await showClay(page);
  await clay.getByRole("button", { name: "Details", exact: true }).click();
  const link = clay.getByRole("link", { name: /See how I use it/ });
  await link.hover();
  await expect(link).toHaveCSS("background-color", "rgb(203, 216, 16)");
  await expect(link).toHaveCSS("color", "rgb(0, 0, 0)");
});

test("Clay's Details and Close details keep Clay's lime and black on hover, not the card's black", async ({ page }) => {
  await page.setViewportSize({ width: DESKTOP_WIDTH, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const clay = await showClay(page);
  const details = clay.getByRole("button", { name: "Details", exact: true });
  await details.hover();
  await expect(details).toHaveCSS("background-color", "rgb(203, 216, 16)");
  await expect(details).toHaveCSS("color", "rgb(0, 0, 0)");
  await details.click();
  const close = clay.getByRole("button", { name: "Close details" });
  await close.hover();
  await expect(close).toHaveCSS("background-color", "rgb(203, 216, 16)");
  await expect(close).toHaveCSS("color", "rgb(0, 0, 0)");
});

const MAX_FLIP_SCROLL_PX = 20;
for (const width of [DESKTOP_WIDTH, PHONE_WIDTH, NARROWEST_WIDTH]) for (const name of FEATURED) test(`at ${width}px turning ${name}'s card while it is in view moves neither the page nor the card`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === DESKTOP_WIDTH ? VIEWPORT_HEIGHT : PHONE_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await carousel.getByRole("button", { name, exact: true }).click();
  const card = carousel.getByRole("article", { name: `${name} card` });
  await expect(card).toBeVisible();
  // The whole card on screen, its top just under the screen's top.
  await card.evaluate(article => scrollBy(0, article.getBoundingClientRect().top - 10));
  const before = await card.evaluate(article => ({ scroll: scrollY, top: article.getBoundingClientRect().top }));
  await card.getByRole("button", { name: "Details", exact: true }).click();
  await expect(card.getByRole("button", { name: "Close details" })).toBeVisible();
  // Its back may run longer than its front, below the card; its top stays put.
  const after = await card.evaluate(article => ({ scroll: scrollY, top: article.getBoundingClientRect().top, focused: document.activeElement?.tagName }));
  expect(Math.abs(after.scroll - before.scroll)).toBeLessThanOrEqual(MAX_FLIP_SCROLL_PX);
  expect(Math.abs(after.top - before.top)).toBeLessThanOrEqual(MAX_FLIP_SCROLL_PX);
  expect(after.focused).toBe("H2");
});

for (const width of [PHONE_WIDTH, NARROWEST_WIDTH]) test(`at ${width}px turning a card over from its foot, its top scrolled above the screen, shows the back's top, and closing it shows Details again`, async ({ page }) => {
  await page.setViewportSize({ width, height: PHONE_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  const card = await showClay(page);
  const details = card.getByRole("button", { name: "Details", exact: true });
  // Read to the card's foot, so the card's top is above the screen and Details is still on it.
  await card.evaluate(article => scrollBy(0, article.getBoundingClientRect().top + 40));
  expect(await card.evaluate(article => article.getBoundingClientRect().top)).toBeLessThan(0);
  await details.click();
  const close = card.getByRole("button", { name: "Close details" });
  await expect(close).toBeVisible();
  const turned = await card.evaluate(article => ({ top: Math.round(article.getBoundingClientRect().top),
    close: Math.round(article.querySelector(".close-button")!.getBoundingClientRect().top), focused: document.activeElement?.tagName }));
  expect(turned.top).toBeGreaterThanOrEqual(0);
  expect(turned.top).toBeLessThanOrEqual(MAX_FLIP_SCROLL_PX);
  expect(turned.close).toBeGreaterThanOrEqual(0);
  expect(turned.focused).toBe("H2");
  // Closing from the back's top brings Details into view, clear of the row held at the screen's foot.
  await close.click();
  await expect(details).toBeFocused();
  const box = (await details.boundingBox())!;
  const row = (await carousel.getByRole("group", { name: "Choose a product example" }).boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(row.y);
});

/*
 * No test holds a back to its front's height any more. Each front now leads with one number and a use line (no uses list, no table),
 * so a back that lists a chart's every value runs longer: at 1440 Clay, Cloudflare and Firecrawl grow 19-30px when they turn, and at
 * 320 GitHub grows 111px (measured on macOS, 15 Nov 2026). What a visitor feels is the page moving, and the test above holds every
 * featured card's top and the page still across the turn at every width.
 */
/** The most a back's last line may sit above the card's bottom edge: its padding and a little. */
const MAX_BACK_GAP_PX = 24;
for (const width of [DESKTOP_WIDTH, PHONE_WIDTH]) test(`each featured back holds what its front cannot, fills its card and closes with the brand's button at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  const found: Record<string, unknown> = {};
  for (const name of FEATURED) {
    await carousel.getByRole("button", { name, exact: true }).click();
    const card = carousel.getByRole("article", { name: `${name} card` });
    const details = card.getByRole("button", { name: "Details", exact: true });
    const detailsFill = await details.evaluate(button => getComputedStyle(button).backgroundColor);
    await details.click();
    const back = card.locator(".card-back");
    await expect(back).toBeVisible();
    const close = card.getByRole("button", { name: "Close details" });
    found[name] = await card.evaluate(article => {
      const box = article.getBoundingClientRect();
      const last = Math.max(...[...article.querySelectorAll(".card-back-content > *")].map(element => element.getBoundingClientRect().bottom));
      return { gap: Math.round(box.bottom - last) };
    });
    expect((found[name] as { gap: number }).gap, name).toBeLessThanOrEqual(MAX_BACK_GAP_PX);
    // Close details is the brand's button, except where its fill is the slab's own colour: there it takes the card's surface, as Cloudflare's hero button is white.
    expect(await close.evaluate(button => getComputedStyle(button).backgroundColor), name).toBe(name === "Cloudflare" ? "rgb(255, 255, 255)" : detailsFill);
    await close.click();
  }
  // What only the back holds: Cloudflare's day-by-day values.
  await carousel.getByRole("button", { name: "Cloudflare", exact: true }).click();
  const cloudflare = carousel.getByRole("article", { name: "Cloudflare card" });
  await cloudflare.getByRole("button", { name: "Details", exact: true }).click();
  // Every day, at once where the card is wide; on a phone its highest days, and every day one press away.
  const everyDay = cloudflare.getByRole("list", { name: "requests, each day" });
  if (width !== DESKTOP_WIDTH) {
    await expect(cloudflare.getByRole("list", { name: "Highest days" }).getByRole("listitem")).toHaveCount(4);
    await cloudflare.getByRole("button", { name: "All 31 days" }).click();
  }
  await expect(everyDay.getByRole("listitem")).toHaveCount(31);
  await expect(everyDay.getByRole("listitem").first()).toHaveText("1 Aug28,400");
  await cloudflare.getByRole("button", { name: "Close details" }).click();
});

for (const width of [DESKTOP_WIDTH, PHONE_WIDTH]) test(`no back of the fourteen leaves an empty band over ${MAX_BACK_GAP_PX}px between its lines or under them at ${width}px`, async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await openMoreExamples(carousel);
  const bands: Record<string, number> = {};
  for (const name of ALL_EXAMPLES) {
    await carousel.getByRole("group", { name: "Choose a product example" }).getByRole("button", { name, exact: true }).click();
    const card = carousel.getByRole("article", { name: `${name} card` });
    await card.getByRole("button", { name: "Details", exact: true }).click();
    // The widest stretch of the back with nothing on it: between two of its lines, or under the last one.
    bands[name] = await card.evaluate(article => {
      const lines = [...article.querySelectorAll(".card-back-topline, .card-back-content > *")].filter(element => element.checkVisibility())
        .map(element => element.getBoundingClientRect()).sort((a, b) => a.top - b.top);
      const style = getComputedStyle(article);
      const floor = article.getBoundingClientRect().bottom - parseFloat(style.paddingBottom) - parseFloat(style.borderBottomWidth);
      return Math.round(Math.max(...lines.map((line, index) => (index + 1 < lines.length ? lines[index + 1].top : floor) - line.bottom)));
    });
    await card.getByRole("button", { name: "Close details" }).click();
  }
  expect(Object.entries(bands).filter(([, band]) => band > MAX_BACK_GAP_PX)).toEqual([]);
});

test("a sample's How this was measured speaks in plain dates, keeps the exact value in the markup, and claims no source or coverage", async ({ page }) => {
  await page.setViewportSize({ width: DESKTOP_WIDTH, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const card = await showClay(page);
  await card.getByRole("button", { name: "Details", exact: true }).click();
  await card.getByRole("button", { name: "How this was measured" }).click();
  const panel = card.locator(".card-provenance-panel");
  await expect(panel).toBeVisible();
  const text = await panel.innerText();
  expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}|Source-reported value|Coverage: complete/);
  expect(text).toContain("Synthetic sample. Not real account activity.");
  await expect(panel.locator("time[datetime='2026-09-01T00:00:00.000Z']").first()).toHaveText("1 Sep 2026");
});

test("mid-turn, the incoming face stays inside the card's edge, so none of it is cut off", async ({ page }) => {
  await page.setViewportSize({ width: PHONE_WIDTH, height: PHONE_HEIGHT });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const card = await showClay(page);
  await card.evaluate(article => scrollBy(0, article.getBoundingClientRect().top - 10));
  await card.getByRole("button", { name: "Details", exact: true }).click();
  // Every moment of the turn, the incoming back's drawn box against the card's.
  const overhang = await card.evaluate(article => {
    const back = article.querySelector<HTMLElement>(".card-back")!;
    const turn = back.getAnimations()[0];
    if (!turn) return [];
    turn.pause();
    const total = Number(turn.effect!.getComputedTiming().duration);
    const outer = article.getBoundingClientRect();
    return Array.from({ length: 11 }, (_, step) => {
      turn.currentTime = (total * step) / 10;
      const face = back.getBoundingClientRect();
      return Math.round(Math.max(outer.left - face.left, face.right - outer.right, outer.top - face.top, face.bottom - outer.bottom));
    }).filter(over => over > 0);
  });
  expect(overhang).toEqual([]);
});

test("with motion allowed the card visibly turns over, in under 300ms; with reduced motion it does not move", async ({ page }) => {
  await page.setViewportSize({ width: DESKTOP_WIDTH, height: VIEWPORT_HEIGHT });
  for (const motion of ["no-preference", "reduce"] as const) {
    await page.emulateMedia({ reducedMotion: motion });
    await page.goto("/");
    const card = await showClay(page);
    await card.getByRole("button", { name: "Details", exact: true }).click();
    const turn = await card.locator(".card-back").evaluate(back => ({ name: getComputedStyle(back).animationName, seconds: parseFloat(getComputedStyle(back).animationDuration) }));
    if (motion === "reduce") expect(turn.name).toBe("none");
    else expect(turn).toEqual({ name: "card-turn-over", seconds: turn.seconds > 0 && turn.seconds <= 0.3 ? turn.seconds : NaN });
  }
});

for (const width of [DESKTOP_WIDTH, PHONE_WIDTH]) test(`all fourteen fronts say Sample once, set no text under 12px and draw bars that stand 3:1 off their backdrop at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await openMoreExamples(carousel);
  const found: string[] = [];
  for (const name of ALL_EXAMPLES) {
    await carousel.getByRole("button", { name, exact: true }).click();
    const card = carousel.getByRole("article", { name: `${name} card` });
    await expect(card).toBeVisible();
    await expect(card.locator(".card-front .card-sample-tag"), name).toHaveText("Sample");
    // Sample once: the card's tag, and on a wide screen the one line above the card; never again on what a visitor sees of the slide.
    const marks = await carousel.locator("[data-current=true]").evaluate(slide => {
      const words: string[] = [];
      const walker = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement!;
        if (parent.closest(".card-back, .visually-hidden") || !parent.checkVisibility()) continue;
        const where = parent.classList.contains("card-sample-tag") ? "tag" : parent.closest(".product-card") ? "card" : "slide";
        words.push(...(node.textContent!.match(/sample|synthetic|illustrative|invented/gi) ?? []).map(word => `${where}:${word}`));
      }
      return words;
    });
    expect(marks, name).toEqual(width > PHONE_ONLY_MAX_PX ? ["slide:Sample", "tag:Sample"] : ["tag:Sample"]);
    const front = await card.evaluate(article => {
      const luminance = (colour: string) => {
        const scale = colour.startsWith("color(") ? 1 : 255;
        const [red, green, blue] = colour.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => value / scale).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
        return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      };
      const contrast = (first: string, second: string) => { const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a); return (light + 0.05) / (dark + 0.05); };
      const backdrop = (start: Element) => {
        for (let node: Element | null = start.parentElement; node; node = node.parentElement) {
          const fill = getComputedStyle(node).backgroundColor;
          if (fill !== "rgba(0, 0, 0, 0)" && fill !== "transparent") return fill;
        }
        return "rgb(255, 255, 255)";
      };
      const face = article.querySelector(".card-front")!;
      const walker = document.createTreeWalker(face, NodeFilter.SHOW_TEXT);
      const small: string[] = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement!;
        if (!node.textContent!.trim() || parent.closest(".visually-hidden") || !parent.getBoundingClientRect().width) continue;
        if (parseFloat(getComputedStyle(parent).fontSize) < 12) small.push(node.textContent!.trim());
      }
      const bar = face.querySelector(".activity-bars > span:not([data-zero])");
      // An outlined bar (a brand that draws in lines) is drawn in its border; a filled one in its fill.
      const ink = bar && (parseFloat(getComputedStyle(bar).borderTopWidth) > 0 ? getComputedStyle(bar).borderTopColor : getComputedStyle(bar).backgroundColor);
      return { small, barContrast: bar ? contrast(ink!, backdrop(bar)) : undefined };
    });
    found.push(...front.small.map(text => `${name}: ${text}`));
    if (front.barContrast !== undefined && front.barContrast < 3) found.push(`${name}: bars ${front.barContrast.toFixed(2)}:1`);
  }
  expect(found).toEqual([]);
});

test(`at ${PHONE_WIDTH}px GitHub's source link under its card is a ${MIN_TAP_PX}px target`, async ({ page }) => {
  await page.setViewportSize({ width: PHONE_WIDTH, height: VIEWPORT_HEIGHT });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await carousel.getByRole("button", { name: "GitHub", exact: true }).click();
  const link = carousel.getByRole("link", { name: "GitHub contribution definitions ↗" });
  expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(MIN_TAP_PX);
});

/**
 * The nine behind More examples hold the same look floors as the five featured: each branded card on its brand's surface, its
 * headline and name in the brand's heading face, and every text, bar and button on both faces at its WCAG contrast. Claude Code
 * and Grok Bot have no stored brand (their domains belong to a parent company). Claude Code takes claude.com's ivory from its own
 * measured page, in system faces; x.ai blocked the measurement, so Grok Bot keeps the house card.
 */
const OTHER_LOOK = [
  { name: "Firecrawl", slug: "firecrawl", surface: "rgb(249, 249, 249)" },
  { name: "n8n", slug: "n8n", surface: "rgb(250, 250, 250)" },
  { name: "Claude Code", slug: undefined, surface: "rgb(250, 249, 245)" },
  { name: "Exa", slug: "exa", surface: "rgb(255, 255, 255)" },
  { name: "Porkbun", slug: "porkbun", surface: "rgb(254, 249, 249)" },
  { name: "Spider", slug: "spider", surface: "rgb(12, 14, 19)" },
  { name: "Open Places", slug: "open-places", surface: "rgb(247, 245, 239)" },
  { name: "Grok Bot", slug: undefined, surface: "rgb(37, 37, 31)" },
  { name: "Context.dev", slug: "context-dev", surface: "rgb(255, 255, 255)" },
] as const;

/** Runs in the page: every visible text, the first bar and the button on the card's shown face, each under its WCAG floor. */
function contrastFailures(article: Element) {
  const face = article.querySelector(article.getAttribute("data-side") === "back" ? ".card-back" : ".card-front")!;
  const rgb = (colour: string) => {
    const scale = colour.startsWith("color(srgb") ? 255 : 1, [red, green, blue, alpha = 1] = colour.match(/[\d.]+/g)!.map(Number);
    return { channels: [red * scale, green * scale, blue * scale], alpha };
  };
  const luminance = (channels: number[]) => channels.map(value => value / 255).map(value => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const ratio = (first: number[], second: number[]) => { const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a); return (light + 0.05) / (dark + 0.05); };
  const behind = (element: Element | null) => {
    for (let node = element; node; node = node.parentElement) { const fill = rgb(getComputedStyle(node).backgroundColor); if (fill.alpha > 0.5) return fill.channels; }
    return [255, 255, 255];
  };
  const failures: string[] = [];
  for (const element of face.querySelectorAll<HTMLElement>("*")) {
    if (!element.checkVisibility() || element.closest(".visually-hidden") || ![...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent!.trim())) continue;
    const style = getComputedStyle(element), size = parseFloat(style.fontSize);
    const floor = size >= 24 || (Number(style.fontWeight) >= 700 && size >= 18.66) ? 3 : 4.5;
    const measured = ratio(rgb(style.color).channels, behind(element));
    if (measured < floor - 0.005) failures.push(`${element.textContent!.trim().slice(0, 30)}: ${measured.toFixed(2)} < ${floor}`);
  }
  const bar = face.querySelector(".activity-bars > span:not([data-zero])");
  if (bar) {
    const style = getComputedStyle(bar), ink = parseFloat(style.borderTopWidth) > 0 ? style.borderTopColor : style.backgroundColor;
    const measured = ratio(rgb(ink).channels, behind(bar.parentElement));
    if (measured < 3) failures.push(`bar: ${measured.toFixed(2)} < 3`);
  }
  return failures;
}

for (const width of [DESKTOP_WIDTH, PHONE_WIDTH, NARROWEST_WIDTH]) test(`the nine behind More examples hold their look and contrast floors at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await openMoreExamples(carousel);
  const looks = [];
  for (const look of OTHER_LOOK) {
    await carousel.getByRole("button", { name: look.name, exact: true }).click();
    const card = carousel.getByRole("article", { name: `${look.name} card` });
    await expect(card).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const front = await card.evaluate(article => {
      const face = article.querySelector(".card-front")!;
      const headline = getComputedStyle(face.querySelector(".card-headline")!).fontFamily.split(",")[0].replaceAll('"', "");
      const name = getComputedStyle(face.querySelector("h2")!).fontFamily.split(",")[0].replaceAll('"', "");
      return { surface: getComputedStyle(article).backgroundColor, headline, name };
    });
    const frontFailures = await card.evaluate(contrastFailures);
    await card.getByRole("button", { name: "Details", exact: true }).click();
    await expect(card).toHaveAttribute("data-side", "back");
    const backFailures = await card.evaluate(contrastFailures);
    await card.getByRole("button", { name: "Close details" }).click();
    looks.push({
      name: look.name, surface: front.surface,
      faces: look.slug ? front.headline.startsWith(`PRBrand-${look.slug}-`) && front.headline.endsWith("-heading") && front.name === front.headline : !front.headline.startsWith("PRBrand-"),
      contrast: [...frontFailures, ...backFailures],
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), look.name).toBe(true);
  }
  expect(looks).toEqual(OTHER_LOOK.map(look => ({ name: look.name, surface: look.surface, faces: true, contrast: [] })));
});

/** A group separator is at least a fifth of an em wide: the font's comma, not a speck between figures. */
const MIN_SEPARATOR_EM = 0.2;
for (const width of [DESKTOP_WIDTH, PHONE_WIDTH]) test(`every card's lead number keeps its group separators clear of its figures at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await openMoreExamples(carousel);
  const separated: string[] = [];
  for (const name of ["Clay", "GitHub", "Cloudflare", "Docker", "Firecrawl", "n8n", "Claude Code", "Exa", "Porkbun", "Spider", "Open Places", "Grok Bot", "Elicit", "Context.dev"]) {
    await carousel.getByRole("button", { name, exact: true }).click();
    const card = carousel.getByRole("article", { name: `${name} card` });
    await expect(card).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const separators = await card.evaluate(article => [...article.querySelectorAll(".card-front .figure-separator")].map(separator => {
      const size = parseFloat(getComputedStyle(separator.parentElement!).fontSize), box = separator.getBoundingClientRect(), range = document.createRange();
      const before = separator.previousSibling!, after = separator.nextSibling!;
      range.setStart(before, before.textContent!.length - 1); range.setEnd(before, before.textContent!.length);
      const digitBefore = range.getBoundingClientRect();
      range.setStart(after, 0); range.setEnd(after, 1);
      const digitAfter = range.getBoundingClientRect();
      return { widthEm: box.width / size, clear: box.left >= digitBefore.right - 0.5 && box.right <= digitAfter.left + 0.5 };
    }));
    for (const separator of separators) {
      expect(separator.clear, `${name}'s separator overlaps a figure`).toBe(true);
      expect(separator.widthEm, `${name}'s separator width`).toBeGreaterThanOrEqual(MIN_SEPARATOR_EM);
    }
    if (separators.length) separated.push(name);
  }
  // At least the big numbers with thousands carry separators to check.
  expect(separated.length).toBeGreaterThanOrEqual(3);
});

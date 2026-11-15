import { expect, test, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** The widest screen that shows a phone's chooser row, with Play and no arrows (product-example.module.css). */
const PHONE_ONLY_MAX_PX = 600;
for (const width of [1440, 390, 320]) test(`usage slideshow keeps metrics and caveats distinct at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await expect(carousel.getByRole("button", { name: "Play slideshow" })).toBeVisible();
  await expect(carousel.locator("[data-current=true] [data-capability]")).toHaveText("Published usage numbers");
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
    ["Clay", "Daily · since 2023", "uppercase", "none"],
    ["Cloudflare", "Daily · since 2020", "none", "none"],
    ["Docker", "Weekly · since 2024", "none", "none"],
    ["Firecrawl", "Weekly · since 2025", "none", "none"],
    ["n8n", "Paused · started 2024", "uppercase", "uppercase"],
    ["Claude Code", "Daily · since 2025", "uppercase", "uppercase"],
    ["Exa", "Weekly · since 2025", "none", "none"],
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
    await expect(carousel.getByRole("article", { name: "Clay card" })).toBeVisible();
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
  Clay: "Published usage numbers",
  "Claude Code": "Coding days",
  Firecrawl: "Referral link, disclosed",
  Exa: "A demo link on the back",
  Cloudflare: "Go-to, with what it costs",
  Porkbun: "Running totals",
  Spider: "Affiliate link, disclosed",
  Docker: "A list of linked work",
  "Open Places": "Used now and then",
  "Grok Bot": "Still testing",
  Elicit: "Stopped using, and why",
  "Context.dev": "Testing, week by week",
  n8n: "Paused, and why",
};
/** What each label promises, said on the card's front: its cost, why it was paused or stopped, and where its demo is. */
const FRONT_TEXT: Readonly<Record<string, readonly string[]>> = {
  Clay: ["Costs $167/month · sample"],
  Cloudflare: ["Costs $5/month · sample", "Owner-selected go-to"],
  Exa: ["A demo link inside"],
  n8n: ["Paused while my nightly jobs move to plain cron.", "I used it to"],
  Elicit: ["I stopped once my market study was done.", "I used it to"],
};
/** What a card discloses next to its outbound arrow, and what its back shows beyond the front: one capability per example. */
const FRONT_DISCLOSURE: Readonly<Record<string, string>> = { Firecrawl: "Referral link", Spider: "Affiliate link" };
/** The linked work a card's front lists: only Docker's sample collects any. */
const FRONT_LINKS: Readonly<Record<string, readonly string[]>> = {
  Docker: ["Sample Compose apps (awesome-compose) ↗", "Official Postgres image ↗", "Multi-stage build guide ↗"],
};
const BACK_TEXT: Readonly<Record<string, readonly string[]>> = {
  Firecrawl: ["Weekly · Referral link", "Open Firecrawl ↗Referral link"],
  Exa: ["Weekly · Direct link", "Demo ↗exa.ai"],
  Cloudflare: ["Owner-selected go-to", "Sample cost: $5/month · as of 1 Sep 2026"],
  Docker: ["Weekly · Direct link", "Illustrative sample, not account data · the owner's own use · Jan 2024 – Aug 2026 · last updated 1 Sep 2026"],
  n8n: ["Paused · Direct link", "Paused while my nightly jobs move to plain cron."],
  Clay: ["Daily · Direct link", "Sample cost: $167/month · as of 1 Sep 2026 · 1 Sep 2025 to 31 Aug 2026", "See how I use it ↗clay.com", "How this was measured"],
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
  await expect(carousel.getByRole("article", { name: "Clay card" })).toBeVisible();
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
  { name: "n8n", slug: "n8n", background: "rgb(250, 250, 250)", bars: { count: 12, color: "rgb(22, 22, 22)" }, logo: "wordmark" },
  { name: "Clay", slug: "clay", background: "rgb(255, 255, 255)", bars: undefined, logo: "app-icon" },
] as const;
const CODING_DAYS = 31;
const NARROWEST_WIDTH = 320;

[DESKTOP_WIDTH, PHONE_WIDTH].forEach(width => test(`branded example cards wear their brand, say what they're used for and show a sample chart or metrics at ${width}px`, async ({ page }) => {
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
    // n8n is paused, so its uses are in the past tense.
    const [lead, list] = brand.name === "n8n" ? ["I used it to", "What I used it for"] : ["I use it to", "What I use it for"];
    await expect(card.getByText(lead)).toBeVisible();
    expect(await card.getByRole("list", { name: list }).getByRole("listitem").count()).toBeGreaterThanOrEqual(2);
    if (brand.bars) {
      const bars = card.locator(".card-front .activity-bars > span:not([data-zero])");
      await expect(card.locator(".card-front .activity-bars > span")).toHaveCount(brand.bars.count);
      await expect(bars.last()).toHaveCSS("background-color", brand.bars.color);
      await expect(card.locator(".card-front .activity-bars")).toHaveAttribute("role", "img");
    } else {
      // Clay shows the product: a few rows of a table filling in, then its three published numbers in one row.
      const table = card.getByRole("table", { name: "Lead list · from a job-change signal · invented sample rows" });
      await expect(table).toBeVisible();
      // A phone-wide card leaves out which provider found the address, so the address and the AI column stay in view.
      await expect(table.getByRole("columnheader")).toHaveText(width === DESKTOP_WIDTH ? ["Company", "Work email", "Found by", "AI: signal"] : ["Company", "Work email", "AI: signal"]);
      await expect(table.getByRole("rowheader")).toHaveText(["Nimbus", "Heron", "Quillon", "Tessel", "Marrow"]);
      // One period for all three numbers, said once beside them.
      const stats = card.locator(".card-front .usage-measurement-stats li");
      await expect(stats).toHaveText(["11,800rows enriched", "52tables built", "27,600data credits used"]);
      await expect(card.locator(".card-front .usage-measurement-note")).toHaveText("Sep 2025 – Aug 2026 · Sample numbers · how each was measured is in Details");
      // The numbers the capability names come first, above the table they come from.
      const [statsBottom, tableTop] = [await stats.first().evaluate(item => item.getBoundingClientRect().bottom), await table.evaluate(item => item.getBoundingClientRect().top)];
      expect(statsBottom).toBeLessThan(tableTop);
      // The disclosures are above the card and on its back, not on its front.
      await expect(card.locator(".card-front")).not.toContainText(/Synthetic sample|Owner-supplied evidence|more reported measurements/);
      // Its footer says what is behind Details, and the button carries the same words.
      await expect(card.locator(".card-footer > span")).toHaveText("Periods, sources and a work sample inside");
      await expect(card.getByRole("button", { name: "Details", exact: true })).toHaveAccessibleDescription("Periods, sources and a work sample inside");
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
    await expect(card.locator(".card-front .card-artifact-links a")).toHaveText(FRONT_LINKS[name] ?? []);
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
  await expect(carousel.getByRole("article", { name: "Clay card" })).toBeVisible();
  await expect(carousel.getByRole("button", { name: "Pause slideshow" })).toBeVisible();
  await expect(status).toHaveAttribute("aria-live", "off");
  await page.clock.fastForward(8100);
  await expect(carousel.getByRole("article", { name: "GitHub card" })).toBeVisible();
  await carousel.hover();
  await expect(status).toHaveAttribute("aria-live", "polite");
  await expect(status).toHaveText("2 of 5: GitHub");
  await page.clock.fastForward(16000);
  await expect(carousel.getByRole("article", { name: "GitHub card" })).toBeVisible();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(8100);
  await expect(carousel.getByRole("article", { name: "Cloudflare card" })).toBeVisible();
  await carousel.getByRole("button", { name: "Details", exact: true }).focus();
  await page.clock.fastForward(16000);
  await expect(carousel.getByRole("article", { name: "Cloudflare card" })).toBeVisible();
  await page.locator("#homepage-content").focus();
  await page.clock.fastForward(8100);
  await expect(carousel.getByRole("article", { name: "Docker card" })).toBeVisible();
  const toggle = carousel.getByRole("button", { name: /slideshow$/ });
  await toggle.focus();
  await expect(toggle).toHaveText("Pause slideshow");
  await page.clock.fastForward(16000);
  await expect(carousel.getByRole("article", { name: "Docker card" })).toBeVisible();
  await toggle.press("Enter");
  await expect(toggle).toHaveText("Play slideshow");
  await page.clock.fastForward(16000);
  await expect(carousel.getByRole("article", { name: "Docker card" })).toBeVisible();
  await toggle.press("Enter");
  await expect(toggle).toHaveText("Pause slideshow");
  await expect(toggle).toBeFocused();
  await page.clock.fastForward(8100);
  await expect(carousel.getByRole("article", { name: "Firecrawl card" })).toBeVisible();
  await carousel.getByRole("button", { name: "Next example" }).focus();
  await page.clock.fastForward(16000);
  await expect(carousel.getByRole("article", { name: "Firecrawl card" })).toBeVisible();
  // Only the five featured examples take turns: after Firecrawl it wraps to Clay, never on to the nine behind More examples.
  await page.locator("#homepage-content").focus();
  await page.clock.fastForward(8100);
  await expect(carousel.getByRole("article", { name: "Clay card" })).toBeVisible();
  await expect(carousel.locator("[aria-roledescription=slide]")).toHaveCount(5);
});

test("an open back holds the slideshow, wherever focus and the pointer go, until it is closed", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  const clay = carousel.getByRole("article", { name: "Clay card" });
  await expect(carousel.getByRole("button", { name: "Pause slideshow" })).toBeVisible();
  await clay.getByRole("button", { name: "Details", exact: true }).click();
  await page.mouse.move(0, 0);
  await page.locator("#homepage-content").focus();
  await page.clock.fastForward(17_000);
  await expect(clay.getByRole("button", { name: "Close details" })).toBeVisible();
  await expect(carousel.locator("[data-slide-status]")).toHaveText("1 of 5: Clay");
  await clay.getByRole("button", { name: "Close details" }).click();
  await page.mouse.move(0, 0);
  await page.locator("#homepage-content").focus();
  await page.clock.fastForward(8100);
  await expect(carousel.getByRole("article", { name: "GitHub card" })).toBeVisible();
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
  for (const name of ["GitHub", "Cloudflare", "Docker", "Firecrawl", "Clay"]) {
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
  await expect(carousel.getByRole("article", { name: "Clay card" })).toBeVisible();
});

test("the example chooser is one tab stop: arrows move, a press picks, and the picked example stays pressed", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const chooser = page.getByRole("group", { name: "Choose a product example" });
  const github = chooser.getByRole("button", { name: "Clay", exact: true });
  const second = chooser.getByRole("button").nth(1);
  const third = chooser.getByRole("button").nth(2);
  expect(await toggleNames(chooser)).toEqual(["Clay", "GitHub", "Cloudflare", "Docker", "Firecrawl"]);
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
  await expect(carousel.getByRole("article")).toHaveAccessibleName("GitHub card");
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
  await chooser.getByRole("button", { name: "Firecrawl", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  const n8n = chooser.getByRole("button", { name: "n8n", exact: true });
  await expect(n8n).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(carousel.getByRole("article")).toHaveAccessibleName("n8n card");
  await expect(carousel.getByText("6 / 14", { exact: true })).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  await expect(chooser.locator(":focus")).toHaveCount(0);
  // Closing the nine while one of them is shown keeps it shown, and the slideshow's count keeps all fourteen.
  await more.click();
  await expect(chooser.getByRole("button")).toHaveCount(5);
  await expect(carousel.getByRole("article")).toHaveAccessibleName("n8n card");
  await expect(carousel.getByText("6 / 14", { exact: true })).toBeVisible();
});

test("pressing the example already shown stops the slideshow for good", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await expect(carousel.getByRole("button", { name: "Pause slideshow" })).toBeVisible();
  const github = page.getByRole("group", { name: "Choose a product example" }).getByRole("button", { name: "Clay", exact: true });
  await expect(github).toHaveAttribute("aria-pressed", "true");
  await github.press("Enter");
  await expect(github).toHaveAttribute("aria-pressed", "true");
  await expect(carousel.getByRole("button", { name: "Play slideshow" })).toBeVisible();
  // With focus and the pointer gone, nothing holds the slideshow but the visitor's choice.
  await page.locator("#homepage-content").focus();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(24000);
  await expect(carousel.getByRole("article", { name: "Clay card" })).toBeVisible();
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
  // Clay's font, since it is shown, and GitHub's font and logo, since it is next. Clay's reviewed app icon is this site's own file.
  expect([...assets].sort()).toEqual([
    "/api/brand-fonts/1ab1b6a248cab8ba937f10ddd4b6cd983c88752d97371ff6c9eae613a7e21a2e.woff2",
    "/api/brand-fonts/45386689a773179ad2a4f750698c7b6152d7b57f4e7c41aed967d8704d49e115.woff2",
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

const FEATURED = ["Clay", "GitHub", "Cloudflare", "Docker", "Firecrawl"] as const;
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
  // A stub keeps the bars' own opaque colour, so it holds the chart's contrast against the card; its height alone marks it as zero.
  const paint = await bars.evaluateAll(spans => spans.map(span => ({ zero: span.hasAttribute("data-zero"), opacity: getComputedStyle(span).opacity, colour: getComputedStyle(span).backgroundColor })));
  const barColour = paint.find(bar => !bar.zero)!.colour;
  const stubs = paint.filter(bar => bar.zero).map(({ opacity, colour }) => ({ opacity, colour }));
  expect(stubs).toEqual(stubs.map(() => ({ opacity: "1", colour: barColour })));
});

const CLAY_CAPTION = "Lead list · from a job-change signal · invented sample rows";
const MIN_CONTRAST = 4.5;
for (const width of [DESKTOP_WIDTH, PHONE_WIDTH, NARROWEST_WIDTH]) test(`Clay's table fits its card at ${width}px with no cell cut short, on a slab like clay.com's`, async ({ page }) => {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const card = page.getByRole("region", { name: "Product usage examples" }).getByRole("article", { name: "Clay card" });
  const box = card.getByRole("region", { name: CLAY_CAPTION });
  await expect(box).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const fit = await box.evaluate((element, minContrast) => {
    // A computed colour is rgb() in 0-255, or color(srgb …) in 0-1 where color-mix() made it.
    const luminance = (colour: string) => {
      const scale = colour.startsWith("color(") ? 1 : 255;
      const [red, green, blue] = colour.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => value / scale).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };
    const contrast = (first: string, second: string) => {
      const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
      return (light + 0.05) / (dark + 0.05);
    };
    /** The first opaque background behind an element: its own, or an ancestor's. */
    const backdrop = (start: Element) => {
      for (let node: Element | null = start; node; node = node.parentElement) {
        const fill = getComputedStyle(node).backgroundColor;
        if (fill !== "rgba(0, 0, 0, 0)" && fill !== "transparent") return fill;
      }
      return "rgb(255, 255, 255)";
    };
    const cells = [...element.querySelectorAll("th, td")].filter(cell => cell.getBoundingClientRect().width > 0);
    const cut = cells.filter(cell => cell.scrollWidth > cell.clientWidth).map(cell => cell.textContent);
    const faint = cells.filter(cell => contrast(getComputedStyle(cell).color, backdrop(cell)) < minContrast).map(cell => cell.textContent);
    const small = cells.filter(cell => parseFloat(getComputedStyle(cell).fontSize) < 12).map(cell => cell.textContent);
    const bounds = element.closest("article")!.getBoundingClientRect();
    const table = element.querySelector("table")!.getBoundingClientRect();
    const highlighted = [...element.querySelectorAll("tbody tr[data-latest]")].map(row => row.querySelector("th")!.textContent);
    const headerWeight = getComputedStyle(element.querySelector("thead th")!).fontWeight;
    return { cut, faint, small, wrapperScrolls: element.scrollWidth > element.clientWidth, inCard: table.left >= bounds.left && table.right <= bounds.right,
      columns: element.querySelectorAll("thead th").length - [...element.querySelectorAll("thead th")].filter(th => !th.getBoundingClientRect().width).length,
      highlighted, headerWeight, slab: getComputedStyle(element).backgroundColor !== getComputedStyle(element.closest("article")!).backgroundColor };
  }, MIN_CONTRAST);
  expect(fit).toEqual({ cut: [], faint: [], small: [], wrapperScrolls: false, inCard: true, columns: width === DESKTOP_WIDTH ? 4 : 3,
    highlighted: ["Quillon"], headerWeight: "400", slab: true });
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

const FILL_IN_WAIT_MS = 1000;
for (const motion of ["no-preference", "reduce"] as const) test(`Clay's running row ${motion === "reduce" ? "shows its filled-in end state at once, without motion," : "fills in once"} when motion is ${motion}`, async ({ page }) => {
  await page.clock.install();
  await page.setViewportSize({ width: DESKTOP_WIDTH, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: motion });
  await page.goto("/");
  const row = page.getByRole("region", { name: "Product usage examples" }).getByRole("article", { name: "Clay card" }).getByRole("row", { name: /Quillon/ });
  const filled = ["mo@quillon.example", "2nd provider", "New VP Sales"];
  if (motion === "reduce") {
    await expect(row.getByRole("cell")).toHaveText(filled);
    return;
  }
  await expect(row).toContainText("Running");
  await page.clock.runFor(FILL_IN_WAIT_MS);
  await expect(row.getByRole("cell")).toHaveText(filled);
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
  await expect(current).toHaveText("Published usage numbers");
  // In view, it starts playing (its slides stop announcing themselves) and gets a whole turn before moving on.
  await expect(carousel.locator("[data-slide-status]")).toHaveAttribute("aria-live", "off");
  await page.clock.runFor(ADVANCE_MS - TURN_MARGIN_MS);
  await expect(current).toHaveText("Published usage numbers");
  await page.clock.runFor(TURN_MARGIN_MS * 2);
  await expect(current).not.toHaveText("Published usage numbers");
});

/** The phone's first screen: the card starts by here, and its first number is above the fold. */
const PHONE_CARD_TOP_PX = 450;
test(`at ${PHONE_WIDTH}x${PHONE_HEIGHT} the card is in the first screen, right after the heading, and holds still`, async ({ page }) => {
  await page.clock.install();
  await page.setViewportSize({ width: PHONE_WIDTH, height: PHONE_HEIGHT });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  const card = carousel.getByRole("article", { name: "Clay card" });
  await expect(card).toBeVisible();
  const first = await card.evaluate(article => ({
    top: article.getBoundingClientRect().top,
    numberBottom: article.querySelector(".card-front .usage-measurement-stats strong")!.getBoundingClientRect().bottom,
    scrolled: scrollY,
  }));
  expect(first.scrolled).toBe(0);
  expect(first.top).toBeLessThanOrEqual(PHONE_CARD_TOP_PX);
  // The card says it is a sample on its own front, so a cropped screenshot still says so.
  await expect(card.locator(".card-front .card-sample-tag")).toHaveText("Sample");
  await expect(card.locator(".card-front .card-sample-tag")).toBeVisible();
  expect(first.numberBottom).toBeLessThanOrEqual(PHONE_HEIGHT);
  // In reading order the examples follow the heading, and the owner's copy and the call to action follow the examples.
  const order = await page.evaluate(() => {
    const [heading, examples] = ["#homepage-title", "#example"].map(selector => document.querySelector(selector)!);
    const copy = [...document.querySelectorAll("main li")].find(item => item.textContent!.startsWith("A public profile"))!;
    const start = [...document.querySelectorAll("main a")].find(link => link.textContent === "Start your collection")!;
    const before = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    return { headingThenExamples: before(heading, examples), examplesThenCopy: before(examples, copy), examplesThenStart: before(examples, start) };
  });
  expect(order).toEqual({ headingThenExamples: true, examplesThenCopy: true, examplesThenStart: true });
  // On a phone the slideshow is in view from the start, so it waits for play rather than reflowing the copy under it.
  await expect(carousel.getByRole("button", { name: "Play slideshow" })).toBeVisible();
  await page.clock.runFor(ADVANCE_MS * 2);
  await expect(card).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

/** How far a tapped chooser button may move when the card under it changes. */
const MAX_CHOOSER_SHIFT_PX = 20;
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
  // Read down a long card, then pick another: the new card's top comes into view and the row stays under the thumb.
  await page.evaluate(() => scrollBy(0, 600));
  await pick("GitHub");
  await page.evaluate(() => scrollBy(0, 400));
  await pick("Cloudflare");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

const MIN_TEXT_PX = 12;
for (const width of [DESKTOP_WIDTH, PHONE_WIDTH]) test(`Firecrawl's front says its link is a referral link, readably, under the link at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await carousel.getByRole("button", { name: "Firecrawl", exact: true }).click();
  const front = carousel.getByRole("article", { name: "Firecrawl card" }).locator(".card-front");
  const link = front.getByRole("link", { name: "Open Firecrawl · Referral link (opens in a new tab)" });
  const tag = front.locator(".card-link-disclosure");
  await expect(tag).toHaveText("Referral link");
  await expect(tag).toBeVisible();
  const [arrow, label] = [(await link.boundingBox())!, (await tag.boundingBox())!];
  const fontSize = await tag.evaluate(element => parseFloat(getComputedStyle(element).fontSize));
  expect(fontSize).toBeGreaterThanOrEqual(MIN_TEXT_PX);
  // Right under the arrow, centred on it.
  expect(label.y - (arrow.y + arrow.height)).toBeLessThan(MIN_TEXT_PX);
  expect(Math.abs(label.x + label.width / 2 - (arrow.x + arrow.width / 2))).toBeLessThan(2);
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
test(`at ${PHONE_WIDTH}px every carousel control, back link and front link is a ${MIN_TAP_PX}px target`, async ({ page }) => {
  await page.setViewportSize({ width: PHONE_WIDTH, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await openMoreExamples(carousel);
  const short = async (scope: Locator, selector: string) => (await scope.locator(selector).evaluateAll(elements => elements
    .filter(element => element.getBoundingClientRect().width > 0)
    .map(element => ({ text: element.textContent!.trim().slice(0, 24), height: Math.round(element.getBoundingClientRect().height), width: Math.round(element.getBoundingClientRect().width) }))))
    .filter(({ height, width }) => height < MIN_TAP_PX || width < MIN_TAP_PX);
  expect(await short(carousel, ":scope > div button")).toEqual([]);
  await carousel.getByRole("button", { name: "Docker", exact: true }).click();
  const docker = carousel.getByRole("article", { name: "Docker card" });
  expect((await short(docker, ".card-front .card-artifact-links a")).filter(({ height }) => height < MIN_TAP_PX)).toEqual([]);
  await docker.getByRole("button", { name: "Details", exact: true }).click();
  // Every link on the back: each linked work, the work sample, the product's site and How evidence works.
  expect((await short(docker, ".card-back a")).filter(({ height }) => height < MIN_TAP_PX)).toEqual([]);
  expect(await docker.locator(".card-back .artifact-list a").count()).toBe(3);
  // Taller, the back's two links still sit one under the other, not run together on one line.
  const [open, evidence] = await Promise.all([".outbound-link", ".evidence-link"].map(selector => docker.locator(`.card-back ${selector}`).boundingBox()));
  expect(evidence!.y).toBeGreaterThanOrEqual(open!.y + open!.height);
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
  expect(await slides.evaluateAll(elements => elements.map(element => element.getAttribute("data-example")))).toEqual(["clay", "github", "cloudflare", "docker", "firecrawl", "spider", "open-places"]);
  await expect(slides.filter({ has: page.getByRole("article", { name: "Spider card" }) })).toHaveAttribute("aria-label", "10 of 14: Spider");
});

/**
 * The look of the five featured cards, held by geometry and computed style rather than pixel baselines, which differ between
 * macOS and CI's Linux: each one's brand surface, band and heading face, what its front draws, its biggest number, its sizes.
 */
const FEATURED_LOOK = [
  { name: "Clay", slug: "clay", surface: "rgb(255, 255, 255)", band: "rgb(3, 93, 68)", draws: "table" },
  { name: "GitHub", slug: "github", surface: "rgb(255, 255, 255)", band: null, draws: "calendar" },
  { name: "Cloudflare", slug: "cloudflare", surface: "rgb(255, 255, 255)", band: "rgb(255, 94, 31)", draws: "per day bars" },
  { name: "Docker", slug: "docker", surface: "rgb(249, 250, 251)", band: "rgb(15, 17, 23)", draws: "linked works" },
  { name: "Firecrawl", slug: "firecrawl", surface: "rgb(249, 249, 249)", band: null, draws: "per week bars" },
] as const;
const MAX_FACE_DIFFERENCE_PX = 80;
const MIN_BAND_CONTRAST = 4.5;

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
      const draws = face.querySelector(".card-table-preview") ? "table" : face.querySelector(".contribution-calendar") ? "calendar"
        : face.querySelector(".card-artifact-links") ? "linked works" : bars.length ? `${bars[0].getAttribute("title")!.match(/per (day|week)/)![0]} bars` : "nothing";
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
        bandContrast: article.hasAttribute("data-band") ? contrast(headline.color, headline.backgroundColor) : null,
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
      bandReadable: front.bandContrast === null || front.bandContrast >= MIN_BAND_CONTRAST,
      textAtLeast12: front.smallestText >= MIN_TEXT_PX, leadsWithZero: front.biggestNumber === 0,
      // The card keeps its size turned over, and its back's content ends within the target of the front's height.
      // At 1440 the card keeps its size turned over, within the target. On a phone the back carries what the front can't fit
      // (Clay's whole table, Cloudflare's 31 values), so it may be taller; it never shrinks, and the turn keeps the card's top in place (tested below).
      faceDifference: back.height >= front.height - 1 && (width === PHONE_WIDTH || (Math.abs(back.height - front.height) <= MAX_FACE_DIFFERENCE_PX && back.contentBottom <= front.height + MAX_FACE_DIFFERENCE_PX)),
      backLogo: back.logo, shortTargets: width === PHONE_WIDTH ? front.shortTargets : 0,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), look.name).toBe(true);
  }
  expect(looks).toEqual(FEATURED_LOOK.map(look => ({
    name: look.name, surface: look.surface, band: look.band, draws: look.draws, faces: true, bandReadable: true,
    textAtLeast12: true, leadsWithZero: false, faceDifference: true, backLogo: true, shortTargets: 0,
  })));
  // No two featured fronts draw the same thing.
  expect(new Set(looks.map(({ draws }) => draws)).size).toBe(FEATURED_LOOK.length);
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
        panel: style(".card-front :is(.card-table-preview, .contribution-calendar, .card-artifact-links, .usage-chart)")!.backgroundColor,
      };
    });
  };
  const looks: Record<string, Awaited<ReturnType<typeof feel>>> = {};
  for (const name of FEATURED) looks[name] = await feel(name);
  // Cloudflare's site sets no text in capitals, so its labels stay as typed; Clay's small labels are capitals.
  expect([looks.Cloudflare.eyebrowCase, looks.Clay.eyebrowCase]).toEqual(["none", "uppercase"]);
  // GitHub's biggest number is green monospace, as on github.com.
  expect([looks.GitHub.numberFont, looks.GitHub.numberColour]).toEqual(["ui-monospace", "rgb(8, 135, 43)"]);
  // Clay's table on its warm grey slab; Docker's linked work on its dark terminal panel.
  expect([looks.Clay.panel, looks.Docker.panel]).toEqual(["rgb(244, 243, 240)", "rgb(14, 18, 23)"]);
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

const MAX_FLIP_SCROLL_PX = 20;
test(`at ${PHONE_WIDTH}px turning a card that is already in view over moves neither the page nor the card`, async ({ page }) => {
  await page.setViewportSize({ width: PHONE_WIDTH, height: PHONE_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const card = page.getByRole("region", { name: "Product usage examples" }).getByRole("article", { name: "Clay card" });
  await expect(card).toBeVisible();
  // The whole card on screen, its top just under the screen's top.
  await card.evaluate(article => scrollBy(0, article.getBoundingClientRect().top - 10));
  const before = await card.evaluate(article => ({ scroll: scrollY, top: article.getBoundingClientRect().top }));
  await card.getByRole("button", { name: "Details", exact: true }).click();
  await expect(card.getByRole("button", { name: "Close details" })).toBeVisible();
  const after = await card.evaluate(article => ({ scroll: scrollY, top: article.getBoundingClientRect().top, focused: document.activeElement?.tagName }));
  expect(Math.abs(after.scroll - before.scroll)).toBeLessThanOrEqual(MAX_FLIP_SCROLL_PX);
  expect(Math.abs(after.top - before.top)).toBeLessThanOrEqual(MAX_FLIP_SCROLL_PX);
  expect(after.focused).toBe("H2");
});

for (const width of [PHONE_WIDTH, NARROWEST_WIDTH]) test(`at ${width}px turning a long card over from its foot shows the back's top, and closing it shows Details again`, async ({ page }) => {
  await page.setViewportSize({ width, height: PHONE_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  const card = carousel.getByRole("article", { name: "Clay card" });
  const details = card.getByRole("button", { name: "Details", exact: true });
  // Read to the card's foot, so Details sits low on the screen and the card's top is above it.
  await details.evaluate(button => scrollBy(0, button.getBoundingClientRect().bottom - innerHeight + 120));
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

test(`at ${DESKTOP_WIDTH}px no featured card grows when it turns: each back fits the front's height`, async ({ page }) => {
  await page.setViewportSize({ width: DESKTOP_WIDTH, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  const growth: Record<string, number> = {};
  for (const name of FEATURED) {
    await carousel.getByRole("button", { name, exact: true }).click();
    const card = carousel.getByRole("article", { name: `${name} card` });
    const front = (await card.boundingBox())!.height;
    await card.getByRole("button", { name: "Details", exact: true }).click();
    await expect(card.getByRole("button", { name: "Close details" })).toBeVisible();
    growth[name] = Math.max(0, Math.round((await card.boundingBox())!.height - front));
    await card.getByRole("button", { name: "Close details" }).click();
  }
  expect(growth).toEqual(Object.fromEntries(FEATURED.map(name => [name, 0])));
});

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
    expect(await close.evaluate(button => getComputedStyle(button).backgroundColor), name).toBe(detailsFill);
    await close.click();
  }
  // What only the back holds: Cloudflare's day-by-day values, Clay's whole table, Docker's links with what each one is.
  await carousel.getByRole("button", { name: "Cloudflare", exact: true }).click();
  const cloudflare = carousel.getByRole("article", { name: "Cloudflare card" });
  await cloudflare.getByRole("button", { name: "Details", exact: true }).click();
  const values = cloudflare.locator(".card-back .card-back-values li");
  await expect(values).toHaveCount(31);
  await expect(values.first()).toHaveText("1 Aug2,840");
  await cloudflare.getByRole("button", { name: "Close details" }).click();
  await carousel.getByRole("button", { name: "Clay", exact: true }).click();
  const clay = carousel.getByRole("article", { name: "Clay card" });
  await clay.getByRole("button", { name: "Details", exact: true }).click();
  await expect(clay.locator(".card-back .card-table-preview th[scope=col]")).toHaveText(["Company", "Work email", "Found by", "AI: signal"]);
  await expect(clay.locator(".card-back .card-table-preview th[scope=col]").nth(2)).toBeVisible();
  await clay.getByRole("button", { name: "Close details" }).click();
  await carousel.getByRole("button", { name: "Docker", exact: true }).click();
  const docker = carousel.getByRole("article", { name: "Docker card" });
  await docker.getByRole("button", { name: "Details", exact: true }).click();
  await expect(docker.locator(".card-back .artifact-list li")).toHaveCount(3);
  await expect(docker.locator(".card-back .artifact-list li").first()).toContainText("Compose stacks");
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
  const card = page.getByRole("region", { name: "Product usage examples" }).getByRole("article", { name: "Clay card" });
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
  const card = page.getByRole("region", { name: "Product usage examples" }).getByRole("article", { name: "Clay card" });
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
    const card = page.getByRole("region", { name: "Product usage examples" }).getByRole("article", { name: "Clay card" });
    await card.getByRole("button", { name: "Details", exact: true }).click();
    const turn = await card.locator(".card-back").evaluate(back => ({ name: getComputedStyle(back).animationName, seconds: parseFloat(getComputedStyle(back).animationDuration) }));
    if (motion === "reduce") expect(turn.name).toBe("none");
    else expect(turn).toEqual({ name: "card-turn-over", seconds: turn.seconds > 0 && turn.seconds <= 0.3 ? turn.seconds : NaN });
  }
});

for (const width of [DESKTOP_WIDTH, PHONE_WIDTH]) test(`all fourteen fronts say Sample, set no text under 12px and draw bars that stand 3:1 off their backdrop at ${width}px`, async ({ page }) => {
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
      return { small, barContrast: bar ? contrast(getComputedStyle(bar).backgroundColor, backdrop(bar)) : undefined };
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

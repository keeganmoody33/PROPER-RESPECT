import { expect, test, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const width of [1440, 390, 320]) test(`usage slideshow keeps metrics and caveats distinct at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await expect(carousel.getByRole("button", { name: "Play slideshow" })).toBeVisible();
  await expect(carousel.locator("[data-current=true] [data-capability]")).toHaveText("Published usage numbers");
  await expect(carousel.getByText("1 / 5", { exact: true })).toBeVisible();
  // Opening the rest shows them; only picking one of them puts all fourteen in play.
  await openMoreExamples(carousel);
  await expect(carousel.getByText("1 / 5", { exact: true })).toBeVisible();
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
  await carousel.screenshot({ path: testInfo.outputPath(`2026-09-21-github-${width}.png`) });
  const slideBox = () => carousel.locator("[aria-roledescription=slide]").first().evaluate(element => element.parentElement!.getBoundingClientRect().height);
  const githubHeight = await slideBox();
  // The top line and button are typed as written; each card's measured site, or the house default, sets their case.
  for (const [name, text, labelCase, buttonCase] of [
    ["Clay", "Daily · since 2023", "none", "none"],
    ["Cloudflare", "Daily · since 2020", "uppercase", "none"],
    ["Firecrawl", "Weekly · since 2025", "none", "none"],
    ["n8n", "Paused · started 2024", "uppercase", "uppercase"],
    ["Claude Code", "Daily · since 2025", "uppercase", "uppercase"],
    ["Exa", "Weekly · since 2025", "none", "none"],
    ["Porkbun", "Occasionally · since 2021", "uppercase", "uppercase"],
    ["Spider", "Occasionally · since 2026", "uppercase", "uppercase"],
    ["Docker", "Weekly · since 2020", "none", "none"],
    ["Open Places", "Occasionally · since 2026", "none", "none"],
    ["Grok Bot", "Testing · since 2026", "uppercase", "uppercase"],
    ["Elicit", "Stopped using · started 2026", "uppercase", "none"],
    ["Context.dev", "Testing · since 2026", "none", "none"],
  ]) {
    const toggle = carousel.getByRole("button", { name, exact: true });
    // The chooser says what each example shows, as the toggle's description, so its name stays the product's.
    await expect(toggle).toHaveAccessibleDescription(CAPABILITIES[name]);
    await toggle.click();
    await expect(carousel.locator("[data-current=true] [data-capability]")).toHaveText(CAPABILITIES[name]);
    const card = carousel.getByRole("article", { name: `${name} card` });
    await expect(card).toBeVisible();
    await expect(card).toContainText(text);
    await expect(card.locator(".card-title .eyebrow")).toHaveCSS("text-transform", labelCase);
    await expect(card.locator(".card-button")).toHaveCSS("text-transform", buttonCase);
    await expect(card).not.toContainText("contributions");
    await expect(carousel.locator("[data-current=true]")).toContainText("Sample data / No account connected");
    expect(await slideBox()).toBe(githubHeight);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await carousel.screenshot({ path: testInfo.outputPath(`2026-09-21-${name.toLowerCase().replaceAll(" ", "-")}-${width}.png`) });
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
  await carousel.getByRole("button", { name: "Next example" }).click();
  await expect(carousel.getByRole("article", { name: "Clay card" })).toBeVisible();
  await carousel.getByRole("button", { name: "Previous example" }).click();
  await expect(carousel.getByRole("article", { name: "Context.dev card" })).toBeVisible();
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
  Clay: ["Costs $149/month · owner-reported"],
  Cloudflare: ["Costs $5/month · owner-reported", "Owner-selected go-to"],
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
  Cloudflare: ["Owner-selected go-to", "Owner-reported cost: $5.00/month · as of 2026-09-01"],
  Docker: ["Sample Compose apps (awesome-compose) ↗", "Official Postgres image ↗", "Multi-stage build guide ↗"],
  n8n: ["Paused · Direct link", "Paused while my nightly jobs move to plain cron."],
  Clay: ["Daily · Direct link", "Owner-reported cost: $149.00/month · as of 2026-09-01", "Enriched2,140,000Rows", "Built86Tables", "Used48,500Credits", "See how I use it ↗clay.com",
    "Synthetic sample. Not real account activity.", "Owner-supplied evidence. Account identity is not authenticated. Activity actor is unknown."],
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
      const table = card.getByRole("table", { name: "Lead list · invented sample rows" });
      await expect(table).toBeVisible();
      await expect(table.getByRole("columnheader")).toHaveText(["Company", "Domain", "Work email", "Status"]);
      await expect(table.getByRole("rowheader")).toHaveText(["Northwind Labs", "Blue Heron Freight", "Quillon Health", "Tessel Robotics", "Marrow & Pine"]);
      await expect(card.locator(".card-front .usage-measurement-stats li")).toHaveText([
        "2,140,000rows enrichedMar 2023 – Aug 2026", "86tables builtMar 2023 – Aug 2026", "48,500credits usedSep 2025 – Aug 2026",
      ]);
      // The disclosures are above the card and on its back, not on its front.
      await expect(card.locator(".card-front")).not.toContainText(/Synthetic sample|Owner-supplied evidence|more reported measurements/);
      // Its footer says what is behind Details, and the button carries the same words.
      await expect(card.locator(".card-footer > span")).toHaveText("Periods, sources and a work sample inside");
      await expect(card.getByRole("button", { name: "Details", exact: true })).toHaveAccessibleDescription("Periods, sources and a work sample inside");
      continue;
    }
    // Every sample was captured on 2026-09-01: the front says when, in words, not "stale".
    await expect(card.locator(".card-front [data-freshness]")).toHaveText(" · last updated Sep 2026");
    // What a visitor reads under the number; the screen-reader table of bars keeps each bar's exact dates.
    expect(await card.locator(".card-front .card-activity-preview > p").allInnerTexts()).not.toContainEqual(expect.stringMatching(/stale|observation|personal activity|UTC|\d{4}-\d{2}-\d{2}/));
  }
}));

[DESKTOP_WIDTH, PHONE_WIDTH].forEach(width => test(`every example card closes up around its content at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  // The nine others mount when the visitor asks for them, so the frame is measured with all fourteen in it.
  await openMoreExamples(carousel);
  const stage = carousel.locator("[aria-roledescription=slide]").first().locator("..");
  const stageHeight = (await stage.boundingBox())!.height;
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
    // The card fits its content; the slideshow around it did not move.
    expect((await stage.boundingBox())!.height).toBe(stageHeight);
  }
}));

test("slideshow advances on its own quietly, pauses on hover and focus, and stops when asked", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  const stage = carousel.locator("[aria-roledescription=slide]").first().locator("..");
  await expect(carousel.getByRole("article", { name: "Clay card" })).toBeVisible();
  await expect(carousel.getByRole("button", { name: "Pause slideshow" })).toBeVisible();
  await expect(stage).toHaveAttribute("aria-live", "off");
  await page.clock.fastForward(8100);
  await expect(carousel.getByRole("article", { name: "Cloudflare card" })).toBeVisible();
  await carousel.hover();
  await expect(stage).toHaveAttribute("aria-live", "polite");
  await page.clock.fastForward(16000);
  await expect(carousel.getByRole("article", { name: "Cloudflare card" })).toBeVisible();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(8100);
  await expect(carousel.getByRole("article", { name: "Firecrawl card" })).toBeVisible();
  await carousel.getByRole("button", { name: "Details", exact: true }).focus();
  await page.clock.fastForward(16000);
  await expect(carousel.getByRole("article", { name: "Firecrawl card" })).toBeVisible();
  await page.locator("#homepage-content").focus();
  await page.clock.fastForward(8100);
  await expect(carousel.getByRole("article", { name: "GitHub card" })).toBeVisible();
  const toggle = carousel.getByRole("button", { name: /slideshow$/ });
  await toggle.focus();
  await expect(toggle).toHaveText("Pause slideshow");
  await page.clock.fastForward(16000);
  await expect(carousel.getByRole("article", { name: "GitHub card" })).toBeVisible();
  await toggle.press("Enter");
  await expect(toggle).toHaveText("Play slideshow");
  await page.clock.fastForward(16000);
  await expect(carousel.getByRole("article", { name: "GitHub card" })).toBeVisible();
  await toggle.press("Enter");
  await expect(toggle).toHaveText("Pause slideshow");
  await expect(toggle).toBeFocused();
  await page.clock.fastForward(8100);
  await expect(carousel.getByRole("article", { name: "n8n card" })).toBeVisible();
  await carousel.getByRole("button", { name: "Next example" }).focus();
  await page.clock.fastForward(16000);
  await expect(carousel.getByRole("article", { name: "n8n card" })).toBeVisible();
  // Only the five featured examples take turns: after n8n it wraps to Clay, never on to the nine behind More examples.
  await page.locator("#homepage-content").focus();
  await page.clock.fastForward(8100);
  await expect(carousel.getByRole("article", { name: "Clay card" })).toBeVisible();
  await expect(carousel.locator("[aria-roledescription=slide]")).toHaveCount(5);
});

test("with More examples open and nothing else picked, the slideshow still takes turns among the five featured", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await expect(carousel.getByRole("button", { name: "Pause slideshow" })).toBeVisible();
  await openMoreExamples(carousel);
  await expect(carousel.locator("[aria-roledescription=slide]")).toHaveCount(14);
  // Focus and the pointer leave the slideshow, so only the timer moves it.
  await page.locator("#homepage-content").focus();
  await page.mouse.move(0, 0);
  for (const name of ["Cloudflare", "Firecrawl", "GitHub", "n8n", "Clay"]) {
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
  expect(await toggleNames(chooser)).toEqual(["Clay", "Cloudflare", "Firecrawl", "GitHub", "n8n"]);
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
  await expect(carousel.getByRole("article")).toHaveAccessibleName("Cloudflare card");
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
  await chooser.getByRole("button", { name: "n8n", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  const claudeCode = chooser.getByRole("button", { name: "Claude Code", exact: true });
  await expect(claudeCode).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(carousel.getByRole("article")).toHaveAccessibleName("Claude Code card");
  await expect(carousel.getByText("6 / 14", { exact: true })).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  await expect(chooser.locator(":focus")).toHaveCount(0);
  // Closing the nine while one of them is shown keeps it shown, and the slideshow's count keeps all fourteen.
  await more.click();
  await expect(chooser.getByRole("button")).toHaveCount(5);
  await expect(carousel.getByRole("article")).toHaveAccessibleName("Claude Code card");
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
  // Clay's font, since it is shown, and Cloudflare's two fonts and wordmark, since it is next. Clay's reviewed app icon is this site's own file.
  expect([...assets].sort()).toEqual([
    "/api/brand-fonts/16bb192b61c258c142e3e0d92fe74cbb625ab72b60d3031cbcca2bee0968b345.otf",
    "/api/brand-fonts/408f046e22327dabd7d0c5a0c9ee443e7163e95ac699982fd1c9a4e577ede3ac.otf",
    "/api/brand-fonts/45386689a773179ad2a4f750698c7b6152d7b57f4e7c41aed967d8704d49e115.woff2",
    "/api/brand-images/5019dab7-f07e-4e29-98bb-f8bb7b613877.svg",
  ]);
  assets.clear();
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  // Opening the other nine fetches nothing of theirs: each still waits until it is shown or next.
  await openMoreExamples(carousel);
  await page.waitForLoadState("networkidle");
  expect([...assets]).toEqual([]);
  await carousel.getByRole("button", { name: "Spider", exact: true }).click();
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

const FEATURED = ["Clay", "Cloudflare", "Firecrawl", "GitHub", "n8n"] as const;
const COLLAPSED_CHOOSER_LIMIT = 100;

test(`the chooser stays one short row at ${DESKTOP_WIDTH}px, so each featured card's footer is in the first screen`, async ({ page }) => {
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
    const footerBottom = await card.locator(".card-footer").evaluate(element => element.getBoundingClientRect().bottom);
    expect(footerBottom, name).toBeLessThanOrEqual(VIEWPORT_HEIGHT);
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

for (const width of [DESKTOP_WIDTH, PHONE_WIDTH, NARROWEST_WIDTH]) test(`Clay's table fits its card at ${width}px, or scrolls inside its own box with the company in view`, async ({ page }) => {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const card = page.getByRole("region", { name: "Product usage examples" }).getByRole("article", { name: "Clay card" });
  const box = card.getByRole("region", { name: "Lead list · invented sample rows" });
  await expect(box).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const fits = await box.evaluate(element => element.scrollWidth <= element.clientWidth);
  expect(fits).toBe(width === DESKTOP_WIDTH);
  if (fits) return;
  // Scrolled to its end, the company column stays in view beside the status.
  await box.evaluate(element => { element.scrollLeft = element.scrollWidth; });
  const inView = await box.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const company = element.querySelector("tbody th")!.getBoundingClientRect();
    const status = element.querySelector("tbody td:last-child")!.getBoundingClientRect();
    return { company: company.left >= bounds.left - 1, status: status.right <= bounds.right + 1 };
  });
  expect(inView).toEqual({ company: true, status: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

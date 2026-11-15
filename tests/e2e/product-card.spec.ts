import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { buildSync } from "esbuild";
import { expect, test } from "@playwright/test";
import { normalizeProductBrand } from "../../src/domain/product-brand";
import type { PublicProfile } from "../../src/domain/public-profile";

const snapshot = normalizeProductBrand({
  productSlug: "synthetic-card", canonicalDomain: "example.com", retrievalId: "synthetic-typography-2026-09-19",
  retrievedAt: "2026-09-19T09:00:00.000Z", responseHash: "a".repeat(64),
}, {
  brand: { status: "ok", brand: { domain: "example.com", logos: [], colors: [] } },
  fonts: { status: "ok", domain: "example.com", fonts: [], fontLinks: {} },
  styleguide: { status: "ok", domain: "example.com", styleguide: { mode: "dark", colors: {}, typography: {
    headings: { h1: { fontFamily: "Trebuchet MS", fontFallbacks: ["sans-serif"], fontWeight: 400 } },
    p: { fontFamily: "Verdana", fontFallbacks: ["sans-serif"], fontWeight: 400 },
  } } },
});
const card: PublicProfile["cards"][number] = {
  product: { slug: "synthetic-card", name: "Synthetic card", domain: "example.com", description: "A synthetic typography and layout fixture.", brand: snapshot },
  status: "ACTIVE", headline: "An owner-described relationship.",
  note: "A longer retained explanation. ".repeat(30),
  activity: {
    kind: "reviewActivity", reviews: 17, bugsCaught: 3, severity: [{ label: "High", count: 2 }], points: [],
    attributionScope: "PERSONAL", capturedAt: "2026-09-19T09:00:00.000Z", freshness: "FRESH", provenanceLabel: "Synthetic fixture",
  },
};

// Mount the real client component with synthetic data, without authentication or provider reads.
const compiled = buildSync({
  stdin: { contents: `import { createElement } from "react"; import { createRoot } from "react-dom/client"; import { ProductCard } from "./components/product-card";
    const card = ${JSON.stringify(card)};
    createRoot(document.getElementById("root")).render(createElement("div", { className: "card-grid" },
      createElement(ProductCard, { card, index: 0 }),
      createElement(ProductCard, { card: { ...card, headline: "Short note.", activity: undefined }, index: 1 }),
      createElement(ProductCard, { card: { ...card, headline: "A supplied synthetic calendar.", activity: {
        kind: "contributionCalendar", total: 371, attributionScope: "PERSONAL", capturedAt: "2026-09-19T09:00:00.000Z", freshness: "FRESH", provenanceLabel: "Synthetic calendar",
        days: Array.from({ length: 371 }, (_, index) => ({ date: new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10), count: 1, level: 1 })),
      } }, index: 2 })));`, resolveDir: process.cwd() },
  bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
});

for (const width of [1280, 390]) test(`card typography and natural disclosure layout at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.setContent('<main id="root"></main>');
  await page.addStyleTag({ content: readFileSync(process.env.CARD_LAYOUT_STYLESHEET ?? "app/globals.css", "utf8") });
  await page.addScriptTag({ content: compiled.outputFiles[0].text });
  const first = page.locator(".product-card").first();
  await expect(first).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(`2026-09-19-card-front-${width}.png`), fullPage: true, animations: "disabled" });
  for (const selector of [".eyebrow", ".card-button", ".card-activity-preview", ".activity-meta", ".status-row", ".severity-row span", ".close-button", ".card-back-content"]) {
    await expect(first.locator(selector).first()).toHaveCSS("font-family", 'Verdana, sans-serif');
  }
  // The headline is set in the brand's heading face, like the name above it.
  for (const selector of ["h2", ".card-headline", ".metric-row strong", ".product-logo"]) {
    await expect(first.locator(selector).first()).toHaveCSS("font-family", '"Trebuchet MS", sans-serif');
  }
  const frontHeight = (await first.boundingBox())!.height;
  const shortHeight = (await page.locator(".product-card").nth(1).boundingBox())!.height;
  expect(shortHeight).toBeLessThan(frontHeight);
  expect(frontHeight).toBeLessThan(320);
  const trigger = first.getByRole("button", { name: "Details", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(first.locator(".card-back h2")).toBeFocused();
  await expect(first.locator(".card-brand-provenance")).toHaveCount(0);
  await expect(first.locator(".card-back")).not.toContainText("Context.dev");
  await expect(first.locator(".activity-meta")).not.toContainText("Updated");
  await expect(first.locator(".activity-meta")).toContainText("Snapshot recorded 19 Sep 2026");
  const content = first.locator(".card-back-content");
  await expect(content).toHaveCSS("overflow-y", "visible");
  expect((await first.boundingBox())!.height).toBeGreaterThan(frontHeight);
  expect(await content.evaluate(element => element.scrollHeight <= element.clientHeight)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`${new Date().toISOString().slice(0, 10)}-card-details-${width}.png`), fullPage: true, animations: "disabled" });
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(first).toHaveAttribute("data-side", "front");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await trigger.click();
  await expect(first.locator(".card-back")).toHaveCSS("animation-name", "none");
  await first.getByRole("button", { name: "Close details", exact: true }).click();
  await expect(trigger).toBeFocused();
  const calendarCard = page.locator(".product-card").nth(2);
  const frontCalendar = calendarCard.locator(".card-front .activity-calendar");
  await expect(frontCalendar).toBeVisible();
  await expect(frontCalendar.locator("[data-date]")).toHaveCount(371);
  await expect(frontCalendar.locator('[data-date="2025-01-01"]')).toHaveCSS("grid-row-start", "4");
  await expect(frontCalendar.locator('[data-date="2025-01-05"]')).toHaveCSS("grid-column-start", "2");
  await expect(frontCalendar.locator(`[title=${JSON.stringify("1 Jan 2025: 1 contribution")}]`)).toBeVisible();
  await calendarCard.getByRole("button", { name: "Details", exact: true }).click();
  // The back doesn't draw the calendar again; it says where the counts came from.
  await expect(calendarCard.locator(".card-back .activity-calendar")).toHaveCount(0);
  await expect(calendarCard.locator(".card-back .activity-summary")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

const LOOM_LINK = "https://www.loom.com/share/e5b8c04bca094dd8a5507925ab887002";
const linkCard = { ...card, headline: "Building an enrichment table.", activity: undefined, usageLink: { url: LOOM_LINK, label: "SEE_HOW_I_USE_IT" as const } };
const linkCompiled = buildSync({
  stdin: { contents: `import { createElement } from "react"; import { createRoot } from "react-dom/client"; import { ProductCard } from "./components/product-card";
    createRoot(document.getElementById("root")).render(createElement("div", { className: "card-grid" },
      createElement(ProductCard, { card: ${JSON.stringify(linkCard)}, index: 0 })));`, resolveDir: process.cwd() },
  bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
});

for (const width of [1280, 390]) test(`the owner's work-sample link sits on the card's back and loads nothing from its site at ${width}px`, async ({ page }, testInfo) => {
  const linkHostRequests: string[] = [];
  page.on("request", request => {
    if (new URL(request.url()).hostname.endsWith("loom.com")) linkHostRequests.push(request.url());
  });
  await page.setViewportSize({ width, height: 900 });
  await page.setContent('<!doctype html><html lang="en"><head><title>Work-sample link fixture</title></head><body><main><h1>Work-sample link fixture</h1><div id="root"></div></main></body></html>');
  await page.addStyleTag({ content: readFileSync("app/globals.css", "utf8") });
  await page.addScriptTag({ content: linkCompiled.outputFiles[0].text });
  const first = page.locator(".product-card").first();
  await expect(first.locator(".card-front .usage-link")).toHaveCount(0);
  await first.getByRole("button", { name: "Details", exact: true }).click();
  const link = first.getByRole("link", { name: "See how I use it, on loom.com (opens in a new tab)", exact: true });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", LOOM_LINK);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  await expect(page.locator("iframe")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(linkHostRequests).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath(`2026-09-26-usage-link-back-${width}.png`), fullPage: true, animations: "disabled" });
});

for (const width of [320, 390, 1280]) test(`grouped private records fit and switch without saving or merging same-domain products at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  const grouped = buildSync({
    stdin: { contents: `import { createElement } from "react"; import { createRoot } from "react-dom/client"; import { PrivateInventoryView } from "./components/private-inventory";
      const item = (id, status, headline, note) => ({
        prop: { _id: id, _creationTime: 1, userId: "synthetic-owner", productId: "synthetic-github", visibility: "PRIVATE", status, headline, note, relationshipVersion: 1 },
        product: { _id: "synthetic-github", _creationTime: 1, name: "GitHub", slug: "github", domain: "github.com", description: "Synthetic GitHub fixture" },
        links: [], previousStatuses: [], associatedAccountEvidence: [],
      });
      const active = item("synthetic-active", "ACTIVE", "Current GitHub workflow with retained private account and repository context", "Synthetic current note.");
      const testing = item("synthetic-testing", "TESTING", "Testing a GitHub workflow", "Synthetic testing note.");
      const archived = item("synthetic-archived", "ARCHIVED", "Earlier GitHub workflow", "Synthetic archived note.");
      const copilot = { ...item("synthetic-copilot", "ACTIVE", "Separate Copilot workflow", "Synthetic Copilot note."),
        prop: { ...active.prop, _id: "synthetic-copilot", productId: "synthetic-copilot-product", headline: "Separate Copilot workflow", note: "Synthetic Copilot note." },
        product: { ...active.product, _id: "synthetic-copilot-product", name: "Copilot", slug: "github-copilot" },
      };
      createRoot(document.getElementById("root")).render(createElement(PrivateInventoryView, {
        data: { cards: [active, testing, archived, copilot], hasMore: false },
        onImport: async () => {},
        onSave: async () => { document.getElementById("save-count").textContent = String(Number(document.getElementById("save-count").textContent) + 1); throw new Error("Unexpected fixture save"); },
      }));`, resolveDir: process.cwd() },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    outfile: "private-inventory-fixture.js",
    loader: { ".module.css": "local-css" },
    define: { "process.env.NODE_ENV": '"production"' },
  });
  await page.setContent('<main id="root" class="onboarding-shell"></main><output id="save-count">0</output>');
  await page.addStyleTag({ content: readFileSync("app/globals.css", "utf8") });
  await page.addStyleTag({ content: grouped.outputFiles.find(file => file.path.endsWith(".css"))!.text });
  await page.addScriptTag({ content: grouped.outputFiles.find(file => file.path.endsWith(".js"))!.text });
  const github = page.locator('section[aria-label="GitHub in your collection"]');
  const copilot = page.locator('section[aria-label="Copilot in your collection"]');
  const selector = github.getByRole("combobox", { name: "Record to inspect for GitHub", exact: true });
  const note = github.getByRole("textbox", { name: "Explanation or workflow (optional)", exact: true });
  const assertInspected = async (id: string, topLine: string, headline: string, savedNote: string) => {
    await expect(selector).toHaveValue(id);
    await expect(github.locator(".product-card")).toHaveCount(1);
    await expect(github.locator(".card-title .eyebrow")).toHaveText(topLine);
    await expect(github.locator(".card-headline")).toHaveText(headline);
    if (!await note.isVisible()) await github.getByText("Manage relationship and context", { exact: true }).click();
    await expect(github.getByRole("combobox", { name: "How it fits", exact: true })).toHaveValue("");
    await expect(note).toHaveValue(savedNote);
    await expect(page.locator("#save-count")).toHaveText("0");
  };
  await expect(page.locator(".product-card")).toHaveCount(2);
  await expect(copilot.locator(".card-front .card-title h2")).toHaveText("Copilot");
  await expect(selector.locator("option")).toHaveCount(3);
  await page.screenshot({ path: testInfo.outputPath(`2026-09-19-record-selector-${width}.png`), fullPage: true, animations: "disabled" });
  const selectorBounds = (await selector.boundingBox())!;
  const groupBounds = (await github.boundingBox())!;
  await testInfo.attach("record-selector-layout", { body: JSON.stringify({ viewport: page.viewportSize(), selector: selectorBounds, group: groupBounds }), contentType: "application/json" });
  expect(selectorBounds.width).toBeGreaterThan(0);
  expect(selectorBounds.x).toBeGreaterThanOrEqual(groupBounds.x);
  expect(selectorBounds.x + selectorBounds.width).toBeLessThanOrEqual(groupBounds.x + groupBounds.width + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await assertInspected("synthetic-active", "Using", "Current GitHub workflow with retained private account and repository context", "Synthetic current note.");
  await note.fill("An unsaved synthetic edit.");
  await selector.selectOption("synthetic-testing");
  await assertInspected("synthetic-testing", "Testing", "Testing a GitHub workflow", "Synthetic testing note.");
  await selector.selectOption("synthetic-archived");
  await assertInspected("synthetic-archived", "Used before", "Earlier GitHub workflow", "Synthetic archived note.");
  await page.getByRole("button", { name: "Current", exact: true }).click();
  await assertInspected("synthetic-active", "Using", "Current GitHub workflow with retained private account and repository context", "Synthetic current note.");
  await expect(copilot).toBeVisible();
  await page.getByRole("button", { name: "Testing", exact: true }).click();
  await assertInspected("synthetic-testing", "Testing", "Testing a GitHub workflow", "Synthetic testing note.");
  await expect(copilot).toHaveCount(0);
  await page.getByRole("button", { name: "Used before", exact: true }).click();
  await assertInspected("synthetic-archived", "Used before", "Earlier GitHub workflow", "Synthetic archived note.");
  await page.getByRole("button", { name: "All", exact: true }).click();
  await assertInspected("synthetic-active", "Using", "Current GitHub workflow with retained private account and repository context", "Synthetic current note.");
  await expect(page.locator(".product-card")).toHaveCount(2);
  await expect(copilot.locator(".card-headline")).toHaveText("Separate Copilot workflow");
  await expect(page.locator("#save-count")).toHaveText("0");
});

for (const width of [390, 1280]) test(`upload attribution stays honest in supporting details at ${width}px`, async ({ page }, testInfo) => {
  const compiled = buildSync({
    stdin: { contents: `import { createElement } from "react"; import { createRoot } from "react-dom/client"; import { InventoryRelationshipDetails } from "./components/private-inventory";
      const item = {
        prop: { _id: "synthetic-prop", _creationTime: 1, userId: "synthetic-owner", productId: "synthetic-product", visibility: "DRAFT", status: "TESTING", headline: "Unreviewed upload", note: "" },
        product: { _id: "synthetic-product", _creationTime: 1, name: "Synthetic product", slug: "synthetic", domain: "example.com", description: "" }, links: [], previousStatuses: [], associatedAccountEvidence: [],
      };
      const evidence = ["UNVERIFIED_LEGACY", "VERIFIED_OWNER_SESSION"].map((attribution, i) => ({
        id: "synthetic-evidence-" + i, capturedAt: "2026-09-19T12:00:00Z", sourceType: "FILE_UPLOAD", sourceLabel: "Synthetic private export", limitations: [], observationCount: 0,
        uploadedFile: { filename: "export.json", mimeType: "application/json", byteSize: 100, attribution },
      }));
      createRoot(document.getElementById("root")).render(createElement(InventoryRelationshipDetails, { item, evidence, onSave: async () => { throw new Error("No owner choices in fixture"); } }));`, resolveDir: process.cwd() },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    outfile: "upload-attribution.js", loader: { ".module.css": "local-css" },
    define: { "process.env.NODE_ENV": '"production"' },
  });
  await page.setViewportSize({ width, height: 1000 });
  await page.setContent('<main class="onboarding-shell" id="root"></main>');
  await page.addStyleTag({ content: readFileSync("app/globals.css", "utf8") });
  await page.addStyleTag({ content: compiled.outputFiles.find(file => file.path.endsWith(".css"))!.text });
  await page.addScriptTag({ content: compiled.outputFiles.find(file => file.path.endsWith(".js"))!.text });
  await expect(page.getByText(/original uploader is unverified/)).toBeVisible();
  await expect(page.getByText(/authorship and product usage are not verified/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`2026-09-19-upload-attribution-${width}.png`), fullPage: true });
});

for (const width of [320, 1280]) test(`contribution calendar preserves supplied zeros and unsupplied gaps at ${width}px`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const sparse = { ...card, activity: {
    kind: "contributionCalendar", total: 4, attributionScope: "PERSONAL", capturedAt: "2026-09-19T09:00:00.000Z", freshness: "STALE", provenanceLabel: "Synthetic partial snapshot",
    period: { start: "2026-09-01", end: "2026-09-04" },
    days: [{ date: "2026-09-04", count: 4, level: 3 }, { date: "2026-09-01", count: 0, level: 0 }],
  } };
  const bundle = buildSync({ stdin: { contents: `import { createElement } from "react"; import { createRoot } from "react-dom/client"; import { ProductCard } from "./components/product-card";
    createRoot(document.getElementById("root")).render(createElement(ProductCard, { card: ${JSON.stringify(sparse)}, index: 0 }));`, resolveDir: process.cwd() },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
  });
  await page.setViewportSize({ width, height: 1000 });
  await page.setContent('<main id="root"></main>');
  await page.addStyleTag({ content: readFileSync("app/globals.css", "utf8") });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const front = page.locator(".card-front");
  await expect(front.locator("[data-date]")).toHaveCount(2);
  await expect(front.locator(`[title=${JSON.stringify("1 Sep 2026: 0 contributions")}]`)).toHaveAttribute("data-level", "0");
  await expect(front.locator(`[title=${JSON.stringify("4 Sep 2026: 4 contributions")}]`)).toHaveCSS("grid-row-start", "6");
  const cell = await front.locator(`[title=${JSON.stringify("4 Sep 2026: 4 contributions")}]`).boundingBox();
  expect(cell).not.toBeNull();
  expect(Math.abs(cell!.width - cell!.height)).toBeLessThanOrEqual(1);
  expect(cell!.width).toBeLessThanOrEqual(12);
  await expect(front).toContainText("2 days have no supplied count");
  await expect(front.locator("[data-freshness]")).toHaveText(" · last updated 19 Sep 2026");
  await expect(front.locator('[data-date="2026-09-02"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await expect(page.locator(".card-back")).toContainText("Synthetic partial snapshot");
});

for (const width of [320, 1280]) test(`contribution calendar retains missing period boundaries at ${width}px`, async ({ page }, testInfo) => {
  const sparse = { ...card, activity: {
    kind: "contributionCalendar", total: 4, attributionScope: "PERSONAL", capturedAt: "2026-09-21T09:00:00.000Z", freshness: "FRESH", provenanceLabel: "Synthetic boundary-gap snapshot",
    period: { start: "2026-09-01", end: "2026-09-30" },
    days: [{ date: "2026-09-15", count: 0, level: 0 }, { date: "2026-09-25", count: 4, level: 3 }],
  } };
  const bundle = buildSync({ stdin: { contents: `import { createElement } from "react"; import { createRoot } from "react-dom/client"; import { ProductCard } from "./components/product-card";
    createRoot(document.getElementById("root")).render(createElement(ProductCard, { card: ${JSON.stringify(sparse)}, index: 0 }));`, resolveDir: process.cwd() },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
  });
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setContent('<main id="root"></main>');
  await page.addStyleTag({ content: readFileSync("app/globals.css", "utf8") });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  for (const side of [".card-front"]) {
    const face = page.locator(side);
    const grid = face.locator(".activity-calendar");
    await expect(grid.locator("[data-date]")).toHaveCount(2);
    await expect(grid.locator(`[title=${JSON.stringify("15 Sep 2026: 0 contributions")}]`)).toHaveCSS("grid-column-start", "3");
    await expect(grid.locator(`[title=${JSON.stringify("25 Sep 2026: 4 contributions")}]`)).toHaveCSS("grid-column-start", "4");
    await expect(face).toContainText("28 days have no supplied count; blank spaces are not zero activity.");
    await expect(face).toContainText("Daily counts: 15 Sep 2026 – 25 Sep 2026");
    await expect(grid.locator('[data-date="2026-09-01"], [data-date="2026-09-30"]')).toHaveCount(0);
    const geometry = await grid.evaluate(element => {
      const computed = getComputedStyle(element);
      return {
        columns: computed.gridTemplateColumns.split(" ").length,
        width: element.getBoundingClientRect().width,
        expectedWidth: 5 * 10 + 4 * 3,
      };
    });
    expect(geometry.columns).toBe(5);
    expect(Math.abs(geometry.width - geometry.expectedWidth)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`2026-09-21-calendar-boundaries-${side.slice(1)}-${width}.png`), fullPage: true, animations: "disabled" });
  }
  // The back doesn't draw the calendar again.
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await expect(page.locator(".card-back .activity-calendar")).toHaveCount(0);
});

const HEADLINE_LIMIT = 240;
for (const width of [320, 1280]) test(`a headline is set large in the heading face, and the longest one an owner can write still fits at ${width}px`, async ({ page }) => {
  const headlines = ["Short.", "A".repeat(80), "An owner can say a lot about why this product matters to them, ".repeat(4).slice(0, HEADLINE_LIMIT)];
  const bundle = buildSync({ stdin: { contents: `import { createElement } from "react"; import { createRoot } from "react-dom/client"; import { ProductCard } from "./components/product-card";
    const card = ${JSON.stringify(card)};
    createRoot(document.getElementById("root")).render(createElement("div", { className: "card-grid" },
      ...${JSON.stringify(headlines)}.map((headline, index) => createElement(ProductCard, { key: index, card: { ...card, headline, activity: undefined }, index }))));`, resolveDir: process.cwd() },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
  });
  await page.setViewportSize({ width, height: 1000 });
  await page.setContent('<main id="root"></main>');
  await page.addStyleTag({ content: readFileSync("app/globals.css", "utf8") });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const shown = await page.locator(".card-front .card-headline").evaluateAll(elements => elements.map(element => {
    const style = getComputedStyle(element);
    return { size: parseFloat(style.fontSize), family: style.fontFamily, fits: element.scrollWidth <= element.clientWidth };
  }));
  // 1.5rem for a short line, stepping down for a long one so 240 characters stay a paragraph, not a wall.
  expect(shown.map(({ size }) => size)).toEqual([24, 20.8, 18.4]);
  expect(shown.every(({ family, fits }) => family === '"Trebuchet MS", sans-serif' && fits)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

/** The longest value a published measurement can carry, and one below one, beside each other on a card. */
const LONG_VALUE_DIGITS = 650;
const measured = {
  capturedAt: "2026-09-19T09:00:00.000Z", status: "measured", identityBasis: "OWNER_SUPPLIED", activityActor: "UNKNOWN", sample: "synthetic", derivation: "SOURCE_REPORTED",
  scope: "WORKSPACE", coverage: "COMPLETE", temporality: "CUMULATIVE", aggregation: "NON_ADDITIVE", unit: "rows", period: { kind: "date", start: "2026-01-01", end: "2026-08-31", timezone: "UTC" },
} as const;
const longValueCard = { ...card, activity: undefined, measurements: [{ ...measured, metric: "enriched", value: "9".repeat(LONG_VALUE_DIGITS) }, { ...measured, metric: "used", value: "0.004" }] };
const longValueBundle = buildSync({
  stdin: { contents: `import { createElement } from "react"; import { createRoot } from "react-dom/client"; import { ProductCard } from "./components/product-card";
    createRoot(document.getElementById("root")).render(createElement("div", { className: "card-grid" }, createElement(ProductCard, { card: ${JSON.stringify(longValueCard)}, index: 0 })));`, resolveDir: process.cwd() },
  bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
});

test("at 390px a 650-digit published value wraps inside its card, front and back, and a value below one keeps its digits", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.setContent('<main id="root"></main>');
  await page.addStyleTag({ content: readFileSync(process.env.CARD_LAYOUT_STYLESHEET ?? "app/globals.css", "utf8") });
  await page.addScriptTag({ content: longValueBundle.outputFiles[0].text });
  const article = page.locator(".product-card");
  await expect(article).toBeVisible();
  const inside = () => article.evaluate(element => {
    const box = element.getBoundingClientRect();
    const face = element.querySelector(element.getAttribute("data-side") === "back" ? ".card-back" : ".card-front")!;
    return [...face.querySelectorAll("*")].filter(node => node.checkVisibility())
      .filter(node => node.getBoundingClientRect().right > box.right + 1 || node.scrollWidth > node.clientWidth + 1 && getComputedStyle(node).overflowX === "visible").length;
  });
  await expect(article.locator(".card-front")).toContainText("0.004");
  expect(await inside()).toBe(0);
  await article.getByRole("button", { name: "Details", exact: true }).click();
  await article.getByRole("button", { name: "How this was measured" }).click();
  expect(await inside()).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

/** A brand whose mark is the colour given, on a white card with near-black text. */
const markedBrand = (accent: string) => normalizeProductBrand({
  productSlug: "synthetic-card", canonicalDomain: "example.com", retrievalId: "synthetic-accent-2026-11-14",
  retrievedAt: "2026-11-14T09:00:00.000Z", responseHash: "b".repeat(64),
}, {
  brand: { status: "ok", brand: { domain: "example.com", logos: [], colors: [] } },
  styleguide: { status: "ok", domain: "example.com", styleguide: { mode: "light", colors: { accent, background: "#ffffff", text: "#111111" } } },
});
// Yellow is 1.4:1 on white, short of the 3:1 large text needs; burnt orange is 5.2:1.
const accentCards = [["#ffd400", "Yellow"], ["#c2410c", "Orange"]].map(([accent, name]) => ({
  ...card, activity: undefined, headline: "Turns pages into clean Markdown.", product: { ...card.product, name, brand: markedBrand(accent) },
}));
const accentBundle = buildSync({
  stdin: { contents: `import { createElement } from "react"; import { createRoot } from "react-dom/client"; import { ProductCard } from "./components/product-card";
    createRoot(document.getElementById("root")).render(createElement("div", { className: "card-grid" },
      ${JSON.stringify(accentCards)}.map((card, index) => createElement(ProductCard, { key: index, card, index, headlineAccent: "clean Markdown" }))));`, resolveDir: process.cwd() },
  bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
});

test("a large headline's phrase takes the brand's mark where it reads 3:1, and stays in the headline's colour where it doesn't", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.setContent('<main id="root"></main>');
  await page.addStyleTag({ content: readFileSync(process.env.CARD_LAYOUT_STYLESHEET ?? "app/globals.css", "utf8") });
  await page.addScriptTag({ content: accentBundle.outputFiles[0].text });
  const shown = (name: string) => page.getByRole("article", { name: `${name} card` }).locator(".card-headline").evaluate(headline => ({
    size: getComputedStyle(headline).fontSize, headline: getComputedStyle(headline).color, phrase: getComputedStyle(headline.querySelector(".card-headline-accent")!).color,
  }));
  expect(await shown("Yellow")).toEqual({ size: "24px", headline: "rgb(17, 17, 17)", phrase: "rgb(17, 17, 17)" });
  expect(await shown("Orange")).toEqual({ size: "24px", headline: "rgb(17, 17, 17)", phrase: "rgb(194, 65, 12)" });
});

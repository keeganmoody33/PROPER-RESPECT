import { readFileSync } from "node:fs";
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
  for (const selector of [".eyebrow", ".card-headline", ".card-button", ".card-activity-preview", ".activity-meta", ".status-row", ".severity-row span", ".close-button", ".card-back-content"]) {
    await expect(first.locator(selector).first()).toHaveCSS("font-family", 'Verdana, sans-serif');
  }
  for (const selector of ["h2", ".metric-row strong", ".product-logo"]) {
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
  const content = first.locator(".card-back-content");
  await expect(content).toHaveCSS("overflow-y", "visible");
  expect((await first.boundingBox())!.height).toBeGreaterThan(frontHeight);
  expect(await content.evaluate(element => element.scrollHeight <= element.clientHeight)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`2026-09-19-card-details-${width}.png`), fullPage: true, animations: "disabled" });
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(first).toHaveAttribute("data-side", "front");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await trigger.click();
  await expect(first.locator(".card-back")).toHaveCSS("animation-name", "none");
  await first.getByRole("button", { name: "Close details", exact: true }).click();
  await expect(trigger).toBeFocused();
  const calendarCard = page.locator(".product-card").nth(2);
  await calendarCard.getByRole("button", { name: "Details", exact: true }).click();
  const calendar = calendarCard.locator(".activity-calendar");
  await expect(calendar.locator("span")).toHaveCount(371);
  expect(await calendar.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return Array.from(element.children).every(day => {
      const cell = day.getBoundingClientRect();
      return cell.width > 0 && cell.left >= bounds.left && cell.right <= bounds.right + 1;
    });
  })).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
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
  const assertInspected = async (id: string, status: string, headline: string, savedNote: string) => {
    await expect(selector).toHaveValue(id);
    await expect(github.locator(".product-card")).toHaveCount(1);
    await expect(github.locator(".card-title .eyebrow")).toHaveText(status);
    await expect(github.locator(".card-headline")).toHaveText(headline);
    if (!await note.isVisible()) await github.getByText("Manage relationship and context", { exact: true }).click();
    await expect(github.getByRole("combobox", { name: "How it fits", exact: true })).toHaveValue(status);
    await expect(note).toHaveValue(savedNote);
    await expect(page.locator("#save-count")).toHaveText("0");
  };
  await expect(page.locator(".product-card")).toHaveCount(2);
  await expect(copilot.locator(".card-title h2")).toHaveText("Copilot");
  await expect(selector.locator("option")).toHaveCount(3);
  await page.screenshot({ path: testInfo.outputPath(`2026-09-19-record-selector-${width}.png`), fullPage: true, animations: "disabled" });
  const selectorBounds = (await selector.boundingBox())!;
  const groupBounds = (await github.boundingBox())!;
  await testInfo.attach("record-selector-layout", { body: JSON.stringify({ viewport: page.viewportSize(), selector: selectorBounds, group: groupBounds }), contentType: "application/json" });
  expect(selectorBounds.width).toBeGreaterThan(0);
  expect(selectorBounds.x).toBeGreaterThanOrEqual(groupBounds.x);
  expect(selectorBounds.x + selectorBounds.width).toBeLessThanOrEqual(groupBounds.x + groupBounds.width + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await assertInspected("synthetic-active", "ACTIVE", "Current GitHub workflow with retained private account and repository context", "Synthetic current note.");
  await note.fill("An unsaved synthetic edit.");
  await selector.selectOption("synthetic-testing");
  await assertInspected("synthetic-testing", "TESTING", "Testing a GitHub workflow", "Synthetic testing note.");
  await selector.selectOption("synthetic-archived");
  await assertInspected("synthetic-archived", "ARCHIVED", "Earlier GitHub workflow", "Synthetic archived note.");
  await page.getByRole("button", { name: "Current", exact: true }).click();
  await assertInspected("synthetic-active", "ACTIVE", "Current GitHub workflow with retained private account and repository context", "Synthetic current note.");
  await expect(copilot).toBeVisible();
  await page.getByRole("button", { name: "Testing", exact: true }).click();
  await assertInspected("synthetic-testing", "TESTING", "Testing a GitHub workflow", "Synthetic testing note.");
  await expect(copilot).toHaveCount(0);
  await page.getByRole("button", { name: "Archived", exact: true }).click();
  await assertInspected("synthetic-archived", "ARCHIVED", "Earlier GitHub workflow", "Synthetic archived note.");
  await page.getByRole("button", { name: "All", exact: true }).click();
  await assertInspected("synthetic-active", "ACTIVE", "Current GitHub workflow with retained private account and repository context", "Synthetic current note.");
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

// 2026-09-19: synthetic activity and layout; real retained official brand bytes.
import { readFileSync } from "node:fs";
import { buildSync } from "esbuild";
import { expect, test, type Page } from "@playwright/test";
import { verifiedProductAssets } from "../../src/domain/verified-product-assets";
import type { PublicProfile } from "../../src/domain/public-profile";

const assets = verifiedProductAssets({ slug: "github-copilot", domain: "github.com" })!;
const baseCard: PublicProfile["cards"][number] = {
  product: { slug: "github-copilot", domain: "github.com", name: "GitHub Copilot", description: "Synthetic product description for the card fixture." },
  status: "TESTING", headline: "Synthetic owner relationship.", note: "Synthetic owner note.",
  primaryLink: { type: "CANONICAL", url: "https://github.com/features/copilot", label: "Visit GitHub Copilot" },
  activity: {
    kind: "headlineMetrics", primary: { value: 17, label: "synthetic contributions" }, supporting: [],
    attributionScope: "PERSONAL", capturedAt: "2026-09-19T20:00:00.000Z", freshness: "FRESH", provenanceLabel: "Synthetic fixture",
  },
};
const lightCard: typeof baseCard = {
  ...baseCard,
  product: { ...baseCard.product, brand: {
    schemaVersion: 1, provider: "context.dev", adapterVersion: "synthetic-style-fixture",
    productSlug: "github-copilot", canonicalDomain: "github.com", retrievalId: "synthetic-light-surface",
    retrievedAt: "2026-09-19T20:00:00.000Z", partial: true, logos: [], fonts: [], colors: [], receipts: [], responseHash: "a".repeat(64),
    styleguide: { mode: "light", colors: { background: "#ffffff", text: "#111111" } },
  } },
};
const compiled = buildSync({
  stdin: {
    contents: `import {createElement} from "react"; import {createRoot} from "react-dom/client"; import {ProductCard} from "./components/product-card";
      createRoot(document.getElementById("root")).render(createElement("div", {className:"card-grid"},
        createElement(ProductCard, {card:${JSON.stringify(baseCard)},index:0}),
        createElement(ProductCard, {card:${JSON.stringify(lightCard)},index:1})));`,
    resolveDir: process.cwd(),
  },
  bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
});

async function mount(page: Page, fail?: "logos" | "fonts") {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const externalRequests: string[] = [];
  const localPaths = new Set([...assets.logos, ...assets.typography.files, assets.typography.license].map(file => file.path));
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.hostname !== "fixture.invalid") {
      externalRequests.push(url.href);
      return route.abort();
    }
    if (url.pathname === "/") return route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: '<meta charset="utf-8"><p id="fixture-label">Synthetic activity · verified official assets · local fixture</p><main id="root"></main>',
    });
    if (!localPaths.has(url.pathname)) return route.abort();
    if ((fail === "logos" && url.pathname.endsWith(".svg")) || (fail === "fonts" && url.pathname.endsWith(".woff2"))) return route.abort();
    return route.fulfill({
      body: readFileSync(`public${url.pathname}`),
      contentType: url.pathname.endsWith(".svg") ? "image/svg+xml" : url.pathname.endsWith(".woff2") ? "font/woff2" : "text/plain",
    });
  });
  await page.goto("http://fixture.invalid/");
  await page.addStyleTag({ content: readFileSync("app/globals.css", "utf8") });
  await page.addScriptTag({ content: compiled.outputFiles[0].text });
  await expect(page.locator(".product-card")).toHaveCount(2);
  await page.evaluate(() => document.fonts.ready);
  return externalRequests;
}

for (const width of [1280, 390]) test(`official Copilot lockups and scoped fonts without card diagnostics at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  const externalRequests = await mount(page);
  await page.evaluate(async family => {
    await Promise.all([400, 500, 700].map(weight => document.fonts.load(`${weight} 16px "${family}"`)));
  }, assets.typography.cssFamily);
  for (const [index, mode] of ["dark", "light"].entries()) {
    const card = page.locator(".product-card").nth(index);
    const image = card.locator(".product-logo img");
    await expect(image).toHaveAttribute("src", assets.logos.find(logo => logo.mode === mode)!.path);
    await image.evaluate((element: HTMLImageElement) => element.decode());
    const size = await image.boundingBox();
    expect(size!.width).toBeGreaterThan(200);
    expect(size!.width / size!.height).toBeCloseTo(734 / 95, 1);
    await expect(card.getByRole("heading", { name: "GitHub Copilot", exact: true })).toHaveCount(1);
    const families = await card.evaluate(element => [...element.querySelectorAll("*")]
      .filter(node => node.textContent?.trim() && node.children.length === 0 && node.tagName !== "STYLE")
      .map(node => getComputedStyle(node).fontFamily));
    expect(families.every(family => family.includes(assets.typography.cssFamily))).toBe(true);
  }
  await expect(page.locator("#fixture-label")).toHaveCSS("font-family", "Arial, Helvetica, sans-serif");
  expect(await page.evaluate(() => [...document.fonts].filter(face => face.family.includes("PRVerified-")).every(face => face.status === "loaded"))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`2026-09-19-copilot-front-${width}.png`), fullPage: true, animations: "disabled" });
  for (const card of await page.locator(".product-card").all()) {
    await card.getByRole("button", { name: "Details", exact: true }).click();
    await expect(card.locator(".card-brand-provenance")).toHaveCount(0);
    await expect(card.getByRole("link", { name: "Source URLs and SHA-256 hashes" })).toHaveCount(0);
    await expect(card.locator(".activity-meta")).toContainText("Synthetic fixture");
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`2026-09-19-copilot-details-${width}.png`), fullPage: true, animations: "disabled" });
  expect(externalRequests).toEqual([]);
});

test("missing official logos fall back to product text while fonts still load", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  const externalRequests = await mount(page, "logos");
  await expect(page.locator(".product-logo img")).toHaveCount(0);
  for (const logo of await page.locator(".product-logo").all()) await expect(logo).toHaveText("GitHub Copilot");
  expect(await page.evaluate(family => document.fonts.check(`400 16px "${family}"`), assets.typography.cssFamily)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("2026-09-19-copilot-logo-fallback-mobile.png"), fullPage: true, animations: "disabled" });
  expect(externalRequests).toEqual([]);
});

test("missing fonts preserve readable fallback text and intact official logos", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  const externalRequests = await mount(page, "fonts");
  for (const image of await page.locator(".product-logo img").all()) await image.evaluate((element: HTMLImageElement) => element.decode());
  expect(await page.evaluate(() => [...document.fonts].filter(face => face.family.includes("PRVerified-")).some(face => face.status === "error"))).toBe(true);
  await expect(page.locator(".card-headline").first()).toHaveText("Synthetic owner relationship.");
  await expect(page.locator(".card-headline").first()).toHaveCSS("font-family", `${assets.typography.cssFamily}, Arial, Helvetica, sans-serif`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("2026-09-19-copilot-font-fallback-mobile.png"), fullPage: true, animations: "disabled" });
  expect(externalRequests).toEqual([]);
});

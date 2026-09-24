import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join, extname } from "node:path";
import { spawnSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { expect, test, type Locator } from "@playwright/test";

let server: Server;
let nativeServer: Server;
let nativeOrigin: string;
test.use({ deviceScaleFactor: 3 });
let origin: string;
let output: string;
let nativeOutput: string;
const huge = "900719925474099312345678901234";
const tiny = "0.00000000000000000001234567890123456789";

test.beforeAll(async () => {
  const scratch = mkdtempSync(join(tmpdir(), "usage-card-browser-"));
  output = join(scratch, "preview");
  nativeOutput = join(scratch, "native-preview");
  const nativeFixture = "tests/fixtures/claude-native/private-card-synthetic.json";
  const laterNative = join(scratch, "native-later.json");
  const later = JSON.parse(readFileSync(nativeFixture, "utf8"));
  later.capturedAt = "2026-09-24T13:00:00.000Z";
  writeFileSync(laterNative, JSON.stringify(later));
  const fixture = JSON.parse(readFileSync("tests/fixtures/usage-cost/priced-synthetic.json", "utf8"));
  fixture.namespace = "PRIVATE_NAMESPACE_HUGE";
  fixture.ownerAlias = "PRIVATE_OWNER_SENTINEL";
  fixture.accountAlias = "PRIVATE_ACCOUNT_SENTINEL";
  fixture.deviceAlias = "PRIVATE_DEVICE_SENTINEL";
  fixture.bundles[0].counts = { input: huge, output: "0", cacheRead: "1", cacheCreation: "0" };
  fixture.bundles[0].sourceCostUsd = "0.000000000001";
  const large = join(scratch, "large.json");
  writeFileSync(large, JSON.stringify(fixture));
  const additional = ["cumulative-reset", "unknown-and-missing", "overlap"].map((name, index) => {
    const value = JSON.parse(readFileSync(`tests/fixtures/usage-cost/${name}.json`, "utf8"));
    value.namespace = `PRIVATE_NAMESPACE_${index}`;
    const path = join(scratch, `${name}.json`);
    writeFileSync(path, JSON.stringify(value));
    return path;
  });
  const result = spawnSync(process.execPath, ["--no-warnings", "--experimental-strip-types", "scripts/private-usage-card-preview.mjs",
    "--synthetic-haiku-20260924", "--out", output, large, large, ...additional,
    "tests/fixtures/usage-cost/priced-synthetic.json", "tests/fixtures/usage-cost/codex-account-synthetic.json", nativeFixture, laterNative], { encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
  const js = readFileSync(join(output, "preview.js"), "utf8");
  expect(js).not.toMatch(/PRIVATE_(OWNER|ACCOUNT|DEVICE|NAMESPACE)/);
  for (const digest of ["a", "b", "c", "d", "e"]) expect(js).not.toContain(digest.repeat(64));
  const nativeResult = spawnSync(process.execPath, ["--no-warnings", "--experimental-strip-types", "scripts/private-usage-card-preview.mjs",
    "--out", nativeOutput, nativeFixture, laterNative], { encoding: "utf8" });
  expect(nativeResult.status, nativeResult.stderr).toBe(0);
  const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
  async function serve(base: string) {
    const instance = createServer((request, response) => {
      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
      const path = resolve(base, `.${pathname === "/" ? "/index.html" : pathname}`);
      if (!path.startsWith(`${base}/`)) { response.writeHead(404).end(); return; }
      try { response.writeHead(200, { "Content-Type": types[extname(path)] ?? "application/octet-stream" }).end(readFileSync(path)); }
      catch { response.writeHead(404).end(); }
    });
    await new Promise<void>(done => instance.listen(0, "127.0.0.1", done));
    const address = instance.address();
    if (!address || typeof address === "string") throw new Error("Missing local fixture address");
    return { server: instance, origin: `http://127.0.0.1:${address.port}` };
  }
  ({ server, origin } = await serve(output));
  ({ server: nativeServer, origin: nativeOrigin } = await serve(nativeOutput));
});
test.afterAll(async () => {
  for (const instance of [server, nativeServer]) if (instance) await new Promise<void>((done, reject) => instance.close(error => error ? reject(error) : done()));
});

async function expectKnownLogo(card: Locator, slug: string, pixels: number) {
  const logo = card.locator(".product-logo img");
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute("src", `/product-assets/${slug}/2026-09-24/app-icon.png`);
  await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  const dimensions = await logo.evaluate((image: HTMLImageElement) => ({
    width: image.naturalWidth, height: image.naturalHeight,
    rendered: Math.max(image.getBoundingClientRect().width, image.getBoundingClientRect().height),
    density: devicePixelRatio,
  }));
  expect(dimensions.width).toBe(pixels);
  expect(dimensions.height).toBe(pixels);
  expect(dimensions.density).toBe(3);
  expect(dimensions.width).toBeGreaterThanOrEqual(dimensions.rendered * dimensions.density);
}

for (const width of [390, 1280]) for (const theme of ["light", "dark"]) {
  test(`generated exact private cards ${width}px ${theme}`, async ({ page }, testInfo) => {
    const external: string[] = [];
    const errors: string[] = [];
    page.on("request", request => { if (!request.url().startsWith(origin)) external.push(request.url()); });
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(origin);
    await page.getByRole("combobox", { name: "Appearance" }).selectOption(theme);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const claude = page.getByRole("article", { name: "Claude Code card", exact: true });
    const codex = page.getByRole("article", { name: "Codex card", exact: true });
    const copilot = page.getByRole("article", { name: "GitHub Copilot card", exact: true });
    await expectKnownLogo(claude, "claude-code", 266);
    await expect(claude).toContainText("Synthetic");
    await expectKnownLogo(codex, "codex", 385);
    await expect(codex.locator(".product-logo")).toHaveAttribute("data-logo-mode", "dark");
    await expect(codex.locator(".product-logo")).toHaveCSS("background-color", "rgb(23, 23, 19)");
    await expect(codex).toContainText("Origin unverified");
    await expect(copilot.locator(".private-usage-preview")).toHaveCount(0);
    await expect(copilot).toHaveAttribute("data-verified-brand", "github-copilot");
    const logo = copilot.locator(".product-logo img");
    await expect(logo).toBeVisible();
    await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`2026-09-24-private-usage-front-${width}-${theme}.png`), fullPage: true, animations: "disabled" });
    const details = claude.getByRole("button", { name: "Details", exact: true });
    await details.focus();
    await page.keyboard.press("Enter");
    await expect(claude.locator(".card-back h2")).toBeFocused();
    const back = claude.locator(".card-back");
    await expect(back.getByText(huge, { exact: true }).first()).toBeVisible();
    await expect(back.getByText("0.000000000001", { exact: true }).first()).toBeVisible();
    await expect(back.getByText("0.002010000000", { exact: true }).first()).toBeVisible();
    await expect(back).toContainText("Billed (USD)");
    await expect(back).toContainText("Unknown");
    await expect(back).toContainText("Cumulative baseline");
    await expect(back).toContainText("Conflicting observations");
    await expect(back).toContainText("New cumulative epoch/reset");
    await expect(back).toContainText("3 duplicate replays ignored");
    const native = back.locator(".private-native-usage");
    await expect(native).toContainText("Native Claude metrics");
    await expect(native).toContainText("Unix nanoseconds");
    await expect(native.locator(".private-native-rows")).toContainText(huge);
    await expect(native.locator(".private-native-rows")).toContainText(tiny);
    for (const exact of ["1790244000000000001", "1790244000000000100", "1790244000000000004", "1790244000000000108"]) await expect(native).toContainText(exact);
    await expect(native).toContainText("Unpriced");
    await expect(native).toContainText("Unknown");
    await native.locator("details.private-native-observations > summary").click();
    await expect(native).toContainText("2026-09-24T12:00:00.000Z");
    await expect(native).toContainText("2026-09-24T13:00:00.000Z");
    await native.screenshot({ path: testInfo.outputPath(`2026-09-24-native-mixed-${width}-${theme}.png`), animations: "disabled" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`2026-09-24-private-usage-details-${width}-${theme}.png`), fullPage: true, animations: "disabled" });
    await back.getByRole("region", { name: "Coverage row 1", exact: true }).screenshot({ path: testInfo.outputPath(`2026-09-24-private-usage-exact-row-${width}-${theme}.png`), animations: "disabled" });
    await back.locator("details.private-usage-observations > summary").filter({ hasText: /^Source observations \(/ }).click();
    await expect(back.getByText("Source observation 1", { exact: true })).toBeVisible();
    await expect(back).toContainText("not additive");
    await page.keyboard.press("Escape");
    await expect(details).toBeFocused();
    await codex.getByRole("button", { name: "Details", exact: true }).click();
    await expect(codex.locator(".card-back")).toContainText("Lifetime tokens (account snapshot)");
    await expect(codex.locator(".card-back")).toContainText("Unpriced");
    expect(await page.locator("body").textContent()).not.toMatch(/PRIVATE_(OWNER|ACCOUNT|DEVICE|NAMESPACE)/);
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
  });

  test(`generated native-only exact private cards ${width}px ${theme}`, async ({ page }, testInfo) => {
    const external: string[] = [];
    const errors: string[] = [];
    page.on("request", request => { if (!request.url().startsWith(nativeOrigin)) external.push(request.url()); });
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(nativeOrigin);
    await page.getByRole("combobox", { name: "Appearance" }).selectOption(theme);
    const claude = page.getByRole("article", { name: "Claude Code card", exact: true });
    await expect(claude).toHaveCount(1);
    await expect(page.getByRole("article", { name: "Codex card", exact: true })).toHaveCount(0);
    await expectKnownLogo(claude, "claude-code", 266);
    await expect(claude).toContainText("Synthetic");
    await expect(claude).toContainText("2 independent coverage rows");
    await page.screenshot({ path: testInfo.outputPath(`2026-09-24-native-only-front-${width}-${theme}.png`), fullPage: true, animations: "disabled" });
    const details = claude.getByRole("button", { name: "Details", exact: true });
    await details.focus();
    await page.keyboard.press("Enter");
    await expect(claude.locator(".card-back h2")).toBeFocused();
    const native = claude.locator(".private-native-usage");
    await expect(native).toContainText("Native Claude metrics");
    const rows = native.locator(".private-native-rows");
    await expect(rows.getByRole("heading", { name: /^Native coverage row / })).toHaveCount(2);
    await expect(rows).toContainText(huge);
    await expect(rows).toContainText(tiny);
    await expect(rows).toContainText("Source estimate (USD)");
    await expect(rows).toContainText("Unpriced");
    await expect(rows).toContainText("Unknown");
    await expect(native).toContainText("Unix nanoseconds");
    await expect(native).toContainText(/independent/i);
    await native.locator("details.private-native-observations > summary").click();
    const observations = native.locator("details.private-native-observations");
    await expect(observations.getByRole("heading", { name: /^Native observation / })).toHaveCount(2);
    await expect(observations).toContainText("2026-09-24T12:00:00.000Z");
    await expect(observations).toContainText("2026-09-24T13:00:00.000Z");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await native.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await native.screenshot({ path: testInfo.outputPath(`2026-09-24-native-only-${width}-${theme}.png`), animations: "disabled" });
    expect(await page.locator("body").textContent()).not.toMatch(/[a-f0-9]{64}|SYNTHETIC-PRIVATE/);
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
  });
}

for (const product of [{ name: "Claude Code", slug: "claude-code", mark: "CC" }, { name: "Codex", slug: "codex", mark: "C" }]) {
  test(`failed ${product.name} image retains fallback`, async ({ page }) => {
    let attempted = false;
    await page.route(`**/product-assets/${product.slug}/2026-09-24/app-icon.png`, route => {
      attempted = true;
      return route.abort();
    });
    await page.goto(origin);
    const card = page.getByRole("article", { name: `${product.name} card`, exact: true });
    await expect.poll(() => attempted).toBe(true);
    await expect(card.locator(".product-logo img")).toHaveCount(0);
    await expect(card.locator(".product-logo")).toHaveText(product.mark);
    await card.getByRole("button", { name: "Details", exact: true }).click();
    await expect(card.locator(".card-back h2")).toBeFocused();
  });
}

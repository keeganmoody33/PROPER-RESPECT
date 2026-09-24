import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join, extname } from "node:path";
import { spawnSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";

let server: Server;
let origin: string;
let output: string;
const huge = "900719925474099312345678901234";

test.beforeAll(async () => {
  const scratch = mkdtempSync(join(tmpdir(), "usage-card-browser-"));
  output = join(scratch, "preview");
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
    "tests/fixtures/usage-cost/priced-synthetic.json", "tests/fixtures/usage-cost/codex-account-synthetic.json"], { encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
  const js = readFileSync(join(output, "preview.js"), "utf8");
  expect(js).not.toMatch(/PRIVATE_(OWNER|ACCOUNT|DEVICE|NAMESPACE)/);
  const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
  server = createServer((request, response) => {
    const path = resolve(output, `.${new URL(request.url ?? "/", "http://localhost").pathname === "/" ? "/index.html" : new URL(request.url ?? "/", "http://localhost").pathname}`);
    if (!path.startsWith(`${output}/`)) { response.writeHead(404).end(); return; }
    try { response.writeHead(200, { "Content-Type": types[extname(path)] ?? "application/octet-stream" }).end(readFileSync(path)); }
    catch { response.writeHead(404).end(); }
  });
  await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing local fixture address");
  origin = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => { if (server) await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done())); });

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
    await expect(claude).toContainText("Synthetic");
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
    await expect(back).toContainText("1 duplicate replay ignored");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`2026-09-24-private-usage-details-${width}-${theme}.png`), fullPage: true, animations: "disabled" });
    await back.getByRole("region", { name: "Coverage row 1", exact: true }).screenshot({ path: testInfo.outputPath(`2026-09-24-private-usage-exact-row-${width}-${theme}.png`), animations: "disabled" });
    await back.getByText(/Source observations \(/).click();
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
}

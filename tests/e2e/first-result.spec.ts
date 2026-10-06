import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { build } from "esbuild";
import { expect, test } from "@playwright/test";

let fixtureHtml: string;
test.beforeAll(async () => {
  const result = await build({
    stdin: { contents: `import {createElement} from "react"; import {createRoot} from "react-dom/client"; import {OnboardingClient} from "./components/onboarding-client"; createRoot(document.getElementById("root")).render(createElement(OnboardingClient));`, resolveDir: process.cwd() },
    bundle: true, write: false, outfile: "first-result-fixture.js", platform: "browser", format: "iife", jsx: "automatic",
    loader: { ".css": "local-css" }, define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "first-result-boundaries", setup(builder) {
      builder.onResolve({ filter: /^(@clerk\/nextjs|convex\/react)$/ }, args => ({ path: args.path, namespace: "first-result" }));
      builder.onLoad({ filter: /.*/, namespace: "first-result" }, args => ({
        resolveDir: args.path === "convex/react" ? `${process.cwd()}/tests/e2e/fixtures` : process.cwd(), loader: "js",
        contents: args.path === "@clerk/nextjs" ? `
          import {cloneElement} from "react";
          const user={id:"synthetic-owner",fullName:"Synthetic owner",imageUrl:"",externalAccounts:[{provider:"github"}]};
          export const Show=({children,fallback})=>localStorage.getItem("fixture-signed-in")?children:fallback;
          export const SignInButton=({children,forceRedirectUrl})=>cloneElement(children,{onClick:()=>{localStorage.setItem("fixture-signed-in","true");location.assign(forceRedirectUrl);}});
          export const UserButton=()=>null;
          export const useUser=()=>({user});
          export const useAuth=()=>({getToken:async()=>"synthetic-token",sessionClaims:{}});
          export const useClerk=()=>({openUserProfile:()=>{}});
        ` : readFileSync("tests/e2e/fixtures/fresh-user-backend.js", "utf8"),
      }));
    } }],
  });
  const javascript = result.outputFiles.find(file => file.path.endsWith(".js"))!.text;
  const styles = result.outputFiles.find(file => file.path.endsWith(".css"))?.text ?? "";
  fixtureHtml = `<meta name="viewport" content="width=device-width, initial-scale=1"><style>${readFileSync("app/globals.css", "utf8")}\n${styles}</style><div id="root"></div><script>${javascript.replaceAll("</script", "<\\/script")}</script>`;
  mkdirSync("/tmp/proper-first-result-fixture/app/collection", { recursive: true });
  writeFileSync("/tmp/proper-first-result-fixture/app/collection/index.html", fixtureHtml);
});

for (const width of [1280, 390]) test(`source choice survives sign-in without another hero at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 960 });
  await page.route("**/*", route => route.request().url().startsWith("http://127.0.0.1:8883/")
    ? route.fulfill({ contentType: "text/html", body: fixtureHtml }) : route.abort());
  await page.goto("http://127.0.0.1:8883/app/collection");
  await expect(page.getByRole("heading", { name: "Start with one source", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Claude Code", exact: true }).click();
  await page.getByRole("button", { name: "Continue with Claude Code", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/collection\?source=claude-code$/);
  await expect(page.getByRole("heading", { name: "Import Claude Code usage", exact: true })).toBeVisible();
  await expect(page.getByText("Your tools. Your track record.", { exact: true })).toHaveCount(0);
  await expect(page.locator("#collection-profile")).not.toHaveAttribute("open");
  await expect(page.getByRole("button", { name: "Preview sharing", exact: true })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`first-result-source-${width}.png`), fullPage: false });
});

const exact = "9007199254740993123456789";
const packet = JSON.stringify({
  format: "proper-measurements-v1", captureId: "fixture-first-result", capturedAt: "2026-10-06T10:00:00.000Z",
  source: { namespace: "fixture-tool", identityBasis: "OWNER_SUPPLIED", sourceAlias: "private-source-alias", ownerAlias: "private-owner-alias", accountAlias: "private-account-alias", workspaceAlias: null, deviceAlias: "private-device-alias" },
  measurements: [
    { id: "total", metric: "tokens", value: exact, unit: "tokens" },
    { id: "zero", metric: "sessions", value: "0", unit: "sessions" },
    { id: "unknown", metric: "duration", value: null, unit: "seconds" },
  ].map(row => ({ ...row, period: { kind: "date", start: "2026-10-01", end: "2026-10-05", timezone: null }, scope: "DEVICE", coverage: "PARTIAL", temporality: "SNAPSHOT", aggregation: "NON_ADDITIVE", overlapGroup: "private-overlap" })),
});

for (const width of [1280, 390]) test(`exact first result survives malformed upload, reimport, reload and sharing at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.addInitScript(() => localStorage.setItem("fixture-signed-in", "true"));
  await page.route("**/*", route => route.request().url().startsWith("http://127.0.0.1:8883/")
    ? route.fulfill({ contentType: "text/html", body: fixtureHtml }) : route.abort());
  await page.goto("http://127.0.0.1:8883/app/collection?source=metric-packet");
  const first = page.getByRole("region", { name: "Import another product’s measurements", exact: true });
  await first.getByLabel("Product name", { exact: true }).fill("Fixture Tool");
  const upload = first.getByLabel("Sanitized usage file", { exact: true });
  await upload.setInputFiles({ name: "malformed.json", mimeType: "application/json", buffer: Buffer.from("{broken") });
  await first.getByRole("button", { name: "Import privately", exact: true }).click();
  await expect(first.getByRole("alert")).toContainText("not valid JSON");
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("proper-respect-fresh-user-fixture")!));
  expect((await state()).cards).toHaveLength(0);
  await upload.setInputFiles({ name: "unsupported.json", mimeType: "application/json", buffer: Buffer.from('{"totalTokens":42,"prompt":"private-content"}') });
  await first.getByRole("button", { name: "Import privately", exact: true }).click();
  await expect(first.getByRole("alert")).toContainText("supported sanitized");
  expect((await state()).cards).toHaveLength(0);
  const rejectedCalls = await page.evaluate(() => JSON.parse(localStorage.getItem("proper-respect-fresh-user-fixture-calls")!));
  expect(rejectedCalls.filter((call: { name: string }) => call.name === "importMeasurements")).toHaveLength(0);
  await upload.setInputFiles({ name: "sanitized.json", mimeType: "application/json", buffer: Buffer.from(packet) });
  await first.getByRole("button", { name: "Import privately", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/collection#relationship=measurement-fixture-tool$/);
  const result = page.getByRole("region", { name: "Your private usage result", exact: true });
  await expect(result.getByText(exact, { exact: true })).toBeVisible();
  await expect(result.getByText("0", { exact: true })).toBeVisible();
  await expect(result.getByText("Unknown", { exact: true })).toBeVisible();
  await expect(result).toContainText("Scope: device · Coverage: partial");
  await expect(result).toContainText("2026-10-01 to 2026-10-05");
  await expect(page.locator("#collection-profile")).not.toHaveAttribute("open");
  await expect(page.getByRole("button", { name: "Preview sharing", exact: true })).toBeDisabled();
  await result.screenshot({ path: testInfo.outputPath(`first-result-exact-${width}.png`) });
  await page.reload();
  await expect(result.getByText(exact, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Another product", exact: true }).click();
  await expect(first.getByRole("heading", { name: "Import another product’s measurements", exact: true })).toBeFocused();
  await first.getByLabel("Product name", { exact: true }).fill("Fixture Tool");
  await upload.setInputFiles({ name: "sanitized-again.json", mimeType: "application/json", buffer: Buffer.from(packet) });
  await first.getByRole("button", { name: "Import privately", exact: true }).click();
  await expect(first).toHaveCount(0);
  expect((await state()).cards).toHaveLength(1);
  expect((await state()).measurementCaptures).toHaveLength(1);
  for (const box of await result.getByRole("checkbox").all()) await box.check();
  await result.getByRole("button", { name: "Save measurement choices privately", exact: true }).click();
  await expect.poll(async () => (await state()).measurementCaptures[0].reviewedMeasurementIds.length).toBe(3);
  const relationship = page.getByRole("region", { name: "Fixture Tool", exact: true });
  await relationship.getByRole("combobox", { name: "How it fits", exact: true }).selectOption("ACTIVE");
  await relationship.getByRole("button", { name: "Confirm and save privately", exact: true }).click();
  await page.getByRole("link", { name: "Set up your public identity", exact: true }).click();
  const identity = page.locator("#collection-profile");
  await identity.getByLabel("Handle", { exact: true }).fill("synthetic-owner");
  await identity.getByRole("button", { name: "Save public identity", exact: true }).click();
  const review = page.getByRole("group", { name: "Fixture Tool review", exact: true });
  await review.getByLabel("Share this saved card", { exact: true }).check();
  await review.getByRole("checkbox", { name: /Include 3 reviewed measurements from 2026-10-06/ }).check();
  await page.getByRole("button", { name: "Preview sharing", exact: true }).click();
  const preview = page.getByRole("region", { name: "Your visitor’s view", exact: true });
  await expect(preview.getByText(exact, { exact: true }).first()).toBeVisible();
  await preview.getByRole("button", { name: "Details", exact: true }).click();
  await expect(preview.getByText("Unknown", { exact: true })).toBeVisible();
  await expect(preview.getByText("0", { exact: true })).toBeVisible();
  for (const secret of ["private-account-alias", "private-source-alias", "private-owner-alias", "private-device-alias", "private-overlap"]) await expect(preview).not.toContainText(secret);
  await expect(preview.getByRole("button", { name: "Publish this preview", exact: true })).toBeDisabled();
  const calls = await page.evaluate(() => JSON.parse(localStorage.getItem("proper-respect-fresh-user-fixture-calls")!));
  expect(calls.filter((call: { name: string }) => call.name === "publishSelected")).toHaveLength(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await preview.screenshot({ path: testInfo.outputPath(`first-result-private-preview-${width}.png`) });
});

for (const source of ["claude-code", "codex"] as const) test(`native ${source} import opens its private result`, async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("fixture-signed-in", "true"));
  await page.route("**/*", route => route.request().url().startsWith("http://127.0.0.1:8883/")
    ? route.fulfill({ contentType: "text/html", body: fixtureHtml }) : route.abort());
  await page.goto(`http://127.0.0.1:8883/app/collection?source=${source}`);
  const native = source === "codex" ? readFileSync("tests/fixtures/codex-usage/account-snapshot.json", "utf8") : JSON.stringify({
    format: "claude-code-native-metrics-v1", sample: "synthetic", capturedAt: "2026-10-06T10:00:00.000Z", keyScopeDigest: "a".repeat(64),
    points: [{ streamDigest: "b".repeat(64), familyDigest: "c".repeat(64), metric: "input", model: null, sourceVersion: "2.1.214", temporality: "cumulative", startUnixNano: "1000000000000000001", endUnixNano: "1000000000000000002", quantity: exact }],
  });
  await page.getByLabel("Sanitized usage file", { exact: true }).setInputFiles({ name: "sanitized-native.json", mimeType: "application/json", buffer: Buffer.from(native) });
  await page.getByRole("button", { name: "Import privately", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`#relationship=measurement-${source}$`));
  const result = page.getByRole("region", { name: "Your private usage result", exact: true });
  await expect(result).toBeVisible();
  if (source === "claude-code") {
    await expect(result.getByText(exact, { exact: true })).toBeVisible();
    await expect(result).toContainText("Synthetic sample. Not real account activity.");
    await expect(result).toContainText("Baseline only");
  } else {
    await expect(result.getByText("0", { exact: true }).first()).toBeVisible();
    await expect(result.getByText("Unknown", { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Preview sharing", exact: true })).toBeDisabled();
});

test("GitHub response opens the returned relationship and its exact private count", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("fixture-signed-in", "true"));
  await page.route("**/*", async route => {
    if (route.request().url().endsWith("/api/connect/github")) {
      const result = await page.evaluate(() => (window as unknown as { fixtureGithubConnect: () => { connectorId: string; propId: string } }).fixtureGithubConnect());
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(result) });
    }
    return route.request().url().startsWith("http://127.0.0.1:8883/") ? route.fulfill({ contentType: "text/html", body: fixtureHtml }) : route.abort();
  });
  await page.goto("http://127.0.0.1:8883/app/collection?source=github");
  await page.getByRole("region", { name: "Connect GitHub activity", exact: true }).getByRole("button", { name: "Connect GitHub", exact: true }).click();
  await expect(page).toHaveURL(/#relationship=github-result$/);
  const result = page.getByRole("region", { name: "GitHub", exact: true });
  await expect(result.getByText("12345", { exact: true })).toBeVisible();
  await expect(result).toContainText("2026-01-01 to 2026-10-06");
  await expect(result.getByRole("button", { name: "Confirm and save privately", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview sharing", exact: true })).toBeDisabled();
});

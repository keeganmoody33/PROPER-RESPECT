import { readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { build } from "esbuild";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.use({ timezoneId: "America/Los_Angeles" });

let fixture: string;
test.beforeAll(async () => {
  const result = await build({
    stdin: { contents: `import {createElement} from "react"; import {createRoot} from "react-dom/client"; import {ConvexError} from "convex/values";
      import {UsageConnectionsPanel} from "./components/usage-connections-panel";
      window.snapshotCalls=[]; window.failNextSave=true;
      const scope={provider:"codex",sourceKey:"a".repeat(64),deviceDigest:"b".repeat(64),context:"personal",accountIdentity:"unverified",start:"2026-10-01T00:00:00.000Z",end:"2026-10-20T00:00:00.000Z",expiresAt:"2026-10-20T00:00:00.000Z",retainOnDisconnect:true,destination:"https://example.convex.cloud"};
      const grants=[{sourceId:"personal-source",grantId:"personal-grant",scope,state:"active",pairExpiresAt:0,sequence:1,ownerSubject:"synthetic-owner"},{sourceId:"work-source",grantId:"work-grant",scope:{...scope,sourceKey:"c".repeat(64),context:"work"},state:"revoked",pairExpiresAt:0,sequence:1,ownerSubject:"synthetic-owner"}];
      const totals={responses:[{metric:"total_tokens",value:"9007199254740993",conflict:false}],legacy:[{metric:"total_tokens",value:null,conflict:false}],earliestAt:"2026-10-01T12:00:00.000Z",latestAt:"2026-10-07T12:00:00.000Z"};
      createRoot(document.getElementById("root")).render(createElement(UsageConnectionsPanel,{
        grants,approve:async()=>{throw Error("Approval is outside this fixture")},disconnect:async()=>({retained:true}),erase:async()=>({done:true}),
        loadUsage:async sourceId=>{if(window.failNextLoad){window.failNextLoad=false;throw Error("Fixture failed load")} return totals},
        onSaveUsageSnapshot:async args=>{window.snapshotCalls.push(args);if(window.saveFailureCode){const code=window.saveFailureCode;window.saveFailureCode=null;throw new ConvexError({code,detail:"Private server detail must never be shown"})}if(window.failNextSave){window.failNextSave=false;throw Error("Fixture interrupted save")}return {propId:"saved-codex-prop",rawEvidenceId:"saved-evidence",digest:"d".repeat(64),replayed:true}},
      }));`, resolveDir: process.cwd() },
    bundle: true, write: false, outfile: "usage-snapshot-fixture.js", platform: "browser", format: "iife", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const script = result.outputFiles.find(file => file.path.endsWith(".js"))!.text;
  const css = result.outputFiles.find(file => file.path.endsWith(".css"))?.text ?? "";
  fixture = `<html lang="en"><head><title>Synthetic private usage</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>${readFileSync("app/globals.css", "utf8")}\n${css}</style></head><body><main id="root"></main><script>${script.replaceAll("</script", "<\\/script")}</script></body></html>`;
});

test("private snapshot browser journey uses the real Convex backend", async ({}, testInfo) => {
  test.setTimeout(120_000);
  const result = await promisify(execFile)(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "tests/support/usage-snapshot-browser.test.ts", "--maxWorkers=1"], {
    env: { ...process.env, PROPER_RESPECT_SNAPSHOT_BROWSER: "1" },
    timeout: 110_000,
  });
  await testInfo.attach("real-backend-browser-check", { body: `${result.stdout}\n${result.stderr}`, contentType: "text/plain" });
});

for (const width of [1280, 390]) test(`explicit private snapshot uses a bounded UTC window and the loaded source at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 960 });
  await page.route("**/*", route => route.request().url().startsWith("http://127.0.0.1:8884/")
    ? route.fulfill({ contentType: "text/html", body: fixture }) : route.abort());
  await page.goto("http://127.0.0.1:8884/connections");
  const calls = () => page.evaluate(() => (window as unknown as { snapshotCalls: unknown[] }).snapshotCalls);
  await expect(page.getByRole("button", { name: "Save private snapshot", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "View private usage", exact: true }).first().click();
  const snapshot = page.getByRole("region", { name: "Save a private usage snapshot", exact: true });
  await expect(snapshot).toBeVisible();
  await expect(snapshot).toContainText("seven UTC days");
  await expect(snapshot).toContainText("Published cards require a separate unpublish");
  expect(await calls()).toEqual([]);
  const start = snapshot.getByLabel("Snapshot starts, UTC", { exact: true });
  const end = snapshot.getByLabel("Snapshot ends, UTC (inclusive)", { exact: true });
  await start.fill("2026-10-01");
  await end.fill("2026-09-30");
  await snapshot.getByRole("button", { name: "Save private snapshot", exact: true }).click();
  await expect(snapshot.getByRole("alert")).toContainText("seven UTC days");
  expect(await calls()).toEqual([]);
  await end.fill("2026-10-08");
  await snapshot.getByRole("button", { name: "Save private snapshot", exact: true }).click();
  await expect(snapshot.getByRole("alert")).toContainText("seven UTC days");
  expect(await calls()).toEqual([]);
  await end.fill("2026-10-07");
  expect(await calls()).toEqual([]);
  await snapshot.getByRole("button", { name: "Save private snapshot", exact: true }).click();
  await expect(snapshot.getByRole("alert")).toContainText("could not be confirmed");
  await expect(snapshot.getByRole("link", { name: "Configure saved private card", exact: true })).toHaveCount(0);
  await snapshot.getByRole("button", { name: "Save private snapshot", exact: true }).click();
  const expected = { sourceId: "personal-source", start: "2026-10-01T00:00:00.000Z", end: "2026-10-08T00:00:00.000Z" };
  expect(await calls()).toEqual([expected, expected]);
  await expect(snapshot.getByRole("status")).toContainText("already saved privately");
  await expect(snapshot.getByRole("link", { name: "Configure saved private card", exact: true })).toHaveAttribute("href", "/app/collection#relationship=saved-codex-prop");
  await expect(snapshot).toContainText("Nothing is reviewed or published");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await snapshot.screenshot({ path: testInfo.outputPath(`private-snapshot-${width}.png`) });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  for (const [code, message] of [
    ["NO_MODERN_RESPONSES", "No modern response history was found in these dates. Choose another window."],
    ["HISTORY_SCAN_LIMIT", "This source exceeds the supported snapshot scan limit. Existing snapshots remain available."],
    ["UNEXPECTED_PRIVATE_FAILURE", "The private snapshot could not be confirmed. Retry this window; an existing snapshot will be reused."],
  ]) {
    await page.evaluate(value => { (window as unknown as { saveFailureCode: string }).saveFailureCode = value; }, code);
    await snapshot.getByRole("button", { name: "Save private snapshot", exact: true }).click();
    await expect(snapshot.getByRole("alert")).toHaveText(message);
    await expect(snapshot).not.toContainText("Private server detail");
    await expect(snapshot.getByRole("link", { name: "Configure saved private card", exact: true })).toHaveCount(0);
  }

  await page.getByRole("button", { name: "View private usage", exact: true }).nth(1).click();
  await expect(start).toHaveValue("");
  await expect(end).toHaveValue("");
  await expect(snapshot.getByRole("link", { name: "Configure saved private card", exact: true })).toHaveCount(0);
  await start.fill("2026-10-03");
  await end.fill("2026-10-03");
  await snapshot.getByRole("button", { name: "Save private snapshot", exact: true }).click();
  expect((await calls()).at(-1)).toEqual({ sourceId: "work-source", start: "2026-10-03T00:00:00.000Z", end: "2026-10-04T00:00:00.000Z" });
  await page.getByRole("button", { name: "Erase imported history", exact: true }).click();
  await expect(snapshot).toHaveCount(0);
  await page.evaluate(() => { (window as unknown as { failNextLoad: boolean }).failNextLoad = true; });
  await page.getByRole("button", { name: "View private usage", exact: true }).first().click();
  await expect(page.getByRole("status")).toContainText("could not be loaded");
  await expect(snapshot).toHaveCount(0);
});

import { buildSync } from "esbuild";
import { expect, test } from "@playwright/test";

type ContractHarness = {
  records: () => { aborted: boolean }[];
  replace: (handle: string) => void;
  unmount: () => void;
  completePending: () => void;
  invoke: (index: number, input: unknown) => Promise<unknown>;
};
declare global {
  interface Window { profileContract: ContractHarness }
}

function script(mode: "pending" | "rejected" | "unsupported") {
  return buildSync({
    stdin: { contents: `
      import { createElement, StrictMode, useState } from "react";
      import { createRoot } from "react-dom/client";
      import { PublicProfileWebMcp } from "./components/public-profile-webmcp";
      import { projectVisiblePublicProfile } from "./src/domain/visible-public-profile";
      const records = [], pending = [];
      const context = { registerTool(tool, {signal}) {
        records.push({tool, signal});
        return ${mode === "rejected" ? 'Promise.reject(new Error("Policy denied"))' : 'new Promise(resolve => pending.push(resolve))'};
      }};
      Object.defineProperty(document, "modelContext", { configurable: true, value: ${mode === "unsupported" ? "undefined" : "context"} });
      Object.defineProperty(navigator, "modelContext", { configurable: true, value: context });
      let replace;
      function Harness() {
        const [handle, setHandle] = useState("first"); replace = setHandle;
        const profile = projectVisiblePublicProfile({ handle, displayName: handle, bio: "", cards: [] });
        return createElement("main", null,
          createElement("h1", null, handle),
          createElement(PublicProfileWebMcp, { profile }));
      }
      const root = createRoot(document.getElementById("root"));
      window.profileContract = {
        records: () => records.map(item => ({ aborted: item.signal.aborted })),
        replace: handle => replace(handle), unmount: () => root.unmount(),
        completePending: () => pending.splice(0).forEach(resolve => resolve()),
        invoke: (index, input) => records[index].tool.execute(input, {signal: new AbortController().signal}),
      };
      root.render(createElement(StrictMode, null, createElement(Harness)));
    `, resolveDir: process.cwd() },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"' },
  }).outputFiles[0].text;
}

test.describe("WebMCP lifecycle with a contract double (not native browser proof)", () => {
  test("StrictMode, pending registration, replacement and unmount revoke retained callbacks", async ({ page }) => {
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({ content: script("pending") });
    await expect(page.getByRole("heading", { name: "first" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.profileContract.records())).toEqual([{ aborted: true }, { aborted: false }]);
    const first = await page.evaluate(() => window.profileContract.invoke(1, {}));
    expect(first).toMatchObject({ handle: "first", cards: [] });
    await page.evaluate(() => window.profileContract.replace("second"));
    await expect(page.getByRole("heading", { name: "second" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.profileContract.records())).toEqual([{ aborted: true }, { aborted: true }, { aborted: false }]);
    await page.evaluate(() => window.profileContract.completePending());
    expect(await page.evaluate(() => window.profileContract.invoke(2, {}))).toMatchObject({ handle: "second" });
    expect(await page.evaluate(() => window.profileContract.invoke(1, {}).then(() => "unexpected success", error => error.name))).toBe("AbortError");
    expect(await page.evaluate(() => window.profileContract.invoke(2, { handle: "private" }))).toHaveProperty("error");
    await page.evaluate(() => window.profileContract.unmount());
    expect(await page.evaluate(() => window.profileContract.invoke(2, {}).then(() => "unexpected success", error => error.name))).toBe("AbortError");
  });

  for (const mode of ["rejected", "unsupported"] as const) test(`${mode} API preserves the human page`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({ content: script(mode) });
    await expect(page.getByRole("heading", { name: "first" })).toBeVisible();
    await page.evaluate(() => window.profileContract.replace("second"));
    await expect(page.getByRole("heading", { name: "second" })).toBeVisible();
    if (mode === "unsupported") expect(await page.evaluate(() => window.profileContract.records())).toEqual([]);
    else await expect.poll(() => page.evaluate(() => window.profileContract.records().every(record => record.aborted))).toBe(true);
    expect(errors).toEqual([]);
  });
});

function guideScript(mode: "pending" | "rejected" | "unsupported") {
  return buildSync({
    stdin: { contents: `
      import { createElement, StrictMode, useState } from "react";
      import { createRoot } from "react-dom/client";
      import { PublicSiteGuideWebMcp } from "./components/public-site-guide-webmcp";
      const records = [], pending = [];
      const context = { registerTool(tool, { signal }) {
        records.push({ tool, signal });
        return ${mode === "rejected" ? 'Promise.reject(new Error("Policy denied"))' : 'new Promise(resolve => pending.push(resolve))'};
      }};
      Object.defineProperty(document, "modelContext", { configurable: true, value: ${mode === "unsupported" ? "undefined" : "context"} });
      Object.defineProperty(navigator, "modelContext", { configurable: true, value: context });
      let replace;
      function Harness() {
        const [name, setName] = useState("first"); replace = setName;
        return createElement("main", null, createElement("h1", null, name),
          createElement(PublicSiteGuideWebMcp, { guide: { name, documentation: {}, limits: [] } }));
      }
      const root = createRoot(document.getElementById("root"));
      window.profileContract = {
        records: () => records.map(item => ({ aborted: item.signal.aborted })),
        replace: name => replace(name), unmount: () => root.unmount(),
        completePending: () => pending.splice(0).forEach(resolve => resolve()),
        invoke: (index, input) => records[index].tool.execute(input),
      };
      root.render(createElement(StrictMode, null, createElement(Harness)));
    `, resolveDir: process.cwd() },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"' },
  }).outputFiles[0].text;
}

test("site guide StrictMode cleanup revokes old snapshots during pending registration", async ({ page }) => {
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ content: guideScript("pending") });
  await expect.poll(() => page.evaluate(() => window.profileContract.records())).toEqual([{ aborted: true }, { aborted: false }]);
  expect(await page.evaluate(() => window.profileContract.invoke(1, {}))).toMatchObject({ name: "first" });
  await page.evaluate(() => window.profileContract.replace("second"));
  await expect(page.getByRole("heading", { name: "second" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.profileContract.records())).toEqual([{ aborted: true }, { aborted: true }, { aborted: false }]);
  await page.evaluate(() => window.profileContract.completePending());
  expect(await page.evaluate(() => window.profileContract.invoke(1, {}).then(() => "unexpected", error => error.name))).toBe("AbortError");
  expect(await page.evaluate(() => window.profileContract.invoke(2, {}))).toMatchObject({ name: "second" });
  await page.evaluate(() => window.profileContract.unmount());
  expect(await page.evaluate(() => window.profileContract.invoke(2, {}).then(() => "unexpected", error => error.name))).toBe("AbortError");
});

for (const mode of ["rejected", "unsupported"] as const) test(`site guide ${mode} registration preserves human UI`, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ content: guideScript(mode) });
  await expect(page.getByRole("heading", { name: "first" })).toBeVisible();
  if (mode === "unsupported") expect(await page.evaluate(() => window.profileContract.records())).toEqual([]);
  else await expect.poll(() => page.evaluate(() => window.profileContract.records().every(record => record.aborted))).toBe(true);
  expect(errors).toEqual([]);
});

test("homepage remains usable when document.modelContext is unsupported", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(document, "modelContext", { configurable: true, value: undefined }));
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Your tools.");
  await page.getByRole("link", { name: "View Keegan’s shared collection" }).click();
  await expect(page).toHaveURL(/\/keegan$/);
  await expect(page.getByRole("heading", { level: 1, name: "Keegan Moody" })).toBeVisible();
  expect(errors).toEqual([]);
});

import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { expect, test } from "@playwright/test";

let script: string;
test.beforeAll(async () => {
  const result = await build({
    stdin: { contents: `import {createElement} from "react"; import {createRoot} from "react-dom/client"; import {OnboardingClient} from "./components/onboarding-client";
      createRoot(document.getElementById("root")).render(createElement(OnboardingClient));`, resolveDir: process.cwd() },
    bundle: true, write: false, outfile: "account-fixture.js", platform: "browser", format: "iife", jsx: "automatic",
    loader: { ".css": "empty" }, define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "synthetic-account", setup(builder) {
      builder.onResolve({ filter: /^(@clerk\/nextjs|convex\/react)$/ }, args => ({ path: args.path, namespace: "account-fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "account-fixture" }, args => ({
        resolveDir: process.cwd(), loader: "js",
        contents: args.path === "@clerk/nextjs" ? `
          const user={id:"synthetic-owner",fullName:"Synthetic owner",imageUrl:""};
          export const Show=({children})=>children;
          export const SignInButton=({children})=>children;
          export const UserButton=()=>null;
          export const useUser=()=>({user});
          export const useAuth=()=>({getToken:async()=>null,sessionClaims:{}});
          export const useClerk=()=>({openUserProfile:()=>{}});
        ` : `
          import {useSyncExternalStore} from "react";
          import {getFunctionName} from "convex/server";
          let state=null; const listeners=new Set();
          const subscribe=listener=>{listeners.add(listener);return()=>listeners.delete(listener)};
          const snapshot=()=>state;
          window.setupAttempts=0;
          const ensure=async()=>{
            window.setupAttempts++;
            if(window.setupAttempts===1) throw new Error("PRIVATE_BACKEND_DIAGNOSTIC");
            await new Promise(resolve=>{window.finishSetup=resolve});
            state={user:{_id:"synthetic-owner",handle:"pending-owner",displayName:"Synthetic owner",bio:""},cards:[],connectors:[],drafts:[],evidence:[],privateInventoryAvailable:false};
            listeners.forEach(listener=>listener());
            return "synthetic-owner";
          };
          const client={query:async()=>null,mutation:async()=>null};
          export const useConvex=()=>client;
          export const useConvexAuth=()=>({isAuthenticated:true,isLoading:false});
          export const useQuery=(ref)=>{const current=useSyncExternalStore(subscribe,snapshot,snapshot);return getFunctionName(ref)==="onboarding:getState"?current:undefined};
          export const useMutation=(ref)=>getFunctionName(ref)==="onboarding:ensureAccount"?ensure:async()=>null;
          export const useAction=()=>async()=>null;
          export const usePaginatedQuery=()=>({results:[],status:"Exhausted",loadMore:()=>{}});
        `,
      }));
    } }],
  });
  script = result.outputFiles[0].text;
});

for (const width of [1280, 390]) test(`new account setup failure is recoverable without publishing at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await page.route("**/*", route => route.abort());
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setContent('<div id="root"></div>');
  await page.addStyleTag({ content: readFileSync("app/globals.css", "utf8") });
  await page.addScriptTag({ content: script });
  await expect(page.getByRole("alert")).toContainText("could not prepare your private collection");
  await expect(page.getByText("PRIVATE_BACKEND_DIAGNOSTIC")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath(`2026-09-20-account-retry-${width}.png`), fullPage: true });
  const retry = page.getByRole("button", { name: "Retry account setup" });
  await retry.click();
  await expect(retry).toBeDisabled();
  await page.evaluate(() => (window as unknown as { finishSetup: () => void }).finishSetup());
  await expect(page.getByRole("heading", { name: "Add a product", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish this preview" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

let journeyScript: string;
test.beforeAll(async () => {
  const result = await build({
    stdin: { contents: `import {createElement} from "react"; import {createRoot} from "react-dom/client"; import {OnboardingClient} from "./components/onboarding-client";
      createRoot(document.getElementById("root")).render(createElement(OnboardingClient));`, resolveDir: process.cwd() },
    bundle: true, write: false, outfile: "fresh-user-fixture.js", platform: "browser", format: "iife", jsx: "automatic",
    loader: { ".css": "local-css" }, define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "fresh-user-boundary", setup(builder) {
      builder.onResolve({ filter: /^(@clerk\/nextjs|convex\/react)$/ }, args => ({ path: args.path, namespace: "fresh-user" }));
      builder.onLoad({ filter: /.*/, namespace: "fresh-user" }, args => ({
        resolveDir: args.path === "convex/react" ? `${process.cwd()}/tests/e2e/fixtures` : process.cwd(), loader: "js",
        contents: args.path === "@clerk/nextjs" ? `
          const user={id:"synthetic-owner",fullName:"Synthetic owner",imageUrl:""};
          export const Show=({children})=>children;
          export const SignInButton=({children})=>children;
          export const UserButton=()=>null;
          export const useUser=()=>({user});
          export const useAuth=()=>({getToken:async()=>null,sessionClaims:{}});
          export const useClerk=()=>({openUserProfile:()=>{}});
        ` : readFileSync("tests/e2e/fixtures/fresh-user-backend.js", "utf8"),
      }));
    } }],
  });
  const javascript = result.outputFiles.find(file => file.path.endsWith(".js"))!.text;
  const styles = result.outputFiles.find(file => file.path.endsWith(".css"))?.text ?? "";
  journeyScript = `<style>${readFileSync("app/globals.css", "utf8")}\n${styles}</style><main id="root"></main><script>${javascript.replaceAll("</script", "<\\/script")}</script>`;
});

for (const width of [1280, 390]) test(`first private manual card reaches exact preview without publishing at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => route.request().url().startsWith("http://127.0.0.1:8882/fresh-user-fixture")
    ? route.fulfill({ contentType: "text/html", body: journeyScript }) : route.abort());
  await page.goto("http://127.0.0.1:8882/fresh-user-fixture");
  await expect(page.getByRole("heading", { name: "Start with one tool" })).toBeVisible();
  await expect(page.locator("#collection-profile")).not.toHaveAttribute("open");
  await page.screenshot({ path: testInfo.outputPath(`fresh-user-empty-${width}.png`), fullPage: false });
  await page.getByRole("link", { name: "Add your first tool", exact: true }).click();
  const add = page.locator("#add-product");
  await add.getByLabel("Product name", { exact: true }).fill("Field Notes");
  await add.getByLabel("Website (optional)", { exact: true }).fill("https://field-notes.example");
  await add.getByLabel("What you want to remember (optional)").fill("I tried it for research notes.");
  await add.getByRole("button", { name: "Add for private review" }).click();
  await expect(page.getByRole("link", { name: "Review your collection" })).toBeVisible();
  await page.getByRole("link", { name: "Review your collection" }).click();
  const inventory = page.getByRole("region", { name: "Field Notes in your collection" });
  await inventory.getByText("Review this discovery", { exact: true }).click();
  await inventory.getByRole("combobox", { name: "How it fits", exact: true }).selectOption("ACTIVE");
  await inventory.getByLabel("What it helps you do (optional)").fill("My research log");
  await expect(inventory.getByLabel("Explanation or workflow (optional)")).toHaveValue("I tried it for research notes.");
  await inventory.getByLabel("Explanation or workflow (optional)").fill("I keep interview notes here.");
  await inventory.getByRole("button", { name: "Confirm and save privately" }).click();
  await expect(inventory.getByText("My research log", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview sharing", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Publish this preview" })).toHaveCount(0);
  const beforeReload = await page.evaluate(() => localStorage.getItem("proper-respect-fresh-user-fixture"));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Start with one tool" })).toHaveCount(0);
  await expect(inventory.getByText("My research log", { exact: true })).toBeVisible();
  await expect(page.locator("#collection-profile")).not.toHaveAttribute("open");
  expect(await page.evaluate(() => localStorage.getItem("proper-respect-fresh-user-fixture"))).toBe(beforeReload);
  await page.getByRole("link", { name: "Set up your public identity", exact: true }).click();
  const identity = page.locator("#collection-profile");
  await identity.getByLabel("Handle", { exact: true }).fill("synthetic-owner");
  await identity.getByRole("button", { name: "Save public identity" }).click();
  await expect(page.getByRole("button", { name: "Preview sharing", exact: true })).toBeEnabled();
  await page.getByRole("group", { name: "Field Notes review" }).getByLabel("Share this saved card").check();
  await page.getByRole("button", { name: "Preview sharing", exact: true }).click();
  const preview = page.getByRole("region", { name: "Your visitor’s view" });
  await expect(preview).toBeVisible();
  await expect(preview.locator("article.product-card")).toHaveCount(1);
  await expect(preview.getByText("My research log", { exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "Details", exact: true }).click();
  await expect(preview.getByText("I keep interview notes here.", { exact: true })).toBeVisible();
  await expect(preview).toContainText("Synthetic owner");
  await expect(preview).not.toContainText("pending-owner");
  await expect(preview.getByRole("button", { name: "Publish this preview" })).toBeDisabled();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("proper-respect-fresh-user-fixture")!));
  const calls = await page.evaluate(() => JSON.parse(localStorage.getItem("proper-respect-fresh-user-fixture-calls")!));
  expect(saved.cards[0].prop).toMatchObject({ visibility: "PRIVATE", headline: "My research log", note: "I keep interview notes here.", status: "ACTIVE" });
  expect(saved.cards[0].prop.activity).toBeUndefined();
  expect(saved.user.profileLinks).toEqual([]);
  expect(calls.filter((call: { name: string }) => call.name === "publishSelected")).toEqual([]);
  expect(calls.filter((call: { name: string }) => call.name === "previewPublication")).toHaveLength(1);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await preview.screenshot({ path: testInfo.outputPath(`fresh-user-preview-${width}.png`), animations: "disabled" });
});

for (const identityState of ["claimed", "unclaimed-after-upload", "unknown"] as const) test(`public identity is explicit for ${identityState}`, async ({ page }) => {
  await page.route("**/*", route => route.request().url().startsWith("http://127.0.0.1:8882/fresh-user-fixture")
    ? route.fulfill({ contentType: "text/html", body: journeyScript }) : route.abort());
  await page.goto("http://127.0.0.1:8882/fresh-user-fixture");
  await expect(page.getByRole("heading", { name: "Start with one tool" })).toBeVisible();
  await page.evaluate(value => {
    const key = "proper-respect-fresh-user-fixture";
    const state = JSON.parse(localStorage.getItem(key)!);
    state.user.handle = "pending-victim123";
    state.user.onboardingStatus = value === "claimed" ? "IMPORT" : "REVIEW";
    if (value === "unknown") delete state.hasClaimedPublicIdentity;
    else state.hasClaimedPublicIdentity = value === "claimed";
    localStorage.setItem(key, JSON.stringify(state));
  }, identityState);
  await page.reload();
  const identity = page.locator("#collection-profile");
  await expect(identity).not.toHaveAttribute("open");
  await identity.locator("summary").click();
  const preview = page.getByRole("button", { name: "Preview sharing", exact: true });
  if (identityState === "claimed") {
    await expect(identity.getByLabel("Handle", { exact: true })).toHaveValue("pending-victim123");
    await expect(preview).toBeEnabled();
    await expect(page.getByRole("link", { name: "Set up your public identity" })).toHaveCount(0);
    await expect(page.getByText("Nothing is published at /pending-victim123 yet.", { exact: true })).toBeVisible();
    await preview.click();
    await expect(page.getByRole("region", { name: "Your visitor’s view" })).toContainText("@pending-victim123");
  } else {
    await expect(preview).toBeDisabled();
    if (identityState === "unclaimed-after-upload") {
      await expect(identity.getByLabel("Handle", { exact: true })).toHaveValue("");
      await expect(page.getByRole("link", { name: "Set up your public identity" })).toBeVisible();
      await expect(page.getByText("Nothing is published yet.", { exact: true })).toBeVisible();
    } else {
      await expect(identity.getByLabel("Handle", { exact: true })).toHaveValue("pending-victim123");
      await expect(page.getByText("Public identity status is unavailable. Reload before previewing sharing.", { exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Set up your public identity" })).toHaveCount(0);
    }
  }
  const calls = await page.evaluate(() => JSON.parse(localStorage.getItem("proper-respect-fresh-user-fixture-calls")!));
  expect(calls.filter((call: { name: string }) => call.name === "publishSelected")).toEqual([]);
});

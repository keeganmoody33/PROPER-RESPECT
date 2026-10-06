import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { expect, test } from "@playwright/test";

let script: string;
test.beforeAll(async () => {
  const result = await build({
    stdin: { contents: `import {createElement} from "react"; import {createRoot} from "react-dom/client"; import {OnboardingClient} from "./components/onboarding-client";
      createRoot(document.getElementById("root")).render(createElement(OnboardingClient, {publicOrigin:"https://public.example"}));`, resolveDir: process.cwd() },
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
  await expect(page.getByRole("heading", { name: "Add a tool", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish this preview" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

let journeyScript: string;
test.beforeAll(async () => {
  const result = await build({
    stdin: { contents: `import {createElement} from "react"; import {createRoot} from "react-dom/client"; import {OnboardingClient} from "./components/onboarding-client";
      createRoot(document.getElementById("root")).render(createElement(OnboardingClient, {publicOrigin:"https://public.example"}));`, resolveDir: process.cwd() },
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

for (const width of [1280, 390]) for (const [choice, status] of [
  ["ACTIVE", "ACTIVE"], ["TESTING", "TESTING"], ["ARCHIVED", "ARCHIVED"], ["LATER", undefined],
] as const) test(`named tool saves ${choice} with no optional details at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await page.route("**/*", route => route.request().url().startsWith("http://127.0.0.1:8882/fresh-user-fixture")
    ? route.fulfill({ contentType: "text/html", body: journeyScript }) : route.abort());
  await page.goto("http://127.0.0.1:8882/fresh-user-fixture");
  const add = page.locator("#add-product");
  await add.getByLabel("Product name", { exact: true }).fill("Field Notes");
  await expect(add.getByLabel("How do you use it?", { exact: true })).toHaveValue("");
  await add.getByRole("button", { name: "Save tool privately" }).click();
  await expect(page.getByRole("heading", { name: "Start with one tool" })).toBeVisible();
  await add.getByLabel("How do you use it?", { exact: true }).selectOption(choice);
  await add.getByRole("button", { name: "Save tool privately" }).click();
  await expect(page.getByRole("link", { name: "Review your collection" })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("proper-respect-fresh-user-fixture")!));
  expect(saved.cards[0].prop).toMatchObject({ status: status ?? "TESTING", visibility: status ? "PRIVATE" : "DRAFT", note: "" });
  expect(saved.history).toHaveLength(status ? 1 : 0);
  if (status) expect(saved.cards[0].prop).toMatchObject({ relationshipVersion: 1, confirmedAt: expect.any(String) });
  else expect(saved.cards[0].prop).not.toHaveProperty("confirmedAt");
  if (status) {
    await expect(page).not.toHaveURL(/#relationship=/);
    await expect(page.getByRole("link", { name: /Field Notes/ })).toBeVisible();
  }
  const calls = await page.evaluate(() => JSON.parse(localStorage.getItem("proper-respect-fresh-user-fixture-calls")!));
  const added = calls.filter((call: { name: string }) => call.name === "addManualProduct");
  expect(added).toHaveLength(1);
  expect(added[0].args).not.toHaveProperty("website");
  expect(added[0].args).not.toHaveProperty("description");
  if (status) expect(added[0].args.status).toBe(status);
  else expect(added[0].args).not.toHaveProperty("status");
  expect(calls.filter((call: { name: string }) => ["savePrivately", "publishSelected"].includes(call.name))).toHaveLength(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (choice === "TESTING") await page.screenshot({ path: testInfo.outputPath(`2026-10-06-one-step-tool-${width}.png`), fullPage: true });
});

for (const width of [1280, 390]) for (const denied of [false, true]) test(`published profile link ${denied ? "manual fallback" : "copies canonical URL"} at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(({ denied }) => {
    localStorage.setItem("proper-respect-fresh-user-fixture", JSON.stringify({
      user: { _id: "synthetic-owner", handle: "synthetic-owner", displayName: "Synthetic owner", bio: "" },
      cards: [], connectors: [], drafts: [], evidence: [], privateInventoryAvailable: true,
      hasPublicationAtCurrentHandle: true, hasClaimedPublicIdentity: true,
    }));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (url: string) => {
      if (denied) throw new Error("Synthetic permission denied");
      (window as unknown as { copiedProfileLink: string }).copiedProfileLink = url;
    } } });
  }, { denied });
  await page.route("**/*", route => route.request().url().startsWith("http://127.0.0.1:8882/fresh-user-fixture")
    ? route.fulfill({ contentType: "text/html", body: journeyScript }) : route.abort());
  await page.goto("http://127.0.0.1:8882/fresh-user-fixture");
  await page.getByRole("button", { name: "Copy profile link", exact: true }).click();
  if (denied) {
    await expect(page.getByText("Clipboard access is unavailable. Select and copy your link below.", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Profile link", { exact: true })).toHaveValue("https://public.example/synthetic-owner");
  } else {
    await expect(page.getByText("Profile link copied.", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { copiedProfileLink: string }).copiedProfileLink)).toBe("https://public.example/synthetic-owner");
  }
  const calls = await page.evaluate(() => JSON.parse(localStorage.getItem("proper-respect-fresh-user-fixture-calls")!));
  expect(calls.filter((call: { name: string }) => call.name === "publishSelected")).toHaveLength(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`2026-10-06-copy-profile-${denied ? "fallback" : "copied"}-${width}.png`), fullPage: true });
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
  await expect(add.getByLabel("How do you use it?", { exact: true })).toHaveValue("");
  await add.getByLabel("How do you use it?", { exact: true }).selectOption("ACTIVE");
  await add.getByText("Website or a note (optional)", { exact: true }).click();
  await add.getByLabel("Website (optional)", { exact: true }).fill("https://field-notes.example");
  await add.getByLabel("What you want to remember (optional)").fill("I tried it for research notes.");
  await add.getByRole("button", { name: "Save tool privately" }).click();
  await expect(page.getByRole("link", { name: "Review your collection" })).toBeVisible();
  await expect(page).not.toHaveURL(/#relationship=/);
  await page.getByRole("link", { name: /Field Notes/ }).click();
  await expect(page).toHaveURL(/#relationship=manual-prop$/);
  const inventory = page.getByRole("region", { name: "Field Notes", exact: true });
  await inventory.getByRole("combobox", { name: "How it fits", exact: true }).selectOption("ACTIVE");
  await inventory.getByLabel("What it helps you do (optional)").fill("My research log");
  await expect(inventory.getByLabel("Explanation or workflow (optional)")).toHaveValue("I tried it for research notes.");
  await inventory.getByLabel("Explanation or workflow (optional)").fill("I keep interview notes here.");
  await inventory.getByRole("button", { name: "Save privately", exact: true }).click();
  await expect(inventory.getByLabel("What it helps you do (optional)")).toHaveValue("My research log");
  await expect(page.getByRole("button", { name: "Preview sharing", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Publish this preview" })).toHaveCount(0);
  const beforeReload = await page.evaluate(() => localStorage.getItem("proper-respect-fresh-user-fixture"));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Start with one tool" })).toHaveCount(0);
  await expect(inventory.getByLabel("What it helps you do (optional)")).toHaveValue("My research log");
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

// R15: unpublish every card through the approved preview, and download the owner's data.
for (const width of [1280, 390]) test(`unpublish all and download my data at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => route.request().url().startsWith("http://127.0.0.1:8882/fresh-user-fixture")
    ? route.fulfill({ contentType: "text/html", body: journeyScript }) : route.abort());
  await page.goto("http://127.0.0.1:8882/fresh-user-fixture");
  await expect(page.getByRole("heading", { name: "Start with one tool" })).toBeVisible();
  await page.evaluate(() => {
    const key = "proper-respect-fresh-user-fixture";
    const state = JSON.parse(localStorage.getItem(key)!);
    const card = (id: string, name: string, slug: string) => ({
      product: { _id: `${id}-product`, _creationTime: 1, name, slug, domain: `${slug}.example`, description: "Synthetic" },
      prop: { _id: id, _creationTime: 1, userId: state.user._id, productId: `${id}-product`, status: "ACTIVE", visibility: "PUBLIC", headline: `Why ${name}`, note: "", relationshipVersion: 1, confirmedAt: "2026-09-22T12:00:00Z" },
      links: [{ type: "CANONICAL", url: `https://${slug}.example`, label: `Open ${name}`, isPrimary: true }],
      claims: [], previousStatuses: [], isPublishedAtCurrentHandle: true,
    });
    state.user.handle = "synthetic-owner";
    state.user.bio = "Synthetic public bio";
    state.hasClaimedPublicIdentity = true;
    state.hasPublicationAtCurrentHandle = true;
    state.cards = [card("prop-one", "Field Notes", "field-notes"), card("prop-two", "Sketchpad", "sketchpad")];
    localStorage.setItem(key, JSON.stringify(state));
    localStorage.removeItem(`${key}-calls`);
  });
  await page.reload();

  // Approving an ordinary preview must not carry over to the remove-all preview.
  await page.getByRole("button", { name: "Preview sharing", exact: true }).click();
  const firstPreview = page.getByRole("region", { name: "Your visitor’s view" });
  await firstPreview.getByRole("checkbox").check();
  await expect(firstPreview.getByRole("button", { name: "Publish this preview" })).toBeEnabled();

  const removeAll = page.getByRole("region", { name: "Remove every card" });
  await expect(removeAll).toContainText("Your handle, display name, bio and profile links stay public.");
  await expect(removeAll.getByRole("link", { name: "ask through the contact page" })).toHaveAttribute("href", "/about/contact");
  await removeAll.getByRole("button", { name: "Unpublish all cards", exact: true }).click();
  const preview = page.getByRole("region", { name: "Your visitor’s view" });
  await expect(preview).toContainText("No products will be public.");
  await expect(preview).toContainText("@synthetic-owner");
  await expect(preview).toContainText("Synthetic public bio");
  await expect(preview.getByRole("checkbox")).not.toBeChecked();
  await expect(preview.getByRole("button", { name: "Publish this preview" })).toBeDisabled();
  await preview.getByRole("checkbox").check();
  await preview.getByRole("button", { name: "Publish this preview" }).click();
  await expect(page.getByText("Your approved preview is now shared.", { exact: false })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download my data", exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^proper-respect-synthetic-owner-\d{4}-\d{2}-\d{2}\.json$/);
  const exported = JSON.parse(readFileSync(await download.path(), "utf8"));
  expect(exported).toMatchObject({ format: "proper-respect-export", version: 1, profile: { handle: "synthetic-owner" }, evidence: [] });
  expect(exported.relationships.map((row: { id: string }) => row.id)).toEqual(["prop-one", "prop-two"]);
  await expect(page.getByText("Your data was downloaded.", { exact: false })).toBeVisible();

  const calls = await page.evaluate(() => JSON.parse(localStorage.getItem("proper-respect-fresh-user-fixture-calls")!));
  const published = calls.filter((call: { name: string }) => call.name === "publishSelected");
  expect(published).toHaveLength(1);
  expect(published[0].args).toMatchObject({ selections: [], removeAllCards: true });
  // Two relationship pages prove the download follows the cursor.
  expect(calls.filter((call: { name: string }) => call.name === "inventory:exportRelationships")).toHaveLength(2);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const width of [1280, 390]) test(`owner finds later duplicate records, saves one, and returns at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => route.request().url().startsWith("http://127.0.0.1:8882/fresh-user-fixture")
    ? route.fulfill({ contentType: "text/html", body: journeyScript }) : route.abort());
  await page.goto("http://127.0.0.1:8882/fresh-user-fixture");
  await expect(page.getByRole("heading", { name: "Start with one tool" })).toBeVisible();
  await page.evaluate(() => {
    const key = "proper-respect-fresh-user-fixture";
    const state = JSON.parse(localStorage.getItem(key)!);
    state.cards = Array.from({ length: 34 }, (_, i) => {
      const shared = i >= 32;
      const productId = shared ? "shared-product" : `product-${i}`;
      return {
        product: { _id: productId, _creationTime: i, name: shared ? "Shared Tool" : `Tool ${i}`, slug: productId, domain: `${productId}.example`, description: "Synthetic" },
        prop: { _id: `record-${i}`, _creationTime: i, userId: state.user._id, productId, status: i === 33 ? "TESTING" : "ACTIVE", visibility: i === 33 ? "DRAFT" : "PRIVATE", headline: i === 33 ? "Uncertain clue" : `Work ${i}`, note: i === 33 ? "Unreviewed source text" : `Reason ${i}`, relationshipVersion: 0 },
        links: [], claims: [], previousStatuses: [], isPublishedAtCurrentHandle: false,
      };
    });
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  const collection = page.getByRole("region", { name: "My collection", exact: true });
  await expect(collection.getByText("25 relationships checked. More remain to check.", { exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: / review$/ })).toHaveCount(25);
  await page.getByRole("button", { name: "Load more sharing choices" }).click();
  await expect(page.getByRole("group", { name: / review$/ })).toHaveCount(34);
  await collection.getByRole("button", { name: "All", exact: true }).click();
  await collection.getByRole("searchbox", { name: "Find a tool" }).fill("Shared Tool");
  await expect(collection.getByText("2 matching relationships.", { exact: true })).toBeVisible();
  await collection.screenshot({ path: testInfo.outputPath(`2026-10-06-collection-finder-${width}.png`) });
  await collection.getByRole("link", { name: /Shared Tool Currently use/ }).click();
  await expect(page).toHaveURL(/#relationship=record-32$/);
  const focused = page.getByRole("region", { name: "Shared Tool", exact: true });
  await expect(focused.getByRole("heading", { name: "Shared Tool", exact: true })).toBeFocused();
  await expect(focused.getByLabel("Explanation or workflow (optional)")).toHaveValue("Reason 32");
  await focused.getByLabel("One of my go-to tools").check();
  await focused.getByLabel("Explanation or workflow (optional)").fill("Essential for my current work.");
  await focused.getByRole("button", { name: "Save privately", exact: true }).click();
  await expect(focused.getByText("Saved privately. Your public profile has not changed.", { exact: true })).toBeVisible();
  await expect(focused.getByRole("heading", { name: "Saved decisions" })).toBeVisible();
  await focused.getByText("Preview saved card and usage", { exact: true }).click();
  await expect(focused.locator(".product-card")).toHaveCount(1);
  await focused.getByText("Preview saved card and usage", { exact: true }).click();
  await focused.getByRole("combobox", { name: "Relationship record", exact: true }).selectOption("record-33");
  await expect(focused.getByLabel("How it fits")).toHaveValue("");
  await expect(focused.getByLabel("Explanation or workflow (optional)")).toHaveValue("");
  await expect(focused.getByText("No retained source is attached. Your explanation is an owner statement.", { exact: true })).toBeVisible();
  await focused.getByRole("combobox", { name: "Relationship record", exact: true }).selectOption("record-32");
  await expect(focused.getByLabel("One of my go-to tools")).toBeChecked();
  await page.reload();
  await expect(focused.getByLabel("Explanation or workflow (optional)")).toHaveValue("Essential for my current work.");
  await focused.getByLabel("How it fits").selectOption("ARCHIVED");
  await focused.getByRole("button", { name: "Save privately", exact: true }).click();
  await expect(focused.getByText("active → archived", { exact: false })).toBeVisible();
  await focused.getByRole("heading", { name: "Shared Tool", exact: true }).scrollIntoViewIfNeeded();
  await focused.screenshot({ path: testInfo.outputPath(`2026-09-29-owner-relationship-${width}.png`) });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await focused.getByRole("link", { name: "Back to my collection" }).click();
  await collection.getByRole("button", { name: "Past use", exact: true }).click();
  await expect(collection.getByRole("link", { name: /Shared Tool Past use/ })).toBeVisible();
  await collection.getByRole("button", { name: "Discoveries", exact: true }).click();
  await expect(collection.getByRole("link", { name: /Shared Tool Needs your decision/ })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("proper-respect-fresh-user-fixture")!));
  expect(saved.cards[33].prop).toMatchObject({ visibility: "DRAFT", note: "Unreviewed source text", relationshipVersion: 0 });
  expect(saved.history).toHaveLength(2);
  const calls = await page.evaluate(() => JSON.parse(localStorage.getItem("proper-respect-fresh-user-fixture-calls")!));
  expect(calls.filter((call: { name: string }) => call.name === "publishSelected")).toHaveLength(0);
  expect(errors).toEqual([]);
});

for (const width of [1280, 390]) for (const reconnect of ["replacement", "same-account"] as const) test(`GitHub ${reconnect} requires fresh visible consent at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("proper-respect-fresh-user-fixture", JSON.stringify({
      user: { _id: "synthetic-owner", handle: "synthetic-owner", displayName: "Synthetic owner", bio: "" },
      hasClaimedPublicIdentity: true, hasPublicationAtCurrentHandle: false, privateInventoryAvailable: true,
      drafts: [], evidence: [],
      connectors: [{ _id: "github-connector", provider: "GITHUB", status: "CONNECTED", attributionScope: "PERSONAL", accountLabel: "github.com/account-b", connectedAt: "2026-10-01T09:00:00Z", lastSyncedAt: "2026-10-06T09:00:00Z" }],
      cards: [{
        product: { _id: "github-product", name: "GitHub", slug: "github", domain: "github.com", description: "Code" },
        prop: { _id: "github-prop", productId: "github-product", userId: "synthetic-owner", visibility: "PRIVATE", status: "ACTIVE", headline: "My code", note: "", relationshipVersion: 1,
          activity: { kind: "contributionCalendar", attributionScope: "PERSONAL", capturedAt: "2026-09-30T12:00:00Z", freshness: "STALE", provenanceLabel: "Saved activity from github.com/account-a", total: 17, days: [{ date: "2026-09-30", count: 17, level: 4 }] } },
        links: [], claims: [], previousStatuses: [], isPublishedAtCurrentHandle: false,
      }],
    }));
  });
  await page.route("**/*", route => route.request().url().startsWith("http://127.0.0.1:8882/fresh-user-fixture")
    ? route.fulfill({ contentType: "text/html", body: journeyScript }) : route.abort());
  await page.goto("http://127.0.0.1:8882/fresh-user-fixture");
  const review = page.getByRole("group", { name: "GitHub review" });
  await review.getByLabel("Share this saved card", { exact: true }).check();
  await review.getByText("Information to include", { exact: true }).click();
  await review.getByLabel("Publish personal activity", { exact: true }).check();
  await review.getByLabel("Refresh daily from GitHub", { exact: true }).check();
  await page.getByRole("button", { name: "Preview sharing", exact: true }).click();
  const preview = page.getByRole("region", { name: "Your visitor’s view" });
  await expect(preview).toContainText("Daily GitHub refresh will read activity from github.com/account-b");
  await preview.getByRole("button", { name: "Details", exact: true }).click();
  await expect(preview.locator("article.product-card")).toContainText("Saved activity from github.com/account-a");
  await expect(preview.locator("article.product-card")).not.toContainText("github.com/account-b");
  await preview.getByRole("checkbox").check();
  await expect(preview.getByRole("button", { name: "Publish this preview" })).toBeEnabled();

  // Only the connector changes. Saved cards, identity and review choices stay the same.
  await page.evaluate(mode => {
    const key = "proper-respect-fresh-user-fixture";
    const state = JSON.parse(localStorage.getItem(key)!);
    const connector = state.connectors[0];
    connector.accountLabel = mode === "replacement" ? "github.com/account-c" : "github.com/account-b";
    connector.lastSyncedAt = "2026-10-06T10:00:00Z";
    const newValue = JSON.stringify(state);
    localStorage.setItem(key, newValue);
    window.dispatchEvent(new StorageEvent("storage", { key, newValue }));
  }, reconnect);
  await expect(preview.getByRole("status")).toContainText("Preview again before publishing.");
  await expect(preview.getByRole("checkbox")).toBeDisabled();
  await expect(preview.getByRole("button", { name: "Publish this preview" })).toBeDisabled();
  await preview.screenshot({ path: testInfo.outputPath(`github-consent-stale-${reconnect}-${width}.png`), animations: "disabled" });

  await page.getByRole("button", { name: "Preview sharing", exact: true }).click();
  await expect(preview.getByRole("status")).toHaveCount(0);
  await expect(preview).toContainText(`Daily GitHub refresh will read activity from github.com/account-${reconnect === "replacement" ? "c" : "b"}`);
  await expect(preview.getByRole("checkbox")).toBeEnabled();
  await expect(preview.getByRole("checkbox")).not.toBeChecked();
  await expect(preview.getByRole("button", { name: "Publish this preview" })).toBeDisabled();
  await preview.getByRole("checkbox").check();
  await expect(preview.getByRole("button", { name: "Publish this preview" })).toBeEnabled();
  const calls = await page.evaluate(() => JSON.parse(localStorage.getItem("proper-respect-fresh-user-fixture-calls")!));
  expect(calls.filter((call: { name: string }) => call.name === "publishSelected")).toHaveLength(0);
  expect(calls.filter((call: { name: string }) => call.name === "previewPublication")).toHaveLength(2);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await preview.screenshot({ path: testInfo.outputPath(`github-consent-fresh-${reconnect}-${width}.png`), animations: "disabled" });
});

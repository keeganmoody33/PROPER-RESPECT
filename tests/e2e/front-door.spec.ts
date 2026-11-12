import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { build } from "esbuild";
import { expect, test, type Page } from "@playwright/test";

const origin = "http://127.0.0.1:8884";
const collectionUrl = `${origin}/app/collection`;
const key = "proper-respect-fresh-user-fixture";
const pendingKey = "proper-respect:pending-stack:v1";
const screenshots = process.env.FRONT_DOOR_SCREENSHOTS;
const HEIGHT = 900;
const DESKTOP = 1280;
const PHONE = 375;
// Swaps exactly "@clerk/nextjs" and "convex/react" for stand-ins; "convex/server" stays real.
const boundary = /^(@clerk\/nextjs|convex\/react)$/;
const anyPath = /.*/;

let fixtureHtml: string;
test.beforeAll(async () => {
  const result = await build({
    stdin: { contents: `import {createElement} from "react"; import {createRoot} from "react-dom/client"; import {OnboardingClient} from "./components/onboarding-client";
      createRoot(document.getElementById("root")).render(createElement(OnboardingClient, {publicOrigin:"https://public.example"}));`, resolveDir: process.cwd() },
    bundle: true, write: false, outfile: "front-door-fixture.js", platform: "browser", format: "iife", jsx: "automatic",
    loader: { ".css": "local-css" }, define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "front-door-boundary", setup(builder) {
      builder.onResolve({ filter: boundary }, args => ({ path: args.path, namespace: "front-door" }));
      builder.onLoad({ filter: anyPath, namespace: "front-door" }, args => ({
        resolveDir: args.path === "convex/react" ? `${process.cwd()}/tests/e2e/fixtures` : process.cwd(), loader: "js",
        contents: args.path === "@clerk/nextjs" ? `
          import {cloneElement} from "react";
          const user={id:"synthetic-owner",fullName:"Synthetic owner",imageUrl:""};
          export const Show=({children,fallback})=>localStorage.getItem("fixture-signed-in")?children:fallback;
          export const SignInButton=({children,forceRedirectUrl})=>cloneElement(children,{onClick:()=>{localStorage.setItem("fixture-signed-in","true");location.assign(forceRedirectUrl);}});
          export const UserButton=()=>null;
          export const useUser=()=>({user});
          export const useAuth=()=>({isLoaded:true,getToken:async()=>null,sessionClaims:{}});
          export const useClerk=()=>({openUserProfile:()=>{}});
        ` : readFileSync("tests/e2e/fixtures/fresh-user-backend.js", "utf8"),
      }));
    } }],
  });
  const javascript = result.outputFiles.find(file => file.path.endsWith(".js"))!.text;
  const styles = result.outputFiles.find(file => file.path.endsWith(".css"))?.text ?? "";
  fixtureHtml = `<!doctype html><html lang="en"><head><title>Front door fixture</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>${readFileSync("app/globals.css", "utf8")}\n${styles}</style></head>
    <body><div id="root"></div><script>${javascript.replaceAll("</script", "<\\/script")}</script></body></html>`;
});

// The account already holds Vercel, so the restored list must count it as saved.
const seeded = {
  user: { _id: "synthetic-owner", handle: "pending-owner", displayName: "Synthetic owner", bio: "" },
  connectors: [], drafts: [], evidence: [], privateInventoryAvailable: true, brandEnrichmentAvailable: false,
  hasPublicationAtCurrentHandle: false, hasClaimedPublicIdentity: false,
  cards: [
    { product: { _id: "product-vercel", _creationTime: 1, name: "Vercel", slug: "vercel", domain: "vercel.com", description: "Synthetic saved product" },
      prop: { _id: "saved-vercel", _creationTime: 1, userId: "synthetic-owner", productId: "product-vercel", status: "ACTIVE", visibility: "PRIVATE", headline: "", note: "", confirmedAt: "2026-11-01T12:00:00Z", relationshipVersion: 1, goTo: false },
      links: [{ type: "CANONICAL", url: "https://vercel.com", label: "Open Vercel", isPrimary: true }], claims: [], previousStatuses: [], isPublishedAtCurrentHandle: false },
  ],
};

async function open(page: Page, width: number, theme: "light" | "dark") {
  await page.setViewportSize({ width, height: HEIGHT });
  await page.addInitScript(([storageKey, state, dark]) => {
    if (!localStorage.getItem(storageKey as string)) localStorage.setItem(storageKey as string, JSON.stringify(state));
    if (dark) document.addEventListener("DOMContentLoaded", () => { document.documentElement.dataset.theme = "dark"; });
  }, [key, seeded, theme === "dark"] as const);
  await page.route("**/*", route => route.request().url().startsWith(origin)
    ? route.fulfill({ contentType: "text/html", body: fixtureHtml }) : route.abort());
  await page.goto(collectionUrl);
  if (theme === "dark") await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
}

async function calls(page: Page) {
  return page.evaluate(storageKey => JSON.parse(localStorage.getItem(`${storageKey}-calls`) ?? "[]"), key) as Promise<{ name: string; args: Record<string, unknown> }[]>;
}

async function noAxeViolations(page: Page) {
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
}

const fits = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

[DESKTOP, PHONE].flatMap(width => (["light", "dark"] as const).map(theme => [width, theme] as const)).forEach(([width, theme]) => test(`a visitor builds a list before signing in and lands back on it ready to save privately at ${width}px in ${theme}`, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await open(page, width, theme);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Start your collection");
  const builder = page.getByRole("region", { name: "Build your stack" });
  const status = builder.getByRole("status");
  await expect(builder.getByRole("button", { name: "Sign in to save 0 tools" })).toBeDisabled();

  await builder.getByRole("button", { name: "GTM engineering", exact: true }).click();
  await expect(status).toHaveText("Added 12 to your list.");
  const search = builder.getByRole("combobox", { name: "Search products" });
  await search.fill("figma");
  await search.press("Enter");
  await builder.getByRole("button", { name: "Remove Supabase" }).click();
  await builder.getByRole("combobox", { name: "How you use Clay" }).selectOption("TESTING");
  await expect(builder.getByRole("heading", { name: "Your list (12)" })).toBeVisible();
  const signIn = builder.getByRole("button", { name: "Sign in to save 12 tools" });
  await expect(signIn).toBeEnabled();

  await page.reload();
  await expect(builder.getByRole("heading", { name: "Your list (12)" })).toBeVisible();
  await expect(builder.getByRole("combobox", { name: "How you use Clay" })).toHaveValue("TESTING");

  const usageData = page.getByRole("region", { name: "Already have usage data?" });
  expect(await usageData.getByRole("group", { name: "Choose what to bring in" }).getByRole("button").evaluateAll(buttons => buttons.map(button => button.getAttribute("aria-label"))))
    .toEqual(["GitHub", "Claude Code", "Codex", "Another tool", "Add a tool by name"]);
  await expect(usageData.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  expect(await fits(page)).toBe(true);
  await noAxeViolations(page);
  if (screenshots && theme === "light") await page.screenshot({ path: `${screenshots}/signed-out-collection-${width}.png`, fullPage: true, animations: "disabled" });
  expect(await calls(page)).toEqual([]);

  await signIn.click();
  await expect(page).toHaveURL(collectionUrl);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your collection");
  await expect(builder.getByRole("heading", { name: "Your list (11)" })).toBeVisible();
  await expect(status).toHaveText("Added 11 to your list. 1 already saved.");
  const save = builder.getByRole("button", { name: "Save 11 tools privately" });
  await expect(save).toBeFocused();
  // A signed-in owner's unsaved list never sits in the storage a signed-out visitor reads.
  expect(await page.evaluate(storage => sessionStorage.getItem(storage), pendingKey)).toBeNull();
  await expect(builder.getByRole("combobox", { name: "How you use Clay" })).toHaveValue("TESTING");
  expect(await fits(page)).toBe(true);
  await noAxeViolations(page);

  await save.click();
  await expect(status).toHaveText("Saved 11 tools privately. This save made nothing public.");
  const saves = (await calls(page)).filter(call => call.name === "saveSelection");
  expect(saves.map(call => call.args.picks)).toEqual([[
    ...["claude-code", "cursor", "github"].map(slug => ({ kind: "directory", slug, status: "ACTIVE" })),
    { kind: "directory", slug: "clay", status: "TESTING" },
    ...["exa", "firecrawl", "spider", "n8n", "cloudflare", "posthog", "figma"].map(slug => ({ kind: "directory", slug, status: "ACTIVE" })),
  ]]);
  expect(await page.evaluate(storage => sessionStorage.getItem(storage), pendingKey)).toBeNull();
  await page.reload();
  await expect(builder.getByRole("heading", { name: "Your list (0)" })).toBeVisible();
  expect(errors).toEqual([]);
}));

test("a tampered stored list restores nothing and the page still works", async ({ page }) => {
  await page.addInitScript(storage => sessionStorage.setItem(storage, JSON.stringify({ version: 1, picks: [{ kind: "directory", slug: "clay", status: "PUBLIC" }] })), pendingKey);
  await open(page, DESKTOP, "light");
  const builder = page.getByRole("region", { name: "Build your stack" });
  await expect(builder.getByRole("button", { name: "GTM engineering", exact: true })).toBeVisible();
  await expect(builder.getByRole("heading", { name: "Your list (0)" })).toBeVisible();
  await builder.getByRole("button", { name: "GTM engineering", exact: true }).click();
  await expect(builder.getByRole("button", { name: "Sign in to save 12 tools" })).toBeEnabled();
});

test("a restored list the account already holds leaves focus in search when the owner adds another tool", async ({ page }) => {
  await page.addInitScript(storage => {
    localStorage.setItem("fixture-signed-in", "true");
    if (!sessionStorage.getItem("seeded")) sessionStorage.setItem(storage, JSON.stringify({ version: 1, picks: [{ kind: "directory", slug: "vercel", status: "ACTIVE" }] }));
    sessionStorage.setItem("seeded", "true");
  }, pendingKey);
  await open(page, DESKTOP, "light");
  const builder = page.getByRole("region", { name: "Build your stack" });
  await expect(builder.getByRole("status")).toHaveText("1 already saved.");
  await expect(builder.getByRole("heading", { name: "Your list (0)" })).toBeVisible();
  const search = builder.getByRole("combobox", { name: "Search products" });
  await search.fill("figma");
  await search.press("Enter");
  await expect(builder.getByRole("heading", { name: "Your list (1)" })).toBeVisible();
  await expect(search).toBeFocused();
});

test("a usage-data choice still carries through sign-in", async ({ page }) => {
  await open(page, PHONE, "light");
  const usageData = page.getByRole("region", { name: "Already have usage data?" });
  await usageData.getByRole("button", { name: "Claude Code", exact: true }).click();
  await usageData.getByRole("button", { name: "Continue with Claude Code", exact: true }).click();
  await expect(page).toHaveURL(`${collectionUrl}?source=claude-code`);
  await expect(page.getByRole("heading", { name: "Import Claude Code usage", exact: true })).toBeVisible();
});

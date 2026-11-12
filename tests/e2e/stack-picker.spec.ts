import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { build } from "esbuild";
import { expect, test, type Locator, type Page } from "@playwright/test";

const fixtureUrl = "http://127.0.0.1:8882/stack-picker-fixture";
const key = "proper-respect-fresh-user-fixture";
const screenshots = process.env.STACK_PICKER_SCREENSHOTS;
const HEIGHT = 900;
const DESKTOP = 1280;
const PHONE = 375;
const SHARED = 13;
// Swaps "@clerk/nextjs" and "convex/react" for synthetic stand-ins; "convex/server" stays real.
const boundary = /^(@clerk\/nextjs|convex\/react)$/;
const anyPath = /.*/;

let page: string;
test.beforeAll(async () => {
  const result = await build({
    stdin: { contents: `import {createElement} from "react"; import {createRoot} from "react-dom/client"; import {OnboardingClient} from "./components/onboarding-client";
      createRoot(document.getElementById("root")).render(createElement(OnboardingClient, {publicOrigin:"https://public.example"}));`, resolveDir: process.cwd() },
    bundle: true, write: false, outfile: "stack-picker-fixture.js", platform: "browser", format: "iife", jsx: "automatic",
    loader: { ".css": "local-css" }, define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "stack-picker-boundary", setup(builder) {
      builder.onResolve({ filter: boundary }, args => ({ path: args.path, namespace: "stack-picker" }));
      builder.onLoad({ filter: anyPath, namespace: "stack-picker" }, args => ({
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
  page = `<!doctype html><html lang="en"><head><title>Stack picker fixture</title><style>${readFileSync("app/globals.css", "utf8")}\n${styles}</style></head>
    <body><div id="root"></div><script>${javascript.replaceAll("</script", "<\\/script")}</script></body></html>`;
});

// One saved tool the picker must not offer again, and one whose saved link
// share-all must skip by name (R03's javascript: URL).
const seeded = {
  user: { _id: "synthetic-owner", handle: "pending-owner", displayName: "Synthetic owner", bio: "" },
  connectors: [], drafts: [], evidence: [], privateInventoryAvailable: true, brandEnrichmentAvailable: false,
  hasPublicationAtCurrentHandle: false, hasClaimedPublicIdentity: false,
  cards: [
    { product: { _id: "product-slack", _creationTime: 1, name: "Slack", slug: "slack", domain: "slack.com", description: "Synthetic saved product" },
      prop: { _id: "saved-slack", _creationTime: 1, userId: "synthetic-owner", productId: "product-slack", status: "ACTIVE", visibility: "PRIVATE", headline: "", note: "", confirmedAt: "2026-11-01T12:00:00Z", relationshipVersion: 1, goTo: false },
      links: [{ type: "CANONICAL", url: "https://slack.com", label: "Open Slack", isPrimary: true }], claims: [], previousStatuses: [], isPublishedAtCurrentHandle: false },
    { product: { _id: "product-bad-link", _creationTime: 1, name: "Bad Link Tool", slug: "manual-bad-link-tool", domain: "", description: "" },
      prop: { _id: "saved-bad-link", _creationTime: 1, userId: "synthetic-owner", productId: "product-bad-link", status: "ACTIVE", visibility: "PRIVATE", headline: "", note: "", confirmedAt: "2026-11-01T12:00:00Z", relationshipVersion: 1, goTo: false },
      links: [{ type: "AFFILIATE", url: "javascript:alert(1)", label: "Bad link", isPrimary: true }], claims: [], previousStatuses: [], isPublishedAtCurrentHandle: false },
  ],
};

async function open(browserPage: Page, width: number, theme: "light" | "dark") {
  await browserPage.setViewportSize({ width, height: HEIGHT });
  await browserPage.addInitScript(([storageKey, state, dark]) => {
    if (!localStorage.getItem(storageKey as string)) localStorage.setItem(storageKey as string, JSON.stringify(state));
    if (dark) document.addEventListener("DOMContentLoaded", () => { document.documentElement.dataset.theme = "dark"; });
  }, [key, seeded, theme === "dark"] as const);
  await browserPage.route("**/*", route => route.request().url().startsWith(fixtureUrl)
    ? route.fulfill({ contentType: "text/html", body: page }) : route.abort());
  await browserPage.goto(fixtureUrl);
  if (theme === "dark") await browserPage.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
}

async function calls(browserPage: Page) {
  return browserPage.evaluate(storageKey => JSON.parse(localStorage.getItem(`${storageKey}-calls`) ?? "[]"), key) as Promise<{ name: string; args: Record<string, unknown> }[]>;
}

function pageTop(locator: Locator) {
  return locator.evaluate(element => element.getBoundingClientRect().top + scrollY);
}

async function noAxeViolations(browserPage: Page) {
  expect((await new AxeBuilder({ page: browserPage }).analyze()).violations).toEqual([]);
}

[DESKTOP, PHONE].flatMap(width => (["light", "dark"] as const).map(theme => [width, theme] as const)).forEach(([width, theme]) => test(`a new member builds a stack, saves it privately and shares it in one approval at ${width}px in ${theme}`, async ({ page: browserPage }) => {
  const errors: string[] = [];
  browserPage.on("pageerror", error => errors.push(error.message));
  await open(browserPage, width, theme);
  const builder = browserPage.getByRole("region", { name: "Build your stack" });
  const status = builder.getByRole("status");

  await builder.getByRole("button", { name: "Sales", exact: true }).click();
  await expect(status).toHaveText("Added 11 to your list. 1 already saved.");

  const before = await pageTop(builder.getByRole("heading", { name: "Your list (11)" }));
  const search = builder.getByRole("combobox", { name: "Search products" });
  await search.fill("figma");
  const results = builder.getByRole("listbox", { name: "Matching products" });
  await expect(results.getByRole("option").first()).toContainText("Figma");
  await search.press("ArrowDown");
  expect((await search.getAttribute("aria-activedescendant"))?.endsWith("option-0")).toBe(true);
  await search.press("Enter");
  await expect(status).toHaveText("Added 1 to your list.");
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("");

  await search.fill("slack");
  const slack = results.getByRole("option").filter({ hasText: "Slack" }).first();
  await expect(slack).toHaveAttribute("aria-disabled", "true");
  await expect(slack).toContainText("Already saved");
  expect(await pageTop(builder.getByRole("heading", { name: "Your list (12)" }))).toBe(before);
  await search.fill("Field Notes");
  await results.getByRole("option").filter({ hasText: "Add “Field Notes”" }).click();

  await builder.getByRole("button", { name: "Remove ZoomInfo" }).click();
  await builder.getByRole("combobox", { name: "How you use Clay" }).selectOption("TESTING");
  await expect(builder.getByRole("heading", { name: "Your list (12)" })).toBeVisible();
  expect(await browserPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await noAxeViolations(browserPage);
  if (screenshots && theme === "light") await builder.screenshot({ path: `${screenshots}/builder-filled-tray-${width}.png`, animations: "disabled" });

  await builder.getByRole("button", { name: "Save 12 tools privately" }).click();
  await expect(status).toHaveText("Saved 12 tools privately. Nothing is public yet.");
  await expect(builder.getByRole("heading", { name: "Your list (0)" })).toBeVisible();
  const saves = (await calls(browserPage)).filter(call => call.name === "saveSelection");
  expect(saves).toHaveLength(1);
  expect(saves[0].args.picks).toEqual([
    ...["salesforce", "hubspot", "linkedin-sales-navigator", "apollo", "outreach", "salesloft", "gong"].map(slug => ({ kind: "directory", slug, status: "ACTIVE" })),
    { kind: "directory", slug: "clay", status: "TESTING" },
    ...["mixmax", "calendly", "figma"].map(slug => ({ kind: "directory", slug, status: "ACTIVE" })),
    { kind: "typed", name: "Field Notes", status: "ACTIVE" },
  ]);
  expect(saves[0].args.operationId).toHaveLength(crypto.randomUUID().length);

  await builder.getByRole("link", { name: "Next: share your stack" }).click();
  const share = browserPage.getByRole("region", { name: "Share every confirmed tool" });
  await share.getByRole("button", { name: "Choose your public handle" }).click();
  const identity = browserPage.locator("#collection-profile");
  await expect(identity.getByLabel("Handle", { exact: true })).toBeFocused();
  await identity.getByLabel("Handle", { exact: true }).fill("synthetic-stack");
  await identity.getByRole("button", { name: "Save public identity" }).click();

  await share.getByRole("button", { name: "Preview sharing all confirmed tools" }).click();
  await expect(share.getByRole("status")).toHaveText(`Preview ready. ${SHARED} cards will be shared. 1 will stay private until you fix it.`);
  await expect(share.getByRole("listitem").filter({ hasText: "Bad Link Tool" })).toHaveText("Bad Link Tool stays private: its saved link is not a public web address. Fix the link in your collection.");
  const preview = share.getByRole("region", { name: "Your visitor’s view" });
  await expect(preview.locator("article.product-card")).toHaveCount(SHARED);
  await expect(preview).toContainText("@synthetic-stack");
  await expect(preview).not.toContainText("Bad Link Tool");
  await noAxeViolations(browserPage);
  if (screenshots && theme === "light") await share.screenshot({ path: `${screenshots}/share-preview-${width}.png`, animations: "disabled" });

  const publish = preview.getByRole("button", { name: "Publish this preview" });
  await expect(publish).toBeDisabled();
  await preview.getByLabel("I approve making exactly this preview visible to anyone with the public link.").check();
  await publish.click();
  await expect(share.getByRole("status")).toHaveText(`Shared ${SHARED} tools. Your public page is live.`);
  await expect(share.getByRole("link", { name: "https://public.example/synthetic-stack" })).toHaveAttribute("href", "https://public.example/synthetic-stack");
  const published = (await calls(browserPage)).filter(call => call.name === "publishSelected");
  expect(published.map(call => call.args)).toEqual([{ selections: [], shareAllConfirmed: true, expectedPublicationRevision: 0,
    expectedPreviewHash: expect.stringContaining("synthetic-share-all-") }]);
  const saved = await browserPage.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)!), key);
  expect(saved.cards.find((card: { prop: { _id: string } }) => card.prop._id === "saved-bad-link").prop.visibility).toBe("PRIVATE");
  expect(saved.cards.filter((card: { prop: { visibility: string } }) => card.prop.visibility === "PUBLIC")).toHaveLength(SHARED);
  await noAxeViolations(browserPage);
  expect(await browserPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
}));

test("a typed alias, name or website of a listed product joins as that product, and a conflicting pair is refused before save", async ({ page: browserPage }) => {
  await open(browserPage, DESKTOP, "light");
  const builder = browserPage.getByRole("region", { name: "Build your stack" });
  const status = builder.getByRole("status");
  const search = builder.getByRole("combobox", { name: "Search products" });
  const results = builder.getByRole("listbox", { name: "Matching products" });
  await search.fill("windsurf");
  await search.press("Enter");
  await expect(status).toHaveText("Added 1 to your list.");

  await search.fill("codeium");
  await expect(results.getByRole("option").filter({ hasText: "Windsurf" })).toContainText("In your list");
  await expect(results.getByRole("option").filter({ hasText: "Add “codeium”" })).toHaveCount(0);

  await builder.getByText("Add a tool with its website").click();
  const name = builder.getByLabel("Tool name");
  const website = builder.getByLabel("Website (optional)");
  const add = builder.getByRole("button", { name: "Add to list" });
  await name.fill("Codeium");
  await add.click();
  await expect(status).toHaveText("1 already in your list.");
  await name.fill("My editor");
  await website.fill("codeium.com");
  await add.click();
  await expect(status).toHaveText("1 already in your list.");
  await name.fill("GitHub");
  await website.fill("notion.so");
  await add.click();
  await expect(builder.getByRole("alert")).toHaveText("That website does not match the named catalog product. Correct the name or website.");
  await expect(name).toHaveValue("GitHub");
  await expect(builder.getByRole("heading", { name: "Your list (1)" })).toBeVisible();

  await builder.getByRole("button", { name: "Save 1 tool privately" }).click();
  const saves = (await calls(browserPage)).filter(call => call.name === "saveSelection");
  expect(saves.map(call => call.args.picks)).toEqual([[{ kind: "directory", slug: "windsurf", status: "ACTIVE" }]]);
});

test("a failed save keeps the tray and reuses its operation for the unchanged retry", async ({ page: browserPage }) => {
  await open(browserPage, DESKTOP, "light");
  await browserPage.evaluate(storageKey => {
    const state = JSON.parse(localStorage.getItem(storageKey)!);
    state.stackOperations = { "forced-conflict": { body: "[]", result: {} } };
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, key);
  await browserPage.reload();
  const builder = browserPage.getByRole("region", { name: "Build your stack" });
  await browserPage.evaluate(() => { crypto.randomUUID = () => "forced-conflict" as `${string}-${string}-${string}-${string}-${string}`; });
  const search = builder.getByRole("combobox", { name: "Search products" });
  await search.fill("figma");
  await search.press("Enter");
  await builder.getByRole("button", { name: "Save 1 tool privately" }).click();
  await expect(builder.getByRole("alert")).toHaveText("This save was already used with different picks.");
  await expect(builder.getByRole("heading", { name: "Your list (1)" })).toBeVisible();
  await builder.getByRole("button", { name: "Save 1 tool privately" }).click();
  await expect(builder.getByRole("alert")).toHaveText("This save was already used with different picks.");
  const saves = (await calls(browserPage)).filter(call => call.name === "saveSelection");
  expect(saves.map(call => call.args.operationId)).toEqual(["forced-conflict", "forced-conflict"]);
});

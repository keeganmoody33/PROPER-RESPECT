import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { build } from "esbuild";
import { expect, test, type Page } from "@playwright/test";
import { suggestedHeadline } from "../../src/domain/suggested-headline";

// The real onboarding page and walkthrough over the synthetic Convex boundary (fixtures/fresh-user-backend.js). All data is
// synthetic; nothing here reaches Clerk, Convex or a provider.
const fixtureUrl = "http://127.0.0.1:8883/walkthrough-fixture";
const key = "proper-respect-fresh-user-fixture";
const screenshots = process.env.WALKTHROUGH_SCREENSHOTS;
const PHONE_WIDTH = 390, PHONE_HEIGHT = 844, DESKTOP_WIDTH = 1280, DESKTOP_HEIGHT = 900, NARROW_WIDTH = 320, NARROW_HEIGHT = 700;
const PHONE = { width: PHONE_WIDTH, height: PHONE_HEIGHT };
const DESKTOP = { width: DESKTOP_WIDTH, height: DESKTOP_HEIGHT };
const NARROW = { width: NARROW_WIDTH, height: NARROW_HEIGHT };
const SHARED = 2;
// Daily, Weekly, Testing, Stopped using and Never used it; More adds Occasionally, Paused and Tried, didn't adopt.
const FIRST_CHOICES = 5;
const ALL_CHOICES = 8;
// The keyboard pass tabs forward through one screen; it never needs more stops than this.
const TAB_LIMIT = 40;
// The two packages swapped for synthetic stand-ins: matches "convex/react", rejects "convex/server".
const boundary = /^(@clerk\/nextjs|convex\/react)$/;
// Any module path in the swapped namespace: matches "convex/react" and "".
const anyPath = /.*/;

let page: string;
test.beforeAll(async () => {
  const result = await build({
    stdin: { contents: `import {createElement} from "react"; import {createRoot} from "react-dom/client"; import {OnboardingClient} from "./components/onboarding-client";
      createRoot(document.getElementById("root")).render(createElement(OnboardingClient, {publicOrigin:"https://public.example"}));`, resolveDir: process.cwd() },
    bundle: true, write: false, outfile: "walkthrough-fixture.js", platform: "browser", format: "iife", jsx: "automatic",
    loader: { ".css": "local-css" }, define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "walkthrough-boundary", setup(builder) {
      builder.onResolve({ filter: boundary }, args => ({ path: args.path, namespace: "walkthrough" }));
      builder.onLoad({ filter: anyPath, namespace: "walkthrough" }, args => ({
        resolveDir: args.path === "convex/react" ? `${process.cwd()}/tests/e2e/fixtures` : process.cwd(), loader: "js",
        contents: args.path === "@clerk/nextjs" ? `
          const user={id:"synthetic-owner",fullName:"Synthetic owner",imageUrl:""};
          export const Show=({children})=>children;
          export const SignInButton=({children})=>children;
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
  page = `<!doctype html><html lang="en"><head><title>Walkthrough fixture</title><style>${readFileSync("app/globals.css", "utf8")}\n${styles}</style></head>
    <body><div id="root"></div><script>${javascript.replaceAll("</script", "<\\/script")}</script></body></html>`;
});

type Size = { width: number; height: number };
async function open(browserPage: Page, size: Size, options: { theme?: "light" | "dark"; seed?: unknown } = {}) {
  await browserPage.setViewportSize(size);
  await browserPage.addInitScript(([storageKey, state, dark]) => {
    if (state && !localStorage.getItem(storageKey as string)) localStorage.setItem(storageKey as string, JSON.stringify(state));
    if (dark) document.addEventListener("DOMContentLoaded", () => { document.documentElement.dataset.theme = "dark"; });
  }, [key, options.seed ?? null, options.theme === "dark"] as const);
  await browserPage.route("**/*", route => route.request().url().startsWith(fixtureUrl)
    ? route.fulfill({ contentType: "text/html", body: page }) : route.abort());
  await browserPage.goto(fixtureUrl);
  if (options.theme === "dark") await browserPage.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
}

async function calls(browserPage: Page) {
  return browserPage.evaluate(storageKey => JSON.parse(localStorage.getItem(`${storageKey}-calls`) ?? "[]"), key) as Promise<{ name: string; args: Record<string, unknown> }[]>;
}
async function stored(browserPage: Page) {
  return browserPage.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)!), key) as Promise<{ cards: { prop: Record<string, unknown>; product: { name: string } }[] }>;
}
async function noAxeViolations(browserPage: Page) {
  expect((await new AxeBuilder({ page: browserPage }).analyze()).violations).toEqual([]);
}
async function noSidewaysScroll(browserPage: Page) {
  expect(await browserPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

// Three tools a person already picked, saved the way the stack builder saves them: confirmed, Weekly, no line yet.
const picked = (slug: string, name: string, domain: string) => ({
  product: { _id: `product-${slug}`, _creationTime: 1, name, slug, domain, description: "Synthetic product" },
  prop: { _id: `stack-${slug}`, _creationTime: 1, userId: "synthetic-owner", productId: `product-${slug}`, status: "ACTIVE", level: "WEEKLY", visibility: "PRIVATE",
    headline: "", note: "", ownerEntered: true, confirmedAt: "2026-11-17T12:00:00Z", relationshipVersion: 1, goTo: false },
  links: [], claims: [], previousStatuses: [], isPublishedAtCurrentHandle: false,
});
const seeded = {
  user: { _id: "synthetic-owner", handle: "pending-owner", displayName: "Synthetic owner", bio: "" },
  connectors: [], drafts: [], evidence: [], privateInventoryAvailable: true, brandEnrichmentAvailable: false,
  hasPublicationAtCurrentHandle: false, hasClaimedPublicIdentity: false,
  cards: [picked("claude-code", "Claude Code", "claude.com"), picked("clay", "Clay", "clay.com"), picked("cursor", "Cursor", "cursor.com")],
};

const kept = suggestedHeadline({ productName: "Claude Code", level: "DAILY", status: "ACTIVE", uses: ["build features from a description", "review code before it merges"] });
const typed = "Where my lists used to start.";

[{ size: PHONE, theme: "light" }, { size: DESKTOP, theme: "light" }, { size: PHONE, theme: "dark" }].forEach(({ size, theme }) => test(`a new account picks three tools, walks through them one at a time and ends at the share preview at ${size.width}px in ${theme}`, async ({ page: browserPage }) => {
  const errors: string[] = [];
  browserPage.on("pageerror", error => errors.push(error.message));
  await open(browserPage, size, { theme: theme as "light" | "dark" });
  const shoot = screenshots && theme === "light" ? (name: string) => browserPage.getByRole("region", { name: "Go through your tools" })
    .screenshot({ path: `${screenshots}/${name}-${size.width}.png`, animations: "disabled" }) : async () => undefined;

  const builder = browserPage.getByRole("region", { name: "Build your stack" });
  const search = builder.getByRole("combobox", { name: "Search products" });
  await ["Claude Code", "Clay", "Cursor"].reduce(async (previous, name) => {
    await previous;
    await search.fill(name);
    await expect(builder.getByRole("listbox", { name: "Matching products" }).getByRole("option").first()).toContainText(name);
    await search.press("Enter");
  }, Promise.resolve());
  await expect(builder.getByRole("heading", { name: "Your list (3)" })).toBeVisible();
  await builder.getByRole("button", { name: "Save 3 tools privately" }).click();
  await expect(builder.getByRole("status")).toHaveText("Saved 3 tools privately. This save made nothing public.");

  await builder.getByRole("link", { name: "Next: go through your tools one at a time" }).click();
  const walk = browserPage.getByRole("region", { name: "Go through your tools" });
  await expect(walk).toContainText("3 tools are waiting for your answer.");
  await walk.getByRole("button", { name: "Go through your tools one at a time" }).click();

  // 1 of 3: Daily, two uses, and the suggestion kept by the button that says so.
  await expect(walk.getByRole("heading", { name: "Claude Code" })).toBeFocused();
  await expect(walk.getByRole("status")).toHaveText("1 of 3");
  await expect(walk).toContainText("You added it");
  const levels = walk.getByRole("radiogroup", { name: "How do you use Claude Code?" });
  await expect(levels.getByRole("radio", { name: "Weekly" })).toBeChecked();
  await expect(levels.getByRole("radio")).toHaveCount(FIRST_CHOICES);
  await noAxeViolations(browserPage);
  await noSidewaysScroll(browserPage);
  await shoot("first-tool");
  await levels.getByRole("radio", { name: "Daily" }).click();
  await walk.getByRole("checkbox", { name: "build features from a description" }).click();
  await walk.getByRole("checkbox", { name: "review code before it merges" }).click();
  const line = walk.getByRole("textbox", { name: "The line on its card" });
  await expect(line).toHaveValue(kept);
  await expect(walk).toContainText("Suggested from your answers. Edit it, or keep it with the button below.");
  await noAxeViolations(browserPage);
  await noSidewaysScroll(browserPage);
  await shoot("uses-and-line");
  await walk.getByRole("button", { name: "Keep this line and go on" }).click();

  // 2 of 3: Stopped, with a line the person typed.
  await expect(walk.getByRole("heading", { name: "Clay" })).toBeFocused();
  await expect(walk.getByRole("status")).toHaveText("2 of 3");
  await walk.getByRole("radiogroup", { name: "How do you use Clay?" }).getByRole("radio", { name: "Stopped using" }).click();
  await walk.getByRole("textbox", { name: "The line on its card" }).fill(typed);
  await walk.getByRole("button", { name: "Save and go on" }).click();

  // 3 of 3: Never used it removes it, and says so on the button.
  await expect(walk.getByRole("heading", { name: "Cursor" })).toBeFocused();
  await expect(walk.getByRole("status")).toHaveText("3 of 3");
  await walk.getByRole("radiogroup", { name: "How do you use Cursor?" }).getByRole("radio", { name: "Never used it" }).click();
  await expect(walk.getByRole("textbox", { name: "The line on its card" })).toHaveCount(0);
  await walk.getByRole("button", { name: "Remove it and go on" }).click();

  const end = walk.getByRole("heading", { name: "Here's your page" });
  await expect(end).toBeFocused();
  await expect(walk.getByRole("listitem")).toHaveCount(SHARED);
  await expect(walk.getByRole("listitem").filter({ hasText: "Claude Code" })).toContainText(kept);
  await expect(walk.getByRole("listitem").filter({ hasText: "Clay" })).toContainText(typed);
  await expect(walk).toContainText("Removed from your collection: Cursor.");
  await noAxeViolations(browserPage);
  await noSidewaysScroll(browserPage);
  await shoot("end");

  const writes = (await calls(browserPage)).filter(call => ["savePrivately", "removeNeverUsed", "publishSelected"].includes(call.name));
  expect(writes.map(call => ({ name: call.name, ...call.args, operationId: undefined }))).toEqual([
    { name: "savePrivately", propId: "stack-claude-code", expectedVersion: 1, level: "DAILY", status: "ACTIVE", goTo: false, headline: kept, note: "",
      uses: { picks: ["write-features", "review-code"] }, operationId: undefined },
    { name: "savePrivately", propId: "stack-clay", expectedVersion: 1, level: "STOPPED", status: "ARCHIVED", goTo: false, headline: typed, note: "", operationId: undefined },
    { name: "removeNeverUsed", propId: "stack-cursor", expectedVersion: 1, operationId: undefined },
  ]);
  expect((await stored(browserPage)).cards.map(card => card.product.name)).toEqual(["Claude Code", "Clay"]);

  // The existing share preview and approval, untouched: nothing goes public before approve.
  await walk.getByRole("button", { name: "Preview your page" }).click();
  const share = browserPage.getByRole("region", { name: "Share every confirmed tool" });
  await expect(share).toBeFocused();
  await share.getByRole("button", { name: "Choose your public handle" }).click();
  const identity = browserPage.locator("#collection-profile");
  await identity.getByLabel("Handle", { exact: true }).fill("synthetic-walk");
  await identity.getByRole("button", { name: "Save public identity" }).click();
  await share.getByRole("button", { name: "Preview sharing all confirmed tools" }).click();
  await expect(share.getByRole("status")).toHaveText(`Preview ready. ${SHARED} cards will be shared.`);
  const preview = share.getByRole("region", { name: "Your visitor’s view" });
  await expect(preview.locator("article.product-card")).toHaveCount(SHARED);
  await expect(preview).toContainText(kept);
  await expect(preview).toContainText(typed);
  await expect(preview).not.toContainText("Cursor");
  expect((await calls(browserPage)).filter(call => call.name === "publishSelected")).toEqual([]);
  expect((await stored(browserPage)).cards.filter(card => card.prop.visibility === "PUBLIC")).toEqual([]);
  await preview.getByLabel("I approve making exactly this preview visible to anyone with the public link.").check();
  await preview.getByRole("button", { name: "Publish this preview" }).click();
  await expect(share.getByRole("status")).toHaveText(`Shared ${SHARED} tools. Your public page is live.`);
  expect((await calls(browserPage)).filter(call => call.name === "publishSelected")).toHaveLength(1);
  await noAxeViolations(browserPage);
  await noSidewaysScroll(browserPage);
  expect(errors).toEqual([]);
}));

test("Skip leaves a tool untouched, and a reload resumes at the first tool without a saved answer", async ({ page: browserPage }) => {
  await open(browserPage, PHONE, { seed: seeded });
  const walk = browserPage.getByRole("region", { name: "Go through your tools" });
  await walk.getByRole("button", { name: "Go through your tools one at a time" }).click();
  await expect(walk.getByRole("heading", { name: "Claude Code" })).toBeFocused();
  // The preselected Weekly shows a suggestion; Skip must not save it.
  await expect(walk.getByRole("textbox", { name: "The line on its card" })).toHaveValue(suggestedHeadline({ productName: "Claude Code", level: "WEEKLY", status: "ACTIVE", uses: [] }));
  await walk.getByRole("button", { name: "Skip" }).click();
  await expect(walk.getByRole("status")).toHaveText("2 of 3");
  await walk.getByRole("radiogroup", { name: "How do you use Clay?" }).getByRole("radio", { name: "Daily" }).click();
  await walk.getByRole("textbox", { name: "The line on its card" }).fill("Every list starts here.");
  await walk.getByRole("button", { name: "Save and go on" }).click();
  await expect(walk.getByRole("heading", { name: "Cursor" })).toBeFocused();
  expect((await calls(browserPage)).filter(call => call.name === "savePrivately").map(call => call.args.propId)).toEqual(["stack-clay"]);
  const claude = (await stored(browserPage)).cards.find(card => card.product.name === "Claude Code")!;
  expect(claude.prop).toEqual(seeded.cards[0].prop);

  await browserPage.reload();
  await expect(walk).toContainText("2 tools are waiting for your answer.");
  await walk.getByRole("button", { name: "Go through your tools one at a time" }).click();
  await expect(walk.getByRole("heading", { name: "Claude Code" })).toBeFocused();
  await expect(walk.getByRole("status")).toHaveText("1 of 2");
  await walk.getByRole("button", { name: "Skip" }).click();
  await expect(walk.getByRole("heading", { name: "Cursor" })).toBeFocused();
  await expect(walk.getByRole("status")).toHaveText("2 of 2");
  await walk.getByRole("button", { name: "Stop here" }).click();
  await expect(walk.getByRole("button", { name: "Go through your tools one at a time" })).toBeVisible();
  await noSidewaysScroll(browserPage);
});

// The collection arrives 25 tools at a time.
const FIRST_PAGE = 25;
test("a tool waiting on a later page of a long collection still gets its turn", async ({ page: browserPage }) => {
  const answered = Array.from({ length: FIRST_PAGE }, (_, index) => {
    const card = picked(`done-${index}`, `Synthetic tool ${index + 1}`, `tool-${index}.example`);
    return { ...card, prop: { ...card.prop, headline: "Already answered." } };
  });
  await open(browserPage, PHONE, { seed: { ...seeded, cards: [...answered, picked("cursor", "Cursor", "cursor.com")] } });
  const walk = browserPage.getByRole("region", { name: "Go through your tools" });
  await expect(walk).toContainText("1 tool is waiting for your answer.");
  await walk.getByRole("button", { name: "Go through your tools one at a time" }).click();
  await expect(walk.getByRole("heading", { name: "Cursor" })).toBeFocused();
  await expect(walk.getByRole("status")).toHaveText("1 of 1");
});

test("clearing the line on a tool with a saved note says the note shows instead, and keeps it", async ({ page: browserPage }) => {
  const noted = picked("clay", "Clay", "clay.com");
  // Saved before levels: the owner's own note and no level, so the walkthrough still asks about it.
  await open(browserPage, PHONE, { seed: { ...seeded, cards: [{ ...noted, prop: { ...noted.prop, level: undefined, note: "Lead lists." } }] } });
  const walk = browserPage.getByRole("region", { name: "Go through your tools" });
  await walk.getByRole("button", { name: "Go through your tools one at a time" }).click();
  await walk.getByRole("radiogroup", { name: "How do you use Clay?" }).getByRole("radio", { name: "Weekly" }).click();
  const line = walk.getByRole("textbox", { name: "The line on its card" });
  await line.fill("");
  await expect(walk).toContainText("With no line here, your saved note shows on the card: Lead lists.");
  await expect(walk.getByRole("button", { name: "Save without a line and go on" })).toHaveCount(0);
  await walk.getByRole("button", { name: "Save and go on", exact: true }).click();
  await expect(walk.getByRole("heading", { name: "Here's your page" })).toBeFocused();
  await expect(walk.getByRole("listitem").filter({ hasText: "Clay" })).toContainText("Lead lists.");
  expect((await calls(browserPage)).filter(call => call.name === "savePrivately").map(call => ({ headline: call.args.headline, note: call.args.note }))).toEqual([{ headline: "", note: "Lead lists." }]);
});

test("when the server keeps a tool this screen thought was bare, Never used it becomes leave it as it is", async ({ page: browserPage }) => {
  const kept = picked("clay", "Clay", "clay.com");
  // Stands in for a proof the evidence list doesn't show: the fixture refuses to remove a record marked this way.
  await open(browserPage, PHONE, { seed: { ...seeded, cards: [{ ...kept, prop: { ...kept.prop, fixtureAttached: true } }] } });
  const walk = browserPage.getByRole("region", { name: "Go through your tools" });
  await walk.getByRole("button", { name: "Go through your tools one at a time" }).click();
  await walk.getByRole("radiogroup", { name: "How do you use Clay?" }).getByRole("radio", { name: "Never used it" }).click();
  await walk.getByRole("button", { name: "Remove it and go on" }).click();
  await expect(walk).toContainText("Clay has evidence or a published card attached, so it stays in your collection as it is. Nothing new is saved.");
  // Not shown as a failure: the error line stays empty.
  await expect(walk.locator("[role=alert]")).toHaveText("");
  await walk.getByRole("button", { name: "Leave it as it is and go on" }).click();
  await expect(walk.getByRole("heading", { name: "Here's your page" })).toBeFocused();
  await expect(walk).not.toContainText("Removed from your collection");
  expect((await stored(browserPage)).cards.map(card => card.product.name)).toEqual(["Clay"]);
});

test("the walkthrough works from the keyboard alone, with More for the other levels", async ({ page: browserPage }) => {
  await open(browserPage, DESKTOP, { seed: { ...seeded, cards: [seeded.cards[1]] } });
  const walk = browserPage.getByRole("region", { name: "Go through your tools" });
  await walk.getByRole("button", { name: "Go through your tools one at a time" }).focus();
  await browserPage.keyboard.press("Enter");
  await expect(walk.getByRole("heading", { name: "Clay" })).toBeFocused();
  const focused = () => browserPage.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    return { role: element?.getAttribute("role") ?? element?.tagName.toLowerCase(), name: element?.closest("label")?.textContent?.trim() ?? element?.textContent?.trim() };
  });
  const tabTo = async (match: (current: Awaited<ReturnType<typeof focused>>) => boolean, stops = TAB_LIMIT): Promise<void> => {
    if (match(await focused())) return;
    expect(stops).toBeGreaterThan(0);
    await browserPage.keyboard.press("Tab");
    return tabTo(match, stops - 1);
  };
  // One tab stop for the whole level group; arrow keys move the choice.
  await browserPage.keyboard.press("Tab");
  expect(await focused()).toEqual({ role: "radio", name: "Weekly" });
  await browserPage.keyboard.press("ArrowUp");
  expect(await focused()).toEqual({ role: "radio", name: "Daily" });
  await expect(walk.getByRole("radio", { name: "Daily" })).toBeChecked();
  await browserPage.keyboard.press("Tab");
  expect(await focused()).toMatchObject({ name: "More" });
  await browserPage.keyboard.press("Enter");
  await expect(walk.getByRole("radio")).toHaveCount(ALL_CHOICES);
  await expect(walk.getByRole("radio", { name: "Tried, didn't adopt" })).toBeVisible();
  await tabTo(current => current.role === "checkbox" && current.name === "build target account lists");
  await browserPage.keyboard.press("Space");
  await expect(walk.getByRole("checkbox", { name: "build target account lists" })).toBeChecked();
  await tabTo(current => current.role === "textarea" && current.name?.startsWith("The line on its card") === true);
  await browserPage.keyboard.press("ControlOrMeta+a");
  await browserPage.keyboard.type("Lists start here.");
  await tabTo(current => current.name === "Save and go on");
  await browserPage.keyboard.press("Enter");
  await expect(walk.getByRole("heading", { name: "Here's your page" })).toBeFocused();
  const save = (await calls(browserPage)).find(call => call.name === "savePrivately")!;
  expect(save.args).toMatchObject({ propId: "stack-clay", level: "DAILY", status: "ACTIVE", headline: "Lists start here.", uses: { picks: ["build-lists"] } });
  await noAxeViolations(browserPage);
});

test("no sideways scroll at 320px on a tool screen", async ({ page: browserPage }) => {
  await open(browserPage, NARROW, { seed: seeded });
  const walk = browserPage.getByRole("region", { name: "Go through your tools" });
  await walk.getByRole("button", { name: "Go through your tools one at a time" }).click();
  await walk.getByRole("radiogroup", { name: "How do you use Claude Code?" }).getByRole("radio", { name: "Daily" }).click();
  await walk.getByRole("button", { name: "More" }).click();
  await walk.getByText("Who put you on Claude Code? (optional)").click();
  await noSidewaysScroll(browserPage);
  await noAxeViolations(browserPage);
});

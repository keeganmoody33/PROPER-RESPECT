import { build } from "esbuild";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

let compiled: string;
test.beforeAll(async () => {
  const result = await build({
    stdin: { resolveDir: process.cwd(), contents: `import {createElement} from "react"; import {createRoot} from "react-dom/client"; import {MailboxManagement} from "./components/mailbox-management"; window.saved=[]; createRoot(document.getElementById("root")).render(createElement(MailboxManagement, window.mailboxProps ?? {available:true}));` },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "bounded-picker", setup(builder) {
      builder.onResolve({ filter: /^convex\/react$/ }, () => ({ path: "convex-react", namespace: "synthetic" }));
      builder.onLoad({ filter: /.*/, namespace: "synthetic" }, () => ({ resolveDir: process.cwd(), contents: `
        import {getFunctionName} from "convex/server";
        export function useConvexAuth(){return {isAuthenticated:true,isLoading:false}}
        export function useQuery(reference){return getFunctionName(reference)==="mailboxes:listAccounts" ? (window.mailboxAccounts ?? []) : []}
        export function useMutation(reference){return async args=>{window.saved.push({name:getFunctionName(reference),args});return {}}}
        export function useAction(reference){return async args=>{window.saved.push({name:getFunctionName(reference),args});return window.actionResult ?? {}}}
        export function usePaginatedQuery(reference,args){
          const name=getFunctionName(reference);
          if(name==="inventory:list" && args.includeAccountEvidence!==false) throw new Error("Synthetic proof-heavy query exceeds raw read budget");
          const results=name==="inventory:list"?[{prop:{_id:"github-prop",status:"ACTIVE",headline:"Saved GitHub"},product:{name:"GitHub"}}]:[{id:"retained-header",senderDomain:"example.com",accountLabel:"Synthetic mailbox",capturedAt:"2026-09-21",payload:"Synthetic retained header"}];
          return {results,status:"Exhausted",loadMore:()=>{}};
        }` }));
    } }],
  });
  compiled = result.outputFiles[0].text;
});

test("unmatched retained header can select a product without account-evidence joins", async ({ page }) => {
  const requests: string[] = [];
  await page.route("**/*", route => { requests.push(route.request().url()); return route.abort(); });
  await page.setContent('<main id="root"></main>');
  await page.addScriptTag({ content: compiled });
  await page.getByRole("button", { name: "Review unmatched headers" }).click();
  await page.getByText("example.com · Synthetic mailbox", { exact: true }).click();
  await page.getByRole("combobox", { name: "Attach to a product in your collection" }).selectOption("github-prop");
  await page.getByRole("button", { name: "Attach privately", exact: true }).click();
  await expect(page.getByText("Header evidence attached privately. Your relationship and usage claims are unchanged.")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as {saved:unknown[]}).saved)).toEqual([{name:"mailboxDiscovery:reviewUnknown",args:{id:"retained-header",decision:"LINKED",propId:"github-prop"}}]);
  expect(requests).toEqual([]);
});

for (const width of [1280, 390]) {
  test(`Gmail is offered only to listed testers at ${width}px (R16)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/*", route => route.abort());
    await page.setContent('<main id="root"></main>');
    await page.evaluate(() => { (window as unknown as { mailboxProps: unknown }).mailboxProps = { available: false }; });
    await page.addScriptTag({ content: compiled });
    await expect(page.getByRole("heading", { name: "Gmail discovery" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Gmail account" })).toHaveCount(0);
    await expect(page.getByText("Gmail discovery is open only to invited testers right now.")).toBeVisible();
    await expect(page.getByText(/Use Add Gmail account/)).toHaveCount(0);
    expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.setContent('<main id="root"></main>');
    await page.evaluate(() => { (window as unknown as { mailboxProps: unknown }).mailboxProps = { available: true }; });
    await page.addScriptTag({ content: compiled });
    await expect(page.getByRole("button", { name: "Add Gmail account" })).toBeVisible();
    await expect(page.getByText("Gmail discovery is open only to invited testers right now.")).toHaveCount(0);
  });
}

test("an existing account can't be reconnected when Gmail isn't open to this user (R16)", async ({ page }) => {
  await page.route("**/*", route => route.abort());
  await page.setContent('<main id="root"></main>');
  await page.evaluate(() => {
    const w = window as unknown as { mailboxProps: unknown; mailboxAccounts: unknown };
    w.mailboxProps = { available: false };
    w.mailboxAccounts = [{ accountId: "synthetic-account", provider: "GOOGLE", status: "NEEDS_REAUTH", accountLabel: "Synthetic mailbox", generation: 1, maintenanceEnabled: false, contexts: [] }];
  });
  await page.addScriptTag({ content: compiled });
  await page.getByText("Automatic discovery and account controls").click();
  await expect(page.getByRole("button", { name: "Reconnect this Gmail account" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Disconnect and stop collection" })).toBeVisible();
  await expect(page.locator("article").getByText("Gmail discovery is open only to invited testers right now.")).toBeVisible();

  await page.setContent('<main id="root"></main>');
  await page.evaluate(() => {
    const w = window as unknown as { mailboxProps: unknown; mailboxAccounts: unknown };
    w.mailboxProps = { available: true };
    w.mailboxAccounts = [{ accountId: "synthetic-account", provider: "GOOGLE", status: "NEEDS_REAUTH", accountLabel: "Synthetic mailbox", generation: 1, maintenanceEnabled: false, contexts: [] }];
  });
  await page.addScriptTag({ content: compiled });
  await page.getByText("Automatic discovery and account controls").click();
  await expect(page.getByRole("button", { name: "Reconnect this Gmail account" })).toBeVisible();
});

test("recovery messages don't tell an unlisted user to reconnect (R16)", async ({ page }) => {
  await page.route("**/*", route => route.abort());
  for (const lastFailure of ["REAUTHORIZE", "TEMPORARY"]) {
    await page.setContent('<main id="root"></main>');
    await page.evaluate(failure => {
      const w = window as unknown as { mailboxProps: unknown; mailboxAccounts: unknown };
      w.mailboxProps = { available: false };
      w.mailboxAccounts = [{ accountId: "synthetic-account", provider: "GOOGLE", status: "NEEDS_REAUTH", accountLabel: "Synthetic mailbox", generation: 1, maintenanceEnabled: false, contexts: [], lastFailure: failure }];
    }, lastFailure);
    await page.addScriptTag({ content: compiled });
    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert).not.toContainText(/reconnect/i);
    await expect(alert).toContainText("Your retained evidence");
  }
});

test("a failed discovery run doesn't tell an unlisted user to reconnect either (R16)", async ({ page }) => {
  await page.route("**/*", route => route.abort());
  const render = async (available: boolean) => {
    await page.setContent('<main id="root"></main>');
    await page.evaluate(isAvailable => {
      const w = window as unknown as { mailboxProps: unknown; mailboxAccounts: unknown };
      w.mailboxProps = { available: isAvailable };
      w.mailboxAccounts = [{
        accountId: "synthetic-account", provider: "GOOGLE", status: "NEEDS_REAUTH", accountLabel: "Synthetic mailbox", generation: 1,
        maintenanceEnabled: false, contexts: [], lastFailure: "REAUTHORIZE",
        discoveryRun: { id: "synthetic-run", status: "FAILED", failure: "REAUTHORIZE", phase: "KNOWN_PRODUCTS", phaseAttempts: 3, totalAttempts: 3,
          pagesRead: 1, messagesRead: 5, retainedRecords: 2, maxAttemptsPerPhase: 100, maxHeaders: 1000, updatedAt: "2026-09-19T12:00:00Z" },
      }];
    }, available);
    await page.addScriptTag({ content: compiled });
    await page.getByText("Automatic discovery and account controls").click();
  };
  await render(false);
  const card = page.locator("article");
  await expect(card.getByText("Google access expired or was revoked.", { exact: false }).first()).toBeVisible();
  await expect(card).not.toContainText(/reconnect/i);
  await render(true);
  await expect(page.getByText("Reconnect this Gmail account before starting another run.")).toBeVisible();
});

test("a failed-authorization notice doesn't invite an unlisted user to try again (R16)", async ({ page }) => {
  await page.route("**/*", route => route.request().url().startsWith("http://synthetic.test/")
    ? route.fulfill({ contentType: "text/html", body: '<main id="root"></main>' }) : route.abort());
  for (const available of [false, true]) {
    await page.goto("http://synthetic.test/onboarding?gmail=failed");
    await page.evaluate(isAvailable => { (window as unknown as { mailboxProps: unknown }).mailboxProps = { available: isAvailable }; }, available);
    await page.addScriptTag({ content: compiled });
    const notice = page.getByRole("status").filter({ hasText: "Gmail authorization did not complete." });
    await expect(notice).toBeVisible();
    if (available) await expect(notice).toContainText("Start a new connection attempt.");
    else {
      await expect(notice).not.toContainText(/new connection attempt|reconnect/i);
      await expect(notice).toContainText("Gmail discovery is open only to invited testers right now.");
    }
  }
});

test("Disconnect asks the backend to revoke the Google grant and reports a failed revocation honestly (R17)", async ({ page }) => {
  await page.route("**/*", route => route.abort());
  const render = async (actionResult: unknown, lastRevocation?: unknown) => {
    await page.setContent('<main id="root"></main>');
    await page.evaluate(([result, revocation]) => {
      const w = window as unknown as { mailboxAccounts: unknown; actionResult: unknown };
      w.actionResult = result;
      w.mailboxAccounts = [{ accountId: "synthetic-account", provider: "GOOGLE", status: revocation ? "DISCONNECTED" : "CONNECTED", accountLabel: "Synthetic mailbox", generation: 3,
        maintenanceEnabled: false, contexts: [], ...(revocation ? { lastRevocation: revocation } : {}) }];
    }, [actionResult, lastRevocation]);
    await page.addScriptTag({ content: compiled });
    await page.getByText("Automatic discovery and account controls").click();
  };
  await render({ disconnected: true, generation: 4, revocation: "REVOKED" });
  await expect(page.getByText("Disconnecting also asks Google to revoke this app's access.", { exact: false })).toBeVisible();
  await expect(page.getByText("You can also revoke this app in your Google account permissions.")).toHaveCount(0);
  await page.getByRole("button", { name: "Disconnect and stop collection" }).click();
  await expect(page.getByRole("status")).toContainText("Google confirmed that this app's access was revoked.");
  expect(await page.evaluate(() => (window as unknown as { saved: unknown[] }).saved)).toEqual([
    { name: "mailboxGoogle:disconnectAndRevoke", args: { accountId: "synthetic-account", expectedGeneration: 3 } },
  ]);

  await render({ disconnected: true, generation: 4, revocation: "FAILED" });
  await page.getByRole("button", { name: "Disconnect and stop collection" }).click();
  await expect(page.getByRole("status")).toContainText("Google did not confirm the revocation.");
  await expect(page.getByRole("status")).toContainText("Google Account permissions");

  await render({ disconnected: false, reason: "GENERATION_CHANGED" });
  await page.getByRole("button", { name: "Disconnect and stop collection" }).click();
  await expect(page.getByRole("status")).toContainText("This account's connection changed while disconnecting");

  await render({}, { outcome: "FAILED", at: "2026-09-28T12:00:00.000Z" });
  await expect(page.getByRole("alert")).toContainText("Google did not confirm that this app's access was revoked. You can still revoke it in your Google Account permissions.");
});

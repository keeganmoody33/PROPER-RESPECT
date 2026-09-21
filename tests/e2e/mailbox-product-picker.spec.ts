import { build } from "esbuild";
import { expect, test } from "@playwright/test";

let compiled: string;
test.beforeAll(async () => {
  const result = await build({
    stdin: { resolveDir: process.cwd(), contents: `import {createElement} from "react"; import {createRoot} from "react-dom/client"; import {MailboxManagement} from "./components/mailbox-management"; window.saved=[]; createRoot(document.getElementById("root")).render(createElement(MailboxManagement));` },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "bounded-picker", setup(builder) {
      builder.onResolve({ filter: /^convex\/react$/ }, () => ({ path: "convex-react", namespace: "synthetic" }));
      builder.onLoad({ filter: /.*/, namespace: "synthetic" }, () => ({ resolveDir: process.cwd(), contents: `
        import {getFunctionName} from "convex/server";
        export function useConvexAuth(){return {isAuthenticated:true,isLoading:false}}
        export function useQuery(){return []}
        export function useMutation(reference){return async args=>{window.saved.push({name:getFunctionName(reference),args});return {}}}
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

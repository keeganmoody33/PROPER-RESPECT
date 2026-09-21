import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

let compiled: string;
test.beforeAll(async () => {
  const result = await build({
    stdin: { resolveDir: process.cwd(), contents: `
      import {createElement} from "react"; import {createRoot} from "react-dom/client";
      import {AccountEvidence} from "./components/account-evidence";
      import {privateCardPrimaryLink,offeredPrivatePublicationLink} from "./src/domain/product-destination";
      const product={name:"GitHub",slug:"github",domain:"github.com"};
      createRoot(document.getElementById("root")).render(createElement(AccountEvidence,{propId:"synthetic",productSlug:"github"},(evidence,progress)=>{
        const input={product,links:[],associatedEvidence:evidence};
        const offer=offeredPrivatePublicationLink(input);
        const selected=privateCardPrimaryLink({...input,links:[{type:"REFERRAL",url:"https://example.com/my-referral",label:"Selected",isPrimary:true}]});
        return createElement("section",null, createElement("h1",null,"Private GitHub card"),progress,
          createElement("a",{href:privateCardPrimaryLink(input).url},"Open GitHub"),
          createElement("a",{href:selected.url},"Owner-selected destination"),
          offer&&createElement("button",null,"Use "+offer.url+" in sharing preview"));
      }));` },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "synthetic-query", setup(builder) {
      builder.onResolve({ filter: /^convex\/react$/ }, () => ({ path: "convex-react", namespace: "synthetic" }));
      builder.onLoad({ filter: /.*/, namespace: "synthetic" }, () => ({ resolveDir: process.cwd(), contents: `
        import {useState,useCallback} from "react";
        export function usePaginatedQuery(){
          const [count,setCount]=useState(3);
          if(window.failLookup) throw new Error("PRIVATE_SYNTHETIC_DIAGNOSTIC");
          const loadMore=useCallback(n=>{window.requests=(window.requests||[]).concat(n);setCount(c=>Math.min(33,c+n))},[]);
          const results=Array.from({length:count},(_,i)=>({connected:false,candidate:{sourceDay:i===32?"2026-09-21":"2020-01-01",accountKey:String(i),evidence:{relationshipOwnerId:"owner",evidenceOwnerId:"owner",productSlug:"github",accountId:i===32?"newest":"historical"}}}));
          return {results,status:count===33?"Exhausted":"CanLoadMore",loadMore};
        }` }));
    } }],
  });
  compiled = result.outputFiles[0].text;
});

for (const width of [1280, 390]) test(`partial account coverage cannot replace a link or become a sharing offer at ${width}px`, async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width, height: 900 });
  await page.setContent('<main id="root"></main>');
  await page.addStyleTag({ content: readFileSync("app/globals.css", "utf8") });
  await page.addScriptTag({ content: compiled });
  await expect(page.getByRole("status")).toContainText("incomplete: 30 retained records checked");
  await expect(page.getByRole("link", { name: "Open GitHub", exact: true })).toHaveAttribute("href", "https://github.com");
  await expect(page.getByRole("button", { name: /in sharing preview/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Owner-selected destination" })).toHaveAttribute("href", "https://example.com/my-referral");
  await page.screenshot({ path: testInfo.outputPath(`2026-09-21-account-partial-${width}.png`), fullPage: true });
  await page.getByRole("button", { name: "Check 30 more retained records" }).click();
  await expect(page.getByRole("status")).toContainText("complete: 33 retained records checked");
  await expect(page.getByRole("link", { name: "Open GitHub", exact: true })).toHaveAttribute("href", "https://github.com/newest");
  await expect(page.getByRole("button", { name: "Use https://github.com/newest in sharing preview" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Owner-selected destination" })).toHaveAttribute("href", "https://example.com/my-referral");
  expect(await page.evaluate(() => (window as unknown as {requests:number[]}).requests)).toEqual([3,3,3,3,3,3,3,3,3,3]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath(`2026-09-21-account-complete-${width}.png`), fullPage: true });
});


test("failed account lookup keeps links usable and retries without exposing diagnostics", async ({ page }) => {
  await page.setContent('<main id="root"></main>');
  await page.evaluate(() => { (window as unknown as {failLookup:boolean}).failLookup = true; });
  await page.addScriptTag({ content: compiled });
  await expect(page.getByText("Account lookup is unavailable. Your saved links and collection are unchanged.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Owner-selected destination" })).toHaveAttribute("href", "https://example.com/my-referral");
  await expect(page.locator("body")).not.toContainText("PRIVATE_SYNTHETIC_DIAGNOSTIC");
  await page.evaluate(() => { (window as unknown as {failLookup:boolean}).failLookup = false; });
  await page.getByRole("button", { name: "Retry account lookup" }).click();
  await expect(page.getByRole("status")).toContainText("incomplete: 30 retained records checked");
  await page.getByRole("button", { name: "Check 30 more retained records" }).click();
  await expect(page.getByRole("link", { name: "Open GitHub", exact: true })).toHaveAttribute("href", "https://github.com/newest");
});

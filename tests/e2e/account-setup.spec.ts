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

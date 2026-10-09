/// <reference types="vite/client" />
import { readFile, mkdir } from "node:fs/promises";
import { build } from "esbuild";
import { convexTest } from "convex-test";
import { makeFunctionReference, type FunctionArgs, type FunctionReturnType } from "convex/server";
import type { Value } from "convex/values";
import { chromium, expect as browserExpect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";
import { canonicalJson } from "../../src/domain/canonical-json";
import { digest, evidenceKey, type NumericEvidence } from "../../src/domain/usage-sync";

// Clerk is synthetic; all collection reads, private saves, reviews, previews and
// publications below run the actual Convex functions against an isolated store.
// The local browser bridge does not authenticate a hosted session or read a device.
const browserBoundary = `
  import {useEffect,useMemo,useState,useSyncExternalStore} from "react";
  import {getFunctionName} from "convex/server";
  let revision=0;const listeners=new Set();
  const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn)};
  const snapshot=()=>revision;
  async function call(kind,name,args){
    const response=await fetch("/fixture-rpc",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind,name,args})});
    const result=await response.json();if(!response.ok)throw Error(result.error);
    if(kind!=="query"){revision++;listeners.forEach(fn=>fn())}return result;
  }
  const client={query:(ref,args)=>call("query",getFunctionName(ref),args),mutation:(ref,args)=>call("mutation",getFunctionName(ref),args)};
  export const useConvex=()=>client;
  export const useConvexAuth=()=>({isAuthenticated:true,isLoading:false});
  function useCall(kind,ref){const name=getFunctionName(ref);return useMemo(()=>args=>call(kind,name,args),[kind,name])}
  export const useMutation=ref=>useCall("mutation",ref);
  export const useAction=ref=>useCall("action",ref);
  export function useQuery(ref,args){
    const version=useSyncExternalStore(subscribe,snapshot,snapshot),name=getFunctionName(ref),key=JSON.stringify(args);
    const [value,setValue]=useState(undefined);
    useEffect(()=>{let active=true;call("query",name,JSON.parse(key)).then(value=>{if(active)setValue(value)}).catch(error=>{window.fixtureErrors.push(error.message)});return()=>{active=false}},[name,key,version]);
    return value;
  }
  export function usePaginatedQuery(ref,args,options){
    const [count,setCount]=useState(options.initialNumItems);
    const value=useQuery(ref,{...args,paginationOpts:{numItems:count,cursor:null}});
    return {results:value?.page??[],status:value===undefined?"LoadingFirstPage":value.isDone?"Exhausted":"CanLoadMore",loadMore:amount=>setCount(n=>n+amount)};
  }
`;

// The component Playwright suite enables this bridge after Chromium is installed.
test.runIf(process.env.PROPER_RESPECT_SNAPSHOT_BROWSER === "1").each([1280, 390])("private snapshot reaches an exact approved public copy through real backend functions at %ipx", async width => {
  const t = convexTest(schema, import.meta.glob("../../convex/**/*.ts"));
  const owner = t.withIdentity({ subject: "snapshot-browser-owner" });
  const sourceId = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { authSubject: "snapshot-browser-owner", handle: "snapshot-owner", displayName: "Synthetic snapshot owner", bio: "" });
    await ctx.db.insert("products", { name: "Codex", slug: "codex", domain: "openai.com", description: "Synthetic retained source fixture" });
    const sourceId = await ctx.db.insert("usageSources", { userId, sourceKey: "a".repeat(64), deviceDigest: "b".repeat(64), context: "personal", retainOnDisconnect: true });
    const scope = { sourceKey: "a".repeat(64), deviceDigest: "b".repeat(64), context: "personal", accountIdentity: "unverified", provider: "codex", start: "2026-10-01T00:00:00.000Z", end: "2026-10-20T00:00:00.000Z", expiresAt: "2026-10-20T00:00:00.000Z", retainOnDisconnect: true, destination: "https://utmost-mongoose-374.convex.cloud" };
    const grantId = await ctx.db.insert("usageGrants", { userId, sourceId, scopeJson: JSON.stringify(scope), codeDigest: "c".repeat(64), deviceDigest: "b".repeat(64), pairExpiresAt: 0, expiresAt: Date.parse(scope.expiresAt), state: "active", sequence: 1 });
    await ctx.db.patch(sourceId, { currentGrantId: grantId });
    for (const [response, at, value] of [["d", "2026-10-02", "9007199254740993"], ["e", "2026-10-07", "2"], ["f", "2026-10-09", "7"]]) {
      const row: NumericEvidence = { kind: "response", thread: "c".repeat(64), response: response.repeat(64), at: `${at}T12:00:00.000Z`, status: "measured",
        counts: { input_tokens: value, total_tokens: value, cached_input_tokens: "0", output_tokens: "0", reasoning_output_tokens: "0", cache_write_input_tokens: null } };
      const rowJson = canonicalJson(row);
      await ctx.db.insert("usageEvidence", { sourceId, key: evidenceKey(row), fingerprint: digest(rowJson), rowJson });
    }
    return sourceId;
  });
  const compiled = await build({
    stdin: { contents: `import {createElement} from "react";import {createRoot} from "react-dom/client";import {UsageConnectionsClient} from "./components/usage-connections-client";import {OnboardingClient} from "./components/onboarding-client";window.fixtureErrors=[];createRoot(document.getElementById("root")).render(createElement(location.pathname==="/app/collection"?OnboardingClient:UsageConnectionsClient));`, resolveDir: process.cwd() },
    bundle: true, write: false, outfile: "snapshot-backend-fixture.js", platform: "browser", format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "synthetic-session-real-backend", setup(builder) {
      builder.onResolve({ filter: /^(@clerk\/nextjs|convex\/react)$/ }, args => ({ path: args.path, namespace: "snapshot-fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "snapshot-fixture" }, args => ({ resolveDir: process.cwd(), loader: "js", contents: args.path === "convex/react" ? browserBoundary : `
        const user={id:"snapshot-browser-owner",fullName:"Synthetic snapshot owner",imageUrl:"",externalAccounts:[]};
        export const Show=({children})=>children;export const SignInButton=({children})=>children;export const UserButton=()=>null;
        export const useUser=()=>({user});export const useAuth=()=>({isLoaded:true,isSignedIn:true,userId:user.id,getToken:async()=>null,sessionClaims:{}});export const useClerk=()=>({openUserProfile:()=>{}});
      ` }));
    } }],
  });
  const script = compiled.outputFiles.find(file => file.path.endsWith(".js"))!.text;
  const css = compiled.outputFiles.find(file => file.path.endsWith(".css"))?.text ?? "";
  const html = `<html lang="en"><head><title>Synthetic snapshot journey</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>${await readFile("app/globals.css", "utf8")}\n${css}</style></head><body><main id="root"></main><script>${script.replaceAll("</script", "<\\/script")}</script></body></html>`;
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  const page = await context.newPage();
  const requests: { kind: string; name: string; args: Record<string, Value> }[] = [];
  let loseSaveResponse = true, saved: FunctionReturnType<typeof api.retainedEvidence.saveUsageSnapshot> | undefined;
  const artifacts = "test-results/usage-snapshot-backend";
  await mkdir(artifacts, { recursive: true });
  try {
    await page.route("**/*", async route => {
      if (!route.request().url().startsWith("http://127.0.0.1:8885/")) { await route.abort(); return; }
      if (!route.request().url().endsWith("/fixture-rpc")) { await route.fulfill({ contentType: "text/html", body: html }); return; }
      const request = route.request().postDataJSON() as { kind: "query" | "mutation" | "action"; name: string; args: Record<string, Value> };
      requests.push(request);
      try {
        let result: unknown;
        if (request.kind === "query") {
          result = await owner.query(makeFunctionReference<"query">(request.name), request.args);
          // Optional brand/mailbox integrations are outside this isolated journey.
          if (request.name === "onboarding:getState") result = { ...(result as object), brandEnrichmentAvailable: false, mailboxAvailable: false };
        } else if (request.kind === "action" && request.name === "retainedEvidence:saveUsageSnapshot") {
          saved = await owner.action(api.retainedEvidence.saveUsageSnapshot, request.args as FunctionArgs<typeof api.retainedEvidence.saveUsageSnapshot>);
          if (loseSaveResponse) { loseSaveResponse = false; throw Error("Synthetic lost save response"); }
          result = saved;
        } else if (request.kind === "mutation" && ["onboarding:ensureAccount", "inventory:save", "retainedEvidence:reviewMeasurements", "onboarding:claimHandle", "onboarding:publishSelected"].includes(request.name)) {
          result = await owner.mutation(makeFunctionReference<"mutation">(request.name), request.args);
        } else throw Error("Operation outside this fixture");
        await route.fulfill({ json: result });
      } catch (error) { await route.fulfill({ status: 400, json: { error: error instanceof Error ? error.message : "Synthetic backend request failed" } }); }
    });
    await page.goto("http://127.0.0.1:8885/connections");
    await page.getByRole("button", { name: "View private usage", exact: true }).click();
    const snapshot = page.getByRole("region", { name: "Save a private usage snapshot", exact: true });
    await snapshot.getByLabel("Snapshot starts, UTC", { exact: true }).fill("2026-10-01");
    await snapshot.getByLabel("Snapshot ends, UTC (inclusive)", { exact: true }).fill("2026-10-07");
    expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toEqual([]);
    await snapshot.getByRole("button", { name: "Save private snapshot", exact: true }).click();
    await browserExpect(snapshot.getByRole("alert")).toContainText("could not be confirmed");
    expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toHaveLength(1);
    await snapshot.getByRole("button", { name: "Save private snapshot", exact: true }).click();
    await browserExpect(snapshot.getByRole("status")).toContainText("already saved privately");
    expect(saved?.replayed).toBe(true);
    expect(requests.filter(request => request.kind === "action").map(request => request.args)).toEqual(Array.from({ length: 2 }, () => ({ sourceId, start: "2026-10-01T00:00:00.000Z", end: "2026-10-08T00:00:00.000Z" })));
    expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toHaveLength(1);
    expect(await t.run(ctx => ctx.db.query("props").collect())).toMatchObject([{ visibility: "DRAFT" }]);
    expect(await t.run(ctx => ctx.db.query("publishedProfiles").collect())).toEqual([]);
    await snapshot.screenshot({ path: `${artifacts}/saved-${width}.png` });
    await snapshot.getByRole("link", { name: "Configure saved private card", exact: true }).click();
    const measurements = page.getByRole("region", { name: "Your private usage result", exact: true });
    await browserExpect(measurements.getByText("9007199254740995", { exact: true }).first()).toBeVisible();
    await browserExpect(measurements).toContainText("Sum of distinct response counters");
    await browserExpect(measurements).toContainText("2026-10-01 to 2026-10-07 · UTC");
    await browserExpect(measurements.getByText("Unknown", { exact: true })).toBeVisible();
    expect(await measurements.getByRole("checkbox").evaluateAll(inputs => inputs.every(input => !(input as HTMLInputElement).checked))).toBe(true);
    expect(requests.filter(request => request.name === "retainedEvidence:measurements").every(request => request.args.measurementVersion === 2)).toBe(true);
    await measurements.getByRole("checkbox", { name: "Review Total tokens 9007199254740995", exact: true }).check();
    await measurements.getByRole("button", { name: "Save measurement choices privately", exact: true }).click();
    await browserExpect(measurements).toContainText("Saved review: 1 measurements selected.");
    const relationship = page.getByRole("region", { name: "Codex", exact: true });
    await relationship.getByRole("combobox", { name: "How it fits", exact: true }).selectOption("ACTIVE");
    await relationship.getByRole("button", { name: "Confirm and save privately", exact: true }).click();
    await page.getByRole("link", { name: "Set up your public identity", exact: true }).click();
    const identity = page.locator("#collection-profile");
    await identity.getByLabel("Handle", { exact: true }).fill("snapshot-owner");
    await identity.getByRole("button", { name: "Save public identity", exact: true }).click();
    const review = page.getByRole("group", { name: "Codex review", exact: true });
    await review.getByLabel("Share this saved card", { exact: true }).check();
    await review.getByRole("checkbox", { name: /Include 1 reviewed measurements/ }).check();
    await page.getByRole("button", { name: "Preview sharing", exact: true }).click();
    const preview = page.getByRole("region", { name: "Your visitor’s view", exact: true });
    await browserExpect(preview.getByText("9007199254740995", { exact: true }).first()).toBeVisible();
    await browserExpect(preview).toContainText("Sum of distinct response counters");
    await browserExpect(preview).toContainText("Account identity is not authenticated");
    await browserExpect(preview).not.toContainText("connected-personal");
    await browserExpect(preview).not.toContainText("a".repeat(64));
    await browserExpect(preview.getByRole("button", { name: "Publish this preview", exact: true })).toBeDisabled();
    expect(await t.run(ctx => ctx.db.query("publishedProfiles").collect())).toEqual([]);
    expect((await new AxeBuilder({ page }).include(".sharing-preview").analyze()).violations).toEqual([]);
    await preview.screenshot({ path: `${artifacts}/preview-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await preview.getByRole("checkbox").check();
    await preview.getByRole("button", { name: "Publish this preview", exact: true }).click();
    await browserExpect(page.getByRole("status").filter({ hasText: "Your approved preview is now shared." })).toBeVisible();
    const published = await t.query(makeFunctionReference<"query">("publicProfiles:getByHandleV2"), { handle: "snapshot-owner", measurementVersion: 2 });
    expect(published.cards[0].measurements).toMatchObject([{ value: "9007199254740995", derivation: "SUMMED_RESPONSES" }]);
    expect(requests.filter(request => ["onboarding:previewPublication", "onboarding:publishSelected"].includes(request.name)).every(request => request.args.measurementVersion === 2)).toBe(true);
    expect(await page.evaluate(() => (window as unknown as { fixtureErrors: string[] }).fixtureErrors)).toEqual([]);
  } finally { await browser.close(); }
}, 90_000);

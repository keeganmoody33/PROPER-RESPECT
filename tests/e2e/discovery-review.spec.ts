import { readFileSync } from "node:fs";
import { buildSync } from "esbuild";
import { expect, test } from "@playwright/test";

const compiled = buildSync({
  stdin: {
    contents: `import {createElement, useState} from "react"; import {createRoot} from "react-dom/client"; import {DiscoveryResolutionView} from "./components/discovery-review";
      const initial = {id:"synthetic-draft",name:"GitHub",sources:[{id:"synthetic-original",sourceType:"GITHUB",sourceLabel:"Synthetic personal GitHub",capturedAt:"2026-09-19T00:00:00.000Z",deleted:false}],batch:{offset:0,end:100,total:150,skippedDeleted:0},target:null};
      const choices = [{id:"work",headline:"Work record",note:"Synthetic work explanation",status:"ACTIVE",confirmed:true,goTo:false,expectedHash:"work-v1"},{id:"personal",headline:"Personal record",note:"Synthetic personal explanation",status:"TESTING",confirmed:true,goTo:true,expectedHash:"personal-v1"}];
      window.syntheticRequests=[];
      function Fixture(){
        const [detail,setDetail]=useState(initial); const [candidates,setCandidates]=useState(choices); const [fail,setFail]=useState(false);
        return createElement("section",null,
          createElement("h1",null,"Synthetic private discovery review"),
          createElement("p",null,"Local component fixture. No account, original evidence, or hosted mutation is used."),
          createElement("button",{onClick:()=>setCandidates(current=>current.map(item=>({...item,expectedHash:item.expectedHash+"-changed"})))},"Simulate changed relationship"),
          createElement("button",{onClick:()=>setFail(true)},"Reject next synthetic attachment"),
          createElement(DiscoveryResolutionView,{detail,candidates,hasMoreCandidates:false,loadingMore:false,onLoadMore:()=>{},onAttach:async request=>{
            window.syntheticRequests.push(request);
            if(fail){setFail(false);throw new Error("This discovery or relationship changed. Review the current information before attaching.");}
            const target=detail.target??candidates.find(item=>item.id===request.propId); const processed=Math.min(detail.batch.offset+100,150);
            setDetail({...detail,target,expectedHash:"resume-v2",batch:{offset:processed,end:150,total:150,skippedDeleted:1}});setCandidates([]);
            return {duplicate:false,processed,total:150,skippedDeleted:1};
          }}));
      }
      createRoot(document.getElementById("root")).render(createElement(Fixture));`,
    resolveDir: process.cwd(),
  },
  bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
});

for (const width of [1280, 390]) test(`explicit discovery choice, stale error and bounded continuation at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  const requests: string[] = [];
  const errors: string[] = [];
  await page.route("**/*", route => { requests.push(route.request().url()); return route.abort(); });
  page.on("pageerror", error => errors.push(error.message));
  await page.setContent('<main id="root"></main>');
  await page.addStyleTag({ content: readFileSync("app/globals.css", "utf8") });
  await page.addScriptTag({ content: compiled.outputFiles[0].text });
  const choice = page.getByRole("combobox", { name: "Existing relationship" });
  const attach = page.getByRole("button", { name: "Attach originals 1–100 privately" });
  await expect(choice).toHaveValue("");
  await expect(attach).toBeDisabled();
  await choice.selectOption("personal");
  await expect(attach).toBeEnabled();
  expect(await page.evaluate(() => (window as unknown as { syntheticRequests: unknown[] }).syntheticRequests)).toEqual([]);
  await page.getByRole("button", { name: "Simulate changed relationship" }).click();
  await expect(choice).toHaveValue("");
  await expect(attach).toBeDisabled();
  await expect(page.getByText("The selected record changed. Review it and choose again.")).toBeVisible();
  await choice.selectOption("personal");
  await page.getByRole("button", { name: "Reject next synthetic attachment" }).click();
  await attach.click();
  await expect(page.getByText("This discovery or relationship changed. Review the current information before attaching.")).toBeVisible();
  await expect(page.getByText("0 of 150 reviewed originals processed. 0 deleted originals excluded.")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(`2026-09-19-discovery-stale-${width}.png`), fullPage: true });
  await attach.click();
  await expect(choice).toHaveCount(0);
  await expect(page.getByText("Chosen relationship:", { exact: false })).toContainText("Personal record");
  const continueButton = page.getByRole("button", { name: "Continue attachment (101–150)" });
  await expect(continueButton).toBeEnabled();
  await expect(page.getByText("100 of 150 reviewed originals processed. 1 deleted originals excluded.")).toBeVisible();
  await page.getByText("Originals in this attachment step (1)", { exact: true }).click();
  await expect(page.getByText("Synthetic personal GitHub · GITHUB", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`2026-09-19-discovery-continue-${width}.png`), fullPage: true });
  await continueButton.click();
  await expect(page.getByRole("button", { name: "Attachment complete" })).toBeDisabled();
  expect(await page.evaluate(() => (window as unknown as { syntheticRequests: unknown[] }).syntheticRequests)).toEqual([
    { draftId: "synthetic-draft", propId: "personal", expectedHash: "personal-v1-changed" },
    { draftId: "synthetic-draft", propId: "personal", expectedHash: "personal-v1-changed" },
    { draftId: "synthetic-draft", propId: "personal", expectedHash: "resume-v2" },
  ]);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

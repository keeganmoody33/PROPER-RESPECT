import { readFileSync } from "node:fs";
import { buildSync } from "esbuild";
import { expect, test } from "@playwright/test";

const bundle = buildSync({
  stdin: { contents: `import {createElement,useState,useRef} from 'react'; import {createRoot} from 'react-dom/client'; import {RetainedMailboxRecheck} from './components/retained-mailbox-recheck';
    function Fixture(){const [calls,setCalls]=useState([]);const failed=useRef(false);
      const recheck=async cursor=>{setCalls(v=>[...v,cursor??'FIRST']);if(cursor==='page-two'&&!failed.current){failed.current=true;throw Error('synthetic failure');}
        return {continueCursor:'page-two',isDone:cursor!==null,examined:cursor?2:10,matched:cursor?1:4,createdDrafts:cursor?0:2,alreadyClassified:cursor?1:0,unmatched:cursor?1:6,skipped:0,ambiguousProducts:cursor?[]:[{productSlug:'github',reason:'MULTIPLE_OWNER_RELATIONSHIPS'}]};};
      return createElement('main',{className:'onboarding-shell'},createElement('div',{className:'connector-card'},createElement(RetainedMailboxRecheck,{onRecheck:recheck}),createElement('output',{'aria-label':'Synthetic calls'},calls.join(','))));}
    createRoot(document.getElementById('root')).render(createElement(Fixture));`, resolveDir: process.cwd() },
  bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
});

for (const width of [390, 1280]) test(`retained-only recheck is explicit, resumable and keyboard accessible at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.setContent('<div id="root"></div>');
  await page.addStyleTag({ content: readFileSync("app/globals.css", "utf8") });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await expect(page.getByRole("status", { name: "Synthetic calls" })).toHaveText("");
  await expect(page.getByText("No new mail is read", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Recheck retained headers", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("10 retained headers checked", { exact: false })).toBeVisible();
  await expect(page.getByText("2 new private candidates", { exact: false })).toBeVisible();
  await expect(page.getByText("github: choose between existing records", { exact: false })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveText("Could not recheck this page. Retry it; saved evidence and relationship choices are unchanged.");
  await page.getByRole("button", { name: "Continue retained recheck", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("12 retained headers checked", { exact: false })).toBeVisible();
  await expect(page.getByText("Retained recheck reached its final page", { exact: false })).toBeVisible();
  await expect(page.getByRole("status", { name: "Synthetic calls" })).toHaveText("FIRST,page-two,page-two");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`2026-09-19-retained-recheck-${width}.png`), fullPage: true });
});

test("one explicit retained recheck stops at 100 pages and continues from the saved cursor", async ({ page }) => {
  const capBundle = buildSync({
    stdin: { contents: `import {createElement,useState} from 'react'; import {createRoot} from 'react-dom/client'; import {RetainedMailboxRecheck} from './components/retained-mailbox-recheck';
      function Fixture(){const [calls,setCalls]=useState(0);return createElement('main',null,createElement(RetainedMailboxRecheck,{onRecheck:async cursor=>{setCalls(v=>v+1);const next=Number(cursor??0)+1;return {continueCursor:String(next),isDone:next===101,examined:10,matched:0,createdDrafts:0,alreadyClassified:0,unmatched:10,skipped:0,ambiguousProducts:[]};}}),createElement('output',{'aria-label':'Synthetic calls'},calls));}
      createRoot(document.getElementById('root')).render(createElement(Fixture));`, resolveDir: process.cwd() },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
  });
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ content: capBundle.outputFiles[0].text });
  await page.getByRole("button", { name: "Recheck retained headers", exact: true }).click();
  await expect(page.getByRole("status", { name: "Synthetic calls" })).toHaveText("100");
  await expect(page.getByText("Recheck is partial.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Continue retained recheck" }).click();
  await expect(page.getByRole("status", { name: "Synthetic calls" })).toHaveText("101");
  await expect(page.getByText("Retained recheck reached its final page.", { exact: false })).toBeVisible();
});

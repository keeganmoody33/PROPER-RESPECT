import { readFileSync } from "node:fs";
import { buildSync } from "esbuild";
import { expect, test } from "@playwright/test";

const bundle = buildSync({
  stdin: { contents: `import {createElement,useState} from 'react'; import {createRoot} from 'react-dom/client'; import {MailboxDiscoveryRun,MailboxConnectionNotice} from './components/mailbox-discovery-run';
  function Fixture(){
    const [run,setRun]=useState(null); const [calls,setCalls]=useState([]);
    const start=()=>{setCalls(v=>[...v,'START']);setRun({id:'synthetic-run',status:'RUNNING',phase:'KNOWN_PRODUCTS',phaseAttempts:3,totalAttempts:3,pagesRead:2,messagesRead:10,retainedRecords:6,maxAttemptsPerPhase:100,maxHeaders:1000,updatedAt:'2026-09-19T12:00:00Z'});};
    const control=action=>{setCalls(v=>[...v,action]);setRun(v=>({...v,status:action==='PAUSE'?'PAUSED':action==='RESUME'?'RUNNING':'CANCELLED'}));};
    return createElement('main',{className:'onboarding-shell'},createElement('div',{className:'connector-card'},
      createElement(MailboxConnectionNotice,{loading:false,gmailCount:0,connectedCount:0}),
      createElement(MailboxDiscoveryRun,{run,connected:true,busy:false,onStart:start,onControl:control}),
      createElement('output',{'aria-label':'Synthetic actions'},calls.join(','))));
  } createRoot(document.getElementById('root')).render(createElement(Fixture));`, resolveDir: process.cwd() },
  bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
});

for (const width of [390, 1280]) test(`discovery owner controls remain usable at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.setContent('<div id="root"></div>');
  await page.addStyleTag({ content: readFileSync("app/globals.css", "utf8") });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await expect(page.getByText("Signing in with Google", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Start bounded background discovery", exact: true }).click();
  await expect(page.getByText("Discovery is running in the background.", { exact: false })).toBeVisible();
  await expect(page.getByText("10 headers examined across 2 successful pages", { exact: false })).toBeVisible();
  await page.getByText("Search limits", { exact: true }).click();
  await expect(page.getByText("15 of 1000 header-attempt budget used", { exact: false })).toBeVisible();
  await expect(page.getByText("The 1,000 header-attempt cap includes failed attempts and retries.", { exact: false })).toBeVisible();
  await page.getByText("Search limits", { exact: true }).click();
  await page.getByRole("button", { name: "Pause discovery", exact: true }).click();
  await expect(page.getByText("Discovery is paused.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start another bounded discovery run" })).toHaveCount(0);
  await page.getByRole("button", { name: "Resume discovery", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Cancel discovery", exact: true }).click();
  await expect(page.getByText("Discovery is cancelled.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start another bounded discovery run" })).toBeEnabled();
  await expect(page.getByRole("status", { name: "Synthetic actions" })).toHaveText("START,PAUSE,RESUME,CANCEL");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`2026-09-19-discovery-controls-${width}.png`), fullPage: true });
});

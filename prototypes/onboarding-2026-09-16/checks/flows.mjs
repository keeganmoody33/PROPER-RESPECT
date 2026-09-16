import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url).pathname;
await fs.mkdir(`${root}checks/artifacts`, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const report = { date: '2026-09-16', cases: [], errors: [], accessibility: [], network: [] };
async function overflow(page, label) {
  const metrics = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, modal: [...document.querySelectorAll('dialog[open]')].map(d => ({ client: d.clientWidth, scroll: d.scrollWidth })) }));
  assert(metrics.scroll <= metrics.width, `${label}: page overflow ${JSON.stringify(metrics)}`);
  assert(metrics.modal.every(m => m.scroll <= m.client), `${label}: modal overflow`);
  report.cases.push(`${label}: no horizontal overflow`);
}
async function axe(page, label) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  report.accessibility.push({ label, violations: result.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.map(n => ({ html: n.html, summary: n.failureSummary })) })) });
}
async function connect(page, provider, email) {
  await page.getByRole('button', { name: new RegExp(`^${provider} `) }).click();
  await page.getByRole('button', { name: new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).click();
  await page.getByRole('button', { name: 'Allow sample read access' }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
}
try {
 for (const variant of ['studio','collection']) {
  for (const viewport of [{ width: 1440, height: 1060 }, { width: 390, height: 844 }]) {
   const label = `${variant}-${viewport.width}`;
   const context = await browser.newContext({ viewport, colorScheme: 'light', reducedMotion: 'reduce' });
   const page = await context.newPage();
   page.on('pageerror', error => report.errors.push(error.message));
   page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4319') && !request.url().startsWith('data:')) report.network.push(request.url()); });
   await page.goto(`http://127.0.0.1:4319/?view=${variant}`);
   await page.evaluate(() => document.fonts.ready);
   await page.screenshot({ path: `${root}checks/artifacts/${label}-initial.png`, fullPage: true });
   await overflow(page, `${label} initial`); await axe(page, `${label} initial light`);
   assert(await page.getByRole('button', { name: 'Find my tools', exact: true }).isDisabled());
   await page.keyboard.press('Tab');
   assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Skip to onboarding');
   await page.getByRole('button', { name: /^Gmail / }).click();
   await page.keyboard.press('Escape');
   assert.match(await page.evaluate(() => document.activeElement.textContent), /Gmail/);
   await page.getByRole('button', { name: /^Gmail / }).click();
   await page.getByRole('button', { name: /morgan.personal@example.com/ }).click();
   await page.getByRole('checkbox').check();
   await page.getByRole('button', { name: 'Allow sample read access' }).click();
   await page.getByRole('alert').waitFor();
   assert.equal(await page.getByRole('button', { name: 'Disconnect morgan.personal@example.com', exact: true }).count(), 0);
   await overflow(page, `${label} consent`); await axe(page, `${label} declined consent`);
   for(let i=0;i<9;i++) { await page.keyboard.press('Tab'); assert(await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement)), 'focus escaped modal'); }
   await page.getByRole('checkbox').uncheck();
   await page.getByRole('button', { name: 'Allow sample read access' }).click();
   await page.getByRole('dialog').waitFor({state:'hidden'});
   await connect(page, 'Gmail', 'morgan.studio@example.com');
   await connect(page, 'Outlook', 'morgan@current-work.example');
   await page.getByRole('button', { name: 'Find my tools', exact: true }).click();
   await page.getByRole('button', { name: 'Review GitHub', exact: true }).waitFor();
   assert.equal(await page.getByText('Usage unconfirmed', {exact:true}).count(),3);
   await page.getByRole('button',{name:'Review Notion',exact:true}).click();
   await page.getByRole('button',{name:'Add sample activity evidence'}).click();
   await page.getByLabel('My relationship').selectOption('Tried');
   await page.getByLabel('Who put you on?').fill('Rowan, at the sample makers club');
   await page.getByLabel('Affiliate destination').fill('https://example.com/ref/rowan');
   await overflow(page,`${label} review`); await axe(page,`${label} review`);
   await page.screenshot({path:`${root}checks/artifacts/${label}-review.png`,fullPage:true});
   await page.getByLabel('Who put you on?').focus();
   await page.keyboard.press('Enter');
   await page.getByRole('dialog').waitFor({state:'hidden'});
   assert.equal(await page.getByRole('button',{name:'Edit Notion',exact:true}).count(),1);
   await page.getByRole('button',{name:'Review Slack',exact:true}).click();
   await page.getByLabel('Who put you on?').fill('Sample former team');
   await page.keyboard.press('Enter');
   await page.getByRole('dialog').waitFor({state:'hidden'});
   assert.equal(await page.getByRole('button',{name:'Edit Slack',exact:true}).count(),1);
   await page.getByRole('button',{name:'Edit Slack',exact:true}).click();
   await page.getByRole('button',{name:'Set aside',exact:true}).click();
   await page.getByRole('dialog').waitFor({state:'hidden'});
   await page.getByRole('button',{name:'Dismissed',exact:true}).click();
   await page.getByRole('button',{name:'Restore',exact:true}).click();
   await page.getByRole('button',{name:'All',exact:true}).click();
   await connect(page,'GitHub','morgan-sample');
   await page.getByRole('button',{name:'Find tools in new accounts',exact:true}).click();
   await page.getByRole('button',{name:'Review GitHub',exact:true}).waitFor();
   assert.equal(await page.getByText('Usage unconfirmed',{exact:true}).count(),1);
   await page.getByRole('button',{name:'Review GitHub',exact:true}).click();
   await page.getByLabel('My relationship').selectOption('Active');
   await page.getByRole('button',{name:'Keep in my private collection'}).click();
   await page.getByRole('dialog').waitFor({state:'hidden'});
   await page.getByLabel('Refresh preference').selectOption('Daily API (proposal)');
   assert.match(await page.locator('.cadence').textContent(),/No refresh is scheduled/);
   await page.getByRole('button',{name:'Preview my collection'}).click();
   assert.match(await page.getByRole('dialog').textContent(),/Rowan, at the sample makers club/);
   assert.equal(await page.getByRole('dialog').getByRole('article').count(),2);
   await page.getByRole('button',{name:'Back to my discoveries'}).click();
   await page.getByRole('dialog').waitFor({state:'hidden'});
   await page.getByRole('button',{name:'Disconnect morgan-sample',exact:true}).click();
   await page.getByRole('button',{name:'Disconnect morgan.personal@example.com',exact:true}).click();
   await page.getByRole('button',{name:'Disconnect morgan.studio@example.com',exact:true}).click();
   await page.getByRole('button',{name:'Disconnect morgan@current-work.example',exact:true}).click();
   assert.equal(await page.getByText('Source disconnected. Retained sample; no future refresh.',{exact:true}).count(),3);
   await overflow(page,`${label} reviewed`); await axe(page,`${label} reviewed light`);
   await page.screenshot({path:`${root}checks/artifacts/${label}-reviewed.png`,fullPage:true});
   await page.getByRole('button',{name:'Use dark theme'}).click();
   await axe(page,`${label} reviewed dark`); await overflow(page,`${label} dark`);
   await page.screenshot({path:`${root}checks/artifacts/${label}-dark.png`,fullPage:true});
   for(const width of [320,768]){await page.setViewportSize({width,height:900});await overflow(page,`${variant}-${width} dark reviewed`);}
   report.cases.push(`${label}: multi-account; decline and retry; modal focus trap and Escape return; Enter saves with and without activity evidence; email hints not usage; evidence addition; active/tried; private save; dismiss/restore; API activity; cadence proposal; private preview; disconnect retention`);
   await context.close();
  }
 }
} catch (error) { report.errors.push(error.stack); }
finally { await browser.close(); await fs.writeFile(`${root}checks/verification-2026-09-16.json`,JSON.stringify(report,null,2)); }
console.log(JSON.stringify({cases:report.cases,errors:report.errors,externalRequests:report.network,accessibility:report.accessibility.map(a=>({label:a.label,violations:a.violations.length,ids:a.violations.map(v=>v.id)}))},null,2));
if(report.errors.length||report.accessibility.some(a=>a.violations.length)||report.network.length) process.exitCode=1;

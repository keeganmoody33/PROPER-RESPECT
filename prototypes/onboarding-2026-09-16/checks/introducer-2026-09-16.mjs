import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { interpretIntroducer, creditPlatform } from '../src/introducer.js';
const report = { createdAt: new Date().toISOString(), cases: [], accessibility: [], errors: [], externalRequests: [] };
for(const [input,kind,platform] of [
 ['', 'empty',''],['Rae from the meetup','text',''],['@rowan','handle',''],['@rowan@example.social','handle',''],
 ['example.com','link','Website'],['https://github.com/rowan-sample','link','GitHub'],[' www.x.com/rowan-sample ', 'link','X'],
 ['github.com.example.com/rowan','link','Website'],['https://github.com@evil.example/rowan','text',''],
 ['mailto:rowan@example.com','text',''],['javascript:alert(1)','text',''],['data:text/html,hello','text',''],['rowan@example.com','text',''],['https://','text',''],
]) {const actual=interpretIntroducer(input);assert.equal(actual.kind,kind,input);assert.equal(actual.platform,platform,input);}
assert.equal(creditPlatform('github.com/rowan','Website'),'Website');
assert.equal(creditPlatform('github.com/rowan','unspecified'),'');
report.cases.push('14 interpretation cases: empty, text, handle, federated handle, URL/domain, known host, deceptive hostname, credentials, unsupported schemes, email, malformed URL; manual override and unspecified preserve distinction');
const browser = await chromium.launch({headless:true,channel:'chrome'});
try {
 for(const variant of ['studio','collection']) for(const width of [1242,390]) {
  const context=await browser.newContext({viewport:{width,height:863},colorScheme:'dark',reducedMotion:'reduce'});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4320')&&!r.url().startsWith('data:'))report.externalRequests.push(r.url());});
  await page.goto(`http://127.0.0.1:4320/?view=${variant}`);
  await page.getByRole('button',{name:/^Gmail /}).click();
  await page.getByRole('button',{name:/morgan.personal@example.com/}).click();
  await page.getByRole('button',{name:'Allow sample read access'}).click();
  await page.getByRole('button',{name:'Find my tools',exact:true}).click();
  await page.getByRole('button',{name:'Review Notion',exact:true}).click();
  const raw='  https://github.com/rowan-sample  ';
  await page.getByLabel('Who put you on?').fill(raw);
  assert.equal(await page.getByLabel('Platform').inputValue(),'');
  assert.equal(await page.getByLabel('Platform').locator('option:checked').textContent(),'GitHub (suggested from link)');
  await page.getByLabel('Platform').selectOption('Website');
  await page.getByLabel('Who put you on?').press('Enter');
  await page.getByRole('button',{name:'Edit Notion',exact:true}).click();
  assert.equal(await page.getByLabel('Who put you on?').inputValue(),raw);
  assert.equal(await page.getByLabel('Platform').inputValue(),'Website');
  await page.getByLabel('Platform').selectOption('unspecified');
  await page.getByRole('button',{name:'Keep in my private collection'}).click();
  await page.getByRole('button',{name:'Preview my collection'}).click();
  assert.equal(await page.getByRole('link',{name:'Introducer link'}).getAttribute('href'),'https://github.com/rowan-sample');
  assert.equal(await page.getByRole('link',{name:'Product website'}).getAttribute('href'),'https://www.notion.com');
  assert.match(await page.locator('.affiliate-output').textContent(),/example.com\/ref\/studio-notes/);
  await page.getByRole('button',{name:'Back to my discoveries'}).click();
  await page.getByRole('button',{name:'Edit Notion',exact:true}).click();
  await page.getByLabel('Who put you on?').fill('@rowan-sample');
  assert.equal(await page.getByLabel('Platform').inputValue(),'');
  await page.getByLabel('Platform').selectOption('Mastodon');
  await page.getByRole('button',{name:'Keep in my private collection'}).click();
  await page.getByRole('button',{name:'Preview my collection'}).click();
  assert.match(await page.locator('.saved-credit').textContent(),/@rowan-sample.*Mastodon/s);
  assert.equal(await page.getByRole('link',{name:'Introducer link'}).count(),0);
  await page.getByRole('button',{name:'Back to my discoveries'}).click();
  await page.getByRole('button',{name:'Edit Notion',exact:true}).click();
  await page.getByLabel('Who put you on?').fill('example.com/a-long-piece-of-content?source=sample');
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:`checks/artifacts/introducer-${variant}-${width}-2026-09-16.png`,fullPage:false});
  const a11y=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  report.accessibility.push({variant,width,violations:a11y.violations});
  const overflow=await page.evaluate(()=>({page:document.documentElement.scrollWidth>innerWidth,dialog:document.querySelector('dialog').scrollWidth>document.querySelector('dialog').clientWidth}));
  assert.equal(overflow.page,false);assert.equal(overflow.dialog,false);
  await page.getByLabel('Who put you on?').fill('javascript:alert(1)');
  await page.getByRole('button',{name:'Keep in my private collection'}).click();
  await page.getByRole('button',{name:'Preview my collection'}).click();
  assert.equal(await page.getByRole('link',{name:'Introducer link'}).count(),0);
  await page.getByRole('button',{name:'Back to my discoveries'}).click();
  await page.getByRole('button',{name:'Edit Notion',exact:true}).click();
  await page.getByLabel('Who put you on?').fill('');
  await page.getByRole('button',{name:'Keep in my private collection'}).click();
  await page.getByRole('button',{name:'Edit Notion',exact:true}).click();
  assert.equal(await page.getByLabel('Who put you on?').inputValue(),'');
  assert.equal(await page.getByLabel('Platform').count(),0);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button',{name:'Edit Notion',exact:true}).evaluate(e=>e===document.activeElement),true);
  report.cases.push(`${variant} ${width}px: raw text retained, platform suggested/overridden/omitted, handle unresolved unless selected, Enter saves, separate destinations, dangerous schemes remain text, optional blank, Escape restores focus, no overflow`);
  await context.close();
 }
} catch(error){report.errors.push(error.stack);}finally{await browser.close();await fs.writeFile('checks/introducer-verification-2026-09-16.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify({...report,accessibility:report.accessibility.map(a=>({variant:a.variant,width:a.width,violations:a.violations.length}))},null,2));
if(report.errors.length||report.externalRequests.length||report.accessibility.some(a=>a.violations.length))process.exitCode=1;

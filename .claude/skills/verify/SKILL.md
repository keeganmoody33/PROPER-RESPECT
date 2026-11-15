---
name: verify
description: Drive Proper Respect's real web app in reference test mode (no sign-in, no backend) and prove a change with captured evidence. Covers the homepage product-card carousel, a brand card checked side by side against the brand's own site, the fixture public profile, and the fixture private collection. Use after any change to cards, the homepage, brand styling or public profiles, before calling visual work done.
---

# Verify Proper Respect

Proper Respect is a Next.js web app where people publish brand-themed, flippable cards for the tools they use. This skill starts this checkout's app with no sign-in and no backend, drives it with Playwright the way a visitor would, and records evidence. Everything it proves is **synthetic**: fixture data, never a real owner's account. Say so in every receipt. Signed-in owner flows, provider reads, deploys and publishing are out of scope; agents cannot enter passwords, and AGENTS.md reserves those for the owner.

The owner's standing rule for visual work: compare against the brand's real site, side by side, with targets written first and each one marked passed, failed or untested. A card can pass every unit test and still not look like the brand.

## Before you start

- Run the helpers and Playwright with the Bash sandbox off. `lsof`, `pgrep` and Chromium are blocked inside it.
- Pick a free port of your own. Never 3000 (the Playwright suite) or 3211 (the card-fixture preview in `.claude/launch.json`).
- One dev server per checkout. Two share `.next` and corrupt each other. `launch.sh` refuses a second one, and Next refuses one too: `npx playwright test` fails with "Process from config.webServer was not able to start" while a `launch.sh` server runs here. Run `teardown.sh` before the e2e suite.
- Check free disk (`df -h /private/tmp`). A dev server's `.next` grows past 700 MB. Delete only this checkout's `.next`, never anything outside it.

## Launch

```sh
.claude/skills/verify/scripts/launch.sh 3251
```

It starts `next dev` on 127.0.0.1 with `PROPER_RESPECT_E2E_REFERENCE=1` and empty Clerk and Convex variables (the same environment as `playwright.config.ts`), writes the pid to `.artifacts/verify/server-3251.pid` and the log beside it, and returns when the homepage HTML contains its "Product usage examples" region. First start takes 30 to 90 seconds. The fixture data is compiled into the app, so there is nothing to seed or migrate.

## Doctor

```sh
.claude/skills/verify/scripts/doctor.sh 3251
```

Read-only. Checks that the listener runs from this checkout, reports the commit and how many tracked files differ from it, confirms reference test mode (`/evidence-fixture` answers 200 only there), and that the homepage renders its examples. Exit 0 means worth driving. Run it first whenever anything looks off, and record its output with your evidence: a dev server serves the working tree, so "tested commit X" is only true when the changed-file count is 0.

## Drive

Use Playwright (`require('playwright')`, `chromium.launch()`). Address elements by role and accessible name; these handles are what the e2e suite uses, so they stay stable.

```js
const { chromium } = require("playwright");
const browser = await chromium.launch();
const context = await browser.newContext({ baseURL: "http://127.0.0.1:3251", viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: "no-preference" });
const page = await context.newPage();
await page.goto("http://127.0.0.1:3251/", { waitUntil: "load" });
const carousel = page.getByRole("region", { name: "Product usage examples" });
await carousel.getByRole("button", { name: "Pause slideshow" }).click().catch(() => {});
await carousel.getByRole("button", { name: "More examples" }).click();          // the nine behind More
await carousel.getByRole("button", { name: "Clay", exact: true }).click();
const card = carousel.getByRole("article", { name: "Clay card" });
await page.evaluate(() => document.fonts.ready);
await card.screenshot({ path: ".artifacts/<task>/clay-front-390.png" });
await card.getByRole("button", { name: "Details" }).click();                     // flip
await card.getByRole("button", { name: "How this was measured" }).click();
await card.getByRole("button", { name: "Close details" }).click();
```

Each feature's journeys, handles and gotchas are in [features/README.md](features/README.md). Drive every entry point the map lists for the feature you changed, not only the convenient one.

Widths: 1440×1000 for desktop and 390×844 for a phone, plus 320 when text or tables might not fit. Test `reducedMotion: "reduce"` whenever motion is involved.

### Floors every visual change must hold

Measure these, do not estimate them. The rubric's anchors live in the homepage feature file.

```js
const floors = await page.evaluate((selector) => {
  const card = document.querySelector(selector);
  const shown = [...card.querySelectorAll("*")].filter(el => el.checkVisibility() && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
  const small = shown.filter(el => parseFloat(getComputedStyle(el).fontSize) < 12).map(el => el.textContent.trim().slice(0, 40));
  const targets = [...card.querySelectorAll("a, button, [role=button], summary")].filter(el => el.checkVisibility())
    .map(el => ({ name: (el.getAttribute("aria-label") || el.textContent).trim().slice(0, 40), h: el.getBoundingClientRect().height }))
    .filter(t => innerWidth <= 480 && t.h < 44);
  const cut = shown.filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.textContent.trim().slice(0, 40));
  // A word laid out on two lines was broken inside itself ("Pro vide r A"); `cut` does not catch that.
  const split = shown.flatMap(el => [...el.childNodes].filter(n => n.nodeType === 3).flatMap(text =>
    [...text.textContent.matchAll(/\S+/g)].filter(word => {
      const range = document.createRange();
      range.setStart(text, word.index); range.setEnd(text, word.index + word[0].length);
      return new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size > 1;
    }).map(word => word[0])));
  const box = card.getBoundingClientRect();
  return { sidewaysScroll: document.documentElement.scrollWidth > innerWidth, cardTop: box.top + scrollY, cardBottom: box.bottom + scrollY, small, targets, cut, split };
}, '[data-current="true"] .product-card');
```

Run it on both faces: flip with "Details" and measure again. The back holds content the front does not, such as Clay's full table.

Contrast: text at least 4.5:1, chart bars and fills at least 3:1. Read colours with `getComputedStyle` and compute the ratio; the card's own derivation lives in `src/domain/brand-kit.ts`.

## Brand side by side

For any change that affects how a homepage example card looks, run the comparison the repo already ships in `scripts/brand-fidelity.mjs` (it measures the brand's site and the card the same way, refuses a server that is not this checkout, and composes the pairs):

```sh
node scripts/brand-fidelity.mjs reference --only clay,github        # the brands' own sites, once per task
node scripts/brand-fidelity.mjs card --base http://127.0.0.1:3251 --label after --only clay,github
node scripts/brand-fidelity.mjs compare --label after                # writes assertions.md: passed / failed / untested
node scripts/brand-fidelity.mjs pairs --label after                  # site beside card, 1440 and 390
```

Output lands in `.artifacts/brand-fidelity/`. Capture `--label before` from the old commit before you change anything, so there is a pair to compare. The automatic assertions mostly hold by construction; the pairs are the real judgement. Open every pair yourself and write what reads right and wrong per brand. Rules for the brands' sites are in [features/brand-side-by-side.md](features/brand-side-by-side.md).

## Evidence

- Working evidence goes in `.artifacts/<task>/` (git-ignored). Write `assertions.md` first: one line per target as a statement ("Clay's front shows no cut cell at 390"), then mark each passed, failed or untested with the reason and the capture that shows it. Never mark passed without opening the capture.
- Record at the top: the commit, the doctor output, the widths, and that the data is synthetic.
- Capture the action and the resulting state, and the failure before the fix when you are fixing something.
- Prove side effects as well as pixels: no off-site requests on the homepage (`page.on("request")`), focus after a flip, what a screen reader gets (`page.accessibility.snapshot()` or role queries).
- For a pull request receipt, copy the chosen captures to `docs/verification/<YYYY-MM-DD>-<slug>/` with a `README.md`, and use the `before-and-after` skill for the PR table. For a narrated recording, use the `evidence-driven-testing` skill.
- Screenshots a person will look at use deviceScaleFactor 2. Ones only you read use 1, which also saves disk.

## Cleanup

```sh
.claude/skills/verify/scripts/teardown.sh 3251
```

Stops the pid `launch.sh` recorded (checked against its recorded start time, so a reused pid is left alone) and its children, waits for the port to free, and puts `next-env.d.ts`, which `next dev` rewrites on start, back to the contents it had at launch. It never kills by process name and never touches `.artifacts/`. If the port still has a listener afterwards, doctor tells you whose it is; leave a process you did not start alone.

## Helpers

| Script | Run | Does |
| --- | --- | --- |
| `scripts/launch.sh` | `launch.sh PORT` | Starts reference test mode, waits until usable |
| `scripts/doctor.sh` | `doctor.sh PORT` | Read-only health and identity check |
| `scripts/teardown.sh` | `teardown.sh PORT` | Stops what launch started, keeps evidence |
| `scripts/brand-fidelity.mjs` (repo) | see Brand side by side | Site and card measured alike, pairs, assertions |

Keep the feature map honest as the app changes with `/maintain-verification-skill`.

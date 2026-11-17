# Earn your respect revamp: verification, 16 Nov 2026

All data here is synthetic: homepage sample cards and the fixture profile in reference test mode, with no sign-in, no backend and no owner account.

- **Branch.** `feat/revamp-earn-your-respect`, cut from `origin/main` at `9eb44a6`.
- **Server.** `next dev` on 127.0.0.1:3261, started by the verify skill's `launch.sh` with `PROPER_RESPECT_E2E_REFERENCE=1`. `doctor.sh 3261` passed. It reported 30 tracked files changed, so the captures show the working tree that became this branch's first commit, not `9eb44a6`.
- **Widths.** 1440×1000, 390×844 and 320×700. Reduced motion. Captures at deviceScaleFactor 1.

## Owner direction

2026-11-16: revamp the site. Only the name and the origin story are fixed: Aretha Franklin, and a tool history kept apart from a work history as a way to earn props from peers. 2026-11-14, still in force: "There is no hero copy."

## Captures

| File | What it shows |
| --- | --- |
| `before-home-1440.png` | The homepage on `9eb44a6`, full page. |
| `after-home-1440-first-screen.png` | The homepage's first screen after the owner's second round the same day: a pale field in place of full yellow, and a header that stays with the reader. |
| `after-home-390-first-screen.png` | A phone's first screen. |
| `after-home-1440-dark-first-screen.png` | The first screen in dark appearance. |
| `after-footer-1440.png` | The dark footer and the header over a scrolled page. |
| `before-origins-1440.png` | Origins on `9eb44a6`. |
| `after-origins-1440-first-screen.png` | Origins with its rail of About pages and the quote. |

The measurements under Targets were taken on the first round. The second round changed colours, the header and the About rail, and the browser specs for those pages passed again after it (174 tests across eight spec files; one theme test failed once and passed on three repeats).

## Targets

| Target | Result | Evidence |
| --- | --- | --- |
| The hero holds one line and two actions, and no paragraph. | Passed | `src/server/homepage.test.ts`: the hero's lines are "Earn your respect.", "Start your collection" and "View Keegan’s shared collection". |
| The headline is one line at every width and stays inside the screen. | Passed | Right edge 1382px of 1440, 374px of 390, 304px of 320. Height 140px, 38px and 31px. |
| At 390×844 the card's top is at 300px or less. | Passed | 262px. At 320×700, 255px. |
| At 1440×1000 each of the five featured cards fits whole in the first screen. | Passed | Card bottoms: Clay 753px, GitHub 945px, Cloudflare 923px, Docker 808px, Firecrawl 880px. |
| No sideways page scroll at 1440, 390 or 320. | Passed | `scrollWidth` equals the viewport at all three, on `/`, `/about/origins` and `/keegan`. |
| The page makes no off-site requests and loads no new font files. | Passed | `tests/e2e/homepage.spec.ts`. The heading face is the bundled Archivo at its narrowest width, 62%. |
| Text contrast holds in light and dark. | Passed | The axe checks in `homepage.spec.ts`, `theme.spec.ts` and `site-frame.spec.ts`. |
| Origins keeps its title, its source link and "What it means here". | Passed | `tests/e2e/site-frame.spec.ts` and `trust-pages.spec.ts`. |
| The homepage and its Markdown mirror say the same steps. | Passed | `src/server/homepage.test.ts`. |
| A phone's header fits its navigation on one row. | Failed, not changed here | "Your collection" still wraps to a second row at 390, as it did before. |
| The fixture public profile is redesigned. | Untested | Out of scope. It takes the new colours and heading face only. |

## Test runs

- **Browser suite.** `npx playwright test`: 353 passed, 3 failed. One was the GitHub calendar's cell size, which this change raised from 8px to 10px because the card is wider; the test now expects 10px and passes. The other two are `searchable-analytics.spec.ts` under the default config. CI runs that spec under its own config, `tests/e2e/searchable-analytics.config.ts`, and it fails the same way without this change's files involved.
- **Unit suite.** `npm test`: 2637 passed, 11 failed. All 11 are in tests that start local listeners or child processes (`collector-fixture-http`, `collector-fixture-cli`, `codex-rollout-native`, `selected-file-cli`, `private-usage-preview`, `convex/rateLimits`). They ran inside a sandbox that blocks local port binding. None of them imports a file this change touches. CI is the check for those.

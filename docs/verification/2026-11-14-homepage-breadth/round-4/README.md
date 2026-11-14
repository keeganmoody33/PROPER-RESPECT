# Homepage breadth, round 4

Captured 2026-11-14 from this checkout's own `next dev` on port 3317, at commit
`bdc59ff58c09e2b221a7e7852608adbc72360135`, with no uncommitted changes under
`app`, `components`, `src` or `next.config.ts`. `capture.mjs` checked that the
listening process (`next-server (v16.3.8)`) runs from this checkout before it
took any picture, and `capture.json` holds that proof, the text each face
showed and every card's heights. Every picture is at deviceScaleFactor 2, with
reduced motion. Each was looked at by eye before it was marked. A target that
renders correctly but still looks weak is marked failed, with the reason.

Rerun: `node docs/verification/2026-11-14-homepage-breadth/round-4/capture.mjs --base http://127.0.0.1:<port>`
against a dev server started from this checkout.

The round dot at the bottom left of some pictures is Next's development
indicator. It is not part of the page.

## Targets

| Target | File | Result | What it shows |
| --- | --- | --- | --- |
| First screen, 1440×1000 | `first-screen-1440.png` | passed | Controls beside "Inside a card", one chooser row (Clay, GitHub, Cloudflare, Docker, Firecrawl, More examples), Clay with its numbers above the table. Clay's Details button sits at the bottom edge of the screen. |
| First screen, 390×844 | `first-screen-390.png` | failed | The hero fills the screen; the carousel starts at 1,037px, below it. Nothing of the example is in the first screen on a phone. |
| Clay front, 1440 | `clay-front-1440.png` | passed | 38,400 rows enriched · 86 tables built · 48,500 credits used, then the grid: row numbers, tinted Work email and Status headers, Quillon still running. |
| Clay front, 390 | `clay-front-390.png` | passed | Domain dropped; Company, Work email and Status fit with no scroll. Company names and addresses end in an ellipsis ("Northwind …"), so the rows say less than at 1440. |
| Clay back, 1440 and 390 | `clay-back-*.png` | passed | Logo, name and green band; cost "$149/month · as of 1 Sep 2026"; three plain number lines; How this was measured closed; work sample. The card keeps its front's height, so 1440 has about 110px of empty space under the links. |
| GitHub front, 1440 | `github-front-1440.png` | passed | 1,121 contributions, the year with 12px month and weekday labels. |
| GitHub front, 390 | `github-front-390.png` | passed | Opens at the newest weeks with Mon / Wed / Fri held at the left edge; the cut month label is hidden, so Apr is the first label (Feb and Mar are hidden, not cut). |
| GitHub back, 1440 and 390 | `github-back-*.png` | passed | No calendar again; one plain provenance line. About 75px of empty card under the links at 1440. |
| Cloudflare front, 1440 and 390 | `cloudflare-front-*.png` | passed | "187,870 requests served over 31 days", 31 daily bars, cost, Owner-selected go-to. |
| Cloudflare back, 1440 and 390 | `cloudflare-back-*.png` | passed | Wordmark, orange band on the note, plain lines. Empty space under the links (the card keeps its front's height). |
| Docker front, 1440 and 390 | `docker-front-*.png` | passed | "3 linked works" and the three links; at 390 each link is a 44px target. |
| Docker back, 1440 and 390 | `docker-back-*.png` | passed | No repeated list (the front links all three). Short content under a full-height card. |
| Firecrawl front, 1440 and 390 | `firecrawl-front-*.png` | passed | "5,520 pages scraped over 12 weeks"; "Referral link" as an outlined 12px tag under the arrow. |
| Firecrawl back, 1440 and 390 | `firecrawl-back-*.png` | passed | "Weekly · Referral link"; at 390 "Open Firecrawl ↗  Referral link" with a gap (fixed in `bdc59ff`; `2d19c55` had run them together). |
| Clay front beside clay.com | `clay-front-beside-clay-com.png` | failed | Same green band, lime button, type and icon. clay.com leads with a 3D illustration and large display type; the card is a white grid, so the likeness is still the kit, not the feel. |
| More examples opened, 1440 and 390 | `more-opened-*.png` | passed | All fourteen toggles; still five slides mounted. At 390 the 44px toggles take five rows. |
| n8n front, 1440 and 390 | `n8n-front-*.png` | passed | "341 workflow runs a week at its peak" instead of 0; the reason under the headline. The bars stay near-black: no n8n pink passes the chart contrast rule on its surface. |
| Elicit front, 1440 and 390 | `elicit-front-*.png` | passed | "45 papers screened a week at its peak"; reason under the headline. |
| No sideways scroll, 1440 and 390 | `capture.json` | passed | `page-1440` and `page-390` are true. |

## Front and back heights

The card keeps its front's height when turned over, so "back" is the card box
and is never shorter than the front. "Content" is where the back's last line
ends, measured with How this was measured closed.

| Card | 1440 front | 1440 back | 1440 content | 390 front | 390 back | 390 content |
| --- | --- | --- | --- | --- | --- | --- |
| Clay | 638 | 638 | 528 (−110) | 691 | 711 | 696 (+5) |
| GitHub | 526 | 526 | 451 (−75) | 580 | 580 | 558 (−22) |
| Cloudflare | 519 | 519 | 452 (−67) | 608 | 608 | 560 (−48) |
| Docker | 452 | 452 | 411 (−41) | 576 | 576 | 521 (−55) |
| Firecrawl | 460 | 460 | 423 (−37) | 519 | 519 | 497 (−22) |
| n8n | 496 | 496 | 411 (−85) | 576 | 576 | 501 (−75) |
| Claude Code | 576 | 576 | 514 (−62) | 660 | 660 | 605 (−55) |
| Exa | 446 | 470 | 456 (+10) | 468 | 563 | 548 (+80) |
| Porkbun | 447 | 503 | 488 (+41) | 516 | 570 | 556 (+40) |
| Spider | 490 | 490 | 427 (−63) | 537 | 537 | 497 (−40) |
| Open Places | 440 | 440 | 401 (−39) | 496 | 496 | 470 (−26) |
| Grok Bot | 450 | 463 | 449 (−1) | 503 | 575 | 560 (+57) |
| Elicit | 479 | 479 | 389 (−90) | 548 | 548 | 479 (−69) |
| Context.dev | 445 | 445 | 417 (−28) | 499 | 517 | 502 (+3) |

Round 3's Clay back was 1,177px against a 628px front.

## Production numbers

`npm run build` with the `verify.yml` build env (synthetic Convex URL, the
`pk_test_…` publishable key, `PUBLIC_SITE_ORIGIN=https://public.example`)
builds, but `next start` then answers `/` with 500 "Missing secretKey" from
Clerk's middleware. So the numbers below use the env CI uses to serve the
production homepage (`verify.yml`, "Verify production homepage
representation negotiation"): empty Clerk and Convex values and
`PROPER_RESPECT_E2E_REFERENCE=1`, built with `npm run build` (Turbopack) and
served by `next start`. Measured in Chromium on first load of `/`, from the
Navigation and Resource Timing entries.

| | This branch at `9d8683c` | `origin/main` at `262d295` |
| --- | --- | --- |
| HTML transferred (gzip) | 40,709 B | 29,452 B |
| HTML decoded | 258,178 B | 222,100 B |
| JS transferred | 532,183 B (19 files) | 524,525 B (19 files) |
| JS decoded | 1,809,401 B | 1,786,643 B |
| Requests, 1440 / 390 | 45 / 44 | 44 / 43 |
| DOM elements | 1,231 | 1,447 |
| Inline script | 130,124 chars | 50,003 chars |

`origin/main` was built in a temporary worktree and removed afterwards. Only
CSS changed after `9d8683c`, so the HTML and JS sizes stand for `bdc59ff`.

Of this branch's inline script, 121,962 characters are the React Server
Components payload, and most of that is the carousel's props:
`homepageExamples()` is 92.5 KB of JSON. The brand snapshots are 43.6 KB of it
(font links 17.9 KB, style guides 11.0 KB, logos 4.1 KB, provider receipts
3.1 KB, colours 2.4 KB), site traits 13.5 KB and the sample activity 24.4 KB
(most of it GitHub's 365 days). The card computes its look on the client from
the whole snapshot, so sending only the kit values it needs means computing
the card's style and font faces on the server, a change to how every card is
rendered. That is not contained, so it is not done here. Dropping only the
receipts, retrieval ids and hashes would save about 5 KB.

## Theme spec

`tests/e2e/theme.spec.ts` "denied storage keeps working theme controls and
navigation" passed in all three full-file runs on this branch and all three
on `origin/main`; the flake did not reproduce. "theme controls and shell fit"
fails on both: on `origin/main` at 320 and 1440 in every run, on this branch
at all four widths in every run. The console errors are two 503s from
`/api/tally`, which returns 503 whenever `PROPER_RESPECT_E2E_REFERENCE=1`
(`src/server/tally-store.ts` has no store then). The footer's
`RequestTally` fetches it once on mount, so the test fails whenever that
response arrives before the test ends. The 503 predates this branch, but the
extra failures at 390 and 460 are this branch's: they pass on `origin/main`
in every run and fail here in every run. Why the response now lands in time
at those widths is not measured; a different page length or compile timing
under `next dev` is a guess. The tally belongs to other work (the
`feat/request-tally` and `codex/request-tally-reconciliation-20261006`
branches), so it is not changed here, and the test's console-error check is
not loosened. A run at `2b37960` to find which round started the extra
failures was not done: the disk ran out (288 MB free) while copying
`node_modules` for that worktree.

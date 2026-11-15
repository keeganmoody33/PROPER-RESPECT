# Homepage breadth: assertions

Date: 2026-11-14. Branch `feat/homepage-brand-examples`.

- **After:** commit `8bb7b8dcc1b833101f063b30547d71e1f0de8513`.
- **Before:** commit `a24fd1042996e5abccddee6abc1181c8f715e4b6`.

## How the captures were made

Each capture came from a production build made by `node scripts/brand-fidelity.mjs build`. The script refuses to build an uncommitted tree, and it stamps the commit into `.next/brand-fidelity-build.json`.

The build was served with `npx next start -p 3311 -H 127.0.0.1`, using the e2e fixture environment: Clerk and Convex unset, `PUBLIC_SITE_ORIGIN=https://public.example`.

`capture.mjs` refuses to run unless three checks pass:

- The port's listener is `next-server`.
- Its working directory is this worktree.
- The build stamp names `HEAD` with no uncommitted changes.

`before/server.json` and `after/server.json` hold that proof for each run. The worktree path is redacted.

Captures are headless Chromium with reduced motion, at 1440 and 390 wide and 1000 high. The PNGs were re-encoded to a palette to save space.

The files under `prototypes/` came from `next dev` on this worktree. They are the throwaway options described below, and they are not stamped. Only the five that were opened are kept.

Results are `passed`, `failed` or `untested`. Every capture cited in the table was opened and looked at before its row was marked. Where a row rests on extracted text or an e2e check, the Evidence column says so. `after/` also holds front captures of the plain examples that no row cites. Those were made and measured but not opened one by one.

## Targets

| # | Statement | Result | Evidence |
|---|---|---|---|
| 0 | Precondition, before: the back's status row runs the level into the raw enum ("Stopped usingCANONICAL") | failed (the defect, before) | `before/14-clay-back-1440.png` |
| 1 | Clay's front shows the first published number, says 2 more are in Details, and says it is a synthetic sample | passed | `after/14-clay-front-1440.png`, `after/14-clay-front-390.png` |
| 2 | Clay's back shows: a $149.00/month owner-reported cost; three measurements (rows enriched 2140000, tables built 86, credits used 48500) with their periods; "See how I use it ↗" with host clay.com | passed | `after/14-clay-back-390.png`, `after/14-clay-back-1440.png` |
| 3 | Clay's footer reads "Cost, numbers and a work sample inside" | passed | `after/14-clay-front-1440.png`; e2e also checks the Details button's description |
| 4 | Firecrawl's front shows "Referral link" next to ↗; its back reads "Weekly · Referral link" and repeats the disclosure under the outbound link | passed | `after/03-firecrawl-front-390.png`, `after/03-firecrawl-back-1440.png` |
| 5 | Spider's front shows "Affiliate link" next to ↗ | passed | `after/07-spider-front-1440.png` |
| 6 | Cloudflare's back shows "Owner-selected go-to" and "Owner-reported cost: $5.00/month · as of 2026-09-01" | passed | `after/05-cloudflare-back-1440.png` |
| 7 | Exa's back shows the "Demo ↗" work-sample link with host exa.ai | passed | `after/04-exa-back-390.png` |
| 8 | Docker's back lists its three artifacts as links | passed | `after/08-docker-back-1440.png` |
| 9 | n8n's top line reads "Paused · started 2024", and its back carries the note saying why | passed | `after/13-n8n-front-1440.png`; the back text is in `after/measurements.json` |
| 10 | Elicit's top line reads "Stopped using · started 2026" | passed | `after/11-elicit-front-390.png` |
| 11 | No back shows a raw link-type enum. Spider's innerText reads "AFFILIATE LINK" because its measured site sets labels to uppercase; its textContent is "Occasionally · Affiliate link" | passed | 8 backs × 2 widths in `after/measurements.json`; e2e checks textContent |
| 12 | Every slide names its capability above the card | passed | Seen in the opened captures: GitHub, Firecrawl, Spider, Clay, n8n and Elicit fronts, plus the backs. All 14 slides' text is in `after/measurements.json` (`above`). e2e checks all 14 at 1440, 390 and 320 |
| 13 | The chooser gives each toggle a second line at 1440 and only names below 600px; each toggle's accessible name stays the product's | passed | `after/01-github-front-1440.png`, `after/01-github-front-390.png`; e2e checks each toggle's description at all three widths |
| 14 | The frame is one height across all 14 examples | passed | 670.0px at 1440 and 732.9px at 390 for every row in `after/measurements.json`; e2e checks 1440, 390 and 320 |
| 15 | The largest gap between front children stays at the row spacing (12.8px) | passed | `largestFrontGap` in `after/measurements.json` |
| 16 | No homepage example shows "Give props" | passed | no front text in `after/measurements.json` contains it |
| 17 | Hidden slides load no brand assets until shown or next; the homepage makes zero off-site requests; axe is clean at 1440 on every front and on 6 backs; no horizontal overflow at 390 or 320 | passed | `usage-examples.spec.ts` and `homepage.spec.ts` at the after commit (not a capture) |

## Frame and leftover space

Leftover means the space between the bottom of the slide's content and the bottom of the frame.

| Width | Frame before | Frame after | Largest leftover before | Largest leftover after | Chooser before | Chooser after |
|---|---|---|---|---|---|---|
| 1440 | 653.4px | 670.0px | 192px (Open Places) | 221px (Docker) | 78px | 211px |
| 390 | 716.2px | 732.9px | 227px (Exa) | 211px (Docker) | 158px | 158px |

The frame grew by 16.6px at both widths. That is the new capability line above every card.

At 320, `heights.mjs` measured the frame on `next dev` at 796px. GitHub is still the tallest slide.

On a 1440×1000 first screen, the example card now starts about 150px lower: the chooser grew from 78px to 211px, and the capability line adds 17px. The card's headline, uses and chart are above the fold; its footer is not. This was seen in the e2e full-page capture from `next dev` at this commit, which is not committed.

## Options tried and rejected

**Chooser.** Option A put the second line on every toggle at every width (`prototypes/chooser-a-1440.png`, `prototypes/chooser-a-320.png`). The chooser was 557px tall at 320, a wall. Option B, kept, hides the second line below 600px (`prototypes/chooser-b-390.png`). That gives 158px at 390 (unchanged) and 199px at 320.

**Back hint.** "Open Clay's slide on its back" (`prototypes/backhint-back-1440.png`) made the shared frame 1263px at 1440 and 1587px at 320, up from 670px and 796px, and it hid the front's first number. The footer hint was kept (`prototypes/backhint-footer-320.png`). At 320 it wraps onto two lines, and Clay is still well under the frame.

**Compact measurement on the front.** Before the fix in `d61c5c4`, Clay's front carried every recording detail. Clay became the tallest slide at 390 and 320, and the frame grew when its brand font loaded. The e2e check caught this: 735px became 761px at 390.

## Caveats

- Every number on the homepage is an illustrative sample. Activity is labelled "Illustrative sample, not account data" and stale. Clay's measurements carry the schema's `synthetic` origin.
- Paid links and work-sample links go to the product's own public pages, and the slide caveat says so.
- The prototype captures are from `next dev`, so the dev-tools badge shows in them.

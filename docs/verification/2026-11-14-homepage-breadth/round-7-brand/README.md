# Homepage breadth, round 7: Clay's table and the brand look

Captured 2026-11-14 with `scripts/brand-fidelity.mjs` from this checkout's own `next dev` on port 3291 in reference test
mode, at commit `6dc750b92cf4d718b92e899ccce933ba37f50506`. The card data is the homepage's synthetic samples, not
anyone's account.

The left half of each pair is the brand's public home page from the round 6 reference capture (not recaptured this round).
clay.com offers only "Accept all", so its cookie banner stays unanswered in the picture. Each picture was opened and looked
at before it was marked.

Rerun: `node scripts/brand-fidelity.mjs card --base http://127.0.0.1:<port> --label <label> --only clay,github,cloudflare,docker,firecrawl`,
then `compare` and `pairs` with the same label. The Clay captures are each card face alone at 1440, 390 and 320, viewport
height 1000, reduced motion.

The script's automatic assertions: 67 passed, 4 failed, 9 untested. The failures are listed under each brand below.

## Targets

| Target | Evidence | Result |
| --- | --- | --- |
| Clay's table is a lead list: person and title, work email, waterfall, job change | `clay-card-front-1440.png` | passed. Ana Ruiz, VP Sales, Nimbus; invented names, `.example` domains. |
| Every signal is the job change the caption names | `clay-card-*.png`, `src/data/homepage-examples.test.ts` | passed. New role, Promoted, Joined, each with an age. |
| One summary line a Clay user respects, consistent with the card's numbers | `clay-card-*.png`, data test | passed. "171 of 214 emails found · 80% · 3-provider waterfall · 2.3 credits a row". 27,600 / 11,800 = 2.3; 27,600 is inside Launch's 30,000. |
| The waterfall's marks explained visibly | `clay-card-*.png` | passed. A key in the table's title bar: found it, missed, not asked. |
| No sideways scroll on either face at 390 and 320; every column's value readable | `clay-card-*-390.png`, `clay-card-*-320.png`, `tests/e2e/usage-examples.spec.ts` | passed. Rows stack into blocks, each value beside its column's label; scrollWidth equals clientWidth on both faces. |
| Clay's card bottom at 1440×1000 is 1000 or less | e2e test | passed. The front shows three rows; the back carries on with rows 4 and 5. |
| 12px minimum text, no split words, hyphenated words whole | e2e tests | passed at 1440, 390 and 320. |
| Clay's wordmark beside the arch | none | not done. The only proxy-reachable wordmark (Context.dev logo, 509×163) has black "clay" text, 2.6:1 on the `#035d44` slab. |
| Cloudflare's orange from the card's top through the headline, white headline at 24px | `cloudflare-*.png`, e2e test | passed. White on `#ff5e1f` is 3.05:1 at 24px; eyebrow, Sample tag and arrow keep `#262626` at 4.95:1. |
| Cloudflare's wordmark in white | `cloudflare-*.png` | not done. Making it white means recolouring the mark. It sits on a white tile instead, because its orange cloud matches the slab. |
| Firecrawl's second headline phrase in orange | none | not done. It needs a new prop passed through `components/product-example.tsx`, which belongs to the other writer. |
| Firecrawl's header at 390 | e2e test (the pair predates this fix, commits 953d2ab and 8ae13d3) | passed. On a phone the Referral link tag takes its own row under the arrow, so the status line keeps one line at 390. At 320 it still wraps. |
| Exa's 3,690 without gaps around the comma | e2e test | passed. The comma's box is 0.36em; it was 0.59em, a tabular figure's width. |
| Clay's icon at 15 KB or less for a 2x screen | e2e test | passed. A 96px rendition from `/_next/image` is 2.6 KB; the original is 267 KB. |

## Clay

Reads right: the green slab and white type match the hero. The lime "Found" pills echo the site's lime "Get a demo" button.
The table now reads as a lead list a Clay user would build: people, their titles, addresses found by a waterfall, and the
change that triggered each row.

Reads wrong: the arch stands alone without the "clay" wordmark. clay.com's hero is mostly illustration, which the card does
not and should not copy. At 390 the stacked rows make the card long, 900px at 390 against 629px at 1440.

Assertions: 14 passed, 0 failed, 2 untested (no plain body text on the site's first screen; no chart on Clay's card).

## Cloudflare

Reads right: the orange runs from the top through a white headline, as on cloudflare.com's hero, and the card's corners
take the hero's 16px. Close details on the slab is a white pill with dark text, like "Start building for free".

Reads wrong: the logo sits on a white tile inside the orange, which the site never does; on the site the logo is on the
white nav above the hero. The eyebrow and Sample tag are dark, where the site's small text on orange is white (white fails
4.5:1 there).

Assertions: 10 passed, 2 failed, 4 untested. Failed: the button fill is `#ff5e1f`, where the site's measured primary is the
white hero button; the card's 16px corners against the site's square panels, by design.

## GitHub

Reads right: green "1,121" in the served Mona Sans, the calendar in a framed panel, the green Details button. Unchanged this round.

Reads wrong: the site's headline mixes black and green words; the card's headline is all black.

Assertions failed: the chart's green `#216e39` against the site's measured link blue `#0969da`. The measurer picked the
link colour; the site's contribution greens are the right reference.

## Docker

Reads right: the dark slab through the headline, the blue Details button, the dark linked-works panel. Unchanged this round.

Reads wrong: at 390 "Multi-stage build guide" wraps with a wide gap, which is the other writer's back and phone layout.

## Firecrawl

Reads right: the orange 5,520 and bars, the dotted-grid chart frame, the mono eyebrow, the orange Details button.

Reads wrong: the headline is all black, where firecrawl.dev sets its second phrase in orange. The pair shows the eyebrow
wrapping at 390; after 953d2ab it stays on one line there, and still wraps at 320.

Assertions failed: the button label is `#262626`, where the site's is white. White on `#ff4c00` is under 4.5:1 at the
button's 12px.

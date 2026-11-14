# Homepage breadth, round 3

Captured 2026-11-14 from this checkout's own `next dev` on port 3219, at commit
`f545fd98529905ab9241a723f8cca2f831ff5c8e`, with no uncommitted changes under
`app`, `components`, `src` or `next.config.ts`. `capture.mjs` checked that the
listening process's working directory is this checkout before it took any
picture, and `capture.json` holds that proof with each value it read off the
page. Every picture is at deviceScaleFactor 2, with reduced motion. Each was
looked at by eye before it was marked below. A target that renders correctly
but still looks weak, cramped or off-brand is marked failed, with the reason.

Rerun: `node docs/verification/2026-11-14-homepage-breadth/round-3/capture.mjs --base http://127.0.0.1:<port>`
against a dev server started from this checkout.

| Target | File | Result | What it shows |
| --- | --- | --- | --- |
| Collapsed chooser, 1440×1000 viewport | `chooser-collapsed-1440-viewport.png` | passed | One 36px row: Clay, Cloudflare, Firecrawl, GitHub, n8n, More examples. Clay's footer ends at 965px, inside the 1000px screen. |
| Collapsed chooser, 390 | `chooser-collapsed-390.png` | passed | The five names on one row, More examples on the next: 77px. |
| Clay front, 1440 | `clay-front-1440.png` | passed | Five invented rows filling in, three numbers in a row, cost, footer. No disclosure sentences on the front. |
| Clay front, 390 | `clay-front-390.png` | failed | No sideways page scroll. The table scrolls inside its box, so Work email and Status start out of view; the row that looks alive is off to the right. |
| Clay back, 1440 | `clay-back-1440.png` | failed | Cost, all three rows with exact periods, both disclosure sentences, work sample. It is a long wall of provenance text. |
| Clay front beside clay.com | `clay-front-beside-clay-com.png` | failed | Same green band, lime button, type and icon. The site leads with a 3D illustration and big type; the card is a white table, so the likeness is the kit, not the feel. |
| Cloudflare front, 1440 and 390 | `cloudflare-front-*.png` | passed | 31 daily bars with lower weekends, "Costs $5/month · owner-reported" above "Owner-selected go-to". |
| Firecrawl front, 1440 and 390 | `firecrawl-front-*.png` | passed | Twelve weeks growing from 120 to 1,100, "Jun–Aug 2026 · last updated Sep 2026". |
| GitHub front, 1440 | `github-front-1440.png` | passed | All 53 weeks inside the card at 7px cells; quiet weekends and the new-year break are visible. |
| GitHub front, 390 | `github-front-390.png` | passed | The calendar opens at the newest weeks (Feb to Aug in view) and scrolls left for the rest. |
| n8n front, 1440 and 390 | `n8n-front-*.png` | failed | Reason under the headline, "I used it to", weekly runs that stop with two zero stubs. The hero number is 0 and the bars are near-black, not n8n's pink: no n8n accent passes the chart contrast rule on its #fafafa surface. |
| More examples opened, 1440 | `chooser-more-1440.png` | passed | All fourteen in one group, More examples (now "−") on its own row. The counter stays "1 / 5" until one of the nine is picked. |
| Open Places front, 1440 | `open-places-front-1440.png` | passed | Nine empty weeks drawn as stubs on the baseline, three spikes. |
| Elicit front, 1440 | `elicit-front-1440.png` | passed | Reason under the headline, "I used it to", a tail off to zero. The hero number is 0, which is true for a stopped tool. |

Element counts in the carousel at 1440: 2,870 before this round (14 slides
mounted), 1,780 with the five featured, 3,184 once More examples is opened.

Every slide frame is as tall as the tallest mounted card, so shorter cards
(Firecrawl, Elicit, Open Places) sit above an empty band. That was true before
this round and is still true.

The round dot at the bottom left of the 1440 viewport picture is Next's
development indicator. It is not part of the page.

## Review comments and CI on this round

| Source | Finding | Disposition |
| --- | --- | --- |
| Copilot, `src/data/homepage-sample-usage.json:3` | Claude Code's sample said 22 active days beside a series with 24 days that have a session. | Fix now: `85c616f` counts active days from the series, and a unit test fails if a coding sample's sessions or active days differ from it. |
| CI `npm test` at `540751d` | `measurement-publication.test.ts` expected raw digits; the card shows grouped thousands since `59098d6`. | Fix now: `4056579` asserts the grouped value. |


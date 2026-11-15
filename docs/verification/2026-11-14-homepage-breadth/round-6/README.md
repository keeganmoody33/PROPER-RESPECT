# Round 6: phone experience, card backs and real-card numbers

Updated: 2026-11-14.

Synthetic evidence only. The homepage examples are invented samples and `/keegan` is the reference test-mode fixture. No real account, provider or deployment was read.

- Branch `feat/homepage-brand-examples`, captured at commit `654dcf0` with 0 tracked files changed (verify skill `doctor.sh`, port 3261, reference test mode).
- Widths 1440×1000, 390×844 and 320×844, reduced motion, deviceScaleFactor 2.
- Floors: the verify skill's snippet as written, on both faces of all 14 cards at each width.

## Targets

| Target | Result | Evidence |
| --- | --- | --- |
| At 390 a pick from the chooser leaves the card's top between 0 and half the screen, and the tapped name moves at most 20px | Passed. n8n picked: name at y=793 before and after, card top 397 | `390-after-picking-n8n.png`; e2e "picking an example from the chooser" at 390 and 320 |
| At 390×844, scroll 0, the card's top is at most 450 | Passed. Card top 397 | `390-first-screen.png` |
| The held chooser row never covers the copy or Start your collection | Passed. With the card's last 60px at the top, the row sits back under the card | `390-card-tail-at-top-row-let-go.png`; e2e "the held row lets go" |
| After Details at a card's foot, the back's heading is in view | Passed. Card top -34 before; after the turn card top 0, heading 31, Close details 19, focus on the heading | `390-after-flip-from-foot.png` |
| After Close details, Details is in view, clear of the held row | Passed. Details 714 to 758, row at 793 | `390-after-close.png` |
| No word or number splits on either face of the 14 cards at 1440, 390 and 320 | Passed. split = 0 at every width | Floors run; e2e "every word and number … stays whole" |
| Text at least 12px, targets at least 44px at 390 and 320, no sideways scroll | Passed. small = 0, targets = 0, sideways = 0 | Floors run; e2e tap-target checks for all 14 cards |
| No cut text | Passed for visible text. The snippet counts 8 per width, all 1px screen-reader-only boxes: the GitHub calendar's summary sentence and the visually hidden names on Cloudflare's and n8n's wordmark cards | Floors run |
| No back leaves an empty band over 24px | Passed for all 14 at 1440 and 390 | e2e "no back of the fourteen leaves an empty band" |
| At 1440 no featured back is taller than its front | Passed. Clay, GitHub, Cloudflare, Docker and Firecrawl grow 0px; Clay's back ends at y=981 of 1000 | `1440-*-back.png`; e2e "no featured card grows" |
| On a phone a featured card grows at most 40px when it turns | Failed for Clay (+57 at 390), GitHub (+82 at 390, +114 at 320) and Cloudflare (+102 at 390, +189 at 320). The growth goes below the card; its top stays put | Heights table; e2e "turning … while it is in view" for Clay, GitHub and Cloudflare |
| The turn never shows a face cut at the card's edge | Passed. The face fades up from 96% and stays inside the card at every tenth of the turn; none under reduced motion | e2e "mid-turn, the incoming face stays inside" |
| GitHub's back holds what the front can't | Passed. Contributions each month and the busiest month, in words | `1440-github-back.png` |
| `/keegan`'s GitHub card leads with the days it draws | Passed. "22 contributions", "20–26 Jul 2026 · last updated 26 Jul 2026"; the back names its one part-month "20–26 Jul 2026" | `390-keegan-github-front.png`, `390-keegan-github-back.png` |
| Brand likeness side by side with each brand's site | Untested in this round. The brand look is another writer's area | None |

## Front and back heights (px)

| Card | 1440 front/back | 390 front/back | 320 front/back |
| --- | --- | --- | --- |
| Clay | 626/626 | 775/832 | 959/959 |
| GitHub | 534/534 | 580/662 | 657/771 |
| Cloudflare | 549/549 | 609/711 | 675/864 |
| Docker | 503/503 | 644/657 | 742/754 |
| Firecrawl | 484/484 | 557/572 | 687/687 |
| n8n | 497/497 | 576/576 | 596/632 |
| Claude Code | 579/579 | 681/681 | 739/789 |
| Exa | 447/475 | 469/595 | 551/668 |
| Porkbun | 449/449 | 520/520 | 585/603 |
| Spider | 490/490 | 553/592 | 704/704 |
| Open Places | 441/441 | 514/527 | 570/680 |
| Grok Bot | 452/452 | 524/524 | 540/630 |
| Elicit | 480/480 | 552/553 | 588/608 |
| Context.dev | 446/446 | 499/539 | 625/625 |

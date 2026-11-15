# Earn your respect: verification, 15 Nov 2026

All data here is synthetic: homepage sample cards in reference test mode, with no sign-in, no backend and no owner account.

- **Commit.** `0ef4b0e` on `feat/homepage-brand-examples`. The verify skill's `doctor.sh 3281` reported 0 tracked files changed, so the server served exactly that commit.
- **Server.** `next dev` on 127.0.0.1:3281, started by `launch.sh` with `PROPER_RESPECT_E2E_REFERENCE=1`.
- **Widths.** 1440×1000, 390×844 and 320×700.
- **Settings.** Reduced motion. Captures at deviceScaleFactor 2.

## Captures

| File | What it shows |
| --- | --- |
| `first-screen-1440x1000.png` | The hero at 1440. Tagline, headline, two actions, and the carousel showing Clay's card. |
| `first-screen-390x844.png` | A phone's first screen. Tagline, headline, Clay's card with its number above the examples bar. |
| `clay-front-1440.png` | Clay's front at 1440. |
| `clay-front-390.png` | Clay's front at 390. |

## Targets

### First screen

| Target | Result | Evidence |
| --- | --- | --- |
| At 390×844, "A personal record of the tools you use." is in the first screen. | Passed | Tagline 177–193px, above the heading. |
| At 390×844, the card's top is at 300px or less. | Passed | 296px. |
| At 390×844, the card's number sits above the examples bar. | Passed | Number bottom 500px, bar top 785px. |
| At 320×700, the card's number sits above the examples bar. | Passed | Number bottom 535px, bar top 641px. |
| At 1440×1000, each of the five featured cards fits whole in the first screen. | Passed | Card bottoms: Clay 672px, GitHub 844px, Cloudflare 840px, Docker 727px, Firecrawl 799px. |

### Hero copy

| Target | Result | Evidence |
| --- | --- | --- |
| The hero has no copy beyond the tagline, the headline, "Start your collection" and "View Keegan's shared collection". | Passed | Unit test `src/server/homepage.test.ts`; both first-screen captures. |
| The hero's three facts still appear elsewhere on the site, word for word. | Passed | Privacy "What becomes public", privacy "Disconnecting and deleting are different", terms "Disclose affiliate and referral links". Unit test. |

### Cards

| Target | Result | Evidence |
| --- | --- | --- |
| Each of the 14 fronts sets one big number and at most two supporting counts. | Passed | Unit test `src/data/homepage-examples.test.ts`. |
| No front draws Clay's table, a waterfall or a match rate. | Passed | Unit test; `clay-front-*.png`. |
| Each slide says Sample once on its front, plus the one line above the card wider than 600px. | Passed | `usage-examples.spec.ts` "all fourteen fronts say Sample once", at 1440 and 390. |
| Text is at least 12px on both faces of all 14 cards, at 1440, 390 and 320. | Passed | Floors snippet: no small text found. |
| Every link and button is a 44px tap target at 390 and 320, on both faces. | Passed | Floors snippet. |
| No page scrolls sideways, and no word breaks across lines, on both faces of all 14 cards at all three widths. | Passed | Floors snippet. |
| No visible text is cut off. | Passed | The snippet flagged three elements, all screen-reader-only and 1px wide: GitHub's `.contribution-summary`, and the wordmark-hidden `h2.card-product-name` on Cloudflare and n8n. They are present on every commit and are not visible. |

### Rubric changes

| Target | Result | Evidence |
| --- | --- | --- |
| Each featured front draws a different kind of thing (from the verify skill's rubric). | Changed | Clay (one published number) and Docker (one running total) are both a number alone. The owner's direction, that each card is its tool's meter, overrides the rubric here. |
| A featured card's back fits within its front's height. | Changed | Fronts lost their uses list and Clay's table, so backs that list a chart's every value now run longer. Growth at 1440: Clay 19px, Cloudflare 30px, Firecrawl 21px. At 390: GitHub 68px, Firecrawl 80px. At 320: GitHub 111px, Cloudflare 36px, Firecrawl 72px. The two height tests were replaced: the "turning a card in view moves neither the page nor the card" test now covers all five featured cards at 1440, 390 and 320, and passes. |

### Not tested

| Target | Result | Evidence |
| --- | --- | --- |
| Each card's brand matches the brand's own site, side by side. | Untested | This change touched no brand look. The other writer owns brand look. |

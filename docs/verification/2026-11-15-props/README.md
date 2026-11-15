# Props credit: verification, 15 Nov 2026

All data here is synthetic: the private collection fixture, the homepage sample cards and the `/keegan` reference profile, in reference test mode with no sign-in, no backend and no owner account. A save in the fixture proves the form and its checks, not storage; storage is covered by the Convex tests.

- **Commit.** `41ff85d` on `feat/props-put-on-by`. The verify skill's `doctor.sh 3251` reported 0 tracked files changed, so the server served exactly that commit.
- **Server.** `next dev` on 127.0.0.1:3251, started by `launch.sh` with `PROPER_RESPECT_E2E_REFERENCE=1`, stopped by `teardown.sh`.
- **Widths.** 1440×1000 and 390×844. Light theme, reduced motion, deviceScaleFactor 2.
- **Measurements.** `floors.json` holds each credit's text, font sizes, link heights, contrast against the surface behind it, the gap to the footer, overflow and sideways scroll.

## Captures

| File | What it shows |
| --- | --- |
| `editor-question-default-1440.png`, `-390.png` | "Who put you on Clay? (optional)" before any answer: Proper Respect preselected, the hint encouraging a Proper Respect handle. |
| `editor-refused-1440.png`, `-390.png` | X with a pasted status link: the form refuses it with "That link isn't a profile on X. Paste their X profile link or just the handle." |
| `editor-question-saved-1440.png`, `-390.png` | After saving `@jack`: X kept, the handle saved as `jack`. |
| `editor-private-card-1440.png`, `-390.png` | The owner's private Clay card: "Props to @jack · X", no report link. |
| `home-clay-1440.png`, `-390.png` | Clay sample: "Props to @lecturesfrom · Proper Respect", linked. |
| `home-n8n-1440.png`, `-390.png` | n8n sample: "Props to @keeganmoody33 · GitHub", linked. |
| `home-spider-1440.png`, `-390.png` | Spider sample: "Props to a teammate · Slack", plain text. |
| `keegan-github-1440.png`, `-390.png` | The reference profile's GitHub card with its credit and "Not you? Report". |
| `keegan-page-1440.png`, `-390.png` | The whole reference profile. |

The 390 captures of n8n and Spider are cut at the foot by the homepage's fixed examples bar, which overlaps the card in an element screenshot. The credit line is above the bar in both.

## Targets

| Target | Result | Evidence |
| --- | --- | --- |
| The editor asks who put the owner on the product, with Proper Respect first and preselected, and says why a Proper Respect handle is best. | Passed | `editor-question-default-*`. E2E `an owner credits who put them on a product, privately`. |
| A pasted link that isn't a profile on the chosen platform is refused before saving, with a message the owner can act on. | Passed | `editor-refused-*`. |
| A pasted `@` saves as the bare handle and the form shows it after saving. | Passed | `editor-question-saved-*`, `floors.json` `handleValue: "jack"`. |
| The owner's private card shows the credit and no report link. | Passed | `editor-private-card-*`. |
| Each credited homepage sample reads "Props to <name> · <platform>", one line above the footer, linked only where allowed, with no report link. | Passed | `home-*`. Unit test in `src/data/homepage-examples.test.ts`. |
| The published GitHub card shows the credit and "Not you? Report" naming the page and the card. | Passed | `keegan-github-*`. E2E checks the mailto subject. |
| Credit text is at least 12px. | Passed | 12.8px for the line and the handle, 12px for the report link, every capture. |
| At 390 every credit link is at least 44px tall. | Passed | 44px for each handle link and the report link; at 1440 they are text-height (15px and 19.2px), as other card links are on desktop. |
| Credit text has at least 4.5:1 contrast against the surface behind it. | Passed | 13.27 (private Clay), 18.93 (Clay sample), 17.34 (n8n), 18.45 (Spider), 15.48 (GitHub profile). |
| The credit sits just above the footer and causes no overflow or sideways scroll. | Passed | 12.8px gap to the footer in every capture; `overflow` and `sidewaysScroll` false. |
| The credit reads well on all fourteen homepage cards, at worst-case lengths, at 1440, 390 and 320. | Passed, with one note | Worst-case pass below. Every card showed its credit inside the front, at least 12px, with no short tap target, no sideways scroll, and contrast from 6.26:1 (Claude Code) to 21:1. A long handle with no spaces wraps inside itself: at hyphens first, and a 100-character LinkedIn slug wherever it must. |
| The credit and its report link read well on a real card with the longest handle. | Passed | `worst-keegan-linkedin-100-320.png`: the slug wraps over four lines inside the card, and both links stay 44px tall. |
| Dark theme. | Untested here | Captured in light only. The credit takes the card's own text colour, and the existing theme e2e checks pass. |

## Worst-case pass

At `a45e3b9`, a throwaway edit, not committed, gave all fourteen homepage examples a credit, rotating through eight at each platform's longest: a 39-character Proper Respect handle (linked), a 100-character LinkedIn slug, an Other credit at its 40 and 30 character caps, a 15-character X handle, a 30-character YouTube handle, a 30-character Instagram username, a 32-character Substack handle and a 39-character GitHub username. The reference profile's GitHub card took the 100-character LinkedIn slug, with its report link. The doctor reported the two edited data files as the only changes. Each front was measured at 1440×1000, 390×844 and 320×700 with the verify skill's floors snippet; `worst.json` holds all 45 rows.

| Measure | Result |
| --- | --- |
| Credit shown inside the front | 45 of 45 |
| Text under 12px | none |
| Tap targets under 44px at 390 and 320 | none |
| Sideways scroll | none |
| Credit contrast | 6.26:1 to 21:1 |
| Words broken across lines | Only the 39-character Proper Respect and GitHub handles at 320, which wrap at a hyphen, and the 100-character LinkedIn slug, which has no other place to wrap. |
| Cut text | "Cloudflare", "n8n" and GitHub's calendar summary, which are visually hidden or scrolling elements that report the same without a credit. |

| File | What it shows |
| --- | --- |
| `worst-clay-proper-respect-39-320.png` | A 39-character Proper Respect handle at 320, wrapping at its hyphen. |
| `worst-cloudflare-other-40-30-320.png` | Other at both caps at 320, on two lines. |
| `worst-keegan-linkedin-100-320.png` | A 100-character LinkedIn slug with the report link at 320. |

# Brand fidelity: each homepage card next to its product's site

Date: 2026-11-14. Branch `feat/homepage-brand-examples`.

## What was checked

`scripts/brand-fidelity.mjs` opened each product's own site at 1440x900 and 390x844, measured 15 computed traits at 1440, and measured the same traits on the homepage example card. `tests/support/brand-fidelity.ts` compares them with tolerances fixed before the first comparison ran. [`targets.md`](targets.md) lists the 192 target statements, which were written before any capture.

- Before: cards at `0062575`. That commit is `ebafdc2` plus a `.gitignore` line, so its app code is the same as `ebafdc2`. Server proof: [`server-before.json`](server-before.json). See [`assertions-before.md`](assertions-before.md).
- After: cards at `d9b4864`. Server proof: [`server-after.json`](server-after.json). See [`assertions-after.md`](assertions-after.md).
- The server proof shows the port's listener, its PID, and that the listener's working directory is this checkout. The script refuses to capture otherwise. The only uncommitted files were `next-env.d.ts`, which `next dev` rewrites, and the capture script itself.
- Sites were captured on 2026-11-14. A cookie control was pressed only when its name was a plain "Decline" or "Reject" (optionally "all"). Docker, n8n and Spider had a control with such a name, and a press was attempted. The script does not confirm the press, and none of the three shows a banner in its capture. Clay's banner offered only "Accept all" and "More choices", so it was left on screen, and it shows in Clay's capture.
- The RED run of the rule tests is in [`red-brand-kit.txt`](red-brand-kit.txt).

| | Passed | Failed | Untested |
| --- | --- | --- | --- |
| Before (`0062575`) | 117 | 46 | 29 |
| After (`d9b4864`) | 118 | 45 | 29 |

Four rows changed between the two runs. All four were measured:

- GitHub button fill went from `#0d6731` (failed) to `#08872b` (passed).
- Spider chart went from `#94a3b8` to `#24c45c`. It still fails at OKLab distance 0.076 against the site's `#3bde77`.
- Cloudflare's card radius went from 6px to 4px. That trait is untested on the site.
- Exa's card radius went from 6px to 4px. It still passes.

## Pairs

The site is on the left and the card is on the right, at the same width class: [`pairs/`](pairs). The failure as captured before any fix is in [`before-pairs/`](before-pairs) for Spider and GitHub.

Some 390px cards (Clay, Cloudflare, Docker, Firecrawl, GitHub) have a dark circle on their lower-left edge. That circle is not part of the card. It is the Next.js dev-mode indicator, measured at x 20, y 788, 36 by 36px in a 390x844 viewport, and it overlaps the element screenshot. At 390px the long Open Places site caption runs into the card caption.

The 390 pairs do not change any verdict below. At phone width the cards keep their chips, wordmarks and charts inside their edges.

## Per brand, after looking at each pair

- **Clay.** The card does not read as Clay. clay.com opens on a green illustrated hero with a lime "Get a demo". The card is plain white, with Clay's stored black button and a blue link glyph, and it has no chart. Still failing: text colour (the site's hero text is white over the illustration), button fill and label (the site's lime call-to-action against the stored black one), and button and label case.
- **Cloudflare.** Reads as Cloudflare: orange bars, an orange pill button and the wordmark. Still failing: button fill and text. On the site the call-to-action is white on an orange panel, and the card fills its button orange because white would vanish on its white surface. Case also fails. Panel and label traits are untested: the only panel is full width, and the nav labels are larger than 14px.
- **Context.dev.** Reads as Context.dev: blue bars and a blue pill. Still failing: button fill (the site's black pill against the accent, which the card falls back to because the stored white outline would vanish), panel radius (25px on the site, 7.2px stored), and case.
- **Docker.** Reads as Docker: blue bars and a blue button. Still failing: panel radius (the site's cards are square, 18px stored) and case.
- **Elicit.** Reads as Elicit: dark teal and a serif heading. Still failing: button fill and bars. The stored accent `#083d44` is darker than the `#026370` the site's call-to-action renders today, at OKLab distance 0.13. Text colour and case also fail. Panel and label traits are untested: there were no bordered panels or small labels in the first viewport.
- **Exa.** Reads as Exa: blue bars, a black button and the serif heading. Still failing: text colour (the site's grey subtitle), case, and label letter-spacing (the site's 0.08em uppercase labels such as "LATENCY").
- **Firecrawl.** Reads as Firecrawl: orange bars and an orange pill. Still failing: button label colour, because white on `#ff4c00` is 3.3:1 and the 4.5:1 floor keeps the card's text colour. Also panel radius (20px on the site, 8px stored), chip radius (the stored button is 20px, the site's renders at 10px), and case.
- **GitHub.** Reads as GitHub, and the button is now the site's sign-up green. Still failing: the chart, which uses GitHub's fixed contribution colours where the rule picks the site's link blue, and case.
- **n8n.** Only partly n8n: the pink pill button is right. Still failing: the bars are near-black, because n8n's pink is 1.5:1 on the card and the 3:1 floor replaces it. The site's monospace, uppercase buttons and labels are missing, because the provider gives no data for them. Panel radius also fails (34px on the site, 8px stored).
- **Open Places.** Reads as Open Places: green bars and a green button. Still failing: button radius (the site's call-to-action is a pill, while the stored primary is its 12px sidebar "Home" button), text colour (the site's muted paragraph), and case.
- **Porkbun.** Untested. porkbun.com answered 403 with a bot-block page warning of countermeasures after repeated attempts, so it was captured once and not retried.
- **Spider.** Closer, but not yet Spider. The bars and link glyph are now its green, and the dark surface, square button, Fraunces heading and Inter body match. Still failing:
  - The site's labels and buttons are monospace and uppercase at 0.14em. The provider gives no data for this: its "Berkeley" font link has no files and no category, and no field carries text-transform or letter-spacing.
  - The card's corners are 8px, the stored card radius, while the site measures 0px.
  - The bars use the stored logo green `#24c45c`, a darker shade of the site's `#3bde77`. They differ by OKLab distance 0.076, over the 0.05 tolerance.
  - The card's text colour is compared with the site's muted paragraph colour.

## Not fixed, with the measured reason

- **Case, 16 rows across 8 brands.** The card sets its button in uppercase through CSS. Its status line is uppercase in the text itself. Eight of the ten sites captured write both as written, and Spider and n8n use uppercase. The provider returns no text-transform, so no rule can choose per brand. Changing the house default is an owner call.
- **Monospace labels, letter-spacing.** Of the 4 measurable sites whose provider data names a font link with "Mono" in it (Exa, Firecrawl, GitHub, n8n), only n8n uses monospace labels, so a font link does not predict them. Spider's monospace face is named "Berkeley", with no "mono" in the name.
- **Panel radius.** The stored card radius disagrees with the measured panels on Spider, Docker, Context.dev, Firecrawl and n8n, and button radius does not predict it either. This is a gap in the provider's data.
- **Text colour.** The site side measures the first paragraph, which is often a muted subtitle. The card uses the provider's text colour, which passes its contrast checks.

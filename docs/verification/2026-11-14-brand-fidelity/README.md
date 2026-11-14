# Brand fidelity, round 2: measuring each product's own site

Date: 2026-11-14. Branch `feat/homepage-brand-examples`. Round 1 (provider data only) is kept as it was in [`round-1/`](round-1).

## What changed

Round 1 found what the provider's data lacks: the label and button type, their case and letter-spacing, the colour a site is known by, and corners that match the site. The owner asked for a second pull step for the 14 homepage examples. After the provider pull, measure the product's own site, store the measurement beside the brand, and derive the card from both by fixed rules.

- `scripts/brand-site-measure.mjs` is the one measurer. The fidelity check and the pull both use it.
- `src/domain/brand-site-traits.ts` validates what it stores. Every value is a hex colour, a px or em number, a family name or an enumeration, each with where on the page it was found.
- `scripts/pull-homepage-site-traits.mjs` writes `src/data/homepage-brands/<slug>.site.json`. It reads the saved measurement when there is one. Two runs over the same saved measurements wrote byte-identical files (SHA-1 of `clay.site.json` was `fd088e82…` both times, and the same held for all 11 files).
- `src/domain/brand-kit.ts` applies the rules. A card reads a site file only beside the brand it was measured for.

## Sites

Eleven sites were measured on 2026-11-14 at 1440x900. Porkbun answered 403 with a bot-block page in round 1. It was not asked again and has no site file. Claude Code and Grok Bot have no brand, because their listed domains belong to a parent company, so no site was measured for them.

## Rules, each tested red first ([`red/`](red))

1. **Corners.** The card takes the median radius of the site's bordered panels (0 to 24px). The button takes the radius of the site's call-to-action, and a pill stays a pill.
2. **Button.** The site's call-to-action leads the fill chain: its fill, label, outline, family, case and letter-spacing. The 1.5:1 fill floor and the 4.5:1 label floor still decide.
3. **Signature colour.** This is the most colourful of the call-to-action, the heading highlights, a colour hero and the logo. When it differs from the provider's accent by more than OKLab 0.05, it draws the bars (at 3:1) and the link glyph (at 4.5:1). If it fails its floor, the card tries the site's hero colour, then the provider's accent, then its own text colour.
4. **Labels.** The status line, the status row, the footer label and the chips take the site's small-label family, case and letter-spacing.
5. **Hero band.** This rule applies when the site's first heading sits on a backdrop at least 90% of the viewport wide, and at least half the pixels beside the heading are that colour. The card's headline then sits on a band of that colour. Its label colour is set by the 4.5:1 floor.
6. **Case.** The status line is typed as written ("Daily · since 2025"). `--brand-card-label-case` and `--brand-card-button-case` set its case. Without them, the card keeps the house look.

**Fonts.** A measured family the card already loads for its body is reused: labels and buttons for Clay, Context.dev, Docker, Exa, Firecrawl, GitHub and Open Places, and buttons only for Cloudflare and Elicit. Spider's Berkeley and n8n's Baumer Mono have no stored file, so they fall back to `ui-monospace, "SF Mono", Menlo, monospace`. No font file was downloaded or committed.

**Hero band, chosen by comparison ([`band-trials/`](band-trials)).**
- (a) A band behind the logo and title row read most like Clay. It was rejected because it hid Cloudflare's orange cloud on an orange band.
- (b) A thin strip along the top edge kept every logo. It was rejected because Clay's card still read as plain white.
- (c) The band behind the headline kept every logo and reads as each site's heading on its hero. It was chosen.

The band fires for Clay (green `#035d44`) and Cloudflare (orange `#ff5e1f`). Docker's dark hero panel is 81% of the width, so Docker gets no band.

## Corrected definitions (all brands, before table re-baselined)

- **Site text colour.** Round 1 used the first paragraph, often a muted subtitle. It is now the colour that stands off the page background most, among text colours carrying 20 or more characters of plain text on that background.
- **Capitals.** Text typed in capitals counts as uppercase only from four letters. "US" and "UK" made Open Places' labels count as uppercase.
- **Label letter-spacing.** This is now the median of the labels in the case the site's labels count as, not of an uppercase minority.

The before table compares the cards at `2ba6aa8` (app code unchanged since `238c87c`) with the same round-2 site capture and definitions as the after table.

| | Passed | Failed | Untested |
| --- | --- | --- | --- |
| Round 1 as published | 118 | 45 | 29 |
| Before (`2ba6aa8`), re-baselined | 121 | 40 | 31 |
| After (`caa54ea`) | 156 | 5 | 31 |

Most after-passes hold by construction, because the rules read the same capture the check compares against. The five failures are where a floor or missing data overrode the site. The pairs are the real judgement. Per-brand before and after counts are in [`assertions-before.md`](assertions-before.md) and [`assertions-after.md`](assertions-after.md).

## Per brand, after looking at each pair ([`pairs/`](pairs), site left, card right)

- **Spider.** Clearly better. The card has square corners and a white square button, and its labels, chips and button are monospace uppercase at 0.14em. The bars and glyph are its heading green `#3bde77`. Still off: Berkeley itself cannot load (system monospace is used instead), and the tracked chips wrap, so the card is taller.
- **Clay.** Clearly better. The headline sits on Clay's green with white text, the button is its lime with a black label, and the labels are as typed. Still off: the site's illustration is not carried, there is no chart to show the bar rule, and the 48px panels are held to 24px.
- **Cloudflare.** Reads as Cloudflare: an orange headline band and an orange pill. Still off: the site's call-to-action is white on orange, which would vanish on the white card. No small labels were measured, so the status line keeps the house uppercase.
- **Context.dev.** Reads as Context.dev: its black pill, 24px corners and blue bars.
- **Docker.** Reads as Docker: square corners and a blue button with the site's black outline. Its dark hero panel is not carried.
- **Elicit.** Reads as Elicit: the bars and button are the teal its site renders today. The status line stays uppercase because no small labels were measured.
- **Exa.** Little changed. It still reads as Exa. Still off: the text colour is the provider's `#000000` against the site's `#111827`.
- **Firecrawl.** Reads as Firecrawl: 20px corners and 10px button corners. Still off: the label on the orange button stays dark, because white on that orange is 3.3:1.
- **GitHub.** Reads as GitHub: its sign-up green on the button and glyph. Still off: the chart is the contribution calendar in GitHub's fixed greens, and the check compares it with the site's link blue.
- **n8n.** Now reads as n8n: monospace uppercase labels, chips and button, and the pink pill. Still off: the bars are near-black because n8n's pink is 1.5:1 on the card.
- **Open Places.** Reads as Open Places: the button is now the site's pill.
- **Porkbun.** Untested. It has no site file, and its card is pixel-identical to before.

## Proof

- **Servers.** [`server-before.json`](server-before.json) and [`server-after.json`](server-after.json) record the server. Each was a production `next build && next start` from this checkout with a clean tree, so no dev-mode indicator appears in the captures. `brand-fidelity.mjs build` stamps the commit it built, and `card` refuses a server built from another commit. The before build predates that stamp. Its `.next/BUILD_ID` is dated 07:34:54, 17 seconds after commit `2ba6aa8`, and the tree was clean.
- **No change without a site file.** Claude Code, Grok Bot and Porkbun cards are byte-identical between the before and after captures at 1440 and 390, and so are their measured traits. `src/domain/brand-kit-site.test.ts` pins every brand's kit without a site file to its `2ba6aa8` values.
- **Checks at `caa54ea`.** Lint and typecheck are clean. The touched Vitest files passed when run one at a time. These six specs passed 70 of 70: `usage-examples`, `homepage`, `product-card`, `public-profile`, `security-headers` and `inventory`. `usage-examples` covers axe on every example at 1440, the computed case of each example's status line and button, and no horizontal overflow at 390 and 320. The native-webmcp config passed 10 of 10.
- **Two owner-rule script tests fail in this checkout, from files that are not committed.** `http-url-owner` and `assert-return-value` flag only files under the git-ignored `prototypes/public-mcp/node_modules` and `dist` folders.

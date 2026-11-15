# The fourteen homepage cards beside their brands' sites

Updated: 2026-11-15, round 9. Branch `feat/homepage-brand-examples`, cards captured at `7dc499e` from this checkout's
reference-mode dev server (doctor: listener runs from this checkout, 0 tracked files changed; `next dev` rewrites
`next-env.d.ts` on start, and it was restored after). All card data is synthetic sample data.

The eleven stored brands' sites are the round-8 captures of 2026-11-15 (1440x900 and 390x844, home pages only, cookies
declined where a plain Decline or Reject control existed). Rerunning the site-traits pull from those captures gave
byte-identical site files, except Context.dev's, which gained the new coloured-panel trait. Two pages were visited for
this round, on 2026-11-15:

- `https://claude.com/product/claude-code` loaded with HTTP 200 and showed no cookie banner. It was measured.
- `https://x.ai/` answered with Cloudflare's "Attention Required!" challenge (HTTP 403). The visit stopped there, and no
  other route into x.ai was tried. Grok Bot has no site file.

Porkbun was not visited: porkbun.com answers automation with a 403 bot-block page.

Each `<slug>-1440.png` and `<slug>-390.png` shows the site on the left and the card on the right, made by
`node scripts/brand-fidelity.mjs pairs --label round9`. Porkbun and Grok Bot have no site beside them, and their images
say why.

`floors.json` holds both faces of all fourteen at 1440, 390 and 320 (84 faces). All 84 have no sideways scroll, no text
under 12px, no phone tap target under 44px, no word split across lines, every text at 4.5:1 (3:1 where it is large),
every bar at 3:1 and every 6px panel frame at 3:1, measured from computed colours. The "cut" check (content wider than
its box) reports only Cloudflare's and n8n's product names. Those are the screen-reader headings beside their wordmarks,
clipped to 1px by design (`.card-product-name`), so nothing a visitor sees is cut.

The fidelity check's automatic rows read 154 passed, 10 failed and 60 untested. Three of the failures are this round's
choices. Exa's bars (#000000) and text are not the site's link blue. n8n's bars are its pink deepened to #b77987, not the
site's #ff91ac link pink. Claude Code's headline is in a serif, as every card's is, where claude.com's paragraphs are
sans. The pairs are the judgement, not the counts.

## What changed this round

- **Exa.** A measured site that shows no colour of its own (no colourful call-to-action, heading phrase, hero or logo),
  and fills less than a 40px box of its first screen with the provider's accent, does not get that accent. Exa's
  number is now its measured #111827, and its bars are the card's black.
- **Context.dev.** The first screen's largest coloured panel, if it is not the hero, is stored as `framedPanel`. That
  panel is the blue box around context.dev's search field. The card frames its data panel 6px thick in that colour,
  rounded to 24px.
- **n8n.** A brand colour that fails 3:1 for bars moves in OKLab lightness, hue kept, until it reads, before the text
  colour takes the bars. Every candidate is tried unchanged first. The cap is 0.25: n8n's pink on its #f0f0f0 panel needs
  0.215, so a 0.2 cap left it short. Its bars are #b77987.
- **Porkbun.** It has no site file, and none was derived. Two generic rules now reach it from the stored snapshot: the
  same lightness move for bars, and on a card with no measured site, figures in the brand's accent moved to 4.5:1. Its
  number is now #c04e51, a deeper salmon.
- **Claude Code.** It is drawn from its measured product page alone, with no stored brand. The brand gate is unchanged.
  The look is the ivory #faf9f5, its #141413 button, a system serif standing in for Anthropic Serif, and coral #d97757
  bars, deepened to #cf6e4e on the #f0eee6 panel. The logo is the official icon already in `public/product-assets/`.
- **Grok Bot.** The house card, unchanged. There is no measurement and no official icon, so it keeps its lettermark.

## Ranked: how much each card reads as its brand

1. **Clay.** Reads right: the green hero as one slab over the header, the lime button, Roobert, the numbers in the hero
   green. Reads wrong: clay.com's hero is an illustrated landscape, and the card is a flat green.
2. **GitHub.** Reads right: the green contribution calendar, the green 1,121 in GitHub's face, the green button, the
   back's values in the same green. Reads wrong: the site's white hero with its green heading phrase is echoed only in
   the headline's accent.
3. **Firecrawl.** Reads right: the orange, the ruled 101px column grid behind the chart, GeistMono labels, the orange
   number and heading phrase, the button's white label. Reads wrong: to read 4.5:1 the button's orange is 16% deeper
   (#d64000) than the site's #ff4c00.
4. **Claude Code.** Reads right: claude.com's ivory page, the serif product name and headline, the near-black button,
   the coral asterisk icon, and coral bars on the page's warm grey panel. It now reads as Anthropic's at a glance.
   Reads wrong: the faces are system ones (Georgia-like serif, system sans), because no Anthropic font file is stored or
   served. The card's text is the page's paragraph grey (#5e5d59), so the headline is lighter than claude.com's
   near-black heading. The bars are a deeper coral than the logo.
5. **Cloudflare.** Reads right: the orange slab with the site's 16px corners, Cloudflare's own wordmark straight on the
   orange. Reads wrong: the only stored variant that reads on the orange is the black wordmark alone, so the cloud is
   gone from the card.
6. **Context.dev.** Reads right: white, the black pill button, the blue number, and now the blue-framed rounded panel
   around the chart, as context.dev frames its search box. Reads wrong: the site's blue dot-ring swaths are still
   absent, because the margin texture detector does not find ring dots. The frame is a solid 6px line, where the site's
   frame is about 24px of blue with a dot pattern inside it.
7. **Spider.** Reads right: the near-black page, Fraunces, mono capitals, square corners, the green number, and bars
   drawn as thin green outlines. Reads wrong: the site's isometric line illustration has no counterpart.
8. **Docker.** Reads right: the navy hero slab, the blue square button, the dark terminal panel, the blue big number.
   Reads wrong: the site's falling-letter texture on the hero is absent.
9. **Exa.** Reads right: now monochrome like exa.ai. That means white, the serif heading and near-black serif number,
   mono capital labels, the black square button, and black bars, with only the logo in blue. Reads wrong: the solid
   black bars are heavier than anything on exa.ai's light, airy first screen. The site does use its blue for its banner
   link and its search arrow, and the card shows that blue only in the logo.
10. **Elicit.** Reads right: the serif heading, the teal button and number, the pale green second surface. Reads wrong:
    elicit.com's mint dot stipple is drawn inside a panel, not on the page margins, so it is not measured.
11. **Open Places.** Reads right: the cream page, the dark green pill button, the pale green map panel behind the chart,
    the big number on the site's yellow highlight. Reads wrong: the site's chart is a tile map in graded greens, and the
    card's bars are one green.
12. **n8n.** Reads right: the light page, the pink pill button in mono capitals, the site's grey dots behind the chart,
    and now pink bars instead of black. Reads wrong: to reach 3:1 on the grey panel, the pink deepens to a dusty mauve
    (#b77987), far from the site's candy #ffbcca. The wordmark is large beside the name.
13. **Porkbun.** Reads right: the blush surface, the salmon Details button, the pig icon, and now a salmon number.
    Reads wrong: nothing was measured, so whatever porkbun.com shows beyond the provider's two colours is unknown. With
    no chart and no hero, the card is still mostly white with two salmon accents.
14. **Grok Bot.** The house card with a "GB" lettermark. Reads wrong: everything. x.ai blocked the measurement with a
    bot challenge, no official Grok icon is committed, and no stored brand exists.

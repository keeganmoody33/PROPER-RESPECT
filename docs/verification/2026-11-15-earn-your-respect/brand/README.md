# The fourteen homepage cards beside their brands' sites

Updated: 2026-11-15. Branch `feat/homepage-brand-look`, cards captured at `f332dac` from this checkout's
reference-mode dev server (doctor: listener runs from this checkout, 0 tracked files changed; `next dev` rewrites
`next-env.d.ts` on start, and it was restored after). All card data
is synthetic sample data. The brands' sites were visited on 2026-11-15 at 1440x900 and 390x844, home pages
only, cookies declined where a plain Decline or Reject control existed (Docker, n8n, Spider). No site showed a
bot challenge. Porkbun was not visited: porkbun.com answers automation with a 403 bot-block page.

Each `<slug>-1440.png` and `<slug>-390.png` shows the site on the left and the card on the right, made by
`node scripts/brand-fidelity.mjs pairs --label round8`. Porkbun, Claude Code and Grok Bot have no site beside
them, and their images say why.

`floors.json` holds both faces of all fourteen at 1440, 390 and 320 (84 faces). All 84 have no sideways scroll,
no text under 12px, no phone tap target under 44px, no word split across lines, every text at 4.5:1 (3:1 where it
is large) and every bar at 3:1, measured from computed colours. The "cut" check (an element's content wider than
its box) is not in that count: Clay's stacked table reports its four column headers cut at 390 and 320 on both
faces. Not checked whether that predates this round; that table is being removed in the other writer's commits.

An earlier capture of this round showed Cloudflare's phone card with its old logo on a white tile: that load of the
wordmark file failed once, and the card fell back as designed. The capture here, and three direct reloads at 390
and 1440, show the wordmark on the slab.

The fidelity check's automatic rows went from 147 passed and 13 failed (before this round) to 152 passed and 8
failed. The pairs are the judgement, not the counts.

## Ranked: how much each card reads as its brand

1. **Clay.** Reads right: the green hero as one slab over the header, the lime button, Roobert, and now its numbers
   in the hero green. Reads wrong: clay.com's hero is an illustrated landscape, and the card is a flat green.
2. **GitHub.** Reads right: the green contribution calendar, the green 1,121 in GitHub's face, the green button, and
   now the back's monthly values in the same green. Reads wrong: nothing a GitHub designer would object to. The
   site's white hero with its green heading phrase is echoed only in the headline's accent.
3. **Firecrawl.** Reads right: the orange, the ruled 101px column grid behind the chart, GeistMono labels, the orange
   number and heading phrase, and the button's white label as on firecrawl.dev. Reads wrong: to read 4.5:1 the
   button's orange is 16% deeper (#d64000) than the site's #ff4c00.
4. **Cloudflare.** Reads right: the orange slab with the site's 16px corners, and now Cloudflare's own wordmark straight
   on the orange with no white tile. Reads wrong: the only stored variant that reads on the orange is the wordmark
   alone, in black, so the cloud is gone from the card. A white one-colour logo is not in the snapshot.
5. **Spider.** Reads right: the near-black page, Fraunces, Berkeley-style mono capitals, square corners, a green
   Fraunces number like the site's green heading phrase, and now bars drawn as thin green outlines, as the site
   draws in green lines. Reads wrong: the site's isometric line illustration has no counterpart.
6. **Docker.** Reads right: the navy hero slab, the blue square button, the dark terminal panel, and now a blue big
   number instead of plain black. Reads wrong: the site's falling-letter texture on the hero is absent.
7. **Elicit.** Reads right: the serif heading, the teal button and number, the pale green second surface. Reads wrong:
   elicit.com's mint dot stipple is drawn inside a panel, not on the page margins, so it is not measured.
8. **Open Places.** Reads right: the cream page, the dark green pill button, the pale green map panel behind the
   chart, and now the big number on the site's yellow highlight. Reads wrong: the site's chart is a tile map in
   graded greens, the card's bars one green.
9. **n8n.** Reads right: the light page, the pink pill button in mono capitals, and now the site's grey dots behind
   the chart instead of the near-black panel. Reads wrong: n8n's pink fails 3:1 on its light page, so the bars are
   black. The wordmark is large beside the name.
10. **Context.dev.** Reads right: white, the black pill button, the blue number and bars, and no near-black panel
    any more. Reads wrong: context.dev's signature is a blue-framed box and blue dot-ring swaths; the ring dots don't
    pass the margin texture detector.
11. **Exa.** Reads right: white, the serif heading and number face, mono capital labels as the site's controls use,
    and now thin blue outlined bars instead of solid blue blocks. Reads wrong: exa.ai is nearly colourless, and the
    blue number and bars still carry more blue than the site shows.
12. **Porkbun.** Provider brand only: the pink surface and salmon button. Not measured, not compared.
13. **Claude Code** and 14. **Grok Bot.** The house card. Their listed domains (claude.com, x.ai) belong to a parent
    company, which the brand gate refuses. Branding them needs an owner decision to use Anthropic's or xAI's brand.

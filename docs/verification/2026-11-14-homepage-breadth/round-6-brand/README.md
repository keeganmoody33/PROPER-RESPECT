# Homepage breadth, round 6: brand look

Captured 2026-11-14 (UTC 2026-11-15) with `scripts/brand-fidelity.mjs` from this checkout's own `next dev` on port 3271
in reference test mode, at commit `4b6d955e710245f1a6c5e1edb1990b6aad703525`. The verify skill's doctor reported 0 tracked
files changed from that commit before the capture. The card data is the homepage's synthetic samples, not anyone's account.

The left half of each pair is the brand's public home page, measured and captured the same evening
(`node scripts/brand-fidelity.mjs reference --only clay,github,cloudflare,docker,firecrawl`). Cookies were declined where a
plain decline was offered; clay.com offers only "Accept all", so its banner stays unanswered in the picture. No bot challenge
was met. Pictures are at the deviceScaleFactor the script uses (1). Each was opened and looked at before it was marked.

Rerun: `node scripts/brand-fidelity.mjs card --base http://127.0.0.1:<port> --label <label> --only clay,github,cloudflare,docker,firecrawl`,
then `compare` and `pairs` with the same label.

The script's automatic assertions: 67 passed, 4 failed, 9 untested. The four failures are listed under each brand below.

## Targets

| Target | Pair | Result | What it shows |
| --- | --- | --- | --- |
| Clay's green covers the header (logo, name, headline) as one slab, white name | `clay-1440.png`, `clay-390.png` | passed | One `#035d44` slab from the card's top through "My lead lists, enriched.", like clay.com's hero under its white nav. |
| Clay's body sits on its warm grey `#f4f3f0`, the table a white inset panel | `clay-*.png` | passed | Body `rgb(244, 243, 240)`; table panel white with a visible rule. |
| Clay's chips and footer in sentence case | `clay-*.png` | passed | "enrich lead and account lists", "Periods, sources and a work sample inside". The eyebrow "Daily · since 2023" is as typed too: the first-screen labels measure as typed. |
| Clay's rule shows on the card | `clay-*.png` | passed | `#f0f8ff` (1.03:1 on white) gives way to a border mixed from the text. |
| Clay's table shows skill with Clay: column glyphs, a waterfall, run-status pills, rows tied to the numbers | `clay-*.png` | passed | Glyphs for text, email, waterfall and AI; lime "Enriched" pills with a mark per provider (answered, missed, not asked); "4 of 214 rows · 2.3 credits a row this year" (27,600 / 11,800). |
| Clay's card bottom ≤ 1000 at 1440×1000, no cut cell or split word at 1440/390/320 | not in the pairs | passed | Card bottom 968 at 1440 (measured); the e2e table tests pass at all three widths. |
| GitHub's figures in a served face with tabular figures | `github-1440.png` | passed | "1,121" in GitHub's served Mona Sans heading face, no gap around the comma. |
| GitHub's calendar framed in the site's 1px `#d2d9d4` rule | `github-*.png` | passed | Framed panel; days stay 8px at 1440. |
| Cloudflare's eyebrow and chips not monospace | `cloudflare-*.png` | passed | Its first screen has no small labels, so the eyebrow and chips stay in its body face. |
| Cloudflare's card rounded like its inset orange slab | `cloudflare-*.png` | passed | 16px corners, the hero slab's measured radius. The script marks this failed against its square panels, by design. |
| Cloudflare's button a white pill with dark text, as on its orange hero | `cloudflare-*.png` | failed | Kept dark text on its orange. The card's button sits on the white footer, where a white pill fails the fill floor. |
| Docker's card corners like its cards (~16px) | `docker-*.png` | passed | 18px, the radius most of its panels' area is drawn with. |
| Docker's eyebrow and chips not monospace | `docker-*.png` | passed | Its first screen's small labels are Inter. |
| Docker's big "3" in a brand colour | `docker-*.png` | untested | The measured number colour on docker.com is `#000000`; no rule here invents a blue. |
| Firecrawl's faint grid on the card | `firecrawl-1440.png` | passed | Its 101px ruled columns in `#ededed` behind the weekly bars. |
| Firecrawl's "5,520" in its orange only as large text at 3:1 | `firecrawl-*.png` | passed | 3.16:1 on `#f9f9f9`, kept because it is drawn at 24px or more; an e2e test holds every featured card to this. |
| Firecrawl's button white on orange | `firecrawl-*.png` | failed | White on `#ff4c00` is 3.3:1, under the 4.5:1 floor for its label, so the label stays `#262626`. |
| Firecrawl's crosshair marks and orange second headline line | `firecrawl-*.png` | untested | Not measured by any generic rule yet. |

## Per brand

**Clay.** Reads right: the green slab, white name, lime button and pills, the warm grey body and the white table now read as
clay.com. The table reads as a Clay table: typed columns, a waterfall per address, Running and No match states. Reads wrong:
the logo is the rainbow arch alone where clay.com's nav pairs it with the "clay" wordmark; the cost line and number note are
plain. Next: a real wordmark when the brand store has one, and the table's column glyphs drawn from Clay's own icon style.

**GitHub.** Reads right: green figures in Mona Sans, the framed contribution graph, green button. Reads wrong: github.com's
hero is now a white page with green highlighted heading words and a dotted grid below; the card has none of the grid. The
script's chart-colour check fails because it reads github.com's link blue `#0969da` as the accent while the card draws
GitHub's contribution greens. Next: carry the measured highlight green into the headline's emphasis.

**Cloudflare.** Reads right: the orange band, its rounded 16px corners, sans eyebrow and chips, the orange pill button.
Reads wrong: on cloudflare.com the orange is a whole slab with white heading text and a white pill; on the card it is a band
with dark text, and the button is orange. The script fails the button fill and the square panels. Next: a measured "button
on the hero" trait, used only where the card's button sits on the hero colour.

**Docker.** Reads right: the dark slab over the header with the whale on its white tile, white name, blue button, 18px
corners and the dark linked-works panel. Reads wrong: docker.com's hero has drifting monospace glyphs and a centred heading;
the card's big "3" is plain black, as docker.com's largest number is. Next: nothing generic is measured for the glyph field.

**Firecrawl.** Reads right: the ruled 101px columns behind the bars, orange bars and number, white chart panel, orange
button. Reads wrong: the button label is dark where the site's is white (the floor holds), and the bracketed mono labels
and orange crosshairs are missing. The script fails the button label colour. Next: measure bracketed small labels as a
label style; the eyebrow is in a system mono because the card does not serve Geist Mono.

## What the pairs do not show

The pairs are fronts only. The backs were checked by the usage-examples e2e spec and by eye at 1440 and 390: Clay's and
Docker's backs carry the slab as their header only, with the owner's note ruled in the slab colour rather than banded again,
and Clay's back adds the fifth row (Marrow, no match) to the front's four.

The verify skill's floors snippet lists Clay's waterfall words for screen readers (", provider 2 of 3 answered") as "cut".
They sit in the `.visually-hidden` pattern, the same as GitHub's calendar summary and Cloudflare's hidden name beside its
wordmark; nothing a visitor sees is cut.

## Measurement notes

The five featured sites were remeasured 2026-11-15 with the new rules (hero radius, panel corner by area, ruled columns, small
labels read in the first screen only). Firecrawl's label face is near the 10% monospace threshold: three runs measured 1 of 11,
1 of 10 and 2 of 8 first-screen labels monospace, so its stored GeistMono labels can flip on a later remeasure. The other
nine homepage brands keep site files from the earlier measurer.

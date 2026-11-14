# A card beside its brand's own site

Proves a homepage example card reads as its brand by measuring the brand's public site and the card the same way and putting the two side by side. The owner judged earlier cards "directionally correct" but "not reminiscent of the brand"; only a comparison with the real site catches that.

## Sub-features

- `brand-reference` captures and measures the brand's own public home page at 1440 and 390.
- `brand-card` captures and measures the card from this checkout's server.
- `brand-compare` writes `assertions.md`, one row per trait, passed, failed or untested.
- `brand-pairs` composes site-beside-card images.

## How to get to it (user POV)

A visitor who knows the brand looks at the card on `/` and recognises it, or does not.

## Driving it with scripts/brand-fidelity.mjs

Preconditions: doctor exits 0 on your port; network access to the brand's public domain; free disk for about 2 MB of images per brand.

- **Reference, once per task.** `node scripts/brand-fidelity.mjs reference --only clay,github`. Writes `.artifacts/brand-fidelity/reference/<slug>-1440.png`, `-390.png` and `<slug>.json`.
- **Before.** From the old commit's server: `node scripts/brand-fidelity.mjs card --base http://127.0.0.1:PORT --label before --only clay,github`.
- **After.** Same with `--label after` from the changed checkout. The script refuses a server that does not run from this checkout.
- **Compare.** `node scripts/brand-fidelity.mjs compare --label after` prints the passed, failed and untested counts and writes `.artifacts/brand-fidelity/after/assertions.md`.
- **Pairs.** `node scripts/brand-fidelity.mjs pairs --label after`. Open every `pairs/<slug>-1440.png` and `-390.png` yourself.
- **Proof.** Write, per brand, what reads right, what reads wrong, and the one change that would buy the most recognition. Show the owner the pairs, not the card alone.

## Rules for the brands' sites

- Visit only the product's own public domain, and only ordinary page requests.
- Decline cookies with the most private option. If a banner offers no decline (clay.com offers only "Accept all"), leave it unanswered.
- Stop on any bot challenge or CAPTCHA and mark that brand untested. Porkbun's site blocks automation; do not work around it.
- Never copy the brand's imagery or font files into the repo. Brand fonts come only through the app's own `/api/brand-fonts/` and Google-font proxies.

## Gotchas

- Most automatic assertions hold by construction, because the card's traits are derived from the same site measurement. The pairs are the judgement; the counts are not.
- The measurer reads small-label typography, number type, panels and dividers only as well as `scripts/brand-site-measure.mjs` does. When a pair looks wrong but the assertions pass, suspect the measurer and say so.
- Colours the brand uses on its own site can fail the card's contrast floors (white on Cloudflare orange is 3.06:1). The card keeps the floor; do not copy the failing pair.
- Claude Code and Grok Bot have no stored brand (their parent companies' domains are refused), so they render the neutral card. `--with-unbranded` captures them to show a change left them alone.

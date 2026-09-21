# PROPER-RESPECT — Homepage v4 + Brand Manifest Handoff

## What's in this folder

```
index.html                    # Homepage v4 prototype (self-contained, references assets/)
brand-manifest.schema.json    # Contract: what a fully-branded prop card needs per product
competitive-notes.md          # Field research: Linktree / Carrd / Beacons / about.me
assets/
  fists-blueprint.png         # Hero figure: blueprint fist bump (Fig. 01)
  bump-art.png                # Lineage figure: cel fist bump (Fig. 02, dark section)
  PR-mark-black.png           # PR monogram, black on transparent
  PR-mark-white.png           # PR monogram, white
  PR-icon.png                 # Rounded-square app icon
```

Open `index.html` in a browser. Everything renders offline.

---

## 1. v4 decisions (locked with the founder)

- **Voice:** no em dashes anywhere in copy. Short declaratives with periods.
- **Positioning line:** "Objective, objective." An objective look at what you're running.
  Replaces the old "props, with proof" eyebrow.
- **Stack states are the product:** what you use, what you're testing, what you tested
  and dropped. Matches the domain's ACTIVE / TESTING / ARCHIVED status enum.
- **Sharing is the point:** the page is for friends to keep up, follow you, see what
  you're running. Copy says "share it," "friends land on your page," "when a friend
  takes your card."
- **Phrase:** "Give props, get props." Used in the lineage section and as the final
  headline. The old "Give props where they're due" is retired.
- **Card section headline:** "Give people a look at your stack." (Not "cards that
  look like the product." The mechanism shows; the copy sells the outcome.)
- **Pricing section removed.** Handle stays free in copy ("Free · 90 seconds").
  Pricing comes back later as its own decision.
- **Mobile is first-class:** claim form stacks (prefix / input / full-width button),
  ledger rows collapse to tool + freshness with proof and lineage wrapped under,
  cards go single column with full-width take buttons, section heads stack.

## 2. Page structure (v4)

1. **Masthead** — PR mark + wordmark left, domain + "Claim your handle" right, sticky.
2. **Hero** — "WHAT YOU ACTUALLY USE." + objective sub + proof line + Fig. 01 blueprint fists.
3. **Claim strip** (ink band) — "GET YOUR PAGE." + `proper-respect.com/____` input + red CLAIM IT button + own-domain note.
4. **Give people a look at your stack** — four branded cards (Wispr cream/Figtree, GitHub #0d1117, NotebookLM white, Devin ink), each with status, usage sparkline, lineage footer, and TAKE THIS CARD. NotebookLM card shows TESTING status so the three states are visible.
5. **The proof ledger** — tool / proof attached / last verified (red) / put on by.
6. **Usage, metered** — 12-week SVG line chart + 16-week cadence grid, sources cited in footers.
7. **Put on by.** (dark band) — cel fist-bump art + "Give props, get props."
8. **Final** — "GIVE PROPS. GET PROPS." + handle line + footer ("objective, objective").

## 3. Design tokens

| Token | Value | Use |
|---|---|---|
| `--ink` | `#171713` | Text, borders, claim strip + dark section bg |
| `--paper` | `#f0eee7` | Page background |
| `--panel` | `#fbfaf6` | Cards, figure frames, graph panels, ledger |
| `--red` | `#d93843` | Diamonds, freshness, claim button, one accent word per headline |
| `--muted` | `#706f68` | Mono annotations |
| `--hairline` | `rgba(23,23,19,.16)` | Inner dividers |
| `--line` | `rgba(23,23,19,.85)` | Section dividers, 1.5px |

**Type:** Archivo 900 headlines (uppercase, −0.045em tracking, .93 line-height), IBM Plex Mono 700 (.72rem, .1em, uppercase) for labels. Branded cards override with the product's own stack per manifest.

**Anti-slop rules:**
- No em dashes in copy. Periods and colons instead.
- Every image in a bordered figure with a mono caption (`Fig. 01, …`).
- Red diamond (rotated square) = where credit changes hands. Not decoration.
- One red accent word per display headline.
- No rounded corners on chrome, no shadows, no gradients. 1.5px borders.
- Branded cards are the only non-paper surfaces; the page frame stays ink/cream.

## 4. Brand manifest (context.dev pipeline)

`brand-manifest.schema.json` is the contract, mapped onto the existing
`ProductBrandSnapshot` / `VerifiedProductAssets` shapes in `src/domain/`:

```
Product added (domain)
  → context.dev /v1/brand/retrieve   (logos, colors, company)
  → context.dev /v1/web/styleguide   (typography, spacing, components)
  → mapped + contrast-validated (WCAG AA 4.5, same rule as brandAppearance())
  → cached on product record with fetchedAt; refresh after 30 days
  → curationScore < 0.5 → owner UI flags "identity incomplete", never guess
```

The manifest feeds the card theming that `product-card.tsx` already implements
(`--brand-card-*` vars, font-face injection, provenance panel). It is a data
source, not a parallel render path. Legal: nominative fair use for identification;
provenance panel stays; honor the denylist field on takedown.

## 5. Custom domain (Sovereign promise in copy)

`proper-respect.com/you` by default; `props.yourdomain.com` later. Path handles are
the existing dynamic route. Subdomain mounting = Vercel multi-tenant pattern
(CNAME → cert → host-middleware maps host to handle, same profile render).
The homepage promises it in the claim note and final handle line.

## 6. Paste this into Codex

```
Read design/homepage/HANDOFF.md, brand-manifest.schema.json, competitive-notes.md,
and index.html — together they are the spec. Then:

1. LANDING PAGE
- Replace app/page.tsx with the v4 design (server components where possible).
  The current page is a bare system-message block; v4 replaces it entirely.
- Merge tokens into app/globals.css (keep variables other files use).
- Fonts: Archivo (500–900) + IBM Plex Mono (500,700) via next/font/google.
- Art from design/homepage/assets/ → public/brand/, via next/image.
- Claim strip posts the handle into onboarding: /onboarding?handle=X.
- Branded-cards section: render through the REAL product-card component with
  manifest-shaped brand data, not a mock. NotebookLM shows TESTING status.
- Usage chart = presentational SVG component; cadence grid deterministic.
- Mobile rules in the CSS are the spec: stacked claim form, collapsed ledger,
  single-column cards, full-width buttons.
- Copy rules: no em dashes. "Objective, objective." "Give props, get props."
  Do not reintroduce pricing; it was deliberately removed.

2. BRAND MANIFEST PIPELINE
- Implement brand-manifest.schema.json as a module: context.dev fetcher,
  mapper, WCAG contrast validation, curationScore. Cache on product record
  with fetchedAt; refresh >30 days. CONTEXT_DEV_API_KEY in env.
- Fail closed: no manifest → initials tile, never guessed colors.
- Feed the existing brand fields on product-card.tsx; keep the provenance panel.

3. DO NOT
- Do not invent brand colors.
- Do not imply product endorsement in copy.
- Do not add pricing, shadows, rounded chrome corners, or gradients back.
- Do not use em dashes anywhere in user-facing copy.
```

## 7. Placeholder data honesty

Usage numbers and ledger dates are illustrative until signal computation exists.
The framing contract everywhere: **automation proposes, the person confirms.**

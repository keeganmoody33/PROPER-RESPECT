# Proper Respect verification map

The maintained source for verifying what a visitor sees. Read this index before driving the app, then use the matching feature file as the recipe.

| Feature | File | Reach it at |
| --- | --- | --- |
| Homepage product examples (carousel, chooser, flip) | [homepage-examples.md](homepage-examples.md) | `/` |
| A card beside its brand's own site | [brand-side-by-side.md](brand-side-by-side.md) | `/` plus the brand's public domain |
| Fixture public profile | [public-profile.md](public-profile.md) | `/keegan`, `/legacy-profile-url` |
| Fixture private collection | [private-collection-fixture.md](private-collection-fixture.md) | `/evidence-fixture/inventory` |

## Baseline preconditions

- This checkout is served by `scripts/launch.sh PORT`, and `scripts/doctor.sh PORT` exits 0.
- Reference test mode: `PROPER_RESPECT_E2E_REFERENCE=1`, Clerk and Convex variables empty. The fixture data is compiled in; nothing is seeded and nothing is stored.
- Never drive a server this run did not start, and never a production URL.

## Driving conventions

- Playwright with role and accessible-name locators, as in `tests/e2e/`. Avoid CSS position and tab counting.
- Widths 1440×1000 and 390×844; add 320×700 for anything with text that might not fit.
- Pause the slideshow before capturing, or a card changes under you.
- Wait for `document.fonts.ready` before a screenshot; brand fonts load per slide.
- Run once with `reducedMotion: "reduce"` whenever the change involves motion.

## Proof and skip reporting

- Every receipt says the data is synthetic and names the commit and the doctor output.
- Capture the action and the resulting state: the front before the flip and the back after it, focus after the flip, the table a screen reader gets.
- Record the feature file and the entry point with each artifact.
- An unreachable path is reported with the command tried and the unmet precondition, never skipped silently.

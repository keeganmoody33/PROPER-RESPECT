# Phone first screen, 17 Nov 2026

Synthetic check on the fixture site (`PROPER_RESPECT_E2E_REFERENCE=1`, no account, sample cards), branch `public-ready/phase-b`.

`home-390x844.png` is the homepage at 390 by 844 with nothing scrolled.

- "Start your collection" sits right under the heading, 222px to 276px from the top. Before this change it was 1,070px down, below the 844px fold.
- The example card still starts in the first screen, with its number above the examples row held at the foot.
- The examples row scrolls sideways. It now fades at whichever edge has more names, in the bar's own colour.

Checked by `tests/e2e/usage-examples.spec.ts` ("the heading, the way to start and the card are all in the first screen" and "the examples row fades at whichever edge has more names") and `tests/e2e/homepage.spec.ts` (tab order). Not checked on a real phone.

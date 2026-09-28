# Collection design QA — 2026-09-28

final result: blocked

Implementation: Task 1 #125 (`080d87d`), Task 2 #126 (`e824670`), followed by the Task 3 theme changes in this branch. Ref: https://plan.ref.tools/wF1376s8dtHxyZHw.

## Sources and capture contract

Paper source: https://app.paper.design/file/01M3E1TBAJHVR7TEM66C3DASKV/p-E-0. The desktop and mobile artboards were exported without changing the originals. All examples are synthetic.

Evidence directory: `docs/verification/2026-09-28-collection-refinement/`.

| Evidence | Pixel size | CSS viewport/state |
| --- | --- | --- |
| `paper-desktop.png` | 1440 × 1079 | 1440px, light, proposed unsaved observed date |
| `paper-mobile.png` | 390 × 1401 | 390px, light, proposed unsaved observed date |
| `desktop-light-viewport.jpg` | 1428 × 1071 | 1440 × 1080, DPR 1.2, scrolled editor, unsaved observed date |
| `desktop-dark-viewport.jpg` | 1428 × 1071 | Same editor/state, dark |
| `mobile-light-viewport.jpg` | 378 × 818 | 390 × 844, DPR 1.2, date and beginning of evidence, unsaved |
| `mobile-dark-viewport.jpg` | 378 × 818 | Same region/state, dark |
| `comparison-desktop.jpg` | 1713 × 1141 | Paper and implementation in the same comparison input |

`comparison.html` contains the full source exports alongside the implementation viewport crops. Source and implementation were inspected together in the in-app browser, including the desktop and mobile portions of the comparison. These are preliminary comparisons: source/implementation coverage and output density are not matched. Full-page in-app captures duplicated content and introduced empty space; they were rejected as QA evidence. No overlays or percentage-match claims were made. The date field uses the native browser date format.

## Findings and iterations

| Priority | Finding | Disposition |
| --- | --- | --- |
| P2 | Narrow preview caused the GitHub title to wrap inside a word. | Fixed: expanded-editor preview is 280px; re-inspected desktop capture. Product-card implementation is unchanged. |
| P1 | The unsaved badge became part of the date field's accessible name. | Fixed: stable explicit accessible name; native keyboard date edit and private save verified at 390px. |
| P2 | Collection focus rule could override a branded card's focus styling. | Fixed: explicitly exclude product-card descendants. |
| P2 | Full-page comparison cannot establish matched source/implementation dimensions because the browser capture stitches incorrectly. | Open: requires reliable complete captures before design QA passes. |
| P2 | The implemented card browser and current site navigation differ from the Paper sidebar/header study; complete work-link and source controls make the form longer. | Open design review: this preserves current functionality, but is not an exact implementation of the full artboard. Do not call it a pixel match. |

Typography follows the Ref's Archivo hierarchy and IBM Plex Mono date roles, with 16px controls and 14px supporting text. Paper form children export as system-ui, despite the Ref specifying Archivo; the explicit Ref typography is used. Existing bundled Plex is bold; the Paper metadata study uses regular weight. This difference remains visible for design review.

## Verified behavior and theme observations

- The focused collection/evidence suite passes (13 tests); typecheck and lint pass. A production build with empty auth/backend environment values passes.
- #125 CI run `36464901605` passed the new observed-date tests at 1280px and 390px. Its wider browser run reported 80 passed and one Origins canonical-link check passing on retry. This does not establish hosted behavior.
- In-app synthetic checks: choosing June 3 leaves save operations empty; a keyboard edit to June 4 persisted after explicit Save privately in the refined mobile layout. Saving never invoked publication.
- At 390 CSS px, document scroll width was 377px. Evidence followed the date, and Save privately followed evidence. Desktop was also within its viewport.
- `theme-observations.json` records identical product-card color/background/font in light and dark. Form/panel colors changed independently. No brand provider was called.
- Calculated solid-color text contrast: light save 5.23:1; dark save 5.87:1; light evidence 11.01:1; dark evidence 9.73:1; secondary text 6.04:1 light and 8.84:1 dark. See `capture-manifest.json`.
- Desktop/mobile theme, card-isolation and axe checks were added to the existing CI-included inventory suite. Local direct Playwright CLI was not run: permission was requested under the invoked design-qa skill and is pending. CI results for this final theme head must be checked separately.

## Remaining boundary

Keep visual PRs in draft. Obtain reliable full and focused matched captures, finish the source-deviation review, and resolve any final-head browser failures before changing this verdict to passed. No authenticated owner/provider testing, deployment or publication occurred. The primary Downloads checkout and #118 checkout were not modified.

This thread retains `/Users/keeganmoody/.codex/worktrees/collection-refinement/PROPER-RESPECT` for these PRs and `/Users/keeganmoody/.codex/worktrees/evidence-snapshot-labels/PROPER-RESPECT` for #118 review follow-up.

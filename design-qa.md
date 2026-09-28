# Collection acceptance — 2026-09-28

final result: passed

Scope: the existing #102 behavior, collection editor and theme refinement in #125 → #126 → #127. This verdict accepts the bounded refinement with the explicitly classified differences below. It does not claim that the full Paper navigation study was implemented or that authenticated/hosted acceptance occurred.

Implementation tested: #125 `080d87d65d14836fc0ece1169545873548b04832`, #126 `736b6af2260a83dfb7c3e561c128e2d639646c6e`, #127 `1e1e795014421bd8567684c8d737bddabe6baff4`. No merge or deployment.

## Source, state and capture contract

- Paper: https://app.paper.design/file/01M3E1TBAJHVR7TEM66C3DASKV/p-E-0, “2026-09-28 — Collection refinement draft”. Source screenshots and JSX were refreshed read-only on September 28. Sources: `docs/verification/2026-09-28-collection-refinement/paper-desktop.png` (1440 × 1079) and `paper-mobile.png` (390 × 1401).
- Live: http://127.0.0.1:3137/evidence-fixture/inventory. Synthetic GitHub, Active, owner-selected go-to, matching headline/note, observed date 2024-06-03, captured 2026-09-18. Date copied to an unsaved draft; the separate success capture is explicitly labelled.
- Desktop CSS viewport: 1440 × 1079. Mobile: 390 × 1401. Light is compared to Paper. Paper supplies no dark artboard; dark is compared to the accepted live light hierarchy and semantic color roles.
- Evidence: `docs/verification/2026-09-28-collection-refinement/acceptance/`. `capture-manifest.json` records exact output pixels. Native screenshots are uniformly scaled to CSS width in `comparison.html` (desktop outputs 1425 × 1068; mobile 375 × 1347; original pre-fix desktop capture 1440 × 1079). These output sizes are capture normalization, not overflow. DPR reported by the page was 1.
- Full-page scroll stitching remains unreliable in the in-app browser and was rejected. The accepted comparison uses intact viewport frames: desktop top plus editor at scroll 760; mobile top plus editor at 1370 and date-to-save at 2200. The overlapping frames cover the entire changed editor without stitching or painting over content. The taller live document retains real controls and includes clearly labelled fixture scaffolding absent from Paper.
- Full composition and focused comparisons were opened with Paper and live images together in the same browser input: `comparison.html`, `paired-desktop.jpg`, `paired-mobile.jpg`, `paired-focus.jpg`, `paired-themes.jpg`. Focused date/evidence crops are rendered at 1 CSS pixel per displayed pixel in the HTML. This is a region/state comparison with declared composition differences, not a pixel-match claim.

## Header and sidebar decisions

| Difference | Classification | Reason / retained behavior |
| --- | --- | --- |
| Actual PR symbol and wordmark versus text-only Paper masthead | intentional / keep | Existing real brand asset remains. No substitute logo was introduced. |
| Existing global navigation, account entry and Appearance control versus Paper's three-link header | intentional / keep | Working navigation and theme switching stay available. The actual authenticated workspace separately retains Collection, Add a product, Sources, Profile and links, and Sharing anchors in `onboarding-client.tsx`. The fixture is not an authenticated-header proof. |
| “Connections” as a new top-level header destination | Paper study not intended to ship | The current source controls already have a Sources section. This task does not rename the domain or introduce a new route. |
| Static “PRIVATE WORKSPACE” in the desktop masthead | Paper study not intended to ship | The implemented relationship identifies its private state and the save boundary explicitly says the public profile will not change. No global status inferred from a mock label. |
| Mobile “Menu” and “← Your collection” detail-screen navigation | Paper study not intended to ship | The actual UI is an inline expandable collection editor, not a new standalone detail route. Existing navigable links remain visible. |
| Three-item left sidebar with All tools count, initials and selection arrow | Paper study not intended to ship | This is a navigation alternative. Keep the working collection views, grouped-record selection and branded card browser; do not ship synthetic counts or placeholder initials as a replacement. |
| Desktop card preview stays beside the editor; mobile card stays above it | intentional / keep | Preserves product-specific identity and existing Details interaction. This accounts for the different composition and vertical position. |
| Add a product button and Preview saved card link relocated into the mock header | Paper study not intended to ship | Keep the working Add a product form/workspace anchor and existing card Details instead of creating duplicate controls. |
| Design-study date/synthetic banner versus fixture's test banner | Paper study not intended to ship | Neither is production product copy. Fixture scaffolding is explicitly excluded from visual identity acceptance. |

## Other declared source adaptations

- **intentional / keep:** Archivo follows the accepted Ref and existing app font, although Paper exported form children as system-ui. Existing bundled Plex Mono is heavier than the Paper metadata study; retain the loaded asset and legible 14px metadata. No new font dependency or brand-card typography change.
- **intentional / keep:** native date formatting and picker remain locale/browser controlled; the semantic value is 2024-06-03. Native input text follows the existing control typography. Paper's ISO text block is not a custom date widget specification.
- **intentional / keep:** complete work-sample, source, snapshot, correction, history and deletion controls remain reachable. They make the form longer than the focused study. Relationship/go-to controls stack on mobile to accommodate full labels and touch targets. The headline remains an editable single-line input; it scrolls for long values rather than imitating a static wrapped text block.
- **intentional / keep:** current shell gutters, 16px form text, 14px secondary text and 24px evidence-panel padding retain app spacing conventions. No overlapping or hidden controls were found at tested widths. Paper's narrower mobile padding is not applied to unrelated screens.
- **intentional / keep:** “Supporting context”, owner-statement caveats, evidence correction disclosure and current relationship labels retain accurate product meaning. The mock's abbreviated evidence copy does not replace source/provenance controls.
- **intentional / keep:** the actual product card uses its existing logo/fallback and palette. The Paper G/W/D placeholders are not shipped assets. No imagery was generated or approximated for this change.

## Actual mismatches and comparison history

| Severity | Earlier finding | Fix and post-fix evidence |
| --- | --- | --- |
| P2 | Narrow desktop preview broke the GitHub title inside a word. | Earlier layout fix uses a 280px preview. Rechecked in final desktop pair; title fits. |
| P1 | Unsaved badge changed the date field's accessible name. | Earlier fix keeps the stable explicit name. Browser date/keyboard tests pass. |
| P2 | Collection focus selector could override product-card focus styles. | Earlier fix excludes card descendants. Final light/dark branding checks pass. |
| P2 | Saving remounted evidence and closed its disclosure. | `736b6af` keeps evidence outside the version-keyed form. Final keyboard save retains the expanded evidence disclosure. |
| P2 | Copied date lacked Paper's 2px indigo draft border. | `1e1e795` adds the border only while the Unsaved badge is present. Seen in `mobile-light-date-save.jpg`, `mobile-dark-date-save.jpg` and focused paired comparison. Final CI asserts 2px in both themes. |
| P2 | Mobile Save privately did not span the form width. | `1e1e795` makes the mobile save button full width. Same light/dark captures and CI assert width equal to the evidence/form region. Desktop remains compact. |
| P2 | Earlier full-page captures could not establish fidelity. | Superseded by separately captured intact viewport frames, explicit normalization, complete changed-region coverage, and combined source/live comparisons. Rejected stitched files are not included in the acceptance set. |
| P2 | Header/sidebar differences were unclassified. | Every difference is classified above against the existing implementation and bounded task. No new navigation redesign is implied. |

## Required fidelity surfaces

- **Fonts/typography:** verified Archivo headings/body, loaded navigation font and monospace metadata roles. Intentional family/weight differences are stated above. No broken title wrapping; controls remain readable. Native dates and single-line input scrolling are preserved.
- **Spacing/layout rhythm:** form/evidence grid at desktop; evidence follows date and precedes save on mobile; save remains in document flow. Complete controls explain the greater vertical length. No horizontal page overflow at 390/1440; homepage checks also cover 320px.
- **Colors/tokens:** Paper field/panel/ink/red/indigo roles retained with dark counterparts. The unsaved border and evidence action are distinct. Existing contrast observations: save text 5.23:1 light / 5.87:1 dark; evidence 11.01:1 / 9.73:1; secondary 6.04:1 / 8.84:1. Final axe runs find no violations in either theme.
- **Image/asset quality:** existing product identity retained; no altered/fabricated brand assets. Screenshot compression is disclosed and normalized; images are not accepted as pixel-diff evidence. The app's brand asset is unchanged.
- **Copy/content:** matched synthetic record, separate observed/captured dates, explicit Unsaved state, editable/clearable date, owner-decision caveat and private-save/publication distinction. Additional production controls/caveats are intentionally retained.

## Required checks and limits

CI `36486950144` passes on `1e1e795`: unit/script tests, lint, typecheck, production build, 40 component-browser tests, 10 private-usage-card tests, main browser suite (81 passed, 2 Origins canonical-link checks passed on retry), 5 trust-preview tests, 5 production representation checks, native WebMCP and local public MCP jobs. No tests were weakened or disabled. The Origins retries remain recorded; they are not a new failure attributed to this UI change.

The main browser suite reran #102 at 1280px/390px and the collection light/dark, axe, no-overflow, product-brand-isolation and mobile-order checks at 390px/1440px. It covers explicit save, edit/clear, record isolation, retry identity and publication approval protections. Final assertions cover the corrected draft border and mobile save width.

Fresh in-app keyboard check after the CSS fixes: ArrowUp changed the selected native date segment from 2024-06-03 to 2024-07-03, with no save operation. Enter on Save privately persisted 2024-07-03, reported “Saved privately. Your public profile has not changed.”, and left evidence expanded. `mobile-keyboard-saved.jpg` is that separate saved state. Earlier date-selection snapshots remain the unsaved June 3 state. No real owner or provider was accessed.

Local direct Playwright CLI was not run while its permission request was pending. Acceptance browser regressions were executed by the existing CI workflow. The in-app viewport comparison resolved the screenshot blocker without a new browser, install, or environment change. This verdict does not cover authenticated owner sessions, live providers, deployment, or publication.

## Merge recommendation and retained ownership

Recommended order, after explicit owner merge authorization: #125 → #126 → #127. #125 has Copilot approval recommended with no findings at its exact head, but main has advanced from `bd24b90` to `3752c672ae98ea62e8592e87ca613a8153d61e59` with #124's Gmail tester gate. Revalidate/update against the current main as required before merge; no base update or merge was performed here. Retarget/update dependent PRs after their parent lands and rerun exact-head/current-base checks, especially if using squash merge. Do not reuse old CI as proof for changed head/base pairs.

#126 received a Copilot review with no findings, asking for the formal visual QA that is now recorded here. #127 received two findings: focused-card coverage and a stale PR-description QA status. The PR descriptions now agree with this passed verdict; `6d8389f` adds normal and keyboard-focused inventory card appearance comparisons in both themes, including outline color, width, style and offset. An independent in-app check also found the focused card colors and 2px outline/3px offset unchanged across themes (`acceptance/card-focus-check.json`). Re-review of the addressed findings and current-base validation remain merge gates. Devin's green context is not review evidence because its review was skipped. Check the latest head and CI independently after these review follow-ups.

Protected active/resumable checkouts: `/Users/keeganmoody/.codex/worktrees/collection-refinement/PROPER-RESPECT` and `/Users/keeganmoody/.codex/worktrees/evidence-snapshot-labels/PROPER-RESPECT`. Only the former was edited. Its known `next-env.d.ts` dev-preview rewrite is left local and unstaged.

## Implementation checklist

- [x] Classify header/sidebar and other meaningful source adaptations.
- [x] Correct observed-date emphasis and mobile save width.
- [x] Compare source and revised desktop/mobile implementation together, including focused details.
- [x] Verify keyboard, accessibility, light/dark, brand isolation and privacy behavior.
- [ ] Obtain substantive review for #126/#127 and revalidate the eventual main-based merge sequence.
- [ ] Merge/deploy only after explicit owner instruction.

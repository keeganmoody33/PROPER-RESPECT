# Collection layout, 2026-10-06

Ref: https://plan.ref.tools/oLGxQYBMTcFHrrvg, Task 11.
Branch: `codex/collection-layout-20261006`.
Starting main: `94c65df28ff6caf0367728c40c855e8e6303d493`.

## Source proposals and current behavior

| Source PR and inspected head | Useful behavior | Current-main decision |
| --- | --- | --- |
| #126, `736b6af2260a83dfb7c3e561c128e2d639646c6e` | Separate relationship fields, evidence, and explicit private save. | Keep the current focused relationship route. Place independent evidence forms between the relationship fields and save in document order. |
| #127, `a767aee74f2a2b29b33cdc2b14bde90a4f40ecb7` | Theme roles for evidence, visible unsaved dates, full-width mobile save, and product-card focus isolation. | Use collection-scoped evidence ink and save styling. Compare actual card keyboard focus in both themes. Global navigation, fonts, and action styling stay outside this concern. |
| #129, `fb8c3698fbb436e6230803d20b0b7eb57ccb42f0` | Paper tool-list layout and mobile date, evidence, save, then optional fields. | Keep the current search, filters, duplicate-record selector, hash route, and explicit selection. Use compact rows and optional work-sample controls after save. |

The exact #127 desktop and mobile Paper exports were inspected. The evidence panel uses indigo, and private save uses red. The current main implementation already supplies one-step tool entry and focused editing. Those behaviors remain the entry and navigation path.

The #125 observed-date behavior landed separately in #146. Its record and version isolation remains intact. A copied date is editable and visibly unsaved. New saved versions reset the editable fields without remounting open evidence disclosures. Evidence corrections remain independent forms. Private save includes the externally associated work-sample and snapshot controls. Invalid work-sample input opens its optional section for native browser validation.

Delete-original confirmation, retained originals, snapshot removal, work-sample links, saved decisions, unpublish, export, and sharing approval remain available. No schema, generated file, global configuration, provider, or owner-data change belongs to this PR.

## Outside review dispositions

These dispositions were recorded before editing in [the collection reconciliation receipt](../../work/pstack/2026-10-06-collection-reconciliation.md).

- #126 says "Needs a closer look" and "Findings: None." Fix now through desktop and mobile behavior checks and inspection against the Paper exports. The old review does not clear this new head.
- #127 [focus coverage comment](https://github.com/keeganmoody33/PROPER-RESPECT/pull/127#discussion_r4127379069) says "Compare both normal and focused card appearance in each theme." Fix now with an actual keyboard-focus regression inside the collection and an equivalent card outside it.
- #127 [QA status comment](https://github.com/keeganmoody33/PROPER-RESPECT/pull/127#discussion_r4127379190) says "Those statuses imply different merge gates; update the PR description or this report so reviewers and automation have one current acceptance state." This dated receipt and its delivering PR replace the old conflicting statements for the new change. The old proposal and its review thread remain preserved for parent disposition.
- #129 has no substantive GitHub review or inline comments. Its new implementation requires fresh review.

## Local verification

Runtime: bundled Node `v24.19.0`. Raw command output remains in `/tmp/proper-respect-collection-20261006/`.

- RED: `npx vitest run src/client/private-inventory.test.ts` failed one new reading-order and independent-form regression, with eight passes. `layout-red.txt` preserves the failure before implementation.
- GREEN: the same suite passed all nine tests. `layout-green.txt` preserves the result.
- The first browser run passed 33 cases and failed 10. `layout-e2e.txt` and `layout-first-browser-errors/` preserve the failures. Saved-version changes remounted evidence disclosures. The fixture comparison had a different card position and destination, and the correction selector did not match the textarea's accessible name.
- The second browser run passed 39 cases and failed four. `layout-e2e-rerun.txt` and `layout-second-browser-errors/` preserve the failures. A closed optional section hid native URL validation, and the correction fixture omitted the production `review-field` styling.
- After those fixes, the browser run passed all 43 cases. `layout-e2e-final.txt` preserves that result. Screenshot inspection then found that direct theme-attribute changes left the theme provider's native `colorScheme` unchanged. The first real-selector run failed six cases because both the header and footer have Appearance controls. `layout-e2e-real-theme.txt` and `layout-theme-selector-errors/` preserve that test error. The final selectors use the header control before opening the focused relationship.
- Final desktop and mobile browser verification passed all 43 cases with real theme controls. Command: `npm run test:e2e -- tests/e2e/inventory.spec.ts tests/e2e/account-setup.spec.ts --workers=2`. Proof: `layout-e2e-real-theme-final.txt`.
- `npm test` passed 1,711 Vitest tests, with two existing skips, and all 121 script tests. Proof: `layout-full-tests.txt`.
- `npm run typecheck` and `npm run lint` passed. Proof: `layout-typecheck-final.txt` and `layout-lint.txt`.
- `npm run build` passed with `.github/workflows/verify.yml` synthetic values and an empty Clerk secret. Proof: `layout-build.txt`.
- `git diff --check` passed.

The browser cases cover correction forms without relationship save, date drafts, explicit private save, optional fields, save locks, lost-response retry identity, snapshot removal, retained originals, delete confirmation, sharing approval, duplicate records, focus navigation, and card styling. The theme checks use the actual Appearance control. The card checks compare all descendant computed colors, fonts, borders, and focus outlines with an equivalent card outside the collection. Axe and horizontal-overflow checks pass in the focused desktop and mobile cases.

## Current-main integration

The reviewed layout was committed as `2e7a6d579d15155df33360924ba44976c806011e`. Parent main `44836dcfb6c8afa22be5b60c43d5428b586b5a0c` was merged at `0f2cefede1b33b5ddc768a33a65932e12be13779`. That main update contains the release Vercel CLI check and snapshot-label reconciliation. The workflow's release-tool smoke step remains intact. All six reviewed source files and 14 captures remain byte-identical. The delivering diff against this main contains exactly 21 files.

Checks repeated on that integrated tree:

- `npm test` passed 1,725 Vitest tests, with two existing skips, and all 121 script tests. Proof: `layout-current-main-full-tests.txt`.
- `npm run test:e2e -- tests/e2e/inventory.spec.ts tests/e2e/account-setup.spec.ts --workers=2` passed all 43 cases. Proof: `layout-current-main-e2e.txt`.
- `npm run lint` and `npm run typecheck` passed. Proof: `layout-current-main-lint.txt` and `layout-current-main-typecheck.txt`.
- `npm run build` passed with the same synthetic configuration. Proof: `layout-current-main-build.txt`.
- `git diff --check` passed. The generated `next-env.d.ts` and prior observed-date receipt remain unchanged.

## Screenshot evidence

All 14 captures were inspected. They use synthetic fixtures at 1280px or 390px. The focused editor captures show the copied unsaved date, independent correction form, evidence panel, private save, optional disclosure, and saved decisions. The native date control remains visible in dark mode.

- [Desktop light editor](2026-10-06-collection-layout-assets/focused-1280-light.png)
- [Desktop dark editor](2026-10-06-collection-layout-assets/focused-1280-dark.png)
- [Mobile light editor](2026-10-06-collection-layout-assets/focused-390-light.png)
- [Mobile dark editor](2026-10-06-collection-layout-assets/focused-390-dark.png)
- [Desktop finder](2026-10-06-collection-layout-assets/collection-finder-1280.png)
- [Mobile finder](2026-10-06-collection-layout-assets/collection-finder-390.png)

Normal and actual keyboard-focused card captures:

| Viewport and theme | Normal | Keyboard focus |
| --- | --- | --- |
| Desktop light | [Card](2026-10-06-collection-layout-assets/card-normal-1280-light.png) | [Card](2026-10-06-collection-layout-assets/card-focused-1280-light.png) |
| Desktop dark | [Card](2026-10-06-collection-layout-assets/card-normal-1280-dark.png) | [Card](2026-10-06-collection-layout-assets/card-focused-1280-dark.png) |
| Mobile light | [Card](2026-10-06-collection-layout-assets/card-normal-390-light.png) | [Card](2026-10-06-collection-layout-assets/card-focused-390-light.png) |
| Mobile dark | [Card](2026-10-06-collection-layout-assets/card-normal-390-dark.png) | [Card](2026-10-06-collection-layout-assets/card-focused-390-dark.png) |

## Review identity and acceptance

Current-source SHA-256 values:

```text
f72bb2cf1f8e291863e6282ace9214852284ee73ce9e2f662da769b4dc947e2e  components/private-inventory.tsx
8011e12838bde1a83adedfa39b6700e0237a3d2ee814c940ee73a0a17035e294  components/private-inventory.module.css
22600eff8a76be6bc463e6b6462bbce75da6e11a3a28e852bacfb04da873cf6d  src/client/private-inventory.test.ts
7d60ca2807f1be8d10217a519ba4479df39d25ba81d00455f4f7da54ae118dad  app/evidence-fixture/inventory/view.tsx
19d5d33d02f2c4ea44af6d45185c293ffa482ffc19e948d1ed44ec2622548640  tests/e2e/inventory.spec.ts
11d9be4f439baab4d8eabda0fe3b46ac1cc467a0afab9ffa148338d8e441ca59  tests/e2e/account-setup.spec.ts
```

Fresh functional and changed-comment review returned internal PASS with no concrete findings. `docs_review` matched the six source hashes and inspected the full 21-file delivery and all 14 captures. It reviewed form associations, disabled controls, native validation reveal, record and version resets, preserved evidence disclosures, retry identity, finder navigation, and card focus. Changed comments, suppressions, and MUST KILL flags are zero. The report is retained at `/tmp/proper-respect-pickup-20261006/collection-layout-port-review.md`. This internal review does not replace the required outside review or authorize release.

Merge, production release, and authenticated hosted acceptance remain separate gates. No deployment or publication was performed.

## Subsequent main integration — 2026-10-06 UTC

Main `06f1160553207cabe74fa2325949c2293573066e` was merged after the cloud-fixture, dependency and analytics deliveries. All six layout source/test files and all 14 visual assets are byte-identical to independently reviewed head `83fad37afe305e3a5ce3d4bc1393100bda07ae20`; only this dated receipt adds the new integration record. The delta against this main remains 21 files.

The earlier local checks bind their recorded base. Fresh final-head review and strict hosted checks on this combined tree remain required before merge. No provider read, production release or publication occurred.

## Final Copilot disposition — 2026-10-06 UTC

Final merge preflight found an unresolved fixture accessibility comment at `fd5a8a64ee950613207497a7a8145b5401d2f459`: the comparison div has an accessible name but an implicit generic role. Disposition before editing: fix now by giving that synthetic comparison container the supported group role. Existing card comparison browser cases will verify the rendered fixture. Final source binding and hosted checks restart after this correction.

The two existing actual-browser card comparison cases pass at 1280px and 390px after the supported group role correction, using both actual themes (`layout-group-role-browser.txt`). The five other source/test files and all 14 committed images remain byte-identical. The fixture hash above now identifies the corrected source.

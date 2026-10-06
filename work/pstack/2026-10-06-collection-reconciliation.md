# Collection reconciliation, 2026-10-06

Ref: https://plan.ref.tools/oLGxQYBMTcFHrrvg.
Starting main: `258660c`. Prior tool-entry branch and commit `71757487` are retained.

## Source behavior and chosen implementation

- #125, head `080d87d65d14836fc0ece1169545873548b04832`: connect eligible observed dates to an editable private draft. Keep record/version isolation and unchanged-decision retry identity. Current main already supplies the eligible action but does not pass its callback from the relationship editor.
- #126, head `736b6af2260a83dfb7c3e561c128e2d639646c6e`: separate relationship fields, evidence, and explicit save. Current main already has a focused editor and evidence columns; retain its navigation and adapt the visual hierarchy.
- #127, head `a767aee74f2a2b29b33cdc2b14bde90a4f40ecb7`: theme roles, visible unsaved dates, mobile save width, and product-card focus isolation. Apply collection-scoped styling. Global navigation, font, and primary-action changes belong outside this collection concern.
- #129, head `fb8c3698fbb436e6230803d20b0b7eb57ccb42f0`: Paper tool list and selected editor, with mobile date, evidence, save, and extra-fields order. Keep the current searchable relationship locator and focus route. Adapt the compact list and editor order without selecting an unrequested record or replacing the current one-step entry.

The Paper desktop/mobile exports retained in #127 were inspected from that exact commit. They show an indigo evidence panel, red private save, and optional work-sample controls after the save on mobile. These dated design studies guide the layout; current owner direction and main's collection navigation remain authoritative.

## Review dispositions recorded before implementation

- #125's head review has “Findings: None.” No inline review comments exist. The current-main port requires fresh review.
- #126's head review says “Needs a closer look” and “Findings: None.” Fix now in the layout concern by executing desktop/mobile visual checks against the inspected Paper exports. The old review does not clear a new head.
- #127 [focus coverage comment](https://github.com/keeganmoody33/PROPER-RESPECT/pull/127#discussion_r4127379069): “Compare both normal and focused card appearance in each theme.” Fix now in the layout concern with an actual keyboard-focus regression inside the collection.
- #127 [QA status comment](https://github.com/keeganmoody33/PROPER-RESPECT/pull/127#discussion_r4127379190): “Those statuses imply different merge gates; update the PR description or this report so reviewers and automation have one current acceptance state.” Superseded for the delivering concern by a new dated receipt and matching PR checks. Preserve the original proposal and its review thread for parent disposition.
- #129 has no substantive GitHub review or inline comments. Its original proposal remains preserved. New work requires fresh review.

## Verification

Observed-date concern, branch `codex/observed-date-draft-20261006`, base `258660c`:

The eligible observation action fills an editable start-date draft for the selected relationship. It does not save or confirm the relationship. A different record or newer saved relationship version discards that draft. An explicit private save retains the existing operation identity and retry rules. Evidence actions are disabled during saving. No layout change belongs in this first PR.

Node runtime: `v24.19.0`, from the configured bundled runtime. Raw command output is preserved outside Git in `/tmp/proper-respect-collection-20261006/`.

- RED: `node node_modules/vitest/vitest.mjs run src/client/private-inventory.test.ts`, one failure and seven passes before the callback was connected. `date-red.txt` retains the missing-action assertion.
- GREEN: the same client suite passed all eight tests. Focused inventory, onboarding-auth, and backend inventory checks passed 37 tests: `date-focused.txt`.
- `npm run typecheck` passed: `date-typecheck.txt`.
- The first `npm run lint` collided with Playwright removing its ignored output directory and failed with `ENOENT` for `test-results`: `date-lint.txt`. Retrying after the browser run passed: `date-lint-retry.txt`.
- `npm run test:e2e -- tests/e2e/inventory.spec.ts tests/e2e/account-setup.spec.ts --workers=2` passed all 35 cases: `date-e2e.txt`. The synthetic checks cover editing and clearing a copied date, no save before explicit confirmation, unchanged-decision retry identity, record isolation, newer saved versions, a pending-save lock, existing private deletion, and the separate sharing approval.
- A focused screenshot rerun passed both 1280px and 390px date cases: `date-screenshot-e2e.txt`. [Desktop draft](../../docs/verification/2026-10-06-observed-date-assets/desktop-draft.png) and [mobile draft](../../docs/verification/2026-10-06-observed-date-assets/mobile-draft.png) were inspected. The copied date and unsaved notice are visible; the fixture has no horizontal overflow. These are synthetic legacy-card fixtures, not authenticated production acceptance or the pending focused-layout design.
- `npm test` passed 1,710 Vitest tests, with two existing skips, and all 121 script tests: `date-full-tests.txt`.
- `npm run build` passed using only `.github/workflows/verify.yml` synthetic values and an empty Clerk secret: `date-build.txt`.
- `git diff --check` passed. No schema, generated file, global configuration, provider, or owner-data change is included. No deployment or publication was performed.

Current-source SHA-256 values for independent review:

```text
9dd3d24fb7442bf57781c54496fd900aab125014c593b5d0bde935d40e2b98b0  components/private-inventory.tsx
8d5939a3a17f271333cabf4eb5e68aa39cc205284d6c75c43bedca419f3f7b96  src/client/private-inventory.test.ts
118c30f1e8ac426b157855b7190248dd607f13a0a25e08b9a041eed94b572bdb  app/evidence-fixture/inventory/view.tsx
b800078203005440a924f88384d54543178803ddf6dfa83ac452673813f3d482  tests/e2e/inventory.spec.ts
```

Fresh functional and changed-comment review: `docs_review` inspected the full tracked diff, matched the four source hashes above, inspected both screenshots and raw proof, and returned internal PASS with no findings. Changed comments: zero; removals: zero; suppressions: zero; MUST KILL flags: none. The unchanged-source report is retained at `/tmp/proper-respect-pickup-20261006/date-port-review.md`. This internal review does not replace the required outside review or authorize a merge or release.

Layout concern: pending after parent review and merge of the observed-date PR. Keep delete-original confirmation, snapshot selection/removal, work-sample links, saved decisions, unpublish/export controls, and separate sharing approval.

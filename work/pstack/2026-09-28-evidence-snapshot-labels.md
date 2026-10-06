# Dated evidence snapshots

Date: 2026-09-28. Base: `859870cc4e9719f1a9edb0012523b88f938a2174`.
Issue: [#103](https://github.com/keeganmoody33/PROPER-RESPECT/issues/103).
Ref: https://plan.ref.tools/oUl8LCIQb32SAicK.
Checkout: `/Users/keeganmoody/.codex/worktrees/evidence-snapshot-labels/PROPER-RESPECT`.
Branch: `codex/evidence-snapshot-labels-20260928`. This thread expects to resume this checkout.

## pstack TDD workflow

1. **Understand the bug.** Identify the intended behavior, current behavior, affected path, and smallest observable reproduction.
   Complete: `ActivityMeta` renders stored `FRESH` as “Updated” without subscription authority. A successful one-off capture retains that label indefinitely. Disposition of issue #103: fix now, display only.
2. **Choose the narrowest executable check.** Prefer the closest unit, component, integration, or regression test already used for that codepath. If no practical test path is obvious, do not create one from scratch just to satisfy the workflow.
   Complete: the existing static-render component tests cover the shared owner/visitor card.
3. **Write the failing test first.** Add the smallest focused test that would have caught the bug. The test should encode intended behavior, not mirror the current implementation.
   Complete: all six activity kinds, both audiences, dated capture/measurement period/provenance and archived relationship status; stale/error warnings remain independent of relationship state.
4. **Run the new test before fixing.** Confirm it fails for the intended reason. If it passes or fails for an unrelated reason, correct the test or reproduction before editing the implementation.
   Complete: `npx vitest run src/client/product-card.test.ts` failed 12 tests, all because activity metadata contained “Updated”; 77 tests passed.
5. **Fix the bug.** Make the smallest production change that satisfies the intended behavior while preserving nearby contracts.
   Complete: remove the unsupported positive update label; retain the existing snapshot date and non-FRESH warnings. A refreshed capture also remains honestly dated. No stored schema, provider, subscription, public projection or receipt changes.
6. **Rerun the regression test.** Confirm the test now passes.
   Complete: 107/107 component and visible-profile projection tests pass.
7. **Run nearby validation.** Run relevant adjacent tests, type checks, lint, or scenario checks when the change has broader risk.
   Complete: lint and typecheck pass. The existing Chromium card disclosure/layout checks pass at 1280px and 390px (2/2), including the dated snapshot label, absence of “Updated”, keyboard focus and overflow checks. Both screenshots inspected. No provider reads or deployment. Next dev's generated import-path change in this checkout's `next-env.d.ts` was restored to its starting content.

## Evidence

- `npx vitest run src/client/product-card.test.ts src/domain/visible-public-profile.test.ts` — 107 passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npx playwright test tests/e2e/product-card.spec.ts --grep 'card typography and natural disclosure layout' --workers=1` — 2 passed; fixture-only, no authentication/backend configuration.
- [Desktop screenshot](../../docs/verification/2026-09-28-evidence-snapshot-labels/desktop.png).
- [Mobile screenshot](../../docs/verification/2026-09-28-evidence-snapshot-labels/mobile.png).

Only `components/product-card.tsx` changes production behavior. The Section 10 receipt-sensitive source paths and their dependencies remain untouched. This establishes a display correction in source, not a hosted acceptance result or an assessment of the ongoing 30-day receipt.

Next concrete slice: issue #102, making the observed-date shortcut available in the private relationship form without automatically saving it. Recheck ownership before starting it. This branch remains dedicated to #103 and awaits outside review; it is not merged or deployed.

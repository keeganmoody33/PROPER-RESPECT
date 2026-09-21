# PR #38 review remediation — September 21, 2026

Reviewed branch: `codex/usage-examples-20260921`.
Reviewed head: `ae2d8743123add07853c66e9a2ea4bfaa0e2bc25`.

Owner instruction: “Remediate any of the comments by Devin and anything on PR 38, and once you get done with that, merge.” This authorizes merging PR #38 after verification. Deployment, backend synchronization, provider reads and publication remain outside this operation.

The original preview checkout has an existing modified `next-env.d.ts`; it is preserved. Fixes run in isolated `/tmp/proper-respect-pr38-remediation-20260921` from the exact reviewed head.

## Dispositions recorded before implementation

| Feedback | Disposition | Evidence and correction |
| --- | --- | --- |
| Devin comment 4061765995 / thread PRRT_kwDOSyRAjs6kVd67: existing `collection` profiles become unreachable | Fix now | The new static `/collection` route shadows the existing dynamic profile namespace, and the new handle reservation rejects an otherwise valid legacy handle. Move the private workspace to `/app/collection`, remove the added reservation, and regress public `/collection` and `/app` profiles plus same-handle owner edits. No data migration. |
| Devin comment 4061766150 / thread PRRT_kwDOSyRAjs6kVd8o: boundary gaps disappear | Fix now | Calendar bounds currently use supplied days alone. Use a valid enclosing activity period for the displayed range; preserve unsupplied days as blank rather than zero, and fall back to the supplied span for unusable periods. Regress leading/trailing gaps. |
| Copilot review PRR_kwDOSyRAjs8AAAABOeL0eg: calendar range and CSS calc expression | Fix now | Calendar range is the same defect above. Replace CSS numeric multiplication with JavaScript-computed clamp bounds for compatibility while preserving responsive spacing; verify the resulting width in browser layout. Do not claim that all browsers reject the original expression. |
| Cursor approval / automated check wrappers | Not a bug | No additional actionable finding in the initial inventory; final-head reviews will be checked again. |

## Verification

Routing regression: `npx vitest run src/domain/onboarding.test.ts convex/publicationHandles.test.ts` first failed 2 tests (22 passed), proving rejection of the existing handle and saved-owner identity edit. `npx playwright test tests/e2e/public-profile.spec.ts tests/e2e/homepage.spec.ts` first failed 7 tests (2 passed), proving the shadowed profile, old links and absent private nested route. After correction, 25 scoped unit tests (including the public-profile loader) and all 9 routing/browser tests passed. The public-profile browser spec now runs in CI alongside homepage and metadata checks so the route regression stays covered.

Calendar regression: `npx vitest run src/client/product-card.test.ts` first failed 4 boundary/position tests (58 passed), then passed all 62. Leading/trailing gaps, missing initial weeks, invalid/non-enclosing periods, empty data, and existing supplied-zero semantics are covered on both card faces. Scoped component browser checks passed 11/11, including 320px/1280px geometry and computed width.

Combined verification, September 21, 2026:

- `npm test`: 697 passed, 2 optional skipped; all 7 Node script tests passed.
- `npm run lint`, `npm run typecheck`, `git diff --check`: passed.
- `npm run build`: passed with synthetic Clerk/Convex settings and `PUBLIC_SITE_ORIGIN=https://public.example`; generated routes include `/app/collection` and dynamic `/[handle]`.
- `npx playwright test`: all 64 passed. These are synthetic source/browser checks, not real-account hosted acceptance.
- Screenshots: [legacy public profile](2026-09-21-pr38-remediation/2026-09-21-legacy-collection-profile.png), [private route](2026-09-21-pr38-remediation/2026-09-21-private-collection.png), [mobile calendar front](2026-09-21-pr38-remediation/2026-09-21-calendar-boundaries-card-front-320.png), [desktop calendar back](2026-09-21-pr38-remediation/2026-09-21-calendar-boundaries-card-back-1280.png). Parent inspected the legacy profile and mobile calendar directly.

Final pushed SHA, remote checks, visible feedback replies and merge result will be recorded on [PR #38](https://github.com/keeganmoody33/PROPER-RESPECT/pull/38) and the [canonical Ref](https://plan.ref.tools/oUl8LCIQb32SAicK). At receipt authoring, the source correction is local and the PR is not yet merged. No deployment or backend synchronization was performed. Existing hosted acceptance gates and profile-link schema synchronization requirements remain unchanged.

CSS compatibility probe: installed HeadlessChrome 151.0.7922.34 accepts both the original numeric-multiplication expression and the proposed precomputed-clamp expression through `CSS.supports('max-width', expression)`. Copilot's blanket invalid-CSS characterization was not reproduced in this browser. The simplification removes reliance on CSS typed multiplication while preserving the sizing formula; browser geometry remains part of verification.

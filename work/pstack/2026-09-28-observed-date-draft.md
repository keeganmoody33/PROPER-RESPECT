# Observed date to private draft — 2026-09-28

Ref: https://plan.ref.tools/wF1376s8dtHxyZHw
Issue: #102. Base: bd24b90475b9ca31f9ed0ecba897a1217c43ce48.

The existing eligible-observation action now updates the selected relationship's editable date draft. It does not call the save mutation. Saving remains explicit, uses the existing operation identity/retry logic, and does not publish. Record identity and saved relationship version scope the draft. Evidence actions are disabled during a save.

## Verification

- RED: the new collection regression failed because the eligible date action was absent (1 failed, 7 passed).
- GREEN: focused collection/evidence checks passed (13 tests).
- Node 24.21.0: typecheck and lint passed; npm test passed (1,602 Vitest tests, two skipped; 120 script tests).
- In-app browser, synthetic fixture: selecting June 3, 2024 left save operations empty; explicit save recorded a private relationship; a native keyboard edit to July 3 persisted after another save. No real owner data or provider was used.
- Added desktop/mobile browser regression for draft-only selection, edited date, lost-response retry, clearing, record isolation and separate publication. Direct Playwright CLI execution awaits the permission requested by the invoked design-qa skill; do not treat these new browser tests as executed yet.

No layout redesign, backend/schema change, merge or deployment is included. R15 deletion controls remain intact. This thread retains collection-refinement for follow-up and evidence-snapshot-labels for #118 review.

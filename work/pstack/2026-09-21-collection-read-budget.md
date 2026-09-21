# Collection read-budget work — 2026-09-21 UTC

Status update: rebased implementation complete at 3c2dd07a40b47580860aaf51cad1dfeb0b08f5fc on owner-merged main 3a1413f3deb34c417cb9bdbdbfa4d34096e47e77; full local verification recorded in docs/verification/2026-09-21-collection-read-budget.md. Preparing owner-reviewed PR; no deployment or backend synchronization. Earlier checkpoint details below are historical.
Base: bb108413d937abb9082f88fd3ded3e168f93e574.
Checkpoint: 2fde7ef4cc7e51f523b44d3ac896f450648978ee.
Worktree: /tmp/proper-respect-read-budget-20260920.
Branch: codex/collection-read-budget-20260920.

## pstack verification steps

1. Build it (necessary but not sufficient)
2. Run it and exercise the actual feature path
3. Check the full chain: does data flow from input to output?
4. For integrations, test the full communication path end-to-end

Step 1: pending final implementation/build. Focused backend contract regression reproduced RED (new option rejected), then GREEN: 14 publication tests. Full current suite: 638 Vitest passes, two optional skips, seven Node checks; lint/typecheck pass. Steps 2–4 remain pending for the complete resource correction; current source unit is not release-ready.

## Confirmed source paths and first correction

getState collected every rawEvidence and draftImports document even though its current UI consumes neither list. Added optional includeLegacyCollections; the current UI passes false. Default and includeClaims:false legacy calls still return their metadata, as the existing compatibility test requires. Cards/publication remain intact. This avoids the unused collection reads, not the per-card associatedAccountEvidence raw joins. Backend must accept this argument before releasing the new frontend; older deployed backend rejects unknown arguments.

## Remaining blocker and implementation direction to validate

The account helper still joins up to 200 raw originals for GitHub and 25 for other products, compounded by inventory.list and getState card batching. Whole-query props and links can also grow; do not call the entire query bounded from this first correction. Destination resolution only uses associated account evidence for GitHub; other products cannot gain an associated account link from the current resolver.

Prefer investigating an isolated, paginated account-evidence query (small fixed raw-document pages, metadata-only return) over eager cached metadata: it can preserve deletion/provenance behavior and avoid migration/backfill risk. The current inventory and sharing UI both consume associatedAccountEvidence, including the explicit private-destination sharing offer. Both must retain correct behavior. Never silently select a historical account as newest while coverage is partial. Expose retained lookup coverage/progress, bound each transaction, and preserve explicit owner links, current valid connector priority, original-date ranking and deterministic ties. Pages beyond 200 must be tested. Recompute when retained originals are deleted. No provider reads needed for these stored-evidence queries.

If denormalization is chosen instead, audit all creation/attachment paths: discovery.ts, onboarding.ts upload, privateEvidence.ts, connectors.ts, mailboxDiscovery.ts and discoveryReview.ts. retainedEvidence.importPacket patches original capture metadata AFTER ingestSignalsForOwner, so caching at proof insertion alone gives the wrong chronology. onboarding.deleteEvidence patches deletedAt and removes payload/storage; cached account entries must stop being eligible atomically. Backfill must be bounded, replay-safe, and explicitly authorized for the exact backend; do not activate a partial index without visible coverage and fallback.

## Required acceptance before opening the full correction PR

RED/GREEN regressions for actual no-payload main-list reads, safe per-transaction lookup budget, valid current connector, missing/invalid connector fallback, >200 proofs, adversarial owner/issuer/deletion, original chronology and reversed attachment ties. Preserve legacy metadata contract and owner-selected sharing preview. Verify new/current empty accounts and large synthetic collections. Run full suite, lint/typecheck/build, desktop/mobile UI and record exact head. Keep source and hosted proof separate. PRs #28/#30/#31/#32 are independent and must not be adopted or merged by the agent.

## Review disposition — September 21

Devin r4058967862 is confirmed at head 4757755815f2617f5e822590308ff5fb28018bd6: UnmatchedRecords still passes empty options to inventory.list. Its picker consumes only product/relationship fields. Correct that caller and reproduce the resource-sensitive picker failure in a rendered test before the fix. The production caller audit finds exactly the picker and PrivateInventory; the latter already opts out. This correction is within the existing read-budget PR, not new scope.

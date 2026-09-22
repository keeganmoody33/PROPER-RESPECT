# Canonical owner profile correction

September 22, 2026. Base: `1055aa9dd575738fde4eb3547ae5f401c741b0ab`.

## Reproduced mismatch

Production `/keegan` returns the four-card published profile; `/lecturesfrom` returns 404. The signed-in collection uses `lecturesfrom` and reports no publication at its current handle. Read-only targeted inspection of `striped-chicken-693` confirms the account and site retain their original matching seed lineage, but the publication row and embedded profile still carry the old handle. No old-handle account or destination publication exists. Private operator identifiers and exact preflight arguments remain outside Git.

## Correction

An internal operator-only migration requires expected owner identity, seed lineage, source publication ID/revision and exact canonical profile hash. It checks unique authenticated ownership, the matching site, an unoccupied destination and no alias conflicts in the same transaction. Dry run makes no writes. Apply changes only the existing public snapshot's handle and embedded handle, increments its revision, and creates a durable reserved alias for the old address. Cards, order, approved identity fields, original publication time, unresolved card mappings and all private records are preserved. It does not rebuild the public profile from current private choices.

Public profile queries resolve one alias to the same publication ID; alias chains and mismatched publication IDs fail closed. The page permanently redirects a legacy handle to the returned canonical handle, and canonical/OpenGraph metadata uses that handle. Existing account creation and handle claiming reserve alias names. Homepage, agent instructions and installation examples consistently link the intended `/lecturesfrom` profile. Historical receipts and independent synthetic `keegan` fixtures remain unchanged.

The local MCP prototype still rejects a returned handle differing from the supplied reference. Its documented live example now supplies canonical `lecturesfrom`; this retains the existing fail-closed reader rather than silently relaxing its identity check. Browser reading of the old URL follows the canonical redirect.

## Verification

- New migration regression initially failed against base; implementation passes 16 focused tests including dry-run, replay, preserved private records, unchanged cards, unresolved mappings, stale hash/revision and owner/destination/alias conflicts.
- Combined migration, existing publication/handle and profile metadata checks passed 57 tests before the additional preservation case.
- Full suite passed 778 unit tests with 2 optional skips and 7 script tests before that additional test; the final focused 16 tests pass.
- Twenty-eight rendered Chromium checks passed: canonical legacy redirect, destination identity/OpenGraph URL, existing public routes, privacy-safe 404, private noindex, homepage links and agent discovery.
- Full ESLint, TypeScript, diff whitespace check and configured production webpack build passed.

## Release gate and operator sequence

Code review and hosted checks precede merge. Production backend synchronization and the one-time migration are a separate concrete release action; no backend write or deployment occurred in this implementation pass. Do not deploy the frontend's new example links before the canonical target is active.

1. Review the exact merged source and isolate the additive backend changes. Preserve current production configuration and data; never run a seed function.
2. With exact-target authorization, deploy the reviewed backend to `striped-chicken-693`, run the retained arguments with dryRun true, and compare the source revision/hash and owner/site lineage again.
3. Apply only that approved migration, then verify the new public profile has the same four cards and source content apart from its handle. Verify the old-handle query resolves to it and the owner sees an existing publication at the current handle. Do not publish new private content.
4. Release the verified frontend candidate to existing groundskeep/proper-respect. Verify both URLs, redirect, canonical/OpenGraph and all user-facing/agent example links.
5. Preserve before/after receipts. If the frontend fails, roll back the frontend artifact while retaining the additive alias-capable backend. Do not run destructive schema rollback or reseed.

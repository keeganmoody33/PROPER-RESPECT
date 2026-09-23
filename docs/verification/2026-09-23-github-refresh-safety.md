# Scheduled GitHub refresh safety

Date: 2026-09-23. Base `8298bda8406601ddde8279aee12d080dcbfaf616`. Branch `codex/github-refresh-safety-20260923`. Local implementation and synthetic checks passed; independent review and production authorization remain separate.

## Changed behavior

Scheduled GitHub refresh now obtains a current internal grant before decrypting or fetching. One shared loader checks subscription approval, metric/scope/cadence, duplicate active subscriptions, connector and secret ownership/provider, current account, public relationship/product, unique owner/handle, and one matching approved public calendar. CONNECTED and retryable ERROR remain eligible; NEEDS_REAUTH and REVOKED do not. GitHub credentials are no longer returned by the old bulk work-list query.

Completion reloads that authority transactionally and compares its SHA-256 fingerprint. The fingerprint covers exact encrypted credential bytes, subscription state, owner identity, relationship/private selection, and publication/mapping. A revoke, credential rotation, owner edit or earlier compatible completion invalidates the old grant. The returned GitHub account must match the current authorized account. Success requires a canonical capture time newer than both the prior success and approved public activity, and at most 60 seconds ahead of the server clock. Source timestamps remain unchanged.

Success writes one approved public activity update and one PUBLIC signal. Failure uses a fixed error and can mark only the still-approved activity stale. Both advance existing attempt bookkeeping to at least the previous attempt timestamp plus one millisecond, so a frozen clock does not permit repeated terminal writes. Private selected evidence and sibling cards remain untouched. Failure does not append a signal or increment public revision. No refresh creates private discovery records.

Provider acquisition has its own try/catch. Completion errors are not caught and routed through the old failure mutation. Legacy applyRefresh/markRefreshFailed cannot mutate GitHub without a grant; their Devin branch remains available. An old in-flight GitHub action reaching those legacy entry points after a future deployment will fail closed rather than bypass the new boundary.

There is no new daily throttle. A fresh grant with a strictly newer capture can apply on the same day, and midnight alone does not invalidate a current grant. Manual connect/reconnect, consent enrollment and cron schedules are unchanged.

## Scope

Runtime change is confined to `convex/connectors.ts`. New `convex/githubRefreshSafety.test.ts` exercises the actual action, transaction, AES decryption and source adapter using synthetic credentials and mocked fetch. Existing `convex/connectorPrivacy.test.ts` now reaches GitHub through the guarded prepare/completion functions.

Three generic publication tests previously used a Shared Tool/headline fixture labeled GitHub while directly calling the legacy mutation. Their fixture provider/metric now uses the preserved Devin path, with every omission/revocation assertion retained. Three new real GitHub action cases separately prove that withheld/fixed/removed publication invalidates an old grant while an omitted sibling retains its refresh permission. This is compatibility coverage, not removal of GitHub assertions.

Schema, onboarding/publication runtime, auth, HTTP, cron, generated files, dependencies, frontend and configuration are unchanged. No live data or deployment operations occurred.

## RED and GREEN evidence

The original 12-failure log remains `/tmp/u32-refresh-original-12-red.log`. One original test incorrectly treated any second same-day observation as replay. Before runtime edits, its oracle was corrected to an equal capture under a frozen clock, with a separate strictly newer same-day positive control. The corrected baseline produced 12 failures and one passing positive control. `/tmp/u32-refresh-corrected-red.log`. No daily scheduling-policy defect is claimed.

- `npx --no-install vitest run convex/githubRefreshSafety.test.ts convex/connectorPrivacy.test.ts convex/publication.test.ts`: 57 passed. `/tmp/u32-focused-green.log`.
- `npm test`: 1,036 Vitest passed, two optional private-input tests skipped; all seven Node script checks passed. `/tmp/u32-full-test.log`.
- `npm run lint`: passed. `/tmp/u32-lint.log`.
- `npm run typecheck`: passed. `/tmp/u32-typecheck.log`.
- `PUBLIC_SITE_ORIGIN=https://proper-respect.com PROPER_RESPECT_E2E_REFERENCE=1 NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY= CLERK_SECRET_KEY= NEXT_PUBLIC_CONVEX_URL= npm run build -- --webpack`: passed. `/tmp/u32-build.log`.
- `git diff --check`: passed.

Tests cover zero mocked provider calls for invalid owner/secret/publication linkage, source-account mismatch, older/equal/malformed/future captures, concurrent actions and duplicate completions, late success/failure after owner edits or revocation, exact credential rotation without a changed timestamp, frozen-clock failure checkpoints, ERROR recovery, private evidence/sibling preservation, legacy bypass, same-day newer captures, midnight continuity, and actual Devin success/failure. These are synthetic tests of real code paths; they are not hosted or real-account proof.

PStack architect compared three designs and selected existing-state grants. Prove It Works and Test Behavior drove the retained RED/GREEN action checks. The scoped no-comments inspection found no new narrative comments or correctness suppressions; only the new test file's required Vitest/Vite directives were added. Unslop edited this receipt. No nested comment-review agent was launched; independent exact-head review belongs to root.

## Remaining boundaries

Concurrent admitted provider reads can still occur. A later revoke cannot retract an issued HTTP request or make database validation atomic with network acquisition; stale completion writes are blocked. This patch promises at most one compatible result application, not exactly-once acquisition.

Historical subscriptions never stored the GitHub account identity at approval. Current-context checking cannot recover that missing fact or authorize a transferred historical consent. No automatic revocation, reapproval, enrollment or account-changing reconnect restriction was added. That remains a separate release decision.

The scheduler's existing whole work-list read and legacy publication resolution scans remain unchanged; no whole-job scalability or bounded scheduling claim is made. Full publication fingerprints conservatively discard results after unrelated publication changes. Existing bookkeeping timestamps are internal attempt progress, separate from actual capture timestamps. This implementation is not a durable attempt ledger.

Production is unchanged. Backend synchronization, approved-subscription inspection, real provider reads, recurrence effects, publication and profile migration retain their existing authorization gates. No push, PR or deployment was performed by this worker.

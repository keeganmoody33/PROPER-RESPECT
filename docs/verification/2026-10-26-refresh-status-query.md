# 2026-10-26 refresh status query (#175)

Inspected head: `29c0666` (main). Branch: `claude/175-refresh-status-visible`.

## Problem

The `/lecturesfrom` GitHub card has shown `capturedAt 2026-10-09T06:00:28Z` since
October 9 while `convex/crons.ts` still schedules `connectors.refreshApproved`
daily at 06:00 UTC. The receipt workflow has failed every day since October 10
(#175). The `refreshAttempts` ledger (R08) records every attempt, but no
owner-facing query reads it, so the owner cannot see from the product that the
refresh stopped or why.

Likely cause, unconfirmed from this session (no production Convex access):
`githubRefreshAuthority` requires `sameGithubRefreshBinding`, which compares
`providerAccountId` and `generation`. A GitHub reconnect bumps the generation
(#150, owner decision: every reconnect revokes earlier consent), so the
standing daily approval goes ineligible and each night records
`SKIPPED / NOT_ELIGIBLE`. The card ages silently.

## Change

`convex/refreshStatus.ts` adds the owner query `refreshStatus:forOwner`. For
each unrevoked approval it returns the metric key, prop, approval time, last
success, the last ledger row (outcome and error class only; no provider text)
and a derived `state`:

| state | meaning |
| --- | --- |
| `RUNNING` | approval matches the live connection and the last attempt succeeded |
| `REAUTHORIZE` | no current approval can run: a reconnect revoked it and nothing replaced it, or the connection behind a current approval no longer matches it |
| `FAILING` | approval current, last attempt failed at the provider |
| `SKIPPED` | approval current, scheduler declined the last attempt for a reason other than the connection (error class says which) |
| `NEVER_RUN` | approved, no attempt yet |

Revision after Copilot review (same day): a real reconnect through
`connectors:connectGithub` revokes the approval (`saveConnectedSnapshot`), so
the query also lists the most recent revoked approval for a card when the
owner's connection moved on without it and the card is still public. A
disconnect (`revokeConnector`), a revocation while the connection still
matches, a card taken private, or a fresh approval on the new connection all
drop the row. `REAUTHORIZE` is derived from the current connection, never
from a ledger row: a `SKIPPED / STALE_GRANT` row from an overlapping duplicate
completion is reported as the last attempt but does not decide the state.

Second revision after Copilot review (2026-11-12). Three findings, all
verified against the code:

- A revoked row from a reconnect and one from the owner turning refresh off
  were byte-identical, so no read-side rule could tell them apart. The
  schema gains `metricSubscriptions.revokedReason` (`OWNER`, `RECONNECT`,
  `DISCONNECT`), stamped at every revocation site in `convex/onboarding.ts`
  and `convex/connectors.ts`. Publishing a card with refresh off also settles
  that card's earlier reconnect revocation as `OWNER`, so the diagnostic
  clears in both orderings. Rows without a reason keep the connection-based
  fallback, so stored data is never rejected.
- A first attempt that completes `STALE_GRANT` now reads `SKIPPED`, not
  `NEVER_RUN`.
- The decisive outcome is read with an indexed filter rather than a
  five-row lookback, so any number of stale duplicate completions in front of
  a success still reads `RUNNING`. `lastAttempt` still reports the actual
  latest row.

Third revision (2026-11-12, Copilot): a reconnect followed by a disconnect
left `RECONNECT` on the row because the disconnect site wrote only unrevoked
approvals. `revokeConnector` now settles an earlier `RECONNECT` revocation as
`DISCONNECT`, keeping its original `revokedAt`. Regression covers reconnect
then disconnect: 1 failed on the previous module, 18 passed after.

No UI change in this slice. The query is the contract a collection card can
read to show "daily refresh paused, approve again on the current connection".

## Proof

- RED: `npx vitest run convex/refreshStatus.test.ts` with the module absent,
  6 failed (`Could not find module for: "refreshStatus"`). After review, the
  three added cases (real reconnect, stale duplicate completion, non-connection
  skip) failed against the first commit's module: 3 failed, 9 passed.
- GREEN: same file, 12 passed. Covers never run, running, real reconnect via
  `connectors:connectGithub`, moved-on connection skips without a provider
  call, stale duplicate completion, non-connection skip, provider failure,
  other-user isolation, disconnect, matching-connection revocation, private
  card, and replacement by a fresh approval.
- Second revision: the four added cases (first-attempt stale, success under
  six stale skips, refresh off then reconnect, reconnect then refresh off)
  failed against `42af902`: 4 failed, 13 passed. After the change, 17 passed.
- `npx vitest run convex/githubRefreshSafety.test.ts`: 67 passed.
  `inventory.test.ts`: 11 passed. `connectorPrivacy.test.ts`: 11 passed.
- `npx tsc --noEmit` passed. `npx eslint` on the two new files passed.
- `node --test` owner-rule scripts (`assert-return-value`,
  `convex-auth-token-owner`, `http-url-owner`): 6 passed.
- Not run: full `npm test`, build, Playwright. The box is loaded; CI runs them.

## Owner actions

- [ ] Confirm the cause in the Convex dashboard: `refreshAttempts`, last rows
  for the GitHub subscription. `SKIPPED / NOT_ELIGIBLE` confirms the reconnect
  case; re-approve the daily refresh on the GitHub card.
- [ ] Decide whether to carry an approval forward on a same-account reconnect.
  This slice does not change #150.
- [ ] Follow-up slice: read `refreshStatus:forOwner` in the private collection
  and show the paused state on the card.

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
- `npx vitest run convex/githubRefreshSafety.test.ts`: 67 passed.
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

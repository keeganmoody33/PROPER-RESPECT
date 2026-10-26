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
| `REAUTHORIZE` | the connection was replaced after approval, or the last attempt was skipped as ineligible or stale |
| `FAILING` | approval valid, last attempt failed at the provider |
| `NEVER_RUN` | approved, no attempt yet |

No UI change in this slice. The query is the contract a collection card can
read to show "daily refresh paused, approve again on the current connection".

## Proof

- RED: `npx vitest run convex/refreshStatus.test.ts` with the module absent,
  6 failed (`Could not find module for: "refreshStatus"`).
- GREEN: same file, 6 passed. Covers never run, running, reconnect skips without
  a provider call, provider failure, other-user isolation, revoked approval.
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

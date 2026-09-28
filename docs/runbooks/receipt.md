# The 30-day GitHub refresh receipt

Updated: 2026-09-28. Written for R11. The rules come from Section 10 of
`docs/remediation/CODEX-BRIEF.md`; this page explains how to read the receipt.

## What it proves

For each counted day, a check **outside** the system read the public profile
the way any visitor's browser does, found the owner's GitHub contribution
calendar card, and saw it marked `FRESH` with a capture time at most 36 hours
old. It doesn't prove who made the contributions, and it doesn't read the
refresh ledger. The ledger (`refreshAttempts`, R08) is the inside record,
and the count needs both.

## How it runs

- **The refresh:** the Convex cron refreshes approved GitHub cards daily at
  06:00 UTC (`convex/crons.ts`).
- **The witness:** `.github/workflows/receipt.yml` runs at 08:17 UTC, and on
  demand (Actions, Receipt, Run workflow). It runs
  `scripts/receipt-check.mjs`, which calls the public query
  `publicProfiles:getByHandleV2` for `RECEIPT_HANDLE` at `PUBLIC_CONVEX_URL`.
- **The line:** every run, pass or fail, appends one JSON line to
  `receipts/github-refresh.jsonl` on the `receipts` branch. The branch holds
  nothing else.

  ```json
  {"checkedAt":"…","event":"schedule","runId":"…","sha":"…","handle":"lecturesfrom","capturedAt":"…","freshness":"FRESH","ageHours":2.28,"ok":true}
  ```

  - `ok` is true only when `freshness` is `FRESH` and `ageHours` is 36 or
    less.
  - A failing line carries a `reason`:

    | `reason` | Meaning |
    |---|---|
    | `NOT_PUBLISHED` | The handle has no public profile. |
    | `MISSING_CARD` | The profile has no GitHub contribution calendar card. |
    | `UNREACHABLE` | The query failed. The run log has the error; the line doesn't. |
    | `BAD_CONFIGURATION` | A variable below is missing or invalid. |
    | `NO_OUTPUT` | The script crashed before printing. |

    A line with no `reason` failed on freshness or age.
- **A failure:** the workflow opens an issue labeled `receipt`, or comments on
  the open one, then fails the run.

## Setup (owner)

1. **Set two repository variables** (Settings, Secrets and variables,
   Actions, Variables):
   - `PUBLIC_CONVEX_URL`: the production deployment URL, the same public value
     as `NEXT_PUBLIC_CONVEX_URL`.
   - `RECEIPT_HANDLE`: `lecturesfrom`.

   Neither is a secret: the check uses only the public query that every
   profile page calls.
2. **Check that the workflow can write.** Settings, Actions, General,
   Workflow permissions must allow the workflow's `contents: write` and
   `issues: write`. The workflow asks for exactly those.
3. **Leave the `receipts` branch unprotected.** It must accept the workflow's
   pushes. Nobody else writes to it.

Until K04 publishes the GitHub card with daily refresh on, every run fails
with `MISSING_CARD`. That is expected, and it proves the witness reports a
failure.

## Counting (Section 10)

- **A UTC day counts** when it has a line with `ok: true` whose `capturedAt`
  is later than the previous counted day's.
- **The scheduled line is the one that counts.** If GitHub drops that day's
  scheduled run, a `workflow_dispatch` line from the same UTC day stands in
  for it.
- **Any day that doesn't count restarts the count at 0.**
- **The ledger must hold a row for every cron run in the window.**
- **A tagged release keeps the count only if it leaves the refresh path
  alone.** Section 10 lists the files and functions that must be unchanged.
  Every other release restarts the count; record which in the release notes
  (`docs/releases/TEMPLATE.md`).
- **These always restart it:** hand edits to data, dashboard changes to the
  crons, and any deploy outside the tag workflow.
- **Done when** 30 consecutive days count, and `/about/methodology` (R12)
  links the receipt.

## Reading it

```sh
git fetch origin receipts
git show origin/receipts:receipts/github-refresh.jsonl | jq -c '{checkedAt, event, ok, capturedAt, reason}'
```

Never edit or rewrite the `receipts` branch. A corrected line is a new run,
and the history is the evidence.

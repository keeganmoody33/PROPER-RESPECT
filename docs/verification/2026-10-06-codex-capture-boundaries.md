# Codex capture boundary fixes

Date: 2026-10-06. Base: `main` at `a49a607f98b78aa63612d92ceaf442a811ff170b`.
Branch: `fix/codex-capture-boundaries`. [PR #156](https://github.com/keeganmoody33/PROPER-RESPECT/pull/156)
addresses the two post-merge findings on [PR #154](https://github.com/keeganmoody33/PROPER-RESPECT/pull/154)
and the subsequent clock review below.

## Review dispositions before implementation

- [Timestamp precision](https://github.com/keeganmoody33/PROPER-RESPECT/pull/154#discussion_r4197886388):
  **fix now**. Source and retention conversions discard fractions finer than a
  millisecond. That can manufacture same-position conflicts or admit a record
  before a fractional approved start.
- [Acquisition deadline](https://github.com/keeganmoody33/PROPER-RESPECT/pull/154#discussion_r4197886482):
  **fix now**. A delayed timer callback is not an absolute deadline. A late read
  or validation step can currently commit after the five-second limit.

### Follow-up review on PR #156

- [Wall-clock rollback](https://github.com/keeganmoody33/PROPER-RESPECT/pull/156#discussion_r4198169717):
  **fix now**. The fixed deadline still used wall time. A backward clock change
  during an event-loop stall could admit a result after five elapsed seconds.
  Use an injectable monotonic clock for the read budget, capped by the approval
  time remaining at the start. Keep wall time for absolute approval expiry and
  displayed timestamps, and check both clocks after acquisition and validation.
- [Stale hosted verification status](https://github.com/keeganmoody33/PROPER-RESPECT/pull/156#discussion_r4198169788):
  **fix now**. Record the successful run for `09d0747` as historical evidence
  and distinguish it from the later clock correction's current-head checks.
- Independent review of the clock correction found that fractional monotonic
  readings can schedule a fractional timeout, which Node truncates. **Fix now**:
  round the scheduled delay upward, check both clocks when the timer wakes, and
  rearm if it woke early. Rounding alone did not prevent early callbacks in a
  real-timer check. Exact deadline checks still reject late commits.

## Design

The public usage flow stays `requestConnection`, `approve`, and `sync`.
The shared history timestamp schema owns precision validation for window
endpoints, source records, and retained observations. The bounded prototype
rejects fractions finer than milliseconds before normalization.
Exact arbitrary-precision timestamps would require a different comparison and
identity representation. That broader change is unnecessary for this fixture
contract; silent rounding is never permitted.

`UsageConnection.sync` owns a fixed elapsed-time budget measured by an injectable
monotonic clock, `performance.now` by default. At the start of each read, the
budget is the smaller of five seconds and the approval time remaining on the
wall clock. A later backward wall-clock adjustment cannot extend this budget.
Checks after acquisition and immediately before the atomic history commit reject
an exhausted monotonic budget or an expired wall-clock approval. Validation
consumes the same budget. The timer still cancels pending work, but acceptance
does not depend on when its callback runs.

Wall time remains the source of absolute approval expiry and `lastSyncedAt`.
Retries receive a fresh read budget within the original approval; they do not
renew approval. Generation checks reject disconnected and superseded work.
Synchronous work cannot be preempted; the checks reject late results once control
returns.

## Verification

### Historical local checks before the clock correction

Before implementation, the timestamp regressions produced 13 expected failures
and the lifecycle regressions produced six expected failures, including retained
timestamp rejection. The remaining cases passed.

The initial timestamp and deadline implementation at `09d0747` had these local
results:

- 72 focused tests passed across history, collection, lifecycle, and prior review
  regressions. They cover exact and late deadlines, validation time, retries
  without renewed approval, and atomic preservation of prior history.
- A real 5,100 ms event-loop stall using the fixture's 80 ms acquisition timer
  completed after 5,141 ms with an aborted request, error state, zero retained
  observations, and no successful-sync timestamp.
- All 122 Node script tests passed.
- Repository-wide lint, typecheck, and the production build passed. The build used
  synthetic `PUBLIC_SITE_ORIGIN=https://public.example` and blank Clerk/Convex
  configuration. No provider credentials were loaded.
- Full Vitest with two workers reported 1,928 passes, 50 failures, and two skips.
  The 50 failures were in the existing account-capture, native-adapter, and
  retained-evidence suites. The sandbox's synthetic ancestor `.git` triggered
  their outside-Git safety guards. A clean archive of base `a49a607` reproduced
  the same 50 failures. No safety guard was changed.
- Local browser execution was blocked before page load by Chromium's
  `socket() failed: Operation not permitted`. This was not a local browser pass.
  The hosted run below later passed all eight desktop/mobile browser cases.
- Diff whitespace check passed.

An independent internal review of that revision found no blocking issue and
reproduced the deadline rejection with another real event-loop stall. Its
additional checks covered combined read/validation time and disconnect/reconnect during
serialization. That revision still used wall time for the read deadline. The
subsequent PR #156 review identified the rollback gap recorded above.

### Historical hosted checks for `09d0747`

[Hosted run 37498707458](https://github.com/keeganmoody33/PROPER-RESPECT/actions/runs/37498707458)
passed all four CI jobs for exact head
`09d07473676bb2897336f626f5f6527f72ed6017`:

- 1,978 Vitest tests passed, with two skips.
- All 122 Node script tests passed.
- All eight Codex desktop/mobile browser tests passed.
- [Browser proof artifact](https://github.com/keeganmoody33/PROPER-RESPECT/actions/runs/37498707458/artifacts/11429196386)
  is retained until October 13, 2026.

These results predate the monotonic-clock correction and do not verify later
revisions. They also do not erase the local sandbox limitations above.

### Clock correction and current-head checks

The follow-up replaces the wall-clock read deadline with the monotonic budget
described under Design. Six new lifecycle regressions failed before that change;
the fractional-delay and early-wake regressions each failed before the watchdog
correction. After both changes:

- All 82 focused tests and 122 Node script tests pass.
- Repository-wide lint, typecheck, production build with the same synthetic
  configuration, and diff whitespace checks pass.
- A real 5,100 ms event-loop stall plus a simulated 60,000 ms wall-clock rollback
  completed after 5,109 ms with an aborted read. The original 20 observations,
  150-token total, approval expiry, and successful-sync timestamp were unchanged.
- Independent internal review found no remaining blocking issue. Its 48-case
  rollback/budget matrix passed, and 60 real-timer trials produced no early
  aborts. On-time results committed; exact-deadline and late results rejected.

For hosted results on later revisions, use the
[current-head checks on PR #156](https://github.com/keeganmoody33/PROPER-RESPECT/pull/156/checks)
and confirm the run's commit matches the PR head. The historical run above is
evidence only for `09d0747`.

No live account, private history, credentials, provider read, merge, or deployment
is part of this work.

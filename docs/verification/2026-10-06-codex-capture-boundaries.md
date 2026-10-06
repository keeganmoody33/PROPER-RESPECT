# Codex capture boundary fixes

Date: 2026-10-06. Base: `main` at `a49a607f98b78aa63612d92ceaf442a811ff170b`.
Branch: `fix/codex-capture-boundaries`. This follow-up addresses the two
post-merge review findings on [PR #154](https://github.com/keeganmoody33/PROPER-RESPECT/pull/154).

## Review dispositions before implementation

- [Timestamp precision](https://github.com/keeganmoody33/PROPER-RESPECT/pull/154#discussion_r4197886388):
  **fix now**. Source and retention conversions discard fractions finer than a
  millisecond. That can manufacture same-position conflicts or admit a record
  before a fractional approved start.
- [Acquisition deadline](https://github.com/keeganmoody33/PROPER-RESPECT/pull/154#discussion_r4197886482):
  **fix now**. A delayed timer callback is not an absolute deadline. A late read
  or validation step can currently commit after the five-second limit.

## Design

The public usage flow stays `requestConnection`, `approve`, and `sync`.
The shared history timestamp schema will own precision validation for window
endpoints, source records, and retained observations. The bounded prototype
will explicitly reject fractions finer than milliseconds before normalization.
Exact arbitrary-precision timestamps would require a different comparison and
identity representation. That broader change is unnecessary for this fixture
contract; silent rounding is never permitted.

`UsageConnection.sync` will own a fixed acquisition deadline bounded by the
existing approval expiry. The timer still cancels pending work, but checks after
acquisition and immediately before the atomic history commit enforce elapsed
time even if the event loop stalls. Validation consumes the same allowance.
Retries receive a fresh acquisition allowance within the original approval;
they do not renew approval. Generation checks continue to reject disconnected
and superseded work.

## Verification

Before implementation, the timestamp regressions produced 13 expected failures
and the lifecycle regressions produced six expected failures, including retained
timestamp rejection. The remaining cases passed.

After implementation:

- 72 focused tests pass across history, collection, lifecycle, and prior review
  regressions. They cover exact and late deadlines, validation time, retries
  without renewed approval, and atomic preservation of prior history.
- A real 5,100 ms event-loop stall using the fixture's 80 ms acquisition timer
  completed after 5,141 ms with an aborted request, error state, zero retained
  observations, and no successful-sync timestamp.
- All 122 Node script tests pass.
- Repository-wide lint, typecheck, and the production build pass. The build used
  synthetic `PUBLIC_SITE_ORIGIN=https://public.example` and blank Clerk/Convex
  configuration. No provider credentials were loaded.
- Full Vitest with two workers reports 1,928 passes, 50 failures, and two skips.
  The 50 failures are in the existing account-capture, native-adapter, and
  retained-evidence suites. The sandbox's synthetic ancestor `.git` triggers
  their outside-Git safety guards. A clean archive of base `a49a607` reproduces
  the same 50 failures. No safety guard was changed.
- Local browser execution is blocked before page load by Chromium's
  `socket() failed: Operation not permitted`. All eight desktop/mobile browser
  cases await the existing hosted CI job; local browser results are not a pass.
- Diff whitespace check passes.

An independent internal review found no blocking issue and reproduced the
deadline rejection with another real event-loop stall. Its additional checks
covered combined read/validation time and disconnect/reconnect during
serialization. The clock remains wall-clock based, and synchronous work cannot
be preempted; the checks reject late results once control returns.

Exact-head hosted CI is pending at this local checkpoint. The draft PR will carry
its results. No live account, private history, credentials, provider read, merge,
or deployment is part of this work.

# Current-handle sharing membership

Verified 2026-09-19, America/New_York. Continues existing Tasks 2/4.

## Owner decision and live reproduction

> “We can leave mine as lecturesfrom handle. I approve”

Retain the account/site handle `lecturesfrom`. The abandoned restoration helper
and its 31 tests are removed from active source. Their implementation remains
recoverable at `ed0962d`; neither internal function was deployed. Existing
`linkSeededOwner` code is byte-identical to `d890530`.

The existing signed-in hosted collection has four records labelled “Already
public” and checked sharing defaults. Clicking only “Preview sharing” returns
`@lecturesfrom` and “No products will be public.” The linked `/lecturesfrom`
route displays “404 / NO PUBLIC RECORD” and “Nothing is published here.”
The retained four-card publication is at `/keegan`. No checkbox, relationship,
identity or publication was saved during this reproduction.

## Small correction

Relationship visibility does not establish membership in the snapshot at the
current account handle. `getState` now returns explicit current-handle
publication existence and per-card resolved membership. Review defaults,
activity consent, current-review checks and “Already public” labels consume
that membership. Missing/ambiguous membership stays unselected. The public-page
link requires actual publication existence. Absence shows an explicit message.

The existing publication projection still preserves untouched legacy cards.
No legacy handle lookup, automatic mapping, migration or publication is added.
There is no schema change. An older backend missing the new flags cannot cause
the client to infer membership from visibility.

Independent review caught a related bulk-cost interaction: manufacturing false
publication edits for every ambiguous sibling can remove a retained card from
the preview. The corrected helper preserves explicit publication intent and scopes bulk
costs to selected/resolved records. Stale decisions remain stale. The controls
now describe selected cards; untouched ambiguous snapshots remain unchanged.

## Verification boundary

RED membership checkpoint `cf4ac5f` records seven failing cases and eight passing
cases before the fix. Synthetic backend checks reproduce the four-record orphaned
snapshot, unique/explicit membership, and ambiguous legacy preservation. Component
rendering tests verify actual labels, defaults and links, including absent flags.

The hosted defect is reproduced; the corrected code is local until a separately
approved release. This is not a claim of a corrected live user journey. No new
backend synchronization, source read, transfer, recurrence or publication occurred.

## Final checks

The bulk-cost behavioral RED at `7861653` failed with an empty preview where the
legacy card should remain. After the guard fix, 59 focused backend/domain/component
checks pass. Independent review closed that finding without another blocker.

```text
npm test
Test Files 53 passed | 1 skipped (54)
Tests 535 passed | 1 skipped (536)
Node tests 6 passed, 0 failed
```

`npm run lint`, `npm run build` including TypeScript, separate nonincremental
typecheck and `git diff --check` pass. One optional private-file test is skipped.
The suite count excludes the 31 cancelled restoration tests and includes the new
membership, component and cost-action regressions. Browser evidence proves the
old hosted defect; corrected behavior is proven locally by backend and actual
component-rendering tests, not by a synchronized hosted session.

The pstack Laziness Protocol removed the now-unneeded restoration code rather
than carrying an unused operator mutation into the next release. No PR or push
was performed. A future release must synchronize the query fields before serving
the updated client and verify the existing signed-in flow without publishing.

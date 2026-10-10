# Connection efficiency verification

Date: 2026-10-08, America/New_York. Branch: `codex/connection-efficiency-20261008`.
Baseline: `15fcf7bd1a9723c2ffad16adc18e97448503af42`.

The owner said “cook” after the connection and cost walkthrough. This pass reduces
repeated local reconciliation and repeated private-history downloads. It changes
no backend functions, schema, credentials, billing plan or collection permissions.
The original checkout and verified baseline branch remain intact. No outside
review comments were received.

## Regressions and changes

1. A generated dense week reconciled its source three times when splitting into
   two bounded results. The RED regression observed 3 passes where 1 was required.
   The collector now prepares one numeric projection per validated page and selects
   all weekly/split windows from it. Global conflicts, legacy baselines, lineage,
   modern precedence, result bounds and durable acknowledgement behavior remain.
2. Opening the same private source twice downloaded both evidence pages twice.
   The RED regression observed 4 calls where 2 were required. The browser now
   keeps at most four calculated totals in memory, scoped to its authenticated
   owner/component. Every load queries source grants through the existing Convex
   client and compares the complete grant/checkpoint data. The subscribed Convex
   query may serve that state locally; this is not a forced network round trip.
   Changed checkpoints trigger full pagination. Revoked sources bypass reuse
   because erasure can continue without changing the checkpoint. Failures clear
   the cache and never fall back to saved totals. Account changes/unmount discard
   the loader. No raw history or evidence rows are cached persistently.

## Generated-fixture comparison

`node scripts/codex-efficiency-check.mjs` bundles the baseline collector directly
from Git and compares every result with the optimized collector. Its generated
fixtures include modern responses, legacy baselines, fork exclusion, a conflict
across windows, and modern precedence over legacy data.

Observed at `2026-10-08T12:44:01.866Z`:

| Measurement | Baseline | Optimized |
| --- | ---: | ---: |
| Generated files | 64 | 64 |
| Weekly windows | 53 | 53 |
| Source passes | 3,392 | 64 |
| One-run elapsed time | 3,370 ms | 121 ms |

All 53 complete result objects were identical. The timing is a local generated
fixture measurement, not a whole-Mac acquisition benchmark or latency guarantee.

## Retained-history and browser proof

The signed-in localhost frontend used only `dev:utmost-mongoose-374` and read
already-imported evidence. It displayed the main source as expired and the archive
as revoked. No new history grant or fresh rollout acquisition was performed.

- The displayed counter table matched the prior independently verified table
  exactly. A repeat view preserved every displayed counter.
- A complete CDP sent-frame trace for the repeat interaction observed zero
  `usageConnections:evidence` query additions. Click plus UI-state observation
  took 267 ms. The first-load trace was truncated, so it is not used to claim a
  complete first-load query count.
- A separate local check of retained numeric evidence matched calculated totals
  exactly on first and repeat loads. It confirmed no repeat pages for expired
  retained history and fresh pagination for revoked retained history.
- Desktop 1440x1100 and mobile 390x844 rendered the full table. At the mobile
  breakpoint document width equalled viewport width; no horizontal overflow.
  The temporary viewport override was reset.

Detailed usage counts, screenshots and numeric readbacks remain outside Git under
the private `2026-10-08-connection-efficiency` evidence directory. They were not
uploaded to Ref. No prompts, history code or credentials were uploaded.

## Checks

- `npm run codex:mac:check`: 166 passed, 3 skipped, 19 test files passed on Darwin
  arm64 / Node 24.19.0. Includes owner isolation, changed checkpoints, auth failures,
  revocation/deletion, re-pairing, interrupted pagination and exact conflict rules.
- `npm run typecheck`: passed.
- Changed-file ESLint: passed.
- `npm run lint -- --ignore-pattern '.local-bin/**'`: passed. Unqualified lint
  reports two pre-existing errors in ignored local deployment helpers, plus
  warnings in generated/private helpers; those files were left intact.
- `PUBLIC_SITE_ORIGIN=https://localhost:3000 npm run build`: passed. The first
  build compiled successfully but failed prerendering because development's HTTP
  localhost origin is intentionally rejected in production. The successful retry
  supplied a process-only HTTPS origin; saved configuration was not changed.

## Limits and release state

The first view still downloads the source's full retained history, and refresh or
sign-out loses the in-memory totals. Native acquisition still reads the selected
tree once per pass; this change reduces repeated numeric reconciliation, not disk
I/O. Existing coverage remains partial. No invoice or actual billed saving follows
from these measurements.

The main grant expired at `2026-10-08T00:00:00Z`. Fresh live acquisition with the
optimized collector remains unverified until renewed scope. The prior October 7
live lifecycle receipt remains the evidence for the baseline. This pass did not
push, merge, deploy, install a recurring service or renew access.

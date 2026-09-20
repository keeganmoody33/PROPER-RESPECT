# GitHub capture chronology without a live connector

Date: 2026-09-20. Base: `origin/main`
`d27920adc5c0e6af3b7597a6e93126df0c5af490` (merge of PR #26).
Finding: [PR #22 discussion](https://github.com/keeganmoody33/PROPER-RESPECT/pull/22#discussion_r4057310008),
queued on [issue #24](https://github.com/keeganmoody33/PROPER-RESPECT/issues/24).
Skipped the indexed exhaustive-search / read-budget items; this is ranking
inside the existing 200-proof window only. No deploy, Convex sync, transfer
or publication.

## Disposition

The finding is real. GitHub proof lookup used `order("desc")` on proof
creation, so a 2020 snapshot attached after a 2026 capture became the first
associated profile when no CONNECTED connector was present.

## Correction

CONNECTED connector evidence still comes first. Owner-selected non-homepage
links and publication stay on stored primaries. GitHub proof-derived accounts
inside the existing newest-200 attached-proof window are then ordered by
`raw.capturedAt` descending. Equal capture times keep distinct accounts and
do not invent a newer event from attachment order. Missing snapshots outside
that window remain unsearched.

RED: `test: reproduce late-attached older GitHub snapshots outranking newer captures`.
GREEN: `fix: rank GitHub snapshots by capturedAt inside the proof window`.

Local checks after GREEN: `convex/retainedEvidence.test.ts` 13 passed;
`npm test` 618 Vitest passed, 2 skipped, 6 Node checks; lint and typecheck
passed. No Playwright hosted pass. No Vercel or Convex mutation.

## Remaining gates

Lookup completeness beyond 200 proofs and byte-budget isolation still need a
later indexed design if the owner authorizes it. This change does not deploy
`main`. Hosted signed-in proof, upload-boundary production, development
transfer, extra Gmail, recurrence and publication remain owner-gated.

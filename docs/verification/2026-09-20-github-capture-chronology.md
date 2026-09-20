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
inside the existing newest-200 attached-proof window are ordered by source day
descending. Retained exports use `retainedArtifact.sourceCapturedDate` unchanged;
native timestamps are normalized to UTC. On the same source day, native instants
are selected before date-only exports as an explicit precision preference, not a
claim that the native capture happened later. Native instants retain intraday
chronology. Equal instants and equal retained dates use a deterministic account
and URL key, normalized first with original spelling as a final tie-break.
Neither attachment nor preparation time breaks a source-time tie. Distinct
accounts remain available. Missing snapshots outside the window remain unsearched.

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

## September 20 continuation review dispositions

Inspected `cursor/github-capture-chronology-7318` at
`56900a0d1bfc848944689b219b119761ca58c674` in isolated worktree `90b1`.
Recorded before regression or implementation edits.

- FIX NOW: [Devin r4057799797](https://github.com/keeganmoody33/PROPER-RESPECT/pull/27#discussion_r4057799797). Retained packet `basePacket` assigns preparation time to `capturedAt`; original source date is `retainedArtifact.sourceCapturedDate`. Reproduce with `prepareGitHubActivity` through retained intake. Preserve date precision.
- FIX NOW: [Devin r4057799829](https://github.com/keeganmoody33/PROPER-RESPECT/pull/27#discussion_r4057799829). Equal timestamps compare as zero, retaining descending proof attachment order. Assert the selected destination with both attachment orders.
- SUPERSEDED by the preceding equal-time finding: [Copilot r4057801116](https://github.com/keeganmoody33/PROPER-RESPECT/pull/27#discussion_r4057801116). The same regression and correction address this duplicate.

The prior equal-time claim above was not established by the set-membership test.
The 200-proof lookup and read-budget work remains deferred to issue #24.
Phase 2 remains held at `5935783154d3c575d72a92d31ceaf8317aaad813`.

RED confirmed on unchanged implementation at `56900a0` with
`npx vitest run convex/retainedEvidence.test.ts`: 2 failed, 14 passed.
Equal-time forward attachments selected `beta-account` instead of `alpha-account`.
A 2020 retained source prepared in September 2026 selected `retained-account`
instead of the March 2026 `current-account`. Full output is machine-local at
`/tmp/pr27-red.log`.

GREEN: 27 focused tests passed across retained intake and product destinations.
Coverage includes older/newer retained dates, same-day native/date-only priority,
equal-time attachment reversal, UTC-offset normalization and native intraday
ordering. Retained original dates and preparation timestamps remain unchanged.
Inventory and onboarding destinations, foreign-owner emptiness and unchanged
publication are asserted. Existing destination tests cover owner-selected links.

Model the Domain kept source day, native instant and deterministic account key
in the existing local sorting structure. Test Behavior, Not Implementation
changed the equal-time assertion from membership alone to the selected URL.
The read-only design check rejected a pairwise mixed-precision comparison because
it can be non-transitive. Comment review removed two implementation comments and
made the proof window and same-day priority explicit in names. No architecture
or schema expansion was needed.

Final local commands on the corrected tree, September 20:

- `npm test`: 624 Vitest passed, 2 existing skips; 6 Node checks passed.
- `npm run lint` and `npm run typecheck`: passed.
- `npm run build`: passed using the CI synthetic Convex URL and Clerk publishable key.
- `npx playwright test --config tests/e2e/components.config.ts`: 18 passed, desktop and mobile component fixtures.
- After comment-only cleanup and local variable renames, the 27 focused tests passed again.
- `git diff --check`: passed.

These are local synthetic checks. No hosted signed-in verification, deployment,
backend synchronization, provider reads, transfer, recurrence, relationship edit
or publication occurred. Exact pushed-head CI and owner review remain pending.

Focused Compound Engineering review returned no executable defect. Independent
Claude Opus 5 review completed with verified model identity and independence;
requested effort was high, actual effort was not verified. Two advisory items:

- FIX NOW: clarify RED scope. The recorded 2 failed / 14 passed run contained
  16 test instances. Three same-day and offset cases were added afterward;
  the final retained-evidence file contains 19 instances, all GREEN. The RED
  record does not claim that the final 19-case file was run against the old code.
- NOT A BUG: equal retained source dates intentionally use deterministic account
  ordering. Preparation time cannot establish original source chronology, so
  the proposed preparation-time tie-break is rejected. The existing explicit
  owner-selected non-homepage link remains the override.

The independent review inspected the correction against `56900a0`, including
uncommitted changes. Exact final-head CI and owner review remain separate gates.

## Pushed correction and exact-head verification

Correction head `8ac5de51c9d83b0bca14914f2a31c86cacf18392` on
`cursor/github-capture-chronology-7318` passed
[CI run 35533768709](https://github.com/keeganmoody33/PROPER-RESPECT/actions/runs/35533768709).
The three original comments received commit-linked replies. Fresh Devin review
added two informational comments, both classified NOT A BUG with source evidence:

- [r4057920572](https://github.com/keeganmoody33/PROPER-RESPECT/pull/27#discussion_r4057920572): `sourceDay` is compared before same-day priority, so the comparator uses a transitive tuple.
- [r4057920591](https://github.com/keeganmoody33/PROPER-RESPECT/pull/27#discussion_r4057920591): non-finite parsed instants receive an empty source day and deterministic account key. No runtime change requested.

This receipt-only follow-up preserves the reviewed executable diff. Its final
head must independently pass CI; the canonical Ref and PR checks carry that
result. Owner merge remains required. Phase 2 stays clean at
`5935783154d3c575d72a92d31ceaf8317aaad813` and has not been rebased or tested.

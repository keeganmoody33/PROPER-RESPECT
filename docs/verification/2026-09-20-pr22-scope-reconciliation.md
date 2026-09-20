# PR #22 scope reconciliation — September 20, 2026

## Authority and exact baseline

The owner approved Option A, required first-upload ownership to be fixed in
PR #23, personally merged #23, and then authorized rebasing #22, marking it
ready, and Phase 0 cleanup. This receipt reconciles repository scope; it is not
production release authorization. No deployment, backend synchronization,
provider read, data transfer, personal-choice edit or publication occurred.

- Main / PR #23 merge: `69ef335af9dd8b43dc1c178695e51a34d3943f2a`.
- Merge parents: `f808fc834c7900681d10b043a6bb09d4f8e76314` and expected
  `6936c39eedcf110aa6d4899853dd0f4791913c06`.
- PR #23 merged at `2026-09-20T15:07:28Z`, verified through GitHub API.
- Old PR #22 tip: `a174fc6b74663f165e8469f9778f6972aeb93c86`, preserved by
  annotated tag `archive/pr22-before-rebase-20260920`.
- Rebase: `git rebase --onto origin/main d2266faff48bf764e56e93a8536d0fba9ab3783b`.
- Rebased runtime commit: `6b0c4bef8839f926463578604c3f55fe7feea58e`.

## Previously flagged extra scope

The old docs commit `64f92b2edd5472e752d216ab205a61e54263ab4f` said:

> Merge to `main` waits on owner approval of that additional SHA and diff.

That warning concerned source beyond previously authorized `bc2900073bf524df850a07707f700e5d298e0d40`:

| Scope | Original commits | Current disposition |
| --- | --- | --- |
| Vendor export classification, FILE_UPLOAD, retained file metadata/storage lookup, replay and cross-owner guards | `d428ba5931b4ca3fbd13d33ce96c92e116dbb273`, `6bf69c2476c8f4eb0e94136b9c893c23ca3c878e` | Included in owner-merged #23/main; no duplicate application in #22. |
| Development-sync and Cursor handoff records | `b7f0fba70fc48d6e9200b4da8def35649a42ba92`, `b028d904381c540245beea8d7516bb3460ce2434` | Already in main ancestry; dated evidence remains historical. |
| Baseline integration | `74f6c1cbbbad0bf2ec2042b34d9e4e18367b639e` | Already in main ancestry. No second integration merge. |
| Require GitHub source and GitHub origin issuer for account evidence | `d2266faff48bf764e56e93a8536d0fba9ab3783b` | Already in main; retained unchanged by the rebase. |
| Verified first-upload attribution | `6936c39eedcf110aa6d4899853dd0f4791913c06` | Added and reviewed through #23 before #22 was rebased. Owner-bound HTTP receipt, expiring tickets and internal finalization remain intact. |

The owner’s Option A approval and subsequent personal merge of #23 resolve the
previously outstanding repository-integration scope. They do not authorize
releasing the new upload boundary. Legacy upload rows remain explicitly
UNVERIFIED_LEGACY; no attribution was backfilled. See the
[first-upload receipt](2026-09-19-first-upload-ownership.md).

## Two unique commits and conflict decision

1. `64f92b2`: only `docs/CURSOR_HANDOFF.md` conflicted. Kept the merged main
   version in full, avoiding obsolete release/main claims. The old patch became
   empty and was dropped by rebase; its scope warning and exact commits are
   reconciled above and its original object is preserved by the archive tag.
2. `a174fc6`: replayed without conflict as `6b0c4be`. GitHub account evidence
   examines at most 200 proofs instead of 25; other products remain at 25.
   The fixture puts authentic GitHub-source evidence after 25 unrelated proofs
   and verifies the owned account destination. Main’s source/issuer checks,
   explicit owner-link precedence and publication boundary stay intact.

The runtime diff against main is exactly `convex/associatedAccountEvidence.ts`
and `convex/retainedEvidence.test.ts`. All other #22 additions are receipts.
No application behavior was chosen over the merged lineage in a conflict.

## Verification and review limits

On runtime commit `6b0c4be`: `npm test` passed 613 Vitest tests and six Node
checks, with two optional private-input skips. `npm run lint`,
`npm run typecheck`, `npm run build`, and
`npx playwright test --config tests/e2e/components.config.ts` passed (18 browser
checks). These include first-upload ownership/isolation/replay checks from main.
The browser checks use synthetic fixtures, not hosted owner data.

The first-retention review finding is fixed by #23. The 25-proof failure is
covered, but the query still stops at 200 total proofs before filtering. A
qualifying proof beyond that bound can still be missed. The original request
for filtering/index-aware lookup is therefore not claimed fully solved; its
review thread stays open for explicit review of this bounded change. Increasing
a limit is not an exhaustive account-evidence search. No new index or wider
implementation scope was introduced during reconciliation.

PR #22 is queued for owner review, not merged. Its final head and remote CI
result are recorded in the Phase 0 closure section of the
[state receipt](2026-09-19-state-reconciliation.md). Production remains at the
last recorded release `32aa043c48ee32686b3c656127f2d58ed7d1388b`; this operation
does not independently re-prove the hosted journey. A later upload-boundary
release must be separately authorized, with schema/functions/HTTP action first
and frontend second.

# Public profile readiness

Updated 2026-09-19. Continues Tasks 2/4 in the existing Ref.

## Observed baseline

Accepted source began at `3809cb79053435c928357886ead1784a8533478f`.
The older default worktree remains untouched, including its dirty `.DS_Store`.
The hosted `/keegan` profile still renders four previously published cards with
the old empty-activity filler. Development has the corrected card presentation.
No source read, transfer, publication or deployment occurred in this verification.

Read-only snapshots were obtained from exactly `utmost-mongoose-374` and
`striped-chicken-693`. Originals, owner identifiers, exact saved choices and the
proposed transfer comparison remain outside Git in the private operator directory.
The comparison does not establish cross-environment ownership or authorize writes.
One product has multiple hosted relationship targets. No target was chosen by the
agent. The existing published handle differs from the hosted account's current
handle. Keep its public URL and content unchanged until explicit reconciliation.

## Publication defects and local corrections

Changing a published handle previously updated the account and site but retained
the old publication under its original handle. Handle availability checked only
accounts. Another account could claim an orphaned publication handle and inherit
its retained cards during later publication preparation.

Local guards reject renaming a published handle and claiming an occupied
publication handle. Same-owner saves to the same handle and unused unpublished
handle changes remain available. Existing orphaned snapshots are preserved;
these guards do not retroactively establish ownership or migrate them.

`publishSelected` previously accepted requests without the preview revision/hash.
Both values are now required, and the server always compares them with the current
projection. The current UI already supplies both. Legacy callers must obtain a
fresh `previewPublication` result before submitting a publication.

Seven added regressions produced five failures before the fix and seven passes
after it. Coordinator verification ran publication and handle tests together:
21 tests passed. The implementing worker also passed the full suite with 491
Vitest tests and six Node checks, TypeScript and changed-file ESLint. One optional
private-file test was skipped. These are synthetic checks, not deployed proof.

Independent review reproduced another entry point: automatic account creation
could generate an occupied pending handle. The correction now checks account and
publication reservations, selects an available pending handle, and rejects
ambiguous ownership before preview/publication. Exhausting all 100 candidates
fails without writing. The independent reviewer passed 56 focused tests across
five files, including 12 handle regressions. These are local synthetic checks;
historical handle drift and hosted acceptance remain unresolved.

Publication fixes are locally committed at
`50267f8a04a5965545b9826fbea034a47f880237`. Nothing was pushed or synchronized.

## Product assets and public layout

Copilot uses retained official full lockups and scoped Mona Sans, keyed by exact
canonical slug/domain. The versioned manifest records source URLs and byte hashes;
it is separate from Context.dev and usage evidence. The worker passed 75 focused
tests and seven component-browser tests, including desktop/mobile, both surfaces,
and separate missing-logo/missing-font cases with zero external requests. See
[asset sources and verification](2026-09-19-product-asset-sources.md).
Coordinator reran all seven component-browser tests and inspected the generated
390px/1280px Copilot screenshots. A separate 37-test run covering official assets,
the public reader/projection and publication guards passed. Changed-file ESLint
passed. The unchanged upstream OFL license contains one trailing space; its
recorded digest is preserved rather than rewriting vendor bytes. Other files
pass the commit whitespace check.
Copilot assets are committed at `4211d486e351e7c67e4eb3dcd7c5c91ac553d49d`.
An additional independent review attempt was rejected by the agent service's
cybersecurity filter before producing a verdict; it is not counted as a pass.

The public page places its already-published name and bio above the collection.
Coordinator browser inspection used the local application on port 3118 with the
read-only production public-profile query. At 1280px the cards form a compact
grid; at 390px they form a single column with 358px cards and no horizontal
overflow. No private fields or new usage data were loaded. This mixed-version
preview still receives the older backend's incorrect Google parent branding for
NotebookLM. The existing corrected public projection must be released together
with the frontend; this preview is not a complete brand-acceptance pass.
The public identity layout is committed at
`d096cc63cd7506d702d53256f5bac0910e19a018`.

## Retained discovery review

Application checkpoint `a2539b91e84cd93271daa71550430e32fc95e24e` adds the private
review panel and four authenticated functions. It lists unmapped retained
discoveries, including zero/one-target and unresolved-identity cases. The owner
chooses a same-product relationship explicitly. No choice is preselected.
Source labels, types and capture times provide private context without returning
raw payloads. Unknown identity remains visible and cannot be attached until
resolved; this slice does not add a product-identity correction workflow.

The first attachment binds the target and freezes its batch. Each transaction
processes at most 100 originals. Durable progress supports continuation across
sessions; applied hashes make retries idempotent and prevent retargeting. An
expectation hash rejects changed relationships, source labels or reviewed
evidence. Foreign ownership rejects atomically. Deleted originals are skipped
and counted. The existing proof-type mapping is reused. Tests preserve original
captures, decisions, links, relationship history and publication snapshots.
Concurrent routine ingestion follows the explicitly chosen target without
silently adding new originals to the frozen review batch.

Final coordinator verification on this source:

```text
npm test
521 Vitest tests passed; one optional private-file test skipped; six Node tests passed.

npm run build
Passed, including TypeScript checking.

npm run lint
Passed before the final source-label hash addition; changed-file lint passed afterward.
```

The component-browser suite passed seven card tests and two review tests.
The review tests exercise required selection, no automatic save, stale-choice
reset, visible rejection, fixed-target continuation and completion at 1280px and
390px with no external requests or browser errors. They use synthetic callbacks;
they do not prove an authenticated deployed mutation. Coordinator reviewed the
source and mobile screenshot. The publication unit has a separate independent
review. A subsequent independent reconciliation review is recorded below.

The owner subsequently approved development-only synchronization of
`a2539b91e84cd93271daa71550430e32fc95e24e`. It completed on `utmost-mongoose-374`:
77 exposed functions, required publication preview fields, existing-session
authenticated loading and anonymous-query rejection verified. All 32 application
tables remained unchanged, including after browser verification. See the
[sync receipt](2026-09-19-profile-development-sync.md). No evidence attachment,
owner choice, production release or publication accompanied this synchronization.

## Post-sync release review

An independent read-only review of `a2539b9` found no concrete release-blocking
defect. Its focused local run passed 56 tests across seven files. The reviewer
checked ownership, same-product targets, frozen batches, replay handling, stale
UI selections and preservation of saved decisions and publications. The
205-original regression continues across three batches while interleaved
ingestion adds a separate 206th proof to the explicitly chosen target.

This review used the inherited model route, not cross-provider validation.
Interleaved test transactions do not prove real server contention behavior or
large-payload production transaction limits. Existing component browser tests
were inspected rather than rerun. The added-code comment scan recommended no
deletions; its two directives select the test environment and Vite types.

Coordinator inspected the actual signed-in development collection at a measured
325 CSS-pixel viewport. All four visible product logos loaded, cards had no
horizontal overflow, and expanded Wispr supporting details had no internal
vertical scroller. Static capture freshness and the unknown measurement period
remained visible. No sharing selections, saves or provider controls were changed.
The temporary viewport override was reset afterward.

## Current handle decision — September 19

The owner said, “We can leave mine as lecturesfrom handle. I approve”. Retain the
existing account/site handle `lecturesfrom`. No restoration is needed.
Overruled: the earlier `/keegan` account-restoration proposal. Its helper and tests are removed from active source and preserved in Git at
`ed0962d`; they were never deployed.

The existing four-card `/keegan` publication remains unchanged. Keeping the
account handle does not migrate that snapshot or approve a new public selection.
The current hosted sharing form links to `/lecturesfrom`. A read-only sharing
preview under the existing signed-in session shows `@lecturesfrom` and “No
products will be public.” Its four “Already public” labels come from relationship
visibility, not an actual publication at this handle. The verified [local correction](2026-09-19-publication-membership.md) makes
labels/defaults follow the actual current publication and preserves publication
intent during bulk cost changes. It is not yet synchronized or deployed. No checkbox,
relationship choice, public identity or publication was saved during this check.

The prior private transfer comparison is still a proposal. Cross-environment
owner binding and the GitHub destination record must be confirmed separately.
No data transfer or new production synchronization accompanies this decision.

## Code-generation boundary check

The official `convex codegen --typecheck disable` command uploaded source for
server analysis despite describing itself as not modifying running code. The
installed CLI path calls `start_push`, not `finishPush`. A subsequent read-only
function-spec from exactly `utmost-mongoose-374` is JSON-identical to the approved
development baseline: 73 functions, no discovery-review functions, and unchanged
publication validators. No activation occurred at that earlier analysis step.
The later explicitly approved synchronization is recorded above. Detailed raw
receipts remain outside Git.

## Remaining acceptance

The [release comparison](2026-09-19-profile-release-candidate.json) binds approved
application `a2539b9` to both prior baselines and binary diff hashes. The owner
approved this source, and production release verification is complete:
[exact targets and hosted proof](2026-09-19-profile-production-release.md).
Vercel `dpl_yek1HfE7u8QNa4E1cfWoCiopCnRU` is READY with production Convex
`striped-chicken-693`. All 32 application tables stayed unchanged.

Rollback uses the preceding compatible frontend `dpl_DD4jWfKFtrCKYAPxvK8ufntusCW6`.
Preserve additive receipt/FILE_UPLOAD schema, mailbox ambiguity fields and
publication guards. No data restore, seeding, key rotation or collector activation
belongs to rollback. Git-triggered deployments remain disabled.

- Existing-session authenticated loading now passes in development. Fresh
  sign-in and a real owner-directed attachment remain unexercised; retain local
  synthetic mutation/browser checks as such.
- Keep the approved `lecturesfrom` handle. The prior restoration is withdrawn;
  current-profile publication labels are locally corrected and verified.
- Production code release is verified. Obtain exact authorization for any
  private transfer before changing those records.
- Let the owner preview and approve new public fields; verify the final signed-out
  hosted page on desktop and mobile. Missing coverage and static captures remain
  labeled. No inference of current use, go-to or recommended products is permitted.

Decision trail: [pstack progress](../../work/pstack/2026-09-19-public-profile.md)
and [decisions](../../work/pstack/2026-09-19-public-profile-decisions.tsv).
The private comparison is a proposal, not a transfer or a completed public profile.

## Post-release completion audit — September 19, 19:06 America/New_York

Read-only Vercel inspection still reports production READY at
`dpl_yek1HfE7u8QNa4E1cfWoCiopCnRU`. Accepted local HEAD is `ed0962d`, clean.
The preceding turn made progress by committing and checking guarded restoration.
This audit does not close the full profile goal.

| Required outcome | Evidence and disposition |
| --- | --- |
| Hosted collection and existing public profile | Release receipt proves existing-session loading and signed-out desktop/mobile rendering. Fresh sign-in is still unproven. |
| Owner controls use selected handle | Owner approved keeping `lecturesfrom`. No handle write is needed. Legacy `/keegan` publication is preserved. |
| Richer saved evidence reaches the correct hosted owner | Private transfer proposal remains read-only. Cross-environment owner binding is not automatically established. Two Wispr packets and one GitHub packet await authorized transfer. |
| No invented target or relationship decision | GitHub has four possible production relationships; the owner must choose the target. Clerk/Clay have no existing target and need scoped private transfer authorization. |
| Current activity and coverage | Existing captures remain historical. New provider reads and recurring collection are not authorized. No current-activity claim follows from this release. |
| Correct presentation for every selected product | Copilot is verified; NotebookLM rebrand/product asset and Devin Desktop asset identity remain unresolved under the retained source investigation. |
| Exact owner-approved public output | No new selection/publication approval or write exists. Public information remains the previous four-card snapshot. |

The handle-restoration gate is withdrawn. The sharing-label/default
mismatch is corrected locally. Next resolve the private transfer's owner/target choices and
show the exact publication preview for `lecturesfrom`. No automatic migration,
transfer or publication follows from retaining the existing account handle.

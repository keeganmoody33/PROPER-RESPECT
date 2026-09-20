# Devin triage and Phase 0 closure — September 20, 2026

## Pre-merge queue

Inspected branch `cursor/github-card-account-destination-7318` at exact owner-approved
`a29ceab24db4a0bd3ac34e69e5140f6398937963`; main is
`69ef335af9dd8b43dc1c178695e51a34d3943f2a`. No code changes are made in this pass.
This queue was recorded before verification probes or remediation. The local
checkout was clean before writing this receipt. GitHub has only these two heads.
The two intervening commits are authored/committed by Cursor Agent; no new Devin
branch or commit was found. Devin supplies findings, not implementation authority.

| Comment | Disposition before verification | Reason / evidence to verify |
| --- | --- | --- |
| #22 r4057273533: historical proof overrides connected account | Superseded by approved `5fc8f9e`; verify on current head | CONNECTED connector is emitted first. Run precedence, owner-selected-link, owner-isolation and publication regressions. |
| #22 r4057309835: resolved follow-up | Superseded acknowledgement | It acknowledges the preceding correction, not a separate code change or independent runtime proof. |
| #22 r4057273504: 200-proof truncation; older Copilot r4052778673 | Deferred with reason | Owner explicitly accepted this bounded limitation. Newest-first fixes the old prefix example, not exhaustive retrieval. Compact indexed account evidence belongs in release gaps; no schema/backfill is authorized by this merge. |
| #22 r4057309976: proof scan read budget | Deferred with reason, release-capacity gap | Valid worst-case amplification in existing batched lookup; main already joins full payloads with no byte budget (25 instead of 200). It is not a reproduced hosted failure or a new identity/authorization bypass. Track together with compact indexed lookup before multi-user/historical-volume acceptance. Do not count green fixture tests as Convex resource-limit proof. |
| #22 r4057310008: attachment order differs from capture date | Deferred with reason | Valid chronology limitation without a usable connector. Current explicit policy says newest proofs, not newest captured event. Do not infer current account from attachment time or silently impose a capture-date policy. Reproduce the boundary and track account selection semantics with the indexed lookup. |
| #23 r4055875525: issuer-bound upload replay bypass | Deferred to release gaps; existing-main bug | Retained replay checks application owner but bypasses the ticket tokenIdentifier check. First-upload binding remains protected. Verify same-subject/different-issuer replay separately; block upload-boundary release until fixed on a dedicated post-merge branch. Not part of #22's lookup diff. |
| #23 r4055875539 / r4055875568: stale 25 MiB prose | Deferred to Phase 1 status correction | Code limit is 19 MiB; correct active source text, mark historical receipt as historical. No limit increase. |
| #23 r4055875550: obsolete live release / consent status | Deferred to Phase 1 status correction | Deployment history remains evidence; 32aa043 is latest recorded release, bounded reads completed and paused. |

## Historical Devin comments on merged main lineage

Repo-wide PR review comments and commit comments were inspected; this is a
finite snapshot, not a claim that concurrent future comments have been triaged.
Comment IDs below identify each historical finding separately.

| PR / comment | Disposition | Current evidence / follow-up |
| --- | --- | --- |
| #1 / 3376380508 DraftProp vs DraftImport | Deferred documentation correction | Runtime table is draftImports; conceptual pipeline naming still needs consistent historical labeling in Phase 1. |
| #1 / 3376380578 first-class Link | Not a bug | Runtime links are first-class; PRD sketch is conceptual, not current schema. |
| #1 / 3376380656 proposed Lineage fields | Not a bug | Intent-level interface extension, not implemented functionality or usage verification. |
| #1 / 3376380748 lecturesfrom typo | Not a bug | Owner's explicit handle/account naming; do not rewrite as a typo. |
| #1 / 3376380856 ADR/thesis precedence | Deferred documentation correction | Existing 31-document drift audit governs individual corrections; no architecture restart. |
| #16 / 3650427640 null pushed_at | Superseded | Legacy adapter now uses nullish fallback; no new provider request needed. |
| #16 / 3650427663 unknown subdomain identity collision | Deferred real bug | deriveIdentity still takes first hostname label; unknown app.* domains can collide. Release gaps must preserve ambiguous evidence rather than merge by generic subdomain. |
| #16 / 3650427678 same-batch duplicate inserts | Superseded | Current ingestion uses sequential read/insert transaction, with replay regressions. |
| #16 / 3650427723 duplicate seeded/auto GitHub | Superseded old behavior; residual reviewability deferred | Current ingestion creates private pending proposals and handles multiple relationships explicitly; no automatic public duplicate. Existing distinct records are not silently merged. |
| #16 / 3650427749 no publication refresh on import | Not a bug in current product | Publication is explicitly separate; imports must not republish the profile. |
| #16 / 3650427776 vendor names treated as domains | Superseded | extractDomain rejects single-label/non-web/credential-bearing hosts. |
| #16 / 3650427800 corporate suffix truncates Cisco | Deferred real bug | Current suffix regex permits zero whitespace and can reduce Cisco to cis. Release gaps; do not broaden current lookup correction. |
| #16 / 3650427824 duplicate-batch follow-up | Superseded | Same sequential ingestion correction as 3650427678; one concern, not a second implementation. |
| #16 / 3650427862 automation auto-approves curated/public | Superseded | prepareImportedProp returns DRAFT/TESTING/PENDING, owner review and explicit publication remain required. |
| #16 / 3650427891 MERGED/SUPERSEDED reapproval | Superseded | SUPERSEDED is skipped; MERGED requires existing resultPropId and retains reviewed mapping. |
| #16 / 3650427917 unvalidated GitHub login | Deferred hardening | Legacy syncGithub is internal-only but still interpolates login into fixed-host path. Validate/reject path delimiters before any future use; no claim of an external-host SSRF proven. |
| #18 / 3732796985 Next/eslint version skew | Superseded | Current manifest uses matching ^16.3.5 versions and lint CI passes. |
| #18 / 3732797043 lockfile consistency note | Not a bug | Informational dependency observation; current build/lint CI is authoritative. |

## Coordination rules retained

Devin reports; Codex writes. New Devin code/branches must be reported before
building on them. Every finding receives fix-now, deferred-with-reason,
superseded or not-a-bug disposition before code changes. Before #22 merges,
any necessary blocker remediation is one consolidated commit with RED regression
first and a new review gate; no silent movement past the approved SHA. After
merge, each bug concern gets a small branch off main, while the release-gaps
issue is the single tracking queue. Deployment, source reads and publication
remain separately authorized. This pass does not treat an automated approval
badge as a completed human review or a successful live product journey.


## Verification before merge

All executable source remained byte-identical to approved head `a29ceab24db4a0bd3ac34e69e5140f6398937963`.
The focused retained-evidence, upload, mailbox, destination and discovery suite
passed: 71 tests in five files. GitHub CI run `35519919888` passed on this exact head,
including full tests, lint, typecheck, build and component-browser checks.

Three temporary synthetic probes were executed and restored byte-for-byte:

1. Current connector precedence is covered by the committed regression and
   passes. A separate late-attachment probe confirms an older captured snapshot
   wins when attached last and no usable connector exists; that is the deferred
   chronology boundary, not a recurrence of the connected-account regression.
2. An instrumented helper reads 200 full raw records plus 200 sources despite a
   connected account. At 100 KiB per payload this is 20,480,000 payload bytes.
   This is a resource-cost probe, not a live Convex failure test. Convex's
   [documented transaction limit](https://docs.convex.dev/production/state/limits#transactions)
   is 16 MiB; the batched path needs indexed compact metadata before volume
   acceptance. Classified as a release-capacity gap, not a waiver or a claim
   that this merge is ready to deploy. The existing main helper also joins full
   payloads without byte budgeting; no authorization boundary changed in #22.
3. Same-subject/different-issuer replay returns the already retained upload ID.
   Existing first-retention isolation tests still pass. The replay gap is on
   main and blocks the separate upload-boundary release, not #22's lookup diff.

All deferred bugs and capability gates are tracked together in
[Close the release gaps #24](https://github.com/keeganmoody33/PROPER-RESPECT/issues/24).
The queue separates completed two-account Gmail consent/read history from
future reads/recurrence; no old completed work is restarted. No new blocker
against the narrow reviewed account-precedence correction was established;
production/high-volume acceptance remains explicitly blocked by the listed gaps.
Triage was reported to the owner before merging, at exact head a29ceab.


## Post-merge Phase 0 closure

Merged #22 with `--merge --match-head-commit a29ceab24db4a0bd3ac34e69e5140f6398937963`.
GitHub confirms merge time `2026-09-20T15:46:55Z`, merge commit / main
`4df11b5fd3ff4e4747f61fa2d72998842970fd7b`, and parents
`69ef335af9dd8b43dc1c178695e51a34d3943f2a` plus exact approved `a29ceab`.
No remediation commit or additional code change was appended to the reviewed head.
71 focused tests passed; all three diagnostic probes behaved as recorded above.

PR #23 remains owner-merged at 69ef335; both PRs are now in one main lineage.
PR #22's remote/local branch was removed only after verifying merge ancestry;
its commits remain reachable from main. The earlier checkpoint tags, five
Finder-metadata discards, clean-worktree dispositions and local-only private
history remain preserved. Phase 0 is formally closed with known release gaps
explicitly queued, not represented as solved.

The sole new active branch is `codex/phase0-closure-ticket-recut-20260920`, a
**documentation-only** branch off post-merge main. Its receipt/ticket changes
receive their own review; they are not silently merged under #22's approval.
No application/backend code, deployment, provider read, private transfer,
recurrence, owner choice or publication changed in this phase.

## Phase 1 ticket recut

- #14 rewritten to **Launch V1 as shipped**, containing only checked outcomes
  supported by dated hosted-release receipts, and closed completed.
- #24 **Close the release gaps** holds every remaining release acceptance and
  the valid review findings. Hosted Gmail consent is recorded as completed for
  the existing accounts; further reads, second-user proof and recurrence remain
  gated. Transfer needs fresh source/target reconciliation, not a blind replay
  of September 18's old gap statement.
- #4, #6, #7, #8, #9, #10, #11 and #12 explicitly marked superseded and closed
  not-planned, each with a specific current implementation/remaining-work pointer.
  This does not claim all old requirements shipped. #7's immediate-publication
  onboarding is superseded by private review; #12's four-card layout is not a
  gate for the current owner collection.
- #13 remains open as **Custom-domain routing milestone (separate from path-based
  launch)**, with refreshed criteria and its obsolete ready-for-agent label
  removed. Domain routing is not claimed implemented or silently scheduled.
- One-page `docs/002-v2-product-motion.md` is the only new scope document; old 002
  is marked superseded. No new ADR, source collector or planning program.

## Individual document corrections

Each of the 31 flagged documents receives the explicit status line below.
No file was deleted and no dated evidence was silently rewritten. An additional
historical qualification on the export-upload receipt distinguishes its old
25 MiB behavior from the new 19 MiB source limit; the active source guide uses
19 MiB. Original operator receipts remain private and historical examples are
not treated as deployed features.

| File | Status correction |
| --- | --- |
| `docs/000-current-product-thesis.md` | Product intent remains relevant; implementation-status paragraphs below are historical. September source is reconciled to main, and multi-user release gaps are tracked in #24. |
| `docs/002-v1-product-motion.md` | Superseded as the active motion document by [002-v2-product-motion.md](002-v2-product-motion.md). The prior private-discovery principles remain historical context; do not reimplement completed email discovery. |
| `docs/003-evidence-surfaces.md` | Current source includes separately authorized Gmail discovery, private uploads and retained review. The old four-page continuation below is historical; both hosted bounded runs and retained-only recheck completed, and further reads remain paused. |
| `docs/CURSOR_HANDOFF.md` | Source main is 4df11b5 (PR #23 and #22 merged). Production remains the last recorded 32aa043 release; no release follows from merge. Earlier branch/gate narratives below are dated history. Continue through #24 and the September 20 triage receipt. |
| `docs/DEPLOYMENT.md` | Current source main is 4df11b5; last recorded production is 32aa043. Existing two-account hosted Gmail consent and bounded reads completed; further reads and recurrence remain paused. Older live-release/consent statements below are historical. New upload release requires issuer-replay correction and separate backend-first authorization (#24). |
| `docs/DEVELOPMENT.md` | Main is 4df11b5 after owner-approved merges #23/#22. Earlier local-only and development-only implementation statements below are historical. Production is still the last recorded 32aa043 source; current unresolved acceptance and review findings are #24. |
| `docs/plans/2026-09-16-multiple-mailboxes-and-native-cards.md` | Tasks 1–4 and their checkpoints remain preserved. Earlier zero-match, unimplemented intake and development-sync gates below are historical; the September private collection/discovery source has landed. Remaining acceptance is #24; A/B remains unselected and nonblocking. |
| `docs/plans/2026-09-16-wispr-product-and-usage-plan.md` | The canonical knowledge/evidence/review foundations described below now exist. Remaining hosted selections, transfer reconciliation and coverage gates are #24. No personal Wispr API or complete usage telemetry is established by the implementation. |
| `docs/verification/2026-09-19-public-profile-readiness.md` | Historical rolling receipt: its dated 8b6aa9a/empty-target/mobile-gate statements are not current release instructions. Latest recorded production is 32aa043; current source is 4df11b5. Owner-selected publication and fresh-session acceptance remain explicit #24 gates. |
| `docs/adr/004-public-graph-privacy.md` | Privacy intent is retained. Account-wide export/deletion and lineage controls described below are not all implemented; do not advertise them as delivered. |
| `docs/adr/005-manual-product-database.md` | Identity intent is retained. Generic persisted aliases/community merge/admin tooling is not implemented; current catalog and ambiguity-safe private review are authoritative. |
| `docs/adr/006-data-retention-forever.md` | Retention intent needs reconciliation with ADR 012 and current private retention. The proposed expiry/deletion schedules are not implemented and do not authorize deleting existing evidence. |
| `docs/adr/008-product-rebrand-handling.md` | Historical rebrand proposal, not implemented generic alias/merge capability. Preserve distinct source identity and owner relationships; do not auto-merge products from this ADR. |
| `docs/adr/009-manual-put-on-by.md` | Proposed attribution/notification workflow remains unimplemented. Existing supporting links do not prove notification, identity matching or lineage confirmation. |
| `docs/adr/012-account-deletion.md` | Proposed account-deletion/grace/ghost lifecycle remains unimplemented and conflicts with parts of ADR 006. No deletion is authorized by this document. |
| `docs/adr/013-floating-lineage.md` | Proposed floating attribution matching and confirmation lifecycle remain unimplemented; no current data mutation follows from this intent document. |
| `docs/adr/019-search-discovery.md` | Public people/product search is future intent, distinct from the implemented private product discovery/review flow. |
| `docs/adr/021-domain-branding.md` | Domain interchangeability below is intent only. Auth/callback origin remains explicitly configured; net-new verified Domain routing is separate milestone #13. |
| `docs/adr/022-risk-register.md` | Historical manual-first/API-not-foundation priorities below are superseded by current authorized-source discovery and owner review. Current release gates are #24. |
| `docs/adr/023-put-on-by-ui.md` | Historical UI proposal is not a delivered lineage workflow. Credibility-score examples are superseded and must not be implemented; no universal activity or credibility ranking is permitted. |
| `docs/adr/028-chrome-extension.md` | Unimplemented future extension proposal; not part of current launch acceptance and not permission for device/browser collection. |
| `docs/adr/032-moderation.md` | Unimplemented public reporting/moderation proposal; do not present proposed controls as shipped capabilities. |
| `docs/adr/033-product-sunset.md` | Automatic personal archiving on vendor shutdown is superseded. Vendor status and owner relationship remain separate; only the owner changes their lifecycle state. |
| `docs/adr/034-duplicate-prevention.md` | Fuzzy/admin merge and score examples below are unimplemented or superseded. Current ambiguity-safe review must preserve distinct subproducts and source accounts; same-domain equality is not a merge rule. |
| `docs/adr/036-template-profiles.md` | Historical manual-first rationale is superseded; templates are not delivered. Current private discovery/review flow and #24 acceptance take precedence. |
| `docs/adr/037-import-tools.md` | Broad public URL importers described below are unimplemented future intent, distinct from existing direct connectors, manual entry and private retained uploads. |
| `docs/adr/055-empty-states.md` | Historical manual/public-link-first sample copy is superseded by private discovery/review and visible source failures. Samples below are not current UI acceptance proof. |
| `docs/adr/056-seo-social.md` | OG/share generation and host-derived sitemap remain unimplemented intent. Custom-domain canonical routing belongs to #13; the path-based launch does not assume that subsystem exists. |
| `docs/adr/057-accessibility.md` | Accessibility remains a target requiring real checks. Credibility-score examples are superseded; proposed shadcn/shortcuts are not installed features or evidence of compliance. |
| `docs/adr/058-performance.md` | Prisma/Neon/system-font-only and monitoring descriptions below are historical proposals. Runtime uses Convex and retained brand fonts; performance targets are not measured results. |
| `docs/adr/060-data-export.md` | Account export/restore/merge remains unimplemented intent. Universal-score examples are superseded; retained originals and provenance must not be rewritten to match a proposal. |


The concurrent-review protocol is also retained in existing `AGENTS.md` so
future contributors see it before writing. This is contributor guidance only;
no executable source or release configuration changed in the documentation PR.

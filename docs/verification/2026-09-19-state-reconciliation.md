# State reconciliation — owner review required

Audit date: **2026-09-19, America/New_York**. GitHub refs refreshed at approximately 22:11–22:19 EDT. Scope: Phase 0 only. **Phase 0 exit criteria are not met; Phases 1–3 have not begun.** This is the reconciliation evidence and proposed disposition, not a claim that branches were merged or deleted.

## 1. Exact source, release and remote map

| Surface | Verified full SHA / identifier | Meaning |
|---|---|---|
| GitHub `main` | `f808fc834c7900681d10b043a6bb09d4f8e76314` | Remote baseline; PR #21 merge. |
| Accepted local `codex/personal-release-main` | `a19928ddfca25c9345cb271bd05fb14125138839` | Clean at audit start; latest documentation checkpoint. |
| Latest deployed source | `32aa043c48ee32686b3c656127f2d58ed7d1388b` | Local commit, deployed from an exact archive; not a deploy-only object and not on a remote branch. |
| Later local-only GitHub auth fix | `82faddf915c47dbfca4d3ee82bfd51cac11b731a` | Four additions/two removals in the route, plus regression tests. Not deployed. |
| Its tests-only checkpoint | `028886015d3b2369dde0722bf43ba3686b2fa0b9` | RED reproduction of native Clerk/Convex session failure. |
| PR #22 current HEAD | `a174fc6b74663f165e8469f9778f6972aeb93c86` | Open; has changed from the formerly authorized SHA. |
| PR #22 formerly authorized HEAD | `bc2900073bf524df850a07707f700e5d298e0d40` | Already included in accepted local ancestry. |
| Common ancestor of PR #22 and accepted local source | `d2266faff48bf764e56e93a8536d0fba9ab3783b` | GitHub source/issuer provenance guard. |
| Public-safe Cursor checkpoint | `833b1574c67bc93727c3e0df3f704e66ebd912d8` | Remote branch; ancestor of accepted source. |
| Previously missing upload/handoff commits | `6bf69c2476c8f4eb0e94136b9c893c23ca3c878e`, `b028d904381c540245beea8d7516bb3460ce2434` | Both now remotely reachable through PR #22/Cursor checkpoint and included locally. The old “not on GitHub” blocker is obsolete. |
| Production frontend | `dpl_8zGq3Exu68QgVvCKmdy4Hm9SoRTh` | Fresh `vercel inspect`: READY, production, `groundskeep/proper-respect`. |
| Production backend | `striped-chicken-693` | Release receipt target; no new backend mutation or private database export in this audit. |
| Previous frontend rollback | `dpl_AJeXca75XZNAhM3NYuhRfYRDcdLX` | Source `5a0b77fe936c62df60b5a1924c2161b097288006`, per release receipt. |

`git rev-list --left-right --count origin/main...a19928d` is **0 / 57**. For `origin/main...32aa043` it is **0 / 54**. `main` is an ancestor of accepted source; the latest release is **not** an ancestor of `main`. `git branch -a --contains 32aa043` names only local `codex/personal-release-main`.

PR #22 is 14 commits ahead of main. Comparing PR #22 with accepted local source gives **2 PR-only / 45 local-only commits**. Those two PR-only commits are documentation `64f92b2edd5472e752d216ab205a61e54263ab4f` and the later-proof lookup fix `a174fc6`. The latter raises the GitHub proof scan from 25 to 200 and adds a regression. Accepted source still reads 25. Preserve that change deliberately; neither branch is a complete substitute for the other. A 200-row cap remains a bound, not a proof that arbitrarily late evidence is found.

The accepted tree differs from remote main in 126 files (8,048 insertions / 256 deletions). This is much larger than the original three-item GitHub PR scope. Do not present that range as “just the destination fix.” The release receipt records `32aa043`; later branch HEAD is not an interchangeable deployment candidate.

### Runtime evidence and limits

The dated [retained production receipt](2026-09-19-retained-recheck-production.md) records **969 retained headers, 118 matches, 20 new private candidates and 851 unmatched headers**. It records unchanged original data and publication. This audit preserves that evidence; it did not repeat the recheck or authorize a mailbox read.

Fresh public HTTP checks in this audit:

- `https://proper-respect.com/onboarding` → **307** to `https://props.lecturesfrom.com/onboarding`.
- `https://props.lecturesfrom.com/onboarding` → **200**; this HTTP response alone does not prove a signed-in collection.
- `/keegan` → **200**; `/lecturesfrom` → **404** on the current host.

Vercel inspection matches the receipt's deployment ID and URL, `https://proper-respect-ivkesju5q-groundskeep.vercel.app`. Source binding comes from the exact-archive release receipt; CLI inspection alone does not attest every deployed byte. Fresh sign-in, second-user isolation, a new live GitHub connection and thirty days of unattended refresh remain unproven.

## 2. PR #22 decision and blockers

[PR #22](https://github.com/keeganmoody33/PROPER-RESPECT/pull/22) is OPEN, non-draft, MERGEABLE/CLEAN, with aggregate review decision APPROVED. That is **not sufficient to merge**:

1. The approval review applies to `d2266fa`, not current `a174fc6`.
2. Two review threads remain unresolved. The storage-ownership finding is current; the 25-proof finding is marked outdated following `a174fc6`.
3. The reported successful checks are Cursor Approval Agent, Devin Review and Vercel Agent Review. There is no `.github/workflows` tree on main, PR #22 or accepted HEAD. The main branch protection endpoint says “Branch not protected”; repository rulesets are empty. No required test CI was verified. Local tests are not CI.
4. Upload classification, replay-safe FILE_UPLOAD retention and source/issuer provenance are extra scope beyond `bc29000`'s original authorization, although those changes have since shipped through separately approved archive releases. This reroute expressly requests a new branch disposition; prior production deployment does not resolve GitHub review findings.

### Confirmed first-retention ownership gap

[Unresolved finding](https://github.com/keeganmoody33/PROPER-RESPECT/pull/22#discussion_r4052778663):

> “This first-retention path only checks whether the storage ID exists; it never binds an unretained storage object to the user who received the upload URL.”

Source inspection confirms it in current PR #22 and accepted `convex/onboarding.ts:260–292`: `generateUploadUrl` authenticates but stores no owner ticket; `retainUpload` validates storage size/type and checks owner only when a raw-evidence row already exists. A caller who obtains another user's still-unretained storage ID could claim it first. This is a demonstrated code-path gap, not a claim of observed exploitation or easy storage-ID discovery. It blocks accepting this upload boundary for other users.

No corrective code or review resolution was performed in Phase 0. Existing tests pass without proving this missing binding. The fix should first reproduce cross-owner first retention, then bind finalization to the authorizing uploader without weakening replay protection.

### Owner decision requested

**Recommended (a): preserve the accepted release lineage, approve the additional upload/provenance scope for reconciliation, and resolve the storage-ownership blocker before merging.** Keep PR #22 frozen while the decision is outstanding. Bring its unique later-proof regression/fix into the single accepted integration lineage. Review the full main-to-integration diff, including the local native-session fix, and run checks on the exact final merge candidate. Do not merge private historical operator branches.

Alternative (b), reducing to `bc29000` and re-queuing extras, is possible but intentionally separates changes already present in the hosted runtime; it does not fix the deployed first-retention gap. No force-push/rebase is authorized by this receipt.

Any chosen final source gets its own exact SHA and verification. This audit does **not** authorize a new deployment, source read, recurrence, publication or data transfer.

## 3. All open issues against actual implementation

GitHub returned exactly ten open issues. Their bodies and acceptance checklists were read, not just their titles. No issue was changed. “Implemented” below means source exists unless a named hosted receipt says otherwise; it does not mark unchecked acceptance complete.

| Issue | Current evidence | Phase 1 disposition / acceptance that remains |
|---|---|---|
| [#4 — Keegan-first V1 spec](https://github.com/keeganmoody33/PROPER-RESPECT/issues/4) | Private review, separate exact publication, retained evidence and multiple mailbox accounts supersede immediate GitHub publication and a four-product-only model. Its “documentation-only” test statement is false. `convex/schema.ts` has no Domain table. | Supersede the single-owner/auto-publish specification; retain provenance, exclusions and deterministic evidence rules. New scope document must explicitly cover per-user identity, private review, explicit publication and truthful coverage. Do not silently assert NotebookLM/Gemini or Devin/Windsurf lineage beyond verified identities. |
| [#6 — GitHub deterministic evidence](https://github.com/keeganmoody33/PROPER-RESPECT/issues/6) | Direct GitHub adapter, normalized contribution calendar, source lineage, retained snapshots and scheduled refresh code exist in `convex/connectors.ts`, `src/domain/evidence-claims.ts` and `components/product-card.tsx`. | Retain provider privacy/replay/last-known-good criteria; distinguish fixture/retained proof from hosted owner-authorized connection and unattended refresh. Local native-session fix is not hosted. No 30-day receipt exists. |
| [#7 — GitHub fast start](https://github.com/keeganmoody33/PROPER-RESPECT/issues/7) | Its “immediately published profile” and “without a redundant second confirmation” contradict current owner-controlled publication. Current source says connected activity stays private until approved. | Supersede those criteria. Refresh to sign-in → independent connector consent → private candidate → explicit preview/publication; include cancellation, native Clerk token compatibility, account isolation and retry. |
| [#8 — Add/publish Wispr](https://github.com/keeganmoody33/PROPER-RESPECT/issues/8) | Manual name/site intake, review, lifecycle save, typed links and exact publication preview exist (`convex/manualProducts.ts`, onboarding/inventory/publication and corresponding components). Hosted public Wispr remains curated; development imports are not presumed transferred. | Keep remaining real universal-intake/edit/unpublish/affiliate-link acceptance. Stop blocking on obsolete GitHub auto-publication. Do not count available code or hypothetical affiliate URLs as completed owner actions. |
| [#9 — Wispr dated measurements](https://github.com/keeganmoody33/PROPER-RESPECT/issues/9) | Prepared real snapshots and private review paths have receipts; cards support metrics/time series, unknown periods and provenance. `convex/privateEvidence.ts` handles selected owner-supplied observations. | Still needed for a complete hosted dated-measurement/edit/removal journey with exact publication and transcript exclusion. Single snapshot support does not establish live telemetry or automatic chart history. Newer development packets/selections remain a separate transfer gate. |
| [#10 — NotebookLM artifact](https://github.com/keeganmoody33/PROPER-RESPECT/issues/10) | Existing published card and private supporting context/artifact data shapes; no automatic notebook ingestion. | Refresh to owner-approved artifact and attribution, removal, explicit publication and privacy verification. A seeded card does not prove the complete artifact workflow; do not treat unverified rename/alias claims as acceptance facts. |
| [#11 — Devin IDE lifecycle](https://github.com/keeganmoody33/PROPER-RESPECT/issues/11) | Generic inventory save/history, archive/resume controls and distinct Devin cloud/Desktop identity paths exist. React-key and grouping fixes do not merge personal records. | Keep real lifecycle/history/reload proof and safe alias handling. Do not require a particular IDE seed or collapse cloud/Desktop/Windsurf without identity evidence. |
| [#12 — Cards](https://github.com/keeganmoody33/PROPER-RESPECT/issues/12) | Product-native brands, accessible detail controls, compact public projection, activity variants and responsive tests exist; latest receipt checks actual 1066px/325px collection. | Re-cut remaining browser accessibility, public reveal, truthful evidence, links and degraded-state acceptance. Public `app/[handle]/page.tsx` maps stored card order; no visitor recency/tenure sort control there. No fresh comprehensive accessibility/sort acceptance claimed. |
| [#13 — Canonical host](https://github.com/keeganmoody33/PROPER-RESPECT/issues/13) | Vercel custom hosting/HTTPS and proper-respect.com entrance redirect are live. The described verified Domain → Site host routing is not implemented. Public metadata returns title/description only. | Still needed, with corrected baseline and new canonical direction. Define and test verified/pending/failed/detached/malformed/unknown/preview isolation, metadata, redirects and fallback; include Clerk/application-origin migration. No DNS change in Phase 0. |
| [#14 — Launch](https://github.com/keeganmoody33/PROPER-RESPECT/issues/14) | Hosted release, real two-account Gmail consent, bounded background discovery, retained recheck and private saved choices have later receipts. Those facts replace the early September release gaps. | Phase 1 split “as shipped” from actual gaps. Do not reopen completed hosted Gmail setup. Retain scoped owner transfer, fresh sign-in, exact publication, cross-user isolation, first-upload ownership, hosted GitHub proof and authorized unattended refresh. #7/#12/#13 are not accurately described by the old blocking chain. |

The proposed Phase 1 gap list in the prompt is partially stale: hosted Gmail configuration and consent **have** been completed for the owner. They still require a separate second-user acceptance proof. The earlier development-to-production evidence/selection transfer is **not** proven complete. Both bounded Gmail budgets are exhausted and recurrence is disabled; no further collection is implied by this audit.

## 4. Unexpected drift requiring a decision

- Latest release is local-only while main is 54 runtime commits behind; local accepted HEAD adds three more checkpoints. PR #22 also has unique remote work.
- The current first-upload ownership gap is an unresolved blocking review, despite aggregate approval.
- The assumed Domain model and host test matrix do not exist in accepted source. This requires real Phase 2 implementation, not merely adding a database record.
- July metadata work is genuinely unique, but whole commits also touch old seeding/layout/configuration. Preserve it as a tagged reference and adapt narrowly later; do not cherry-pick obsolete architecture into the release merely to retire a branch.
- AI Hero experiment and prototypes contain unique non-runtime material. “Nothing unique” cannot honestly be recorded. Archive them instead of asserting equivalence.
- Additional local Composio/private-history branches and occupied dirty worktrees make literal “zero dead local branches” unsafe without a preservation decision. Public remote cleanup and protected local archives must be distinguished.
- No test CI or main protection is configured. Three green review bots are not required build/test checks.
- Branch creation timestamps are not established by commit timestamps. Apply the 14-day triage rule prospectively; the explicit dispositions below are today's triage, not invented branch ages.

## 5. Proposed ordered reconciliation after owner review

1. Approve option (a) or (b) for PR #22 and the unexpected drift dispositions above. Freeze PR #22 in the meantime.
2. Keep one integration lineage rooted in current main and preserve accepted September implementation. Reconcile `a174fc6` without downgrading newer source. Fix first-retention ownership with regression coverage before accepting upload scope.
3. Review exact final diff and unpublished tracked history for public safety; do not merge the private self-test/Composio ancestry. This audit checked tracked env paths (only `.env.example`) and the historical consolidation boundary; it is not a complete secret/privacy clearance for pushing all 57 commits.
4. Run focused changed-path tests, full required local checks and final integration checks at the exact candidate. Establish an actual CI gate before claiming checks pass “in CI.” Merge the reviewed candidate to main; record full SHA. No deployment is bundled into this step.
5. Annotate public-safe checkpoint tags, verify their target objects and remote reachability, then delete superseded remote branches. Preserve unique reference-only material under tags with clear descriptions. Privately archive private-history branches without pushing them. Do not reset/switch/remove dirty worktrees; obtain an explicit local archival disposition.
6. Verify one remote main lineage with at most one in-flight branch and all exceptions resolved. Update this receipt with executed actions and exact refs; only then request Phase 0 acceptance before proceeding to Phase 1.

## 6. Checks and actions in this audit

- Read accepted `AGENTS.md`, current source/receipts, Ref, every open issue, PR #22 diff/reviews/threads and live branch inventory.
- `git fetch origin` updated the PR tracking ref; no prune. Compared ancestry, patch IDs, changed blobs, worktree status and all live remote heads.
- `npx vitest run convex/evidenceUpload.test.ts src/domain/product-destination.test.ts src/server/github-route.test.ts`: **3 files, 34 tests passed**. Vite emitted its existing configuration-loader warning. This does not cover the missing first-upload owner binding or live GitHub proof.
- Read-only Vercel inspection and four HTTP route checks as above. No private mailbox/API read, new database backup, synchronization, deployment, transfer, recurrence, relationship edit or publication.
- No merge, rebase, cherry-pick, branch/tag creation/deletion, push, issue edit or source-code fix. This receipt is the only repository file added by the audit. The existing Ref receives the same Phase 0 status.
- Branch audit and complete tracked-doc inventory follow. Historical verification receipts remain historical evidence; superseding their old next-action text must not rewrite their original results.


---

## Appendix A — branch audit evidence

### Read-only branch report

Recorded 2026-09-19 America/New_York. Read-only Git audit; only this temporary report was written. No branch, tag, worktree, source, backend, deployment, publication, or provider state changed.

Accepted source: `a19928ddfca25c9345cb271bd05fb14125138839`. Remote main: `f808fc834c7900681d10b043a6bb09d4f8e76314`. Root owns main, personal-release and PR #22 reconciliation; this report excludes `origin/pr-22` and current PR #22 branch `origin/cursor/github-card-account-destination-7318` from integration decisions.

## Exact refs and divergence

Counts are **ahead / behind** the named baseline. Patch column is `git cherry` plus/minus counts against main and accepted. Plus means no identical standalone patch in that history; it does not prove the behavior is missing after a squash. Merge commits are not represented by `git cherry`.

| Ref | Full SHA | Merge base vs main / accepted | Ahead / behind main | Ahead / behind accepted | Cherry main; accepted |
|---|---|---|---:|---:|---|
| `origin/agent/canonical-products-tracer` (remote canonical tracer) | `82aad4406a320965d47cfa09e021714e7b9b3f1b` | `4bc8cc81d90be9c5520cae4675573da5bce70e09` | 7 / 7 | 7 / 64 | +6/−0; +6/−0 |
| `origin/agent/issue-5-public-product-identity` (remote public identity) | `2119382431c1be6f1d93168ed779a9571b96c29c` | `8be53847b083efeace0ebe287c99b557ac4d9810` | 2 / 8 | 2 / 65 | +2/−0; +2/−0 |
| `origin/devin/1788345545-unique-card-keys` (remote unique React keys) | `008e2887a00eea68e63778c7777597357b71ec3b` | `8be53847b083efeace0ebe287c99b557ac4d9810` | 3 / 8 | 3 / 65 | +3/−0; +3/−0 |
| `origin/agent/setup-ai-hero-skills` (remote AI Hero setup) | `cb0425c1394612eac7470fc36b519d8a80ea8d07` | `67308fb485634b84d1f9c88d089f5db3172f5d69` | 1 / 16 | 1 / 73 | +1/−0; +1/−0 |
| `codex/onboarding-prototype-checkpoint-20260916` (local + remote onboarding prototype) | `b19ab3ea7b2c69ab5bdf7bc1089241ed94118b6e` | `4bc8cc81d90be9c5520cae4675573da5bce70e09` | 1 / 7 | 1 / 64 | +1/−0; +1/−0 |
| `origin/codex/cursor-handoff-20260919` (remote Cursor checkpoint) | `833b1574c67bc93727c3e0df3f704e66ebd912d8` | `f808fc834c7900681d10b043a6bb09d4f8e76314` / `833b1574c67bc93727c3e0df3f704e66ebd912d8` | 13 / 0 | 0 / 44 | +12/−0; +0/−0 |
| `codex/composio-github-spike-20260917` (local Composio spike) | `b562bf0a6d6f296a62f2d1a5ea827e985f1177b3` | `8be53847b083efeace0ebe287c99b557ac4d9810` | 23 / 8 | 23 / 65 | +23/−0; +23/−0 |
| `codex/composio-integration-20260918` (local Composio WIP) | `00a097fd7f8c40591b580c45f15c27964d047056` | `cdbff637947af1d009212e8b5a3853fcdd782d0d` | 1 / 4 | 1 / 61 | +1/−0; +1/−0 |
| `codex/proper-respect-evidence-lifecycle-20260916` (local evidence lifecycle) | `7e352ba4e91a6ffbac33405a530e9019c6c522c4` | `8be53847b083efeace0ebe287c99b557ac4d9810` | 13 / 8 | 13 / 65 | +13/−0; +13/−0 |
| `codex/proper-respect-self-test-20260916` (local historical self-test) | `9b86837e46ff677d16bfc9103670e452c52f1d04` | `4bc8cc81d90be9c5520cae4675573da5bce70e09` | 30 / 7 | 30 / 64 | +29/−0; +29/−0 |
| `origin/dependabot/npm_and_yarn/npm_and_yarn-329b6319ff` (stale Dependabot tracking ref) | `8fbbfab5f28119f085d8c1b610bf1c84c2ac54bc` | `4bc8cc81d90be9c5520cae4675573da5bce70e09` | 1 / 7 | 1 / 64 | +1/−0; +1/−0 |

## Content reconciliation and decisions

### `agent/canonical-products-tracer`

Six standalone commits plus one merge diverge from main; none has an identical patch ID on either baseline. Its 17 changed paths are **not** all incorporated: seven helper/test/config paths are absent on both baselines, and ten paths have evolved versions.

- Genuine unique work: `8bde1a9e4c3a8b3c3460b0ed61713e379bf33248` adds `src/domain/public-site.ts` and tests, canonical/OpenGraph profile URLs, plus required `NEXT_PUBLIC_SITE_URL` validation. Accepted `app/[handle]/page.tsx` still emits title/description only. Preserve this optional metadata work as an inspectable historical candidate; it is not required for Phase 0 or a justification to change production configuration now.
- Superseded/hazardous whole-branch changes: `652dc5a63642abbfe9e3eb91dc41e94c4cc0b2d7` introduces hardcoded personal starter relationships/dates and rewrites seeding. `757512bbc75705efcd3855e6a56968263101638e` targets the obsolete vertical product-card layout. Its page still uses `key={card.product.slug}`, which would regress the unique-key fix. Do not merge this branch over September source or execute its seed.
- `82aad4406a320965d47cfa09e021714e7b9b3f1b` adds `.vercel` and `.env*.local` ignores; both already exist on main/accepted, so that behavior is superseded despite a different full patch ID.
- `b93a7b766595770a5b2aeb210b20383133a27124` deployment configuration and `2ff5ce927f691e26a4096394114731f72de1496c` projection tests belong to the old source layout. Current September deployment and public-contract work must remain authoritative.

Decision: **retain/archive for the unique metadata helper; do not merge/cherry-pick wholesale.** No exact unmodified commit is recommended for immediate cherry-pick. If owner later chooses that SEO feature, adapt the narrow metadata behavior to current source with focused tests instead of importing seeding/layout changes. Discarding this branch outright would lose unique work and needs an explicit disposition.

### `agent/issue-5-public-product-identity`

The branch was advanced after the similarly named PR #15 merge: current tip `2119382431c1be6f1d93168ed779a9571b96c29c` has `75c6e845839370adcb03bccdce0de81ac887040d` as predecessor, neither an ancestor nor patch-identical commit on main. The branch name/PR title alone does not prove current tip merged.

Content examination supplies the missing proof: all 41 changed paths exist on main/accepted; ten are byte-identical and 31 have later implementations. For example `scripts/deployment-preflight.mjs` has identical blob `672d308dfbaf92eee20b52b574b723cce09cc3f5` on branch, main and accepted; AppProviders/auth config and sign-in routes are retained. The old onboarding/connector/public projection code is superseded by September's private collection, safer claims, publication and source-lifecycle work.

Decision: **superseded integration branch; archive or delete only after root records consolidation and an owner-approved cleanup. No cherry-pick.** Do not use a merge to reintroduce old runtime versions.

### `devin/1788345545-unique-card-keys`

The exact one-line behavior of `008e2887a00eea68e63778c7777597357b71ec3b` is already present on both baselines:

```tsx
key={`${card.product.slug}-${index}`}
```

- `origin/main:app/[handle]/page.tsx:68`
- `a19928ddfca25c9345cb271bd05fb14125138839:app/[handle]/page.tsx:70`

This proves the requested same-slug sibling key fix survives despite `git cherry` reporting the old commit as plus after consolidation. It does not claim source-record reconciliation is solved by React keys.

Decision: **superseded; safe cleanup candidate after recording exact SHA, without cherry-picking.** The branch also inherits the older public-identity commits; do not merge those as collateral.

### `agent/setup-ai-hero-skills`

`cb0425c1394612eac7470fc36b519d8a80ea8d07` adds 71 files: 70 absent on both main/accepted, plus an AGENTS.md that differs from the current repository guide. It is genuinely unmerged. It adds local copies of Matt Pocock/AI Hero workflows and assumes GitHub issue labels/domain-doc conventions. These are workflow configuration, not application delivery. Current accepted execution is pstack-codex with CE support; copying this AGENTS.md would replace current boundaries.

The main worktree has untracked `.agents/`, `AGENTS.md`, `skills-lock.json`, `.claude/` and `CLAUDE.md`. Their mere presence does not prove equivalence to this branch; this audit did not overwrite or absorb them.

Decision: **owner decision: retain optional workflow archive or explicitly adopt/review selected files later. Do not merge automatically. No application dependency is blocked by it.**

### Prototype and Cursor checkpoint branches

- `codex/onboarding-prototype-checkpoint-20260916` local and remote tips both equal `b19ab3ea7b2c69ab5bdf7bc1089241ed94118b6e`. All 48 introduced prototype/product-doc paths remain absent on main/accepted. That is intentional separate A/B/synthetic exploration, not a lost production implementation. Preserve it; do not select A/B or bring 41,883 lines of artifacts into current runtime.
- Candidate annotated tag: `archive/onboarding-prototype-20260916` → that exact SHA. No tag by that name exists. It would preserve the already-remote history without merging it. Local branch is checked out in dirty worktree `/Users/keeganmoody/.codex/worktrees/4b19/PROPER-RESPECT`; **do not delete or remove that worktree** merely after creating a tag.
- `origin/codex/cursor-handoff-20260919` → `833b1574c67bc93727c3e0df3f704e66ebd912d8` is an exact ancestor of accepted HEAD, 44 commits behind it. Its 13 commits beyond current main are already included in accepted source, including the upload corrections and earlier GitHub destination work. No cherry-pick needed into accepted source; root must preserve these while reconciling main.
- Candidate annotated tag: `archive/cursor-handoff-20260919` → `833b1574c67bc93727c3e0df3f704e66ebd912d8`. No tag exists and no listed worktree occupies that branch. Tag/archive after root's reconciliation is straightforward; remote branch deletion still requires the cleanup decision. Existing branch history is already remote; this proposal adds no private self-test ancestry.
- No tags were created and no branches removed. Tag recommendations establish preservation targets, not authorization to mutate refs.

### Local Composio lanes

- Spike `b562bf0a6d6f296a62f2d1a5ea827e985f1177b3` is unique and lives in the clean, occupied spike worktree. It adds eight paths relative to its parent: seven isolated prototype/evaluation/test files and package scripts. Its evaluation says real bounded parity passed and **production transport replacement was not accepted**. Preserve completed evaluation; do not rerun or merge it as production. It descends from older private operator history, so do not push the branch/tag publicly merely to simplify local refs.
- WIP `00a097fd7f8c40591b580c45f15c27964d047056` is a distinct, unoccupied local branch one commit beyond `cdbff637947af1d009212e8b5a3853fcdd782d0d`. Six added files are absent on accepted/main; schema changes differ. It contains tests and draft connection tables/lifecycle functions but **both `src/domain/composio-github.ts` and `src/server/composio-github.ts` are absent**. Its handoff explicitly labels tests/build incomplete and forbids merging/deploying it. Retain as a separate unaccepted checkpoint; do not cherry-pick its schema just to consolidate branches. No review in this audit establishes its implementation safe or complete.

### Local evidence lifecycle and historical self-test

- `7e352ba4e91a6ffbac33405a530e9019c6c522c4` is an ancestor of historical self-test `9b86837e46ff677d16bfc9103670e452c52f1d04`, not an ancestor of sanitized main. It remains checked out in dirty `/Users/keeganmoody/.codex/worktrees/33b8/PROPER-RESPECT`.
- Crucial content check: `git diff 9b86837 ea07370 --name-only` lists **only 14 documentation files**. The private self-test runtime source tree was carried into consolidation `ea073706b7e4a1287ae4c0d08e11771db7dbfb04`; the changed docs redact or relocate personal operator receipts. All later main/accepted behavior builds on that runtime. Old runtime commits' `git cherry +` results are not a reason to merge their private ancestry.
- Historical private receipt paths include task2-owner-auth, task2-gmail-live-proof, development-sync and personal-product-delivery documents. Do not push/merge those historical branches or public tags pointing to them. Preserve local history and ignored/private evidence in place; branch cleanup requires a private archival decision, not automatic removal.
- `codex/proper-respect-self-test-20260916` is not currently checked out despite the accepted directory retaining that historical name. Accepted directory is on `codex/personal-release-main`.

### Unexpected/stale Dependabot ref

`refs/remotes/origin/dependabot/npm_and_yarn/npm_and_yarn-329b6319ff` remains locally at `8fbbfab5f28119f085d8c1b610bf1c84c2ac54bc`, but the fresh GitHub branch inventory omits it and `git ls-remote --heads origin dependabot/npm_and_yarn/npm_and_yarn-329b6319ff` returns no ref. It is a **stale tracking ref**, not a live forgotten remote branch.

Its intended dependency upgrades are superseded: branch locks Next 16.3.0, PostCSS 8.5.23, Sharp 0.35.3; both main and accepted lock Next 16.3.5, PostCSS 8.5.23, Sharp 0.35.4. No cherry-pick. Owner-approved prune can remove only stale local tracking metadata later; none performed here.

## Worktree preservation audit

| Path | HEAD / branch | Observed status | Action |
|---|---|---|---|
| `/Users/keeganmoody/Downloads/PROPER-RESPECT` | `4bc8cc81d90be9c5520cae4675573da5bce70e09`, local main | `.DS_Store` staged+unstaged; untracked `.agents/`, `.claude/`, `AGENTS.md`, `CLAUDE.md`, `convex/_generated/ai/`, `skills-lock.json` | Root-owned; preserve dirty/untracked files. |
| `/Users/keeganmoody/.codex/worktrees/33b8/PROPER-RESPECT` | `7e352ba4e91a6ffbac33405a530e9019c6c522c4`, lifecycle | modified `.DS_Store` | Preserve occupied branch/worktree. |
| `/Users/keeganmoody/.codex/worktrees/3799/PROPER-RESPECT` | detached `5ade174d5fb783aa80fbcc661988aa5cc1eee42f` | clean | Historical private-proof checkout; owner decision before removal. |
| `/Users/keeganmoody/.codex/worktrees/4b19/PROPER-RESPECT` | `b19ab3ea7b2c69ab5bdf7bc1089241ed94118b6e`, prototype | modified `.DS_Store`; untracked `prototypes/.DS_Store`, `prototypes/onboarding-2026-09-16/.DS_Store` | Preserve despite archive-tag proposal. |
| `/Users/keeganmoody/Downloads/PROPER-RESPECT-composio-spike-20260917` | `b562bf0a6d6f296a62f2d1a5ea827e985f1177b3`, spike | clean | Preserve accepted evaluation and private ignored receipts. |
| `/Users/keeganmoody/Downloads/PROPER-RESPECT-self-test-20260916` | `a19928ddfca25c9345cb271bd05fb14125138839`, personal-release | clean when audited | Accepted source; root owns reconciliation. |
| `/private/tmp/proper-respect-prod.CHwiEd/repo` | detached `2119382431c1be6f1d93168ed779a9571b96c29c` | directory missing; Git registration marked prunable | Flag only; no pruning/deletion. |

## Exact integration recommendation

**No additional unmodified cherry-pick from the audited side branches is justified before reconciling accepted source to main.** Preserve accepted `a19928d` and its Cursor checkpoint ancestry; archive unique prototype/SEO/workflow/Composio material with the distinctions above. Only the root-reviewed main/PR22 reconciliation should become the release baseline. This is not permission to delete dirty worktrees, publish private ancestry, install alternate workflow instructions, or deploy anything.

This audit used `git cherry`, full ref SHA/merge-base/count inspection, changed-path blob comparisons, old-versus-consolidated tree comparison, actual React-key source inspection, dependency lock inspection, and worktree status. No runtime tests were needed for this read-only disposition; source equivalence is not hosted acceptance.

---

## Appendix B — complete documentation audit

Coordinator note: the root refreshed remote refs during this audit. The specialist did not independently fetch; its main SHA matches the fresh GitHub API result above. No historical receipt has been rewritten.

### Read-only documentation report

Recorded: 2026-09-19 America/New_York (audit wall-clock UTC shown below).
Scope: read-only source/document inspection; no Phase 1–3 implementation, new ADR,
provider read, data transfer, deployment, publication, or Git mutation.

Accepted checkout: `/Users/keeganmoody/Downloads/PROPER-RESPECT-self-test-20260916`.
Inspected HEAD: `a19928ddfca25c9345cb271bd05fb14125138839` (clean).
Local remote-tracking `origin/main`: `f808fc834c7900681d10b043a6bb09d4f8e76314`.
No fetch was performed; this report does not claim that tracking ref is GitHub's
latest state. The coordinator owns live release/PR reconciliation.

## Authority and verified baseline

`docs/verification/2026-09-19-retained-recheck-production.md:8–26` identifies
production source `32aa043c48ee32686b3c656127f2d58ed7d1388b`, Vercel
`dpl_8zGq3Exu68QgVvCKmdy4Hm9SoRTh`, Convex `striped-chicken-693`, and the exact
runtime/archive verification. Lines 30–56 record one retained-only pass: 969
stored headers checked, 118 matches, 20 new private candidates, 851 unresolved
headers; evidence, choices, cursors, runs, and publication unchanged. Lines
72–80 record preserved `/keegan`, unpublished `/lecturesfrom`, and fresh sign-in
still unproven. This audit inspected that receipt; it did not independently
repeat a production query or mailbox operation.

`docs/CURSOR_HANDOFF.md:4–15` and `docs/DEVELOPMENT.md:9–19` agree on that latest
baseline and identify `82faddf` as a local, unreleased GitHub native-session fix.
Do not deploy the accepted documentation HEAD as an implicit replacement for
that approved runtime source.

## Active status contradictions

| ID | Exact file/lines | Conflict with current evidence |
| --- | --- | --- |
| D1 | `docs/000-current-product-thesis.md:43–49,71,77` | Its “current implementation” still centers September 18/four pages, and line 77 says “No ... production/preview deployment ... has occurred.” Production32aa043 and the two completed bounded hosted runs disprove that present-tense statement. General privacy/claim rules remain valid. |
| D2 | `docs/002-v1-product-motion.md:11–19` | Immediate step 5 says “Implement separately authorized, read-only email discovery.” The connector, durable runs, private retention and candidates already exist and have hosted proof. This file is present, not missing; preserve its product principles but do not relaunch email implementation. |
| D3 | `docs/003-evidence-surfaces.md:88–92` | Current continuation still describes only the old four-page authorization. Further reads remain paused, but the status omits both separately authorized hosted runs and later retained recheck. Capability and screenshot-authenticity limitations elsewhere remain correct. |
| D4 | `docs/CURSOR_HANDOFF.md:24–36,47–61,69,100–102,153–163` | Correct latest banner is followed by “Current release” 5a0b77f, “Current production” 8b6aa9a, “not deployed,” and “Hosted Gmail has no connected accounts or required mailbox configuration.” Also names only the old 20-header budget. Fresh-clone-main advice risks losing the accepted branch's newer code until source reconciliation completes. Some paragraphs say older material is historical, but the contradictory current headings remain actionable. |
| D5 | `docs/DEPLOYMENT.md:7–9,246–259,286–296,321–328` | Says live 7fa18a7/consent pending, credentials “only” on development, requires a legacy Clerk JWT template, and says historical mode was not started. Native mode is explicitly supported at108–112, current production has completed consent and historical pages. Single-page instructions still describe a supported path, but omit already deployed durable run and retained-recheck controls. The dated Context.dev development-only section60–96 is historical, not proof production is unconfigured. |
| D6 | `docs/DEVELOPMENT.md:58–59,70–83` | Accurate top baseline coexists with “development only” e8834be, “current receipt” a2539b9 and “Production now runs ... 8b6aa9a.” Historical source checks are called “current.” Header takes precedence, but these must not guide a new agent's release target. |
| D7 | `docs/plans/2026-09-16-multiple-mailboxes-and-native-cards.md:97,156,227,277,357–378` | Task 1 still says not deployed; Task 2 says zero matches/real capture gate open and refresh/stale-cursor work deferred; Task 4 says hosted persistence awaits development sync; exact continuation asks for already-completed Wispr card and Gmail proof. Task 2 now has `finalizeVerifiedConnection`, generation/credential revision checks, bounded scan contexts, discovery runs, maintenance opt-in and `recheckRetained`. Microsoft and live recovery acceptance remain open. Dated checkpoint blocks121–152 and280+ are historical evidence, not invalid commits. Preserve Tasks 1–4. |
| D8 | `docs/plans/2026-09-16-wispr-product-and-usage-plan.md:26,64–69,117–192` | Plan still describes public-source registry/private usage observations/review UI as units to implement and says existing observations cannot represent undated numeric usage. Current `productKnowledge.ts`, `productKnowledgeTables.ts`, `privateEvidence.ts`, `evidence-claims.ts`, `components/private-evidence-panel.tsx` and `components/product-knowledge-panel.tsx` implement those foundations. It lacks a current completion pointer. No personal Wispr API is established; do not infer one from completed schema/UI. |
| D9 | `docs/verification/2026-09-19-public-profile-readiness.md:3–8,194–243` | Rolling readiness begins “Current release is8b6aa9a,” retains old mobile-overflow gate and says Clerk/Clay have no existing target at235. New hosted candidates and Clerk owner save now exist; richer-packet transfer still needs exact source/target reconciliation. Dated completion-audit sections remain historical evidence, not present database state. |

## Accepted ADR drift and unimplemented promises

These are documentation discrepancies or explicitly unimplemented accepted
intent, **not automatic authorization to build additional features in Phase0**.

| ID | Files/lines | Evidence/disposition |
| --- | --- | --- |
| G1 | `docs/adr/004-public-graph-privacy.md:39–47` | “Delete a prop,” “Remove lineage,” and “Export profile data” are presented as always-available controls. Current endpoints include `onboarding.deleteEvidence` and relationship archive/save, but no general account export/delete surface or lineage mutation. Privacy principles remain valid. |
| G2 | `docs/adr/005-manual-product-database.md:16–21,25–45`; `docs/adr/008-product-rebrand-handling.md:16–20` | Generic aliases/domain arrays/community merge are intent. Runtime `products` stores a single domain (`convex/schema.ts:48–57`); reviewed aliases live in `src/domain/discovery.ts` catalog. Manual intake exists; no generic admin product merge/rebrand workflow is present. |
| G3 | `docs/adr/006-data-retention-forever.md:22–41`; `docs/adr/012-account-deletion.md:11–21,62–87` | Retention promises 90-day refresh logs/30-day auth logs/yearly analytics and 30-day full account deletion without implemented schedulers. ADR 006 says all lineage removed; ADR 012 preserves anonymized recipient lineage then proposes annual ghost purge. ADR 006's “Unselected mailbox data: Do not retain” needs reconciliation with explicitly authorized retained unknown headers. Current retained originals remain private; do not delete them to enforce an old prose rule. |
| G4 | `docs/adr/009-manual-put-on-by.md:37–55,121–125`; `docs/adr/013-floating-lineage.md:11–28,65–90`; `docs/adr/023-put-on-by-ui.md:143–180` | Accepted person matching, notifications, confirming/rejecting lineage and expiration are not backed by lineage tables/queries or UI. They cannot be called delivered social features. |
| G5 | `docs/adr/019-search-discovery.md:12–29`; `docs/adr/028-chrome-extension.md:14–29`; `docs/adr/032-moderation.md:12,32–34`; `docs/adr/037-import-tools.md:12–24` | Public people/product search, browser extension, reporting/admin moderation, and broad Linktree/Beacons/Carrd/YouTube/newsletter URL importers are specified but absent from current app routes/Convex functions. Direct GitHub and owner-selected evidence are not those generic importers. These gaps need explicit launch disposition; no implementation is implied here. |
| G6 | `docs/adr/021-domain-branding.md:12–14` | “Interchangeable” branding/domain guidance is design intent only. The real working host, Clerk issuer and Google callbacks are bound to props.lecturesfrom.com; domain changes cannot be treated as a cosmetic substitution. |
| G7 | `docs/adr/022-risk-register.md:19,29–33,45`; `docs/adr/036-template-profiles.md:8–21,38`; `docs/adr/055-empty-states.md:24–29,65` | Old manual-first rationale, template/import-first samples and APIs-not-foundation direction predate accepted discovery-first work. Templates/fuzzy merge/extension are not live implementation. Current `onboarding-client.tsx` mounts actual private inventory and source management. |
| G8 | `docs/adr/023-put-on-by-ui.md:126`; `docs/adr/057-accessibility.md:40–49,57–70,106` | “Cred:67” and “Credibility114/67” contradict no universal score. shadcn and custom keyboard shortcut examples are not installed/delivered features. WCAG target remains a target; these examples cannot establish compliance. |
| G9 | `docs/adr/033-product-sunset.md:47,59–66` | “automatically archived” on vendor shutdown directly conflicts with owner-controlled lifecycle (`docs/000-current-product-thesis.md:72`, `convex/inventory.ts:45–94`). No automatic shutdown/relationship archive function exists; do not add it from this ADR. |
| G10 | `docs/adr/034-duplicate-prevention.md:13–46,67–115` | Levenshtein matching, domain collision restriction, admin merge and credibility-weight preservation/risk score are not current code. Current ambiguity-safe `discovery.ts`/`discoveryReview.ts` preserves multiple relationships. Shared GitHub/Copilot and Devin/Desktop domains deliberately remain distinct. A broad same-domain merge would regress accepted identity boundaries. |
| G11 | `docs/adr/056-seo-social.md:8,12–32` | Profile OG/share image is desired but no `opengraph-image`, `api/og`, sitemap or robots route is tracked. `app/[handle]/page.tsx:13–26` returns title/description only; `app/layout.tsx:5–11` has no metadataBase/canonical/OG. This is missing capability, not already-delivered hostname metadata. |
| G12 | `docs/adr/058-performance.md:24–31,41–59,85–90` | Prisma+Neon, system-font-only, assumed cache durations and LighthouseCI/Sentry/LogRocket are not the running stack. Current `package.json` uses Convex; `components/product-brand-fonts.tsx` supplies retained brand fonts; no those monitoring dependencies/configs are present. Performance targets are not measurements. |
| G13 | `docs/adr/060-data-export.md:13–19,40–41,126–151` | Complete JSON/CSV/Markdown/HTML/Linktree export, <10s/24h download guarantees, re-import and account merge are not implemented. The export example's credibility score and OAUTH_VERIFIED must not become usage claims. `convex export` is an operator database backup, not this owner-facing feature. |

## Prompt assumptions checked

- **Domain → verified hostname → Site → public profile is not implemented.**
  `convex/schema.ts:111–119` has only `sites(ownerId,handle,status DRAFT|ACTIVE)`.
  No Domain table/verified/pending/failed/detached domain lifecycle exists in
  schema or composed `*Tables.ts`. `proxy.ts:1–17` is Clerk middleware only.
  `src/data/get-public-profile.ts:11–27` validates a path handle and queries
  `publicProfiles.getByHandleV2`; that query selects published snapshot by handle
  (`convex/publicProfiles.ts:16–24`), not verified hostname or Site. `next.config.ts`
  has no host routing. `docs/RECONNAISSANCE.md:130–151,258+` proposed this as missing
  future functionality in July. Treating the proposal as existing architecture
  would invent a baseline. The actual purchased-domain redirect is an operator
  hosting configuration, not tenant-safe domain routing. No domain subsystem is
  available to “extend” in this accepted branch or local origin/main.
- **Hosted Gmail setup/consent is already done for this owner's two test accounts.**
  `docs/verification/2026-09-19-hosted-gmail-release.md` and
  `2026-09-19-hosted-discovery-proof.md` record successful consent and bounded
  real reads. Latest32aa043 adds retained-only recognition, not another read.
  This does not prove unrestricted multi-user Gmail approval: runbook 242 and
  hosted setup record identify Google Auth Platform External/Testing with
  named test users; Google public-verification readiness remains unproven.
- **Scheduled GitHub refresh has a code path, not a 30-day live receipt.**
  `convex/crons.ts:6–10` calls `connectors.refreshApproved` daily;
  `convex/connectors.ts:514–531,656–694` reads active metric subscriptions and
  fetches GitHub/Devin. `onboarding.publishSelected:552–581` explicitly creates
  refresh permission from reviewed public selections. This is not a proven
  private-only continuous collector, and no 30-day runtime record was found.
  Local GitHub native-session fix 82faddf remains undeployed; connecting GitHub
  invokes a real source read (`connectors.connectGithub:419+`).
- **Multi-user foundations exist but second-user acceptance is not established.**
  `onboarding.ensureAccount:47–75` binds `identity.subject`, creates an available
  private account; queries/mutations use `requireUser`. Mailbox accounts carry
  immutable owner/provider identity. Existing isolation tests are not a real
  second person's consent→review→publish→revoke proof. Do not seed another user.
- **Richer development packet transfer remains a proposal, not a reason to
  copy a database.** Current production already has mailbox-derived candidates
  and saved choices. Old statements that Clerk/Clay have no target are stale;
  transfer requires a fresh per-record reconciliation of actual accepted
  packets/owner bindings, not overwriting these records. No transfer here.
- **Referenced resources:** both `docs/002-v1-product-motion.md` and
  `docs/plans/2026-09-16-multiple-mailboxes-and-native-cards.md` exist. The latter
  is the original Tasks 1–4 plan, not a multi-tenant domain implementation plan.
  `docs/COMPOSIO_CURSOR_HANDOFF.md` is referenced by CURSOR_HANDOFF 143–145 as a
  file on the preserved Composio branch; it is absent on accepted HEAD and
  origin/main. Do not recreate it as missing accepted-source work. All relative
  Markdown links within tracked docs resolved locally in this audit; absolute
  temporary-machine/Codex links are archival pointers, not portable files.

## Dated records versus active instructions

`docs/RECONNAISSANCE.md:3–29` is explicitly July 22 reconnaissance of a then
source-free repository. Its “no application” assertions are historical, not
current engineering guidance. `docs/004-v1-technical-contract.md:3–25,270`
explicitly labels the interfaces conceptual and contains a later status addendum;
do not “implement” its ORM choice or enum list over the actual schema.
`docs/2026-09-16-self-test.md`, dated dogfood reports, feedback, all versioned
release/sync receipts, and candidate JSON files preserve their historical
assertions. “Not deployed” in a pre-release receipt is not an error to erase.
`docs/verification/2026-09-19-github-native-session.md:42` calls 32aa043 pending
because it predates that release; lines 3/35–40 correctly scope the GitHub fix
as local. The later production receipt supersedes its temporal status.
`docs/future/*` all carry an explicit parked boundary; do not promote them into
Phase0 tasks. Images/brand JSON fixtures are artifacts, not runtime state.

## Local origin/main comparison

Accepted HEAD tracks 122 docs files: 99 Markdown, 9 JSON, 1 ideation HTML, 13 PNG.
Local origin/main tracks 91: 31 files added, 5 modified, 0 removed. Every origin/main
docs path remains in accepted HEAD; there is no missing remote-only docs file.
Modified files inspected on both sides:

- `000-current-product-thesis.md`: main lacks the portable-history link; older
  four-page/no-production status already exists there.
- `003-evidence-surfaces.md`: main lacks FILE_UPLOAD/common-format 25MiB wording
  and September 19 portable-history rules; do not replace newer accepted text.
- `CURSOR_HANDOFF.md`: main 9–16 calls adfc813 current and instructs finishing
  old transfer; it lacks hosted discovery/retained-recheck acceptance.
- `DEPLOYMENT.md`: main 5–8 says proper-respect.com DNS/HTTPS unverified and no
  live application URL; accepted source correctly records the working redirect
  but retains the additional D5 drift. Main lacks native-session guidance.
- `DEVELOPMENT.md`: main is September 18 and lacks the accurate 32aa043 latest
  baseline/retained proof. It must not supersede accepted continuation.

The 31 added docs paths are listed individually as `added` below. None is a
remote-only missing resource. Current GitHub main/PR status belongs to the
coordinator's separately authorized read-only check.

## Full tracked docs inventory

Codes: D = active status contradiction; G = accepted intent/promise or policy
drift needing disposition; H = dated historical record (preserve); C = no
material current-boundary contradiction found; P = explicitly parked; A =
asset/fixture, no live-state authority; X = privacy-preserving placeholder.
A C classification does not certify an entire feature or legal/accessibility
claim. This audit makes no edits to any of these files.

| Path | Classification | Difference from local origin/main |
| --- | --- | --- |
| `docs/000-current-product-thesis.md` | D1 — Active stale release/read boundary | modified |
| `docs/001-git-for-product-attribution.md` | C — no material current-boundary contradiction found | same |
| `docs/002-v1-product-motion.md` | D2 — Immediate sequence still asks to implement email discovery | same |
| `docs/003-evidence-surfaces.md` | D3 — Current continuation refers only to exhausted four-page gate | modified |
| `docs/004-v1-technical-contract.md` | H — explicitly conceptual engineering contract; schema is authoritative | same |
| `docs/2026-09-16-self-test.md` | H — dated evidence/record; not current release direction | same |
| `docs/CURSOR_HANDOFF.md` | D4 — Correct top banner but contradictory current-release/setup paragraphs | modified |
| `docs/DEPLOYMENT.md` | D5 — Consent/read history and legacy JWT prerequisites stale | modified |
| `docs/DEVELOPMENT.md` | D6 — Correct top banner but stale production-only/development-only claims below | modified |
| `docs/RECONNAISSANCE.md` | H — dated evidence/record; not current release direction | same |
| `docs/adr/001-email-as-passport.md` | C — no material current-boundary contradiction found | same |
| `docs/adr/002-weight-over-reach.md` | C — no material current-boundary contradiction found | same |
| `docs/adr/003-no-money-holding.md` | C — no material current-boundary contradiction found | same |
| `docs/adr/004-public-graph-privacy.md` | G1 — Accepted delete/export promises lack implemented account-wide controls | same |
| `docs/adr/005-manual-product-database.md` | G2 — Intent-level aliases/merge tools differ from runtime schema | same |
| `docs/adr/006-data-retention-forever.md` | G3 — Retention/deletion promises conflict internally and exceed current controls | same |
| `docs/adr/008-product-rebrand-handling.md` | G2 — Product alias storage/merge intent not generic persisted capability | same |
| `docs/adr/009-manual-put-on-by.md` | G4 — Notifications/lineage confirmation workflow not implemented | same |
| `docs/adr/012-account-deletion.md` | G3 — Account deletion/grace/ghost flow not implemented | same |
| `docs/adr/013-floating-lineage.md` | G4 — Floating attribution matching/hardening absent | same |
| `docs/adr/014-free-products.md` | C — no material current-boundary contradiction found | same |
| `docs/adr/015-shared-accounts.md` | C — no material current-boundary contradiction found | same |
| `docs/adr/016-seasonal-usage.md` | C — no material current-boundary contradiction found | same |
| `docs/adr/018-viral-loop.md` | C — no material current-boundary contradiction found | same |
| `docs/adr/019-search-discovery.md` | G5 — Accepted public search surfaces absent | same |
| `docs/adr/020-cold-start.md` | C — no material current-boundary contradiction found | same |
| `docs/adr/021-domain-branding.md` | G6 — Domain-interchangeability intent must not override current auth-origin binding | same |
| `docs/adr/022-risk-register.md` | G7 — Old manual-first/API-not-foundation priorities differ from current discovery | same |
| `docs/adr/023-put-on-by-ui.md` | G8 — Unsupported credibility-score example and unimplemented exact social UI | same |
| `docs/adr/024-onboarding-flow.md` | C — no material current-boundary contradiction found | same |
| `docs/adr/028-chrome-extension.md` | G5 — Accepted extension capability absent | same |
| `docs/adr/032-moderation.md` | G5 — Accepted reporting/admin flow absent | same |
| `docs/adr/033-product-sunset.md` | G9 — Automatic personal archive contradicts current owner-controlled lifecycle | same |
| `docs/adr/034-duplicate-prevention.md` | G10 — Fuzzy/admin merge/score not implemented; broad-domain collision unsafe for subproducts | same |
| `docs/adr/036-template-profiles.md` | G7 — Manual-first rationale superseded; templates absent | same |
| `docs/adr/037-import-tools.md` | G5 — Specified broad public URL importers absent | same |
| `docs/adr/039-work-personal.md` | C — no material current-boundary contradiction found | same |
| `docs/adr/055-empty-states.md` | G7 — Manual/public-link-first sample copy predates actual private discovery | same |
| `docs/adr/056-seo-social.md` | G11 — Desired OG generation absent; domain-not-fixed language dated | same |
| `docs/adr/057-accessibility.md` | G8 — Credibility scores and proposed shadcn/shortcuts are not runtime facts | same |
| `docs/adr/058-performance.md` | G12 — Prisma+Neon/no-custom-font stack and monitoring claims not implemented | same |
| `docs/adr/059-error-handling.md` | C — no material current-boundary contradiction found | same |
| `docs/adr/060-data-export.md` | G13 — Export/restore/merge promises absent and score example conflicts | same |
| `docs/adr/061-competitive-differentiation.md` | C — no material current-boundary contradiction found | same |
| `docs/dogfood-reports/2026-09-17-codex-proper-respect-self-test-20260916-dogfood.md` | H — dated evidence/record; not current release direction | same |
| `docs/dogfood-reports/assets/2026-09-17-card-readability/mobile-after.png` | A — dated screenshot or brand fixture | same |
| `docs/dogfood-reports/assets/2026-09-17-card-readability/mobile-before.png` | A — dated screenshot or brand fixture | same |
| `docs/feedback/2026-09-16-onboarding-browser-comments.md` | H — dated evidence/record; not current release direction | same |
| `docs/feedback/2026-09-18-changing-stacks-browser-comment.md` | H — dated evidence/record; not current release direction | same |
| `docs/feedback/2026-09-18-direct-usage-and-screenshot-context.md` | H — dated evidence/record; not current release direction | same |
| `docs/feedback/2026-09-19-hosted-card-comments.md` | H — dated evidence/record; not current release direction | added |
| `docs/future/007-company-reward-config.md` | P — parked | same |
| `docs/future/010-screen-time-usage.md` | P — parked | same |
| `docs/future/011-company-discovery.md` | P — parked | same |
| `docs/future/017-mobile-app.md` | P — parked | same |
| `docs/future/025-notifications.md` | P — parked | same |
| `docs/future/026-company-page.md` | P — parked | same |
| `docs/future/027-embed-widget.md` | P — parked | same |
| `docs/future/029-analytics-dashboard.md` | P — parked | same |
| `docs/future/030-pricing.md` | P — parked | same |
| `docs/future/031-api.md` | P — parked | same |
| `docs/future/035-props-gesture.md` | P — parked | same |
| `docs/future/038-trending-metric.md` | P — parked | same |
| `docs/future/062-customer-support.md` | P — parked | same |
| `docs/future/063-churn-analysis.md` | P — parked | same |
| `docs/future/README.md` | P — parked | same |
| `docs/ideation/2026-09-16-cadenced-tool-usage-ideation.html` | H — dated evidence/record; not current release direction | same |
| `docs/plans/2026-09-16-multiple-mailboxes-and-native-cards.md` | D7 — Existing plan: current Task 2/4 and continuation gates stale | same |
| `docs/plans/2026-09-16-wispr-product-and-usage-plan.md` | D8 — Existing implemented units still written as work to begin | same |
| `docs/verification/2026-09-17-context-brand-enrichment.md` | H — dated evidence/record; not current release direction | same |
| `docs/verification/2026-09-17-product-delivery-state.md` | X — private operator receipt placeholder | same |
| `docs/verification/2026-09-17-task2-gmail-live-proof.md` | X — private operator receipt placeholder | same |
| `docs/verification/2026-09-17-task2-owner-auth.md` | X — private operator receipt placeholder | same |
| `docs/verification/2026-09-18-development-sync.json` | X — private operator receipt placeholder | same |
| `docs/verification/2026-09-18-development-sync.md` | X — private operator receipt placeholder | same |
| `docs/verification/2026-09-18-hosted-release.md` | H — dated evidence/record; not current release direction | same |
| `docs/verification/2026-09-18-inventory-assets/retained-brands-desktop.png` | A — dated screenshot or brand fixture | same |
| `docs/verification/2026-09-18-inventory-assets/retained-brands-mobile.png` | A — dated screenshot or brand fixture | same |
| `docs/verification/2026-09-18-inventory-assets/retained-wispr-reverse-desktop.png` | A — dated screenshot or brand fixture | same |
| `docs/verification/2026-09-18-inventory-assets/synthetic-inventory-desktop.png` | A — dated screenshot or brand fixture | same |
| `docs/verification/2026-09-18-inventory-assets/synthetic-inventory-mobile.png` | A — dated screenshot or brand fixture | same |
| `docs/verification/2026-09-18-main-consolidation.md` | H — dated evidence/record; not current release direction | same |
| `docs/verification/2026-09-18-personal-product-delivery.json` | X — private operator receipt placeholder | same |
| `docs/verification/2026-09-18-personal-product-delivery.md` | X — private operator receipt placeholder | same |
| `docs/verification/2026-09-18-private-inventory-ce-receipt.json` | X — private operator receipt placeholder | same |
| `docs/verification/2026-09-18-private-inventory.md` | X — private operator receipt placeholder | same |
| `docs/verification/2026-09-19-card-development-sync.md` | H — dated evidence/record; not current release direction | added |
| `docs/verification/2026-09-19-card-feedback.md` | H — dated evidence/record; not current release direction | added |
| `docs/verification/2026-09-19-card-fixtures/2026-09-19-card-details-1280.png` | A — dated screenshot or brand fixture | added |
| `docs/verification/2026-09-19-card-fixtures/2026-09-19-card-front-390.png` | A — dated screenshot or brand fixture | added |
| `docs/verification/2026-09-19-catalog-identities.md` | H — dated evidence/record; not current release direction | added |
| `docs/verification/2026-09-19-discovery-release-candidate.json` | H — dated evidence/record; not current release direction | added |
| `docs/verification/2026-09-19-discovery-release-preparation.md` | H — dated evidence/record; not current release direction | added |
| `docs/verification/2026-09-19-durable-discovery.md` | H — dated evidence/record; not current release direction | added |
| `docs/verification/2026-09-19-export-uploads.md` | H — dated evidence/record; not current release direction | added |
| `docs/verification/2026-09-19-github-card-destination.md` | H — dated evidence/record; not current release direction | added |
| `docs/verification/2026-09-19-github-native-session.md` | H — dated evidence/record; not current release direction | added |
| `docs/verification/2026-09-19-handle-restoration.md` | H — dated evidence/record; not current release direction | added |
| `docs/verification/2026-09-19-hosted-discovery-gap.md` | H — dated evidence/record; not current release direction | added |
| `docs/verification/2026-09-19-hosted-discovery-proof.md` | H — dated evidence/record; not current release direction | added |
| `docs/verification/2026-09-19-hosted-gmail-release.md` | H — dated evidence/record; not current release direction | added |
| `docs/verification/2026-09-19-hosted-release.md` | H — dated evidence/record; not current release direction | added |
| `docs/verification/2026-09-19-membership-production-release.md` | H — dated evidence/record; not current release direction | added |
| `docs/verification/2026-09-19-membership-release-candidate.json` | H — dated evidence/record; not current release direction | added |
| `docs/verification/2026-09-19-mobile-record-selector.md` | H — dated evidence/record; not current release direction | added |
| `docs/verification/2026-09-19-product-asset-sources.md` | H — dated evidence/record; not current release direction | added |
| `docs/verification/2026-09-19-profile-development-sync.md` | H — dated evidence/record; not current release direction | added |
| `docs/verification/2026-09-19-profile-production-release.md` | H — dated evidence/record; not current release direction | added |
| `docs/verification/2026-09-19-profile-release-candidate.json` | H — dated evidence/record; not current release direction | added |
| `docs/verification/2026-09-19-public-profile-readiness.md` | D9 — Rolling readiness begins with old release and outdated empty-target claims | added |
| `docs/verification/2026-09-19-publication-membership.md` | H — dated evidence/record; not current release direction | added |
| `docs/verification/2026-09-19-release-reconciliation.md` | H — dated evidence/record; not current release direction | added |
| `docs/verification/2026-09-19-retained-mailbox-recheck.md` | H — dated evidence/record; not current release direction | added |
| `docs/verification/2026-09-19-retained-recheck-production.md` | H — dated evidence/record; not current release direction | added |
| `docs/verification/2026-09-19-retained-recheck-release-candidate.json` | H — dated evidence/record; not current release direction | added |
| `docs/verification/2026-09-19-retained-recheck-runtime-boundary.md` | H — dated evidence/record; not current release direction | added |
| `docs/verification/assets/2026-09-17-context-brands/desktop.png` | A — dated screenshot or brand fixture | same |
| `docs/verification/assets/2026-09-17-context-brands/mobile.png` | A — dated screenshot or brand fixture | same |
| `docs/verification/assets/2026-09-17-context-brands/wispr-keyboard-focus.png` | A — dated screenshot or brand fixture | same |
| `docs/verification/assets/2026-09-17-context-brands/wispr-provenance-mobile.png` | A — dated screenshot or brand fixture | same |
| `docs/verification/fixtures/2026-09-17-context-brands/github.json` | A — dated screenshot or brand fixture | same |
| `docs/verification/fixtures/2026-09-17-context-brands/wisprflow.json` | A — dated screenshot or brand fixture | same |

## Evidence limits and stop boundary

No hosted sign-in, second user, source consent, 30-day refresh, publication, DNS
mutation, account deletion, or data transfer was exercised. No visual inspection
was used to reinterpret dated PNG fixtures as today's app. The doc inventory and
exact source paths, not descriptions in old receipts, establish what exists.
No repository file was changed. Phase0 should be reviewed before later phases;
this report supplies discrepancies and capability gaps only, not a replacement
architecture or execution program.

Audit UTC: 2026-09-20T02:18:53.242128+00:00

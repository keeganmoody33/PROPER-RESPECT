# Minimal onboarding query candidate — 2026-09-23

Status: prepared locally for independent exact-head review; not deployed.

Base: `101b019a5212b2e82871604d17c6e0ebaf557983`, supplied as the current released frontend source. Branch: `codex/onboarding-query-candidate-20260923`. The candidate commit is the commit containing this receipt; resolve it with `git rev-parse HEAD`. This source identity does not attest the deployed Convex backend.

## Exact assembly

This candidate extracts already-merged PR54 behavior from `503847b22cc24d42f7827de11d98de9115c75c14`; it is not a new main-branch feature or a whole-main release. The U14 baseline `86d47ec7ba1c98da9c2ab362e5264a2887c791d2` and this base have no Convex or package/lockfile drift. Their nine-path difference is the released creator attribution/metadata slice.

Applied the unchanged three-hunk `/tmp/u14-pr54-query-only.patch` after checking SHA-256 `5d4d13f5d0796f702c9498e976e864914e7416b7bf43187faa90d0754293dbb6` and clean applicability. Runtime stable patch ID: `8b41d56ef400161880f6234402df41492a9dbb6c`.

Changed-file allowlist:

- `convex/onboarding.ts`: only getState queries the authenticated user's site through existing sites.by_owner and returns hasClaimedPublicIdentity when that site's handle equals the user's current handle.
- `convex/evidenceUpload.test.ts`: copied exactly from PR54; SHA-256 `56fc1f739fbebb82b5c1701688237087263676cf2f9c1556fa59263187014c86`.
- This dated receipt.

An exact prefix/suffix comparison confirms all onboarding.ts bytes outside getState remain unchanged. Connector, cron, schema, auth, generated bindings, frontend and dependency files are unchanged from the supplied frontend base. No alias reservations or migration table references were copied from main.

## Behavior and verification

The boolean describes a claimed identity, independently of upload status, handle prefix or publication. The query binds site lookup to the authenticated owner's user ID. No owned site, another owner's same-named site, or a mismatched owned-site handle produces false. An explicitly claimed pending-prefixed handle produces true while publication remains false. The query performs no mutation, provider acquisition or publication.

Executed locally with existing linked dependencies and synthetic Convex fixtures:

1. Copied the PR54 regression before patching runtime; `./node_modules/.bin/vitest run convex/evidenceUpload.test.ts` reproduced RED: 9 passed, 1 failed because hasClaimedPublicIdentity was absent. Log `/tmp/u17-red.log`.
2. Applied only the verified query patch. `./node_modules/.bin/vitest run convex/evidenceUpload.test.ts convex/publicationHandles.test.ts convex/ownerAuth.test.ts convex/accountEvidencePage.test.ts`: 37 passed. Log `/tmp/u17-focused.log`.
3. `npm test`: 818 Vitest tests passed, 2 skipped; 7 Node script tests passed. The skipped tests require separately supplied retained real mailbox/original evidence and were not enabled. Log `/tmp/u17-full-tests.log`.
4. `npm run lint` and `npm run typecheck`: both passed. Logs `/tmp/u17-lint.log`, `/tmp/u17-typecheck.log`.
5. `git diff --check`, exact test-file hash comparison, runtime patch-ID comparison and changed-file allowlist: passed.

The retained-upload regression uses real ensureAccount, retainUpload, claimHandle and getState functions inside convex-test. It covers missing identity before and after upload, another owner's site, explicit claim with a pending prefix, no automatic publication and mismatched handle. Existing ownerAuth cases verify unauthenticated rejection and separate subject-to-user binding. No hosted account was read or created.

PStack scoped comment review: no added comments or suppressions; proposed deletions 0, restored 0, no MUST KILL flags. Pre-existing comments remain untouched. No additional architecture/encoding changes or nested reviewer were claimed; independent review is assigned separately by the root.

## Release gates and limitations

sites.by_owner is an existing nonunique index; `.unique()` enforces a runtime invariant of at most one site per owner and throws on duplicate rows. This candidate intentionally does not select an arbitrary site or repair duplicates. Synthetic passing cases do not attest the actual target's duplicate-owner invariant.

Convex synchronization deploys the selected project bundle, not just this function. Before any synchronization, a separately authorized operator must establish the actual backend target/version and reconcile the full candidate bundle against it, so older baseline files do not overwrite unrelated deployed fixes. A frontend SHA alone cannot establish backend state. Exact candidate/target approval is still required. No Convex CLI deploy/check/env/config, authenticated request, backend version inspection or account read was performed.

No PR, push, merge, deployment, schema/index change, owner migration, provider capture, seed, recurrence change or publication is included. Existing cron and connector source remains unchanged; no runtime subscription state is inferred. After an approved backend release, the separately prepared fresh-user frontend must be released in order and hosted acceptance must still cover fresh login, two-user isolation, reconnect/revocation, exact sharing preview and existing owner preservation. The user journey is not declared production-ready by these synthetic checks.

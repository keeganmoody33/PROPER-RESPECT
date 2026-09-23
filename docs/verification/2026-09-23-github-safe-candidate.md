# Selective GitHub candidate with guarded refresh

Date: 2026-09-23. Candidate preparation only. No deployment or production read occurred.

This candidate adds the already-merged PR64 refresh safeguards to the reviewed combined GitHub and onboarding candidate. It preserves the released onboarding implementation and excludes the profile migration. Independent exact-head review and offline bundle verification remain the coordinator's next checks.

## Source assembly

- Base candidate: `c9923dab307074cc0499224028d85e7c1c46cd7a`.
- Accepted backend source: `082e90cf21a37ff1e95fbcdd26d50b430ea4a62e`.
- PR64 merge: `4566f17f85fbe5b6eab4545f1c9f8eb1d7be41d0`.
- Compared main: `a87e97910f2d88d71ec9b806d1391166bb34d69d`.
- Branch: `codex/github-safe-candidate-20260923`.

`git cherry-pick --no-commit 4566f17f85fbe5b6eab4545f1c9f8eb1d7be41d0` applied cleanly. No conflict resolution or code adjustment was required. Its five files match main exactly. The only additional file is this receipt.

The five upstream paths are `convex/connectors.ts`, `convex/connectorPrivacy.test.ts`, `convex/githubRefreshSafety.test.ts`, `convex/publication.test.ts`, and `docs/verification/2026-09-23-github-refresh-safety.md`. The inherited PR64 receipt describes its original review and tests; this receipt records the selective candidate checks.

Every other existing tracked file remains identical to the base candidate. Schema, auth, indexes, cron schedule, HTTP routes, generated bindings, frontend, dependencies, and configuration are unchanged. `convex/onboarding.ts` remains blob `ffb230fcccccf3133c16c8e9394bc6c788b1666b`, identical to the accepted backend. PR52 migration and PR65 documentation changes were not added.

Compared with the accepted backend, backend runtime changes are confined to `convex/connectors.ts` and the added `src/server/github-activity.ts`. Seven changed or added backend/provider test files cover those changes. The full repository also retains the frontend and documentation differences already present in the base candidate; this is a selective backend candidate, not a proposed frontend release.

## Local verification

The isolated checkout used the existing installed dependency directory through a symlink. No private inputs or environment files were copied. Commands received a cleared environment with only PATH and TMPDIR. All results are local synthetic checks.

- `npm test` passed 973 Vitest tests across 80 files. Two optional private-input tests were skipped. Seven Node script tests passed.
- The focused command below passed 250 tests across 14 files.
- `npm run lint`, `npm run typecheck`, and `git diff --check` passed.
- Exact Git blob comparisons proved the five upstream files match main and the excluded files remain unchanged.

```sh
node node_modules/vitest/vitest.mjs run convex/githubRefreshSafety.test.ts src/server/github-activity.test.ts convex/githubProviderBoundary.test.ts convex/githubCaptureIntegrity.test.ts convex/evidenceClaims.test.ts convex/connectorPrivacy.test.ts src/server/github-route.test.ts convex/ownerAuth.test.ts convex/publicationHandles.test.ts convex/manualProducts.test.ts src/domain/onboarding.test.ts src/client/onboarding-auth.test.ts convex/evidenceUpload.test.ts convex/publication.test.ts
```

The focused tests exercise the actual Convex action, query, mutation, and publication paths with synthetic identities, credentials, and mocked provider responses. They cover eligibility before acquisition, account mismatch, rotated credentials, stale owner changes, duplicate and concurrent completions, source chronology, private evidence preservation, revocation, and onboarding ownership. No new tests or runtime behavior were authored for this integration.

Local logs and source comparisons are retained under `/tmp/u37-safe-candidate-evidence-20260923`. The immutable candidate SHA, tree, stable patch ID, and artifact hashes are recorded in `/tmp/u37-safe-candidate-report.md` after commit. The frontend build was not repeated because this integration changes no frontend code. No deployment command, dry-run, codegen, or backend bundle command was executed by the author.

## Remaining release boundaries

This receipt does not authorize backend synchronization, live provider reads, recurrence, publication, profile migration, or frontend deployment. Current production drift and row compatibility were not inspected. The separately proposed counts-only aggregate remains unexecuted and does not establish action quiescence. Backend synchronization and provider, recurrence, and publication effects remain HOLD. No automatic consent migration or account enrollment is included.

The PR64 limitations remain. Concurrent admitted HTTP requests can still occur. Revocation cannot recall an already-issued request, but stale completion writes are rejected. Current account equality does not reconstruct historical approval-account identity. Canonical timestamps and valid approved public calendars are required; malformed legacy rows fail closed. Existing scheduler scans and recurrence policy are unchanged.

No claim of real GitHub usage visibility, fresh hosted login, two-user hosted isolation, or Ora improvement follows from these local checks.

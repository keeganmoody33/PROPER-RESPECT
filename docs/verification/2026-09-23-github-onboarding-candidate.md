# GitHub hardening on the released onboarding base

Date: 2026-09-23. Offline source candidate; not a backend deployment or provider-capture approval.

Branch: `codex/github-onboarding-candidate-20260923`. Worktree: `/tmp/proper-respect-github-onboarding-candidate-20260923`.

Base frontend source: `5aa32e6ad1cc6729fd620fa30ba3b98444a0d670`. Released backend source: `082e90cf21a37ff1e95fbcdd26d50b430ea4a62e`. The supplied release receipt records production `striped-chicken-693`, project `lecturesfrom/proper-respect`; this offline assembly made no fresh production query.

## Exact scope and preservation proof

This candidate copies only these six reviewed source/test files from `2b4edb908a63f099675f65246906a94abaf44718`:

- `convex/connectors.ts`
- `src/server/github-activity.ts`
- `convex/githubCaptureIntegrity.test.ts`
- `convex/githubProviderBoundary.test.ts`
- `src/server/github-activity.test.ts`
- `convex/evidenceClaims.test.ts`

All six match that reviewed candidate and merged main `8298bda8406601ddde8279aee12d080dcbfaf616` byte-for-byte. No new product logic is introduced. The only additional change is this dated receipt; the older candidate receipt was not copied.

All 62 tracked files under `convex/` in the frontend base match the released backend source exactly. The candidate preserves every tracked byte outside the six-file allowlist and this receipt, including the released owner-bound onboarding identity query and its tests. The retained onboarding blob is `ffb230fcccccf3133c16c8e9394bc6c788b1666b`. Schema, authentication, HTTP handlers, crons, generated bindings, lockfile, package manifest, frontend, configuration and assets remain unchanged from the base.

The recursive static relative-import/export closure of the two changed runtime files resolves to 24 files, including type-only dependencies. Every unchanged file in that closure also matches the released backend source. The provider helper is the only new runtime module. Existing package imports use the unchanged manifest and lockfile. This source closure is not a compiled-module fingerprint comparison; the complete Convex bundle requires independent offline review before any release proposal.

Reproducible object/closure proof: `/tmp/u26-source-proof.py` and `/tmp/u26-source-closure.json`. The checker explicitly handles TypeScript resolution of `.js` imports to `.ts`/`.d.ts`; its initial missing-extension-resolution assertion was corrected before the passing proof. No application code changed in response.

## Executed verification

- `npx --no-install vitest run src/server/github-activity.test.ts convex/githubProviderBoundary.test.ts convex/githubCaptureIntegrity.test.ts convex/evidenceClaims.test.ts convex/connectorPrivacy.test.ts src/server/github-route.test.ts convex/ownerAuth.test.ts convex/publicationHandles.test.ts convex/manualProducts.test.ts src/domain/onboarding.test.ts src/client/onboarding-auth.test.ts`: 190 passed across 11 files. `/tmp/u26-focused.log`.
- `npx --no-install vitest run convex/evidenceUpload.test.ts`: 10 passed, including the released owner-bound `hasClaimedPublicIdentity` checks. `/tmp/u26-onboarding-focused.log`.
- `npm test`: 940 passed and two optional private-input tests skipped across 79 passed and two skipped Vitest files; all seven Node script tests passed. `/tmp/u26-full-test.log`.
- `npm run lint`: passed. `/tmp/u26-lint.log`.
- `npm run typecheck`: passed. `/tmp/u26-typecheck.log`.
- `PUBLIC_SITE_ORIGIN=https://proper-respect.com PROPER_RESPECT_E2E_REFERENCE=1 NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY= CLERK_SECRET_KEY= NEXT_PUBLIC_CONVEX_URL= npm run build -- --webpack`: passed, using synthetic fixtures and blank Clerk/Convex credentials. `/tmp/u26-build.log`.
- `git diff --check`: passed.

These tests exercise real Convex action/mutation code with synthetic provider responses and in-memory fixtures: account ownership, zero/one/multiple relationship routing, replay/conflict protection, private evidence retention, exact-publication separation, response bounds and deadline cleanup. Existing onboarding identity behavior remains tested. No browser, fresh hosted signup, real-account isolation, actual usage acquisition or live capture success is claimed.

## Release boundaries

The older standalone GitHub candidate must not be deployed: it predates the now-live onboarding query. This combined candidate preserves that query at source level. Convex synchronization still deploys complete functions and schema; a six-file Git delta is not a partial-function release mechanism.

The unchanged cron invokes `connectors.refreshApproved` daily at 06:00 UTC. After synchronization, existing approved subscriptions could execute the changed provider reader, make genuine provider reads, update approved public activity or record ERROR/STALE through existing bookkeeping. Unchanged cron bytes do not mean unchanged runtime effects. The actual target, deployed bundle, approved subscriptions, scheduled work and treatment of the next refresh must be established under separate authorization before synchronization.

No production/account/provider data, environment secrets or credentials were read. No Convex deploy, dry-run, code generation, schema/auth/DNS change, seed, migration, publication, recurrence change, push or PR occurred. Original owner records and publication choices were not accessed or changed. Backend synchronization and real provider capture remain separately gated; hosted acceptance stays open.

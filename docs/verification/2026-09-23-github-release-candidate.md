# GitHub hardening candidate

Date: 2026-09-23. Branch: `codex/github-release-candidate-20260923`. Candidate base: current live frontend source `77f22d551218189dbb3ae366a4709f3b9a5ce599`.

This offline candidate adds only the coherent PR58 and PR60 GitHub hardening slice to the supplied live source. It is not a deployed-backend fingerprint or synchronization approval. All six copied source/test files match merged PR60 `144602e` and current main `8298bda8406601ddde8279aee12d080dcbfaf616` byte-for-byte. PR58's merged contribution is `724216e`; PR60 includes its connector retention logic. No new application logic was invented during assembly.

## Exact source scope

| File | Role |
| --- | --- |
| `convex/connectors.ts` | Existing GitHub actions use the bounded provider reader and validated account-specific retention/replay routing. |
| `src/server/github-activity.ts` | Validate source JSON counts without losing lexical precision; bound bytes, shape and total lifetime before returning normalized activity. |
| `convex/githubCaptureIntegrity.test.ts` | Real mutation routing for zero/one/multiple relationships, account identity, replay, conflict, legacy duplicates, discovery/attachment and publication separation. |
| `convex/githubProviderBoundary.test.ts` | Real action tests with synthetic fetch, invalid connect preservation and existing approved-refresh failure bookkeeping. |
| `src/server/github-activity.test.ts` | Provider shape, numeric fidelity, response limits, deadline and cleanup regressions. |
| `convex/evidenceClaims.test.ts` | Existing assertions adapted to account-partitioned snapshot identity. |

The only other changed file is this receipt. Schema, indexes, authentication, HTTP handlers, onboarding, public-profile readers, migrations, crons, generated bindings, dependency manifests/lockfiles, configuration, frontend and retained assets remain byte-identical to the supplied live base. PR52 aliases and PR54 owner identity capability are excluded. The existing Devin provider implementation is byte-identical to the base.

## Data and call boundaries

The provider adapter accepts an existing server-side token and returns `{accountLabel, activity, value}` after validating the raw source body. Contribution counts must be exact nonnegative safe integers, including their original JSON numeric spelling. Returned calendars have bounded shape and unique dates. Coverage inconsistencies remain explicit caveats. The 128-KiB actual-byte limit and one ten-second total deadline cover acquisition and body reads; malformed input yields a fixed bounded error. Tokens and provider text are not echoed in errors.

The authenticated `connectGithub` action uses the identity subject and validates the provider result before encryption or the internal retention mutation. `retainGithubSnapshot` validates normalized product/account/metric identity, then partitions the capture key by owner, normalized account and capture time. Replays compare retained source, provenance, payload, observations and activity. Conflicts or ambiguous legacy records fail without choosing or overwriting one arbitrarily.

With no existing owner relationship, retention creates a private draft. With one relationship, the snapshot becomes private supporting evidence without overwriting the owner's relationship or published card. With multiple relationships, it remains an unresolved private discovery for owner review. Source capture, owner association, private save and publication remain separate operations. The route accepts no client-provided owner ID. The existing Devin branch is preserved.

Runtime import checks resolved every relative import of the two changed runtime files. All resolved modules other than the intended new helper are byte-identical to the live base, including domain validation/canonical JSON, owner authentication, publication helpers, brand handling and generated bindings. Zod and Convex are existing pinned dependencies. Typechecking and the focused action/mutation tests exercised this closure. No Convex code generation, CLI deployment or synchronization was run.

## Verification actually run

- RED: copied capture-integrity tests against the unchanged live-base connector yielded 24 failed and four passed tests. Log `/tmp/u21-red-capture.log`.
- `npx vitest run src/server/github-activity.test.ts convex/githubProviderBoundary.test.ts convex/githubCaptureIntegrity.test.ts convex/evidenceClaims.test.ts convex/connectorPrivacy.test.ts src/server/github-route.test.ts`: 135 passed across six files. Log `/tmp/u21-focused.log`.
- `npm test`: 938 passed, two skipped across 79 passed and two skipped Vitest files; all seven Node script tests passed. Log `/tmp/u21-full-test.log`. The skipped tests require optional private retained-evidence inputs that were not supplied or read.
- `npm run typecheck`: passed. Log `/tmp/u21-typecheck.log`.
- `npm run lint`: passed. Log `/tmp/u21-lint.log`.
- Production webpack build used only synthetic fixture configuration and blank Clerk/Convex credentials: `PUBLIC_SITE_ORIGIN=https://proper-respect.com PROPER_RESPECT_E2E_REFERENCE=1 NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY= CLERK_SECRET_KEY= NEXT_PUBLIC_CONVEX_URL= npm run build -- --webpack`. Build passed; log `/tmp/u21-build.log`.
- `git diff --check`: passed. `/tmp/u21-source-closure.json` retains exact blob identities and the resolved import proof.

No browser retest is claimed for this backend-only delta. Passing local tests do not establish a hosted Convex runtime, current deployment target, genuine provider capture, account isolation across real sessions or owner acceptance.

## Synchronization and capture remain separate gates

The unchanged cron invokes `connectors.refreshApproved` daily at 06:00 UTC. Existing approved subscriptions could invoke the new provider adapter after synchronization, make provider reads, update approved public activity, or record ERROR/STALE on failure through existing bookkeeping. This release is not operationally inert merely because `crons.ts` is unchanged. The target's actual deployed baseline, active subscriptions and scheduled work must be established under the coordinator's separate authorization before any sync decision.

Convex deployment bundles complete functions and schema. The six-file allowlist describes the Git delta, not a partial-function deployment mechanism. A frontend Git baseline does not prove deployed backend bytes. An independently verified backend manifest and exact target approval are required before this candidate could be synchronized. Do not overwrite unrelated deployed changes by assuming equality.

A genuine GitHub capture remains separately authorized and unperformed. No provider/account data, credentials, subscriptions or deployment configuration were read. No backend synchronization, migration, seed, publication, recurrence change, push or PR occurred. The candidate awaits independent exact-head review and the coordinator's release decision. Rolling back to the older arbitrary-selection/append behavior could reintroduce replay duplication; preserve new retained records and prefer a compatible forward correction if a later issue is found.

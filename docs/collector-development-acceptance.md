# Collector development acceptance

The October 6 implementation is a local development milestone. Its SQLite
receiver, companion and browser tests use synthetic sources. It supplies no live
Convex adapter or Clerk-authenticated collector connection. A real Mac connection
remains the acceptance bar.

## Configuration needed before live work

The October 6 runtime inspection found none of the following settings. Required
names have since been declared in the cloud draft; saving requirements supplies
no values and verifies no target. Enter values in secure environment settings,
never in chat, tracked files, logs or fixture scripts.

| Name | Location and purpose |
| --- | --- |
| `CONVEX_DEPLOYMENT` | Cloud development environment; identifies the existing development deployment. |
| `NEXT_PUBLIC_CONVEX_URL` | Cloud development environment; client URL for that same deployment. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Cloud development environment; matching Clerk development instance. |
| `CLERK_SECRET_KEY` | Secure cloud development environment; server credential for that Clerk development instance. |
| `CLERK_FRONTEND_API_URL` | The development Convex deployment's environment; issuer for the matching Clerk instance. |
| `CONVEX_DEPLOY_KEY` | Optional, development-scoped tooling credential if applying backend changes requires it. |

`CLERK_JWT_ISSUER_DOMAIN` is the existing compatibility alternative to
`CLERK_FRONTEND_API_URL`. New configuration should use the latter. Clerk's JWT
template must use the `convex` application ID expected by `convex/auth.config.ts`.
`PUBLIC_SITE_ORIGIN` must identify the eventual development frontend for its
existing sharing checks; the local fixture uses no public publication target.

Verify the actual Convex project, deployment name and development type through
authorized deployment metadata. Check that the configured URL and any scoped
tooling credential target that deployment. Verify that Clerk's development keys,
issuer and Convex JWT template belong to the same instance. Existing
`npm run deploy:check` checks several configuration relationships without printing
values; it does not prove the new collector is authenticated or functional.
Stop live work if the target is absent, production, ambiguous or mismatched.

The existing `CONNECTOR_ENCRYPTION_KEY` protects other connector credentials.
This fixture does not use it and must not rotate it. Its SQLite stores rely on
private file permissions; they do not claim encryption at rest.

## Run the independent checks

Use Node 24 and a C compiler. No account, provider token, deployment or network
upload is needed.

```sh
TMPDIR=/var/tmp npm test
npm run lint
npm run typecheck
PUBLIC_SITE_ORIGIN=https://public.example PROPER_RESPECT_E2E_REFERENCE=1 npm run build
TMPDIR=/var/tmp PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium \
  npx playwright test --config tests/collector-browser/playwright.config.ts
```

On a Mac, omit the Linux Chromium override and use Playwright's installed browser.
Run the native boundary, accounting and CLI suites on the exact reviewed commit:

```sh
npx vitest run src/local/codex-rollout-native.test.ts \
  src/local/codex-rollout-history.test.ts tests/support/codex-history-cli.test.ts
```

The prepared macOS workflow retains platform/compiler/JUnit evidence. Its presence
does not establish a Darwin pass. Review the native source and
[acquisition contract](codex-macos-acquisition.md) before any real local read.
The preview command outputs only numeric review JSON; do not attach real output
to a public PR or screenshot.

## Remaining live acceptance

After target verification, implement and test the authenticated Convex receiver
against the same shared grant, numeric review, chunk and receipt rules. The
SQLite receiver is a reference for local tests, not a hosted storage adapter.

On the approved Mac, name each selected source, device, personal/work context
and history window. Review the local mixed-file access before collecting. A
current login cannot verify historical account identity. Keep every result
private until the owner selects specific measurements for publication.

Record the reviewed commit, collector/OS versions, confirmed development target
identity and consent scope. Demonstrate backfill against approved real files,
unchanged replay, a new usage update, a stopped and restarted companion, receiver
outage recovery, expiry and owner revocation. Verify accepted private results
and retained history after disconnect. Finally exercise the existing authenticated
publication flow with explicit field selection and inspect the resulting public
snapshot for excluded private fields.

The current grant covers one window of at most seven days. Broad historical
backfill and rolling updates need an explicit multi-window consent model. Other
remaining limits include ignored compressed Codex files, scan bounds, excluded
legacy fork ranges, unverified historical identity, unverified Cursor dashboard
CSV compatibility, signed Mac packaging, a filesystem picker, OS-managed
recurrence, hosted quotas/retention policy and the live publication connection.
Portable tool history and agent-accessible operations remain the broader goal.
Optional owner referral links and props must stay outside measurement and
presentation decisions.

# Codex connection prototype verification

Base commit: `51e5224f60fafb141029235fceeb41fa101d701e`.
Branch: `prototype/codex-connection`. Fixture-only cloud workspace, October 6.
No real provider reads, private session/auth files, Mac access, hosted changes,
GitHub publication, merge or deployment are part of this verification.

## Independent review dispositions

- Fix now: a null cumulative observation interrupted the delta baseline but also
  erased the earlier monotonicity evidence. The regression `100, 150, null, 80,
  120` incorrectly produced 90 known increases. Keep the last known value for
  decrease detection while still starting a fresh delta baseline after unknown.
  The reviewer reproduced this with a RED test before implementation changes.

- Fix now: the collector normalized permissive Date.parse results before strict
  source validation. Invalid September 31 and timezone-less source strings could
  become apparently valid UTC observations. The reviewer added two RED tests.
  Validate the original source datetime before normalization.

## Checks

Passed:

- 40 focused tests across connection lifecycle, history reconciliation, Codex
  fixture parsing and independent review regressions.
- 122 existing Node script tests.
- Repository-wide ESLint and TypeScript checks.
- Production build with synthetic PUBLIC_SITE_ORIGIN=https://public.example and
  blank Clerk/Convex credentials. The initial unconfigured build correctly
  rejected missing PUBLIC_SITE_ORIGIN; the configured build passed.
- Static preview generation; exclusive output-directory behavior prevents
  overwriting a prior preview. Only index.html, preview.js and styles.css are
  produced, with network connections disabled by CSP.
- Local diff whitespace check.

Full Vitest is not green in this workspace. The controlled two-worker run
reported 1,896 passing, 50 failing and 2 skipped tests across 134 files. All 50
failures come from three existing native-capture/retained-evidence suites whose
outside-Git guard sees the sandbox's synthetic /tmp/.git directory. Running
those three suites against a clean archive of base 51e5224 reproduced the same
50 failures. No guard was weakened. The initial higher-concurrency run also had
two mailbox timing failures; both pass in the controlled run and on clean base.

Browser execution is blocked, not passed. Eight desktop/mobile tests are
prepared. Chromium aborts before loading a page with a local socket error, also
on the allowed escalation attempt. The supported cloud browser separately
rejected loopback navigation with ERR_BLOCKED_BY_CLIENT. No alternate host,
file URL or permission workaround was used. No screenshots or accessibility
pass are claimed. The UI's idle-expiry timer was added after review and passed
lint/typecheck/static build; its visible behavior awaits a permitted browser.

## Re-run

```sh
npx vitest run src/domain/connection-history.test.ts src/local/usage-connection.test.ts src/local/codex-history-collector.test.ts src/local/codex-connection-review.test.ts
npm run lint
npm run typecheck
PUBLIC_SITE_ORIGIN=https://public.example npm run build
PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium npx playwright test -c playwright.codex-connection.config.ts
```

The last command needs an environment that permits the fixture server and
browser startup. The fixture browser tests do not require provider accounts,
credentials or backend access.

## Acceptance boundary

The core synthetic flow is verified, including 150 -> 150 on replay -> 200
with new observations and retained history after disconnect. A genuine Codex
connection, complete historical coverage, account attribution, cross-device
deduplication, hosted storage, grants and production readiness are unproved.
Existing native startup/account-selection blockers remain unchanged.

At the initial local-artifact checkpoint, no source branch had been pushed and
no PR had been opened. The later owner-approved draft PR runs the eight isolated
browser tests in the `Synthetic Codex connection` CI job and retains its
screenshots/traces as `codex-connection-browser-proof`. CI results belong to
the PR's exact head. No merge, deployment or live-provider access is authorized.

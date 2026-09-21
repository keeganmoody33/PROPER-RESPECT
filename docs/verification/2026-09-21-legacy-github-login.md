# Legacy GitHub login validation — September 21, 2026 UTC

Base: `bb108413d937abb9082f88fd3ded3e168f93e574`.
Verified implementation: `987aff07cb0e49025c36259f702f3714bfccfec2`.
Issue #24 finding: PR #16 discussion r3650427917.

## Disposition

Confirmed: internal-only `discovery.syncGithub` interpolated unvalidated input into a fixed GitHub API path. Repository search found no callers beyond the definition (generated API references expose the module); absence of local callers does not prove there are no external operator invocations. Preserve the action and reject malformed login input before fetching or ingestion. This is path validation, not a claim of externally exploitable SSRF or complete GitHub account-existence validation.

Accepted input is 1–39 ASCII letters/digits with optional internal hyphens. No leading/trailing hyphen, whitespace, URL syntax, path delimiter, query, fragment or percent encoding. The whitespace check also rejects terminal newlines despite JavaScript dollar-anchor behavior. Accepted input is preserved, not silently normalized. No changes to owner selection, ingestion, response handling or publication.

## Verification

- RED: `npx vitest run convex/discoveryGithub.test.ts` — 13 malformed-input cases failed; three valid-input cases passed.
- GREEN: `npm test` — 654 Vitest passes, two optional skips, seven Node script tests pass.
- `npm run lint`, `npm run typecheck`, `git diff --check` — pass.
- Build passed with existing CI synthetic configuration: `PUBLIC_SITE_ORIGIN=https://public.example NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk NEXT_TELEMETRY_DISABLED=1 npm run build`.
- `npx playwright test --config tests/e2e/components.config.ts` — 18 passed.
- `npx playwright test tests/e2e/public-metadata.spec.ts` — four passed.

Tests invoke the actual internal Convex action through convex-test; HTTP is stubbed. Invalid input produces the validation error with no fetch or source insertion. Valid input uses the fixed-host endpoint and retains its account label through actual ingestion. No live GitHub request or owner evidence read occurred. Raw temporary local logs: `/tmp/proper-respect-login-{red,tests,build,browser,metadata}.log`.

## Release boundary

Isolated branch off main, excluding PR #28, #30 and #31. This is source preparation only. No backend synchronization, deployment, OAuth/Clerk configuration, provider read or publication. Owner review/merge required. Hosted acceptance and other issue #24 items remain open.

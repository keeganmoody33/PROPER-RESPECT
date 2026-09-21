# Vendor-name suffix boundary — September 21, 2026 UTC

Source base: `bb108413d937abb9082f88fd3ded3e168f93e574`.
Verified implementation: `0983f6cd0e8a74b1ebd9f84fead5f3fed47a487e`.
Finding: issue #24, vendor normalization, originating from PR #16 discussion r3650427800.

## Disposition

Confirmed and corrected. `normalizeVendorName("Cisco")` returned `cis` because the corporate suffix expression accepted `co` inside a word. Require a word boundary before the suffix. Cisco, Fresco, Bronco and Zinc retain their names; separate Inc, LLC, Ltd, Corp and Co suffixes still normalize away. No identity migration or stored-record rewrite is performed. Existing malformed stored identities, if any, are not repaired by this pure-function change.

## Verification

- RED: `npx vitest run src/domain/discovery.test.ts` — four new name-preservation cases failed, 25 passed. Actual values: cis, fres, bron and z.
- GREEN: `npm test` — 647 Vitest passes, two optional skips, seven Node script checks pass.
- `npm run lint` and `npm run typecheck` — pass.
- Initial `npm run build` correctly rejected missing `PUBLIC_SITE_ORIGIN` in the fresh checkout. Rerun with the existing CI synthetic environment passed: `PUBLIC_SITE_ORIGIN=https://public.example NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk NEXT_TELEMETRY_DISABLED=1 npm run build`.
- `npx playwright test --config tests/e2e/components.config.ts` — 18 passed.
- `npx playwright test tests/e2e/public-metadata.spec.ts` — four passed.
- `git diff --check` — pass.

Raw local logs: `/tmp/proper-respect-vendor-{red,tests,build,build-ci,browser,metadata}.log`; temporary and machine-local. No screenshots are required because this patch has no visual change. Browser fixtures do not prove authenticated hosted acceptance.

## Boundaries

Separate branch off current main; PR #28 and PR #30 work is excluded and preserved. No schema, Clerk, OAuth, DNS, Vercel, backend synchronization, provider reads, owner data, publication or deployment change. Owner review/merge remains required. Read-budget and other issue #24 items remain open.

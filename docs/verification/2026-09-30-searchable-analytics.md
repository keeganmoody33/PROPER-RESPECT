# Searchable Analytics verification

Date: 2026-09-30 (America/New_York).
Branch: `codex/searchable-analytics-20260930`.
Inspected base: `3e6d6527546cc3ebdaf2fb2030c12864f140736a`.
Ref: https://plan.ref.tools/2SyTyXF107jAuSna

Owner request: “feel free to just do it for me”, following the supplied
Searchable installation screenshot for `proper-respect.com`.

## Implementation

The root head includes the supplied bootstrap and deferred tracker only when
`VERCEL_ENV=production`. The browser-visible site token is taken from the
owner's screenshot. The existing theme bootstrap remains in place.
The report-only CSP permits the tracker origin for scripts and connections.
The privacy page discloses analytics and browser storage, dated September 30.

The tracker fetched from https://tracker.searchableanalytics.com/s.js on this
date identifies version `7507b5e9218c2e8243834ad1e48204b10ebad60a` and reads
`cookieEnabled: "false" !== o.cookie`. The installation explicitly sets
`data-cookie="false"`; local/session storage can still be used.

## Verification

Commands used Node 24.21.0 through `npx --yes --package=node@24 node`.

- RED: `node_modules/vitest/vitest.mjs run src/server/security-headers.test.ts`
  failed on the new Searchable origin assertion (20 passed, 1 failed).
- GREEN: full Vitest suite — 115 files passed, 2 skipped; 1,672 tests passed,
  2 skipped.
- Node script suite — 121 passed, 0 failed.
- Full ESLint and `tsc --noEmit` passed.
- Next production build passed with synthetic Clerk/Convex configuration,
  `PUBLIC_SITE_ORIGIN=https://proper-respect.com` and `VERCEL_ENV=production`.
  An initial build without PUBLIC_SITE_ORIGIN correctly failed that prerequisite.
- Headless Chromium loaded the generated production homepage HTML and the
  fetched vendor tracker through intercepted requests. Other external requests
  were blocked; beacon requests were captured and fulfilled locally.
  Result: one tracker in head; pageviews for `/` and `/about/privacy` after
  history navigation; one beacon batch; correct domain/token; zero cookies.
  No synthetic events were sent to Searchable.
- Environment tests verify no tracker for undefined, development or preview
  VERCEL_ENV values.

The initial served-page attempt stopped at Clerk's missing synthetic secret;
the successful browser check used the actual generated HTML with request
interception. It does not prove signed-in runtime behavior or live receipt.

## Release boundary

No review comments have been received or disposed of yet. No merge, release,
production deployment, or Searchable dashboard receipt is claimed. Follow
docs/DEPLOYMENT.md for the protected tagged release; do not deploy main directly.

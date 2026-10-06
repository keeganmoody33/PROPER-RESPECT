# Searchable public-traffic reconciliation

Date: 2026-10-06 (America/New_York). Source PR [#141](https://github.com/keeganmoody33/PROPER-RESPECT/pull/141) at `884db6b6d5f7e079a4d42cf158f1d78512bc4063`. Baseline main `258660ce212ed50623ff2b93765f7cf8d327dff6`. Isolated branch `codex/searchable-reconcile-20261006`; main incorporated by merge `b8e957e`. Original checkout remains untouched.

## Review dispositions before implementation

The captured outside review says: “Copilot was unable to review this pull request because the user who requested the review has reached their quota limit.” Disposition **not a bug with evidence**: this is missing review coverage, never clearance. Refreshed metadata had no substantive review comments.

The old Verify failure came from expecting three `2026-09-28` sitemap dates after privacy changed. Disposition **fix now**: retain the sitemap contract, date the changed privacy document October 6 and assert its individual sitemap date; other two September 28 dates remain checked.

The old global SDK conflicts with main's private/public contract. Disposition **fix now**: isolate its browser context, preserving PostHog unchanged. Both providers' CSP/disclosures are retained and reconciled.

## Source and RED evidence

Official script: https://tracker.searchableanalytics.com/s.js. Captured October 6, SHA-256 `fe952f7cd52da87da8b5d1a95ffcb77b0883fb5d67ef26e5bc42fdc8f99c3a84`, embedded version `7507b5e9218c2e8243834ad1e48204b10ebad60a`. It replaces history methods and automatically collects page URL/title/referrer. Cookies disabled does not gate those data.

An intercepted synthetic old-SDK navigation produced:

```json
{"t":"pageview","p":"/app/collection/private-fixture","u":"https://synthetic.proper-respect.test/app/collection/private-fixture?note=synthetic-secret#details","tl":"Synthetic private collection"}
```

That browser had zero cookies. New isolation/private-route rendering regressions also failed against the old component:9 failed / 3 passed. Raw artifacts are retained in `/tmp/proper-respect-pickup-20261006/searchable-red.txt` and `searchable-native-feasibility.json`. These are synthetic fixture data.

## Native implementation

An empty first-party frame uses enforced CSP `sandbox allow-scripts`, iframe `sandbox=allow-scripts`, `referrerPolicy=no-referrer`, `frame-ancestors 'self'`, and X-Frame-Options SAMEORIGIN. **allow-same-origin is absent**. The measured same-origin alternative could read the parent DOM; the opaque frame could not. Chromium successfully replaced the opaque frame's URL with an allowed public path before loading the official SDK.

Only homepage, named public trust pages and valid single-segment public profile paths are accepted. Internal/auth/onboarding paths, nested unknown paths, encoded paths, query strings, fragments and external URLs are refused. The SDK starts only after a message from the actual parent with the matching origin and an allowed path. No parent title, content, account identity, query, fragment or referrer is posted.

The same frame persists across public navigation, using the SDK's own history tracking without manual pageview/beacon transport. Leaving a tracked public route for an excluded route removes it. Cookies and all currently supported optional plugins are disabled. The opaque context cannot access parent DOM/cookies/storage or its own persistent storage. Visitor/session IDs are temporary for that frame and reset on a full load or excluded-route visit. Browser/device dimensions can reflect the isolated frame rather than the parent viewport; they are not validated as accurate user-screen measurements.

This implementation counts public browser page visits. It does **not** preserve AI referrer attribution: no-referrer intentionally removes those signals. It does not prove Searchable's separate Cloudflare/vendor configuration or dashboard receipt.

## Verification

Bundled Node `v24.19.0`; isolated-tree `npm ci` installed 445 and audited 446 packages and reported 6 high and 1 critical advisories. No audit fix or dependency changes; tooling reconciliation belongs to the coordinator.

- Full suite:1,761 Vitest tests passed / 2 retained-real-source tests skipped; 121 Node script tests passed. Final focused suite: 108 passed.
- Lint/typecheck passed. Production Next build passed with synthetic empty auth/backend/analytics keys, VERCEL_ENV=production and canonical PUBLIC_SITE_ORIGIN=https://proper-respect.com. No provider/backend connection or synchronization.
- Synthetic intercepted tracker:2 browser tests passed at 390/1440px.
- Actual captured official SDK:2intercepted browser tests passed at390/1440px. Exactly three public pageviews across public→public→private→back; one SDK/session for consecutive public routes, new session on return; no duplicate or private/query/hash/title/referrer data, no cookie, parent DOM/storage denied, incorrect source/origin refused, no optional plugin requests. Every Searchable request was intercepted locally.
- Trust HTML/Markdown/sitemap/keyboard/axe/overflow:11 browser tests passed, including 320/1440px light/dark. Initial concurrent dev-server startup hit this worktree's own Next lock; serial retry passed without weakening any gate.
- Four dated privacy screenshots: [mobile light](2026-10-06-searchable-analytics-assets/2026-10-06-privacy-320-light.png), [mobile dark](2026-10-06-searchable-analytics-assets/2026-10-06-privacy-320-dark.png), [desktop light](2026-10-06-searchable-analytics-assets/2026-10-06-privacy-1440-light.png), [desktop dark](2026-10-06-searchable-analytics-assets/2026-10-06-privacy-1440-dark.png). Implementer visually inspected both light screenshots.

The added browser CI command uses the deterministic synthetic tracker. The actual SDK check uses explicit `SEARCHABLE_TEST_SOURCE` pointing only to the captured public script, with all beacons intercepted. This validates browser isolation and native event shape locally, **not live vendor acceptance**.

## Delivery boundary

Independent internal review, final commit/head and current hosted CI must be recorded separately before coordinator merge. No outside clearance, protected release, dashboard receipt, deployment, provider read or public-profile publication is claimed by this receipt.

Progress and full before-edit dispositions: [2026-10-06-searchable-reconciliation.md](../../work/pstack/2026-10-06-searchable-reconciliation.md).

## Durable native capture — 2026-10-06 UTC

Final actual-SDK browser run passed 2/2 after the test wrote durable evidence. Raw intercepted synthetic batches are `/tmp/proper-respect-pickup-20261006/searchable-native-batches-390.json` and `searchable-native-batches-1440.json`. Each capture has pageview paths `/`, `/about/privacy`, `/keegan`, two SDK loads and two distinct temporary visitor/session IDs. Titles are empty; referrers absent; all pageview URLs lack query/fragment. SDK-native `session_start` and `page_leave` events are also present on allowed public paths. This proves the bounded native event shape, not vendor dashboard session/accounting semantics. Both parent viewport sizes produce 800×600 isolated screen values.

## Independent finding disposition — 2026-10-06 UTC, before edit

Reviewer found: `searchablePublicPath('/evidence-fixture')` was accepted even though it is a gated internal fixture; known reserved roots such as `/admin`, `/icon`, `/apple-icon`, `/agents`, `/auth` and `/index` were also accepted by the profile-shaped path branch. **Fix now**: exclude the application's reserved root set while retaining intentionally claimable `/about` and `/collection`; add path and frame rejection regressions. This is a contract/fidelity defect, not observed private-data disclosure. The frame isolation remains intact. Renew the manifest/review after the fix.

The new direct-navigation browser case observed Chromium's `net::ERR_HTTP_RESPONSE_CODE_FAILURE` for the intentionally empty 404 response. This is a harness mismatch, not tracker admission. Fix the harness while retaining independent HTTP 404/empty-body assertions, the attempted browser navigation and zero outbound SDK requests. Lifecycle cases remained 2/2 passing after reserved-root correction.

## Reserved-root correction verification — 2026-10-06 UTC

GREEN after the independent finding: full 1,775 Vitest tests passed / 2 retained-real-source tests skipped, plus 121 Node script tests passed. Actual SDK browser suite: 3/3 passed, including direct navigation of excluded frame paths (HTTP 404, empty body and zero tracker requests) plus desktop/mobile native lifecycle. Direct Chromium empty-404 navigation errors are accepted only after the independent HTTP assertions; no implementation or verification gate was weakened. The same two durable native-batch JSON files were refreshed with these final source captures.

## Final base integration — 2026-10-06 UTC

Independent internal review passed the complete 24-file manifest `e3d0b61babf7050adb3e9f49f2911048c703a05d94fcd716d71f7bec19fc19bf`; report `/tmp/proper-respect-pickup-20261006/searchable-port-review.md`. Functional correction committed as `c74deaf` before refreshing the base.

Main `1dd933182193f4b38c16762b8890885adcf7aa49` merged cleanly into the branch. Analytics functional source remained unchanged; the only overlapping file was `.github/workflows/verify.yml`, auto-merged to retain both the credential-free pinned release CLI check (`npm ci --ignore-scripts --prefix release-tools`, `node scripts/check-release-cli.mjs`) and the isolated analytics browser invocation. Final workflow SHA-256 `62f32683e00f0a93e94c348b907197b08f963fa1b775691ab407424713127065`. Current main's collection/release-CLI changes remain intact.

The local analytics checks above bind the stable analytics source before this clean base refresh; current-head hosted strict checks are still required and are not inferred from previous-head results. No backend/provider read, deployment, protection bypass or publication occurred.

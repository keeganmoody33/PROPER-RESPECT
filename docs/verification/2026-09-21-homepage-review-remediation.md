# Homepage review remediation — 2026-09-21 UTC

Reviewed PR: https://github.com/keeganmoody33/PROPER-RESPECT/pull/35
Reviewed head: `87d22a2084a8fe6109e93f22da5178e59504bea2`.

- Copilot `4059010404` / `PRRT_kwDOSyRAjs6kOV8m`: confirmed. Activating the skip link did not focus the main region. Added `tabIndex={-1}` to the main target. The browser test now activates the link, verifies focus on main, then tabs directly to the first collection entry link.
- Copilot `4059010414` / `PRRT_kwDOSyRAjs6kOV8r`: confirmed coverage gap. Font readiness alone permits fallback rendering. Tests now derive the first font family actually applied to the headline/navigation, require Archivo/mono respectively, and require a nonempty exact loaded face result. Local fallback faces cannot satisfy these assertions.

## Verification

Before the application fix, all three strengthened browser cases failed at the main-focus assertion (1440, 390 and 320 px). After the fix, all three passed, including local font loading, keyboard navigation, artwork loading, no horizontal overflow, no external homepage requests, destination routes and desktop axe accessibility checks.

Command: `npx playwright test homepage.spec.ts --config /tmp/pr35-playwright.config.cjs --workers=1`. The temporary config uses the existing fixture-only Next server at `http://127.0.0.1:8815`, Chromium, and the repository test directory; it does not start or stop the existing server. Output: `/tmp/pr35-review-test-results`.

A separate browser probe aborted font requests before navigation. `document.fonts.ready` resolved, while Archivo and mono were both `error`; their fallback faces were `loaded`. The strengthened exact-family assertions reject that result.

`npm run lint`, `npm run typecheck`, `git diff --check` and `npm run build` passed. Build used `PUBLIC_SITE_ORIGIN=https://public.example`, synthetic Convex URL and synthetic Clerk publishable key; build log: `/tmp/pr35-remediation-build.log`. No real login, backend or provider requests were used.

The pre-existing `next-env.d.ts` development import was preserved byte-for-byte after the build regenerated that file. The existing port 8815 server remains running. No redesign, public copy change, backend mutation, push, merge or deployment was performed by this worker. Parent owns push and review-thread disposition.

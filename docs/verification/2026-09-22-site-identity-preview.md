# Site icons and share preview — 2026-09-22

Base: `1055aa9dd575738fde4eb3547ae5f401c741b0ab`.
Branch: `codex/site-identity-preview-20260922`.

## Scope and evidence

The owner reported that links lacked the PR monogram and previews did not reflect the current website. The base had no app icon metadata. Its share image used a generic font, omitted the PR mark, and lacked the homepage's red headline treatment.

- Added Next.js root icon (32 × 32) and Apple touch icon (180 × 180), using the exact existing `public/brand/homepage/PR-mark-black.png` on a cream background. The mark is neither redrawn nor replaced.
- Updated the 1200 × 630 share image to use the same PR mark, Archivo Black, cream/black/red palette, headline and privacy wording as the public homepage.
- The domain remains configuration-derived. The image contains no user, collection or usage data.
- Open Graph and Twitter image references now include `?v=20260922` so clients refetching page metadata receive a new asset URL. The unversioned image route remains valid.
- Browser/chats decide whether to display hover previews or favicons and may retain cached page metadata. These changes supply the correct assets; they cannot force another application's UI or invalidate its cache.

## Checks

1. RED: new `tests/e2e/site-identity.spec.ts` failed against the base because `link[rel="icon"]` was absent.
2. GREEN: the same browser test passed. It fetches advertised icon URLs from both the homepage and Origins, verifies successful PNG responses and their binary dimensions, and verifies the matching OG/Twitter preview URL and PNG dimensions.
3. Focused ESLint passed for changed TypeScript files.
4. Public-site/public-metadata Vitest: 14 tests passed, including configured origins, profile canonical URLs and no metadata advertisement for unpublished/unavailable profiles.
5. Production webpack build passed without Clerk credentials or Convex access, using the reference fixture and `PUBLIC_SITE_ORIGIN=https://proper-respect.com`.
6. Local production server: homepage advertises both icons plus the versioned image URL; `/icon`, `/apple-icon` and `/share-image.png?v=20260922` return valid PNGs at 32 × 32, 180 × 180 and 1200 × 630 respectively.
7. Visually inspected the actual rendered share image, both icon sizes, and the existing homepage in a 390px browser viewport. The shared image matches the homepage visual identity. The icon has a cream background so the black mark remains visible in dark browser chrome.
8. Production output tracing includes the share image's font and source logo assets.

Local evidence: `/tmp/site-identity-red.log`, `/tmp/site-identity-green.log`, `/tmp/site-identity-unit.log`, `/tmp/site-identity-build.log`, `/tmp/site-identity-production-preview.png`, `/tmp/site-identity-production-icon.png`, `/tmp/site-identity-production-apple.png`, `/tmp/site-identity-home-mobile.png`.

## Font derivation

Next ImageResponse could not render the existing 643KB variable Archivo font (`Cannot read properties of undefined (reading '256')`). A static 900-weight, 100-width ASCII subset is derived from the existing font, keeping its name records and existing SIL OFL license. No runtime dependency was added. Provenance and SHA-256 are in `app/_homepage-fonts/sources.json`.

Reproduction uses fontTools 4.60.1: load `Archivo.ttf` with `TTFont`; call `instantiateVariableFont(font, {"wght": 900, "wdth": 100}, inplace=True)`; subset Unicode `range(32,127)` with `Options.name_IDs=["*"]`, `name_legacy=True`, `name_languages=["*"]`; save `Archivo-Black-Latin.ttf`. The resulting asset is approximately 19KB and renders successfully in development and production.

## Boundaries

This receipt covers local implementation and verification. No deployment, profile-handle change, data mutation, auth configuration change, private account read or publication happened in this slice. Owner profile identity is a separate diagnosis. No prior external-review comments apply to this newly created branch; independent review follows the implementation commit.

## Legacy favicon follow-up

The parent reproduced `/favicon.ico` returning 404 on production. Added a literal `public/favicon.ico` for clients that probe that conventional URL instead of following HTML icon metadata. This introduces no second metadata link or image-generation endpoint.

The ICO is a 6-byte ICONDIR plus one 16-byte ICONDIRENTRY and the exact existing 32px `/icon` PNG. Header values are reserved=0, type=1, count=1; entry width=32, height=32, colors=0, reserved=0, planes=1, bit depth=32, payload length=409, payload offset=22. The PNG is copied byte-for-byte without editing pixels. SHA-256: `54e67f4e22b5b5836b1f7f9541f98fa7799d104dd77eca1809f2f75ebee694a0`. PNG-bearing ICO is documented by [Microsoft](https://devblogs.microsoft.com/oldnewthing/20101022-00/?p=12473).

Verification: regression failed with the original 404; both site-identity browser tests now pass. The new test validates the ICO header/directory, embedded PNG dimensions and equality with the advertised `/icon`, then opens `/favicon.ico` in Chromium and confirms the decoded image width is 32. Production webpack rebuild passed. Local production GET returns 200 `image/x-icon`, length 431, exact source bytes; the `file` utility identifies a valid Windows icon resource with 32px RGBA PNG data. Evidence: `/tmp/site-identity-favicon-red.log`, `/tmp/site-identity-favicon-green.log`, `/tmp/site-identity-favicon-build.log`, `/tmp/site-identity-favicon-headers.txt`, `/tmp/site-identity-favicon-production.ico`.

No extra Apple filename variant was added. The root layout already emits `rel="apple-touch-icon"` pointing to the verified 180px PNG. [Apple's documented link mechanism](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html) supports that explicit URL; root filename probing is a fallback when no link is supplied.

## PR51 CI remediation

Finding: the gated browser run at `4782e536b44f61a9d4c84ab10c330a58a26ef38d` passed 53 tests but the existing public-profile metadata assertion still expected the unversioned share-image URL. Disposition: fix now. The observed URL correctly included `?v=20260922`; update that stale expectation without changing application behavior. The unversioned image fetch remains an intentional backward-compatibility check. A search of active browser and unit tests found no other stale URL expectation. Source log: `/tmp/pr51-ci-failure.log`.

Copilot review dispositions: `PRRT_kwDOSyRAjs6k294M` (stale OG assertion) is fixed by this follow-up; `PRRT_kwDOSyRAjs6k294y` (missing gated identity browser test) was already fixed in `4782e536b44f61a9d4c84ab10c330a58a26ef38d`. No findings are deferred.

Follow-up verification: all six public-metadata and site-identity browser tests passed using local webpack with one worker; focused ESLint and diff checks passed. The first parallel local run hit an invalid generated vendor chunk and the clean-cache parallel run hit development reload navigation aborts; both logs are retained. Serial execution passed all assertions without changing application code or permanent test configuration. Evidence: `/tmp/site-identity-ci-remediation.log`, `/tmp/site-identity-ci-remediation-clean.log`, `/tmp/site-identity-ci-remediation-serial.log`. GitHub's normal parallel CI remains the final merge gate.

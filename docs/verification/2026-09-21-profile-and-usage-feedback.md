# Profile and usage feedback

Date: 2026-09-21.

Owner feedback: show GitHub activity on the card, support personal links and an explicit preferred name destination, stop presenting the ongoing workspace as onboarding, replace blueprint imagery, retain the bottom fist bump and product-specific branding.

## Delivered behavior

- The GitHub contribution calendar appears on the card front as well as Details. Dates align to UTC weekdays/weeks; supplied zeros differ from missing days. Squares stay square for short histories. The source period, freshness and captured provenance remain available. Contributions are not labeled commits. No new provider capture ran.
- Up to eight named HTTP(S) profile links, with an explicit preferred destination for the display name. Unsafe schemes and embedded credentials are rejected. Existing callers preserve links when omitted. Changes remain private and require a new exact preview before publication. Ownership, stale-preview rejection, legacy preservation and removal are covered by tests.
- `/collection` is the private workspace. `/onboarding` temporarily redirects with query parameters intact, retaining existing OAuth callback destinations. `/collection` was HTTP404 before this edit; its handle is reserved for new claims. Both page exports carry noindex and the sitemap remains homepage-only.
- Homepage navigation exposes How it works, Example, Sign in and Your collection. The hero demonstrates a real ProductCard component with clearly labeled synthetic activity and no personal attribution. The blueprint is removed from homepage/auth UI; the original bottom fist bump remains. Authentication text explains the private-first sequence.
- Profile fields remain optional until sharing. The current collection workspace is retained; this change does not claim a complete new multi-step onboarding wizard or hosted fresh-user acceptance.

## References used

- Linktree setup: https://linktr.ee/help/en/articles/5434134-creating-your-linktree
  "add more links, personalize your Linktree theme, and start sharing"
- Raindrop: https://raindrop.io/
  "Enable access to your collection by coworkers, family or the entire web."
- GitHub contribution semantics: https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference

Design choice: show the product before signup, let the user save a useful private card before decorating a profile, then preview the exact public version. These are our choices, not claims that we tested other companies' authenticated signup flows.

The homepage GitHub favicon is copied unchanged from https://github.githubassets.com/favicons/favicon.svg on 2026-09-21. SHA256: 6a9577cd4f7fa6b75bde1025af85b944e9dd1388373b55ccba6e9f80ac2eae60. It identifies the product and implies no affiliation or use. Other cards continue using their retained/verified brand assets and fallback rules.

## Verification

Final commands and application commit are recorded below after the integrated checks. Browser fixtures do not prove live sign-in, account isolation or provider lifecycle. No backend synchronization, publication, merge or deployment was performed.

Application commit: `2d3fbc6305ede1856ca909eb8cbdc3ea999ec23e`.

- `npm test`: 682 passed, 2 optional skips; 7 script tests passed.
- `npx playwright test`: 55 passed. Includes mobile320/390, desktop, front/back calendar, profile-link choice/removal, noindex/sitemap and legacy-route query preservation.
- `npm run typecheck`, `npm run lint`, `git diff --check`: passed.
- Production build passed with synthetic Clerk/Convex CI values and `PUBLIC_SITE_ORIGIN=https://public.example`.
- Desktop/mobile screenshots inspected and stored in `2026-09-21-profile-usage/`.

The new optional Convex fields and mutation arguments require backend synchronization at an explicitly authorized release. This receipt does not assert hosted verification of the new links. The real Clerk widget's appearance and the remaining second-user signup/isolation and reconnect/revocation gates are still open.

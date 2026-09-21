# Homepage visual integration — September 21, 2026 UTC

Base: `3a1413f3deb34c417cb9bdbdbfa4d34096e47e77`.
Verified implementation: `37bbf65f28abc1e47c599354fb2e365e8f560b15`.
Reference: owner-supplied archive imported by PR #34 at `9a3c20b275304640301c921f64f728bcff18fd11`.

## Owner direction and scope

Apply typography and visual influence while preserving the product. The homepage adopts Archivo display/body type, IBM Plex Mono annotations, paper/ink surfaces, section rules and supplied blueprint fist-bump artwork. A scoped CSS module contains the changes. Global styles, native product branding/cards, private collection, signup, auth, evidence and publication handlers are unchanged.

Existing entry statement, canonical metadata and destinations /onboarding and /keegan remain. The explanatory sequence covers current manual/source intake, private context/go-to decisions and explicit exact sharing preview. No illustrative telemetry, product roster, verification badges, pricing/timing assertion, custom-domain promise, take-card function or new brand pipeline is adopted from the imported document. Red is darkened from reference #d93843 to #c72c39 for readable small text contrast. No motion is introduced.

Both artwork files match the imported original hashes. Font binaries are self-hosted with their OFL licenses; app/_homepage-fonts/sources.json pins upstream URLs to a google/fonts commit and records hashes. No runtime Google font request or build-time font download is required.

## Verification

- `npm test`: 647 Vitest passes, two optional skips, seven Node checks pass.
- `npm run lint`, `npm run typecheck`, `git diff --check`: pass.
- `npm run test:e2e`: all 46 browser checks pass, including widths 1440/390/320, keyboard skip-link focus, loaded artwork, no horizontal overflow, no external homepage requests, existing profile navigation and collection navigation.
- Axe scan of the rendered desktop homepage: zero violations.
- Production build passes with the standard synthetic CI origin/Clerk/Convex environment. Command: `PUBLIC_SITE_ORIGIN=https://public.example NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk NEXT_TELEMETRY_DISABLED=1 npm run build`.
- CI now runs the homepage browser checks alongside public metadata checks.
- Desktop/mobile screenshots visually inspected. [Desktop](assets/2026-09-21-homepage-1440.png), [mobile](assets/2026-09-21-homepage-390.png), [narrow mobile](assets/2026-09-21-homepage-320.png). They show the actual local app with the synthetic E2E configuration, not a hosted release.

Temporary logs: /tmp/proper-respect-homepage-{tests,full-browser,build}.log. Art/reference preview and this application preview are separate surfaces. No application provider credentials or real evidence were used.

## Release boundary

This PR changes source only. Owner review/merge required; no agent merge or deployment. Auth/domain cutover and hosted two-user acceptance remain separate. The current apex redirect is not changed by a homepage source edit. PR #32/#33 fixes are independent; this branch does not claim they are merged or deployed.

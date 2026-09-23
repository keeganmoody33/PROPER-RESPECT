# Onboarding frontend candidate

Date: 2026-09-23. Branch: `codex/onboarding-frontend-release-20260923`. Base live frontend source: `77f22d551218189dbb3ae366a4709f3b9a5ce599`.

This candidate applies the already-merged PR54 frontend changes to the live source. It adds a first-tool entry point to an empty private collection, makes manual-save feedback actionable through an accurately named Review your collection link, and keeps public identity optional until sharing. A claimed `pending-` handle is valid. Preview readiness uses the explicit backend capability rather than inferring identity from a handle prefix or workflow status. A missing capability leaves preview disabled and explains that identity status is unavailable.

The frontend component, its auth test, account-setup browser test, synthetic fixture, inventory regression and original PR54 receipt exactly match merged source `503847b22cc24d42f7827de11d98de9115c75c14`. There is no new frontend implementation. The existing CI components job already selects account-setup; the existing browser job selects inventory. No workflow changes are needed.

## Backend prerequisite in this source snapshot

The initial frontend-only assembly failed TypeScript with TS2339 at the two `hasClaimedPublicIdentity` accesses. Its preserved live backend source did not declare the U17 return field. An initial status message mistakenly reported that typecheck had passed because a combined shell ended successfully on lint; this was corrected before committing. The failed build is not counted as a pass.

The coordinator explicitly authorized including the exact U17 source dependency instead of a new frontend guard. `convex/onboarding.ts` and `convex/evidenceUpload.test.ts` therefore match candidate `082e90cf21a37ff1e95fbcdd26d50b430ea4a62e` exactly. All 62 files under `convex/` match that U17 source, not merely the query hunk. The only Convex runtime delta against the live frontend base is the authenticated owner-site read and explicit identity capability in onboarding.getState. No schema, indexes, aliases, migration, auth, cron, provider or GitHub code changed. The temporary uncommitted frontend guard was removed; final frontend bytes match PR54.

This source addition makes frontend type inference coherent with its separately approved backend prerequisite. It does not synchronize Convex. A future Vercel release must use the existing explicit frontend-only build override and must wait for the coordinator's independent U17 deployed-backend acceptance. The embedded backend bytes identify the dependency; they are not evidence that it has deployed.

Homepage `/keegan` links, the old public profile, public Markdown, factual metadata, assets and homepage/profile WebMCP code remain byte-identical to the live frontend base. PR52 and GitHub hardening are excluded.

## Verification actually run

- `npm test` on the final combined source: 836 Vitest tests passed, two private-input tests skipped; all seven Node script checks passed. `/tmp/u25-full-tests.log`.
- `npm run typecheck` and `npm run lint`: passed. `/tmp/u25-typecheck.log`, `/tmp/u25-lint.log`.
- `npx playwright test tests/e2e/account-setup.spec.ts --config tests/e2e/components.config.ts`: seven passed. `/tmp/u25-account-setup.log`. Desktop/mobile cases at 1280 and 390 pixels cover account-setup retry, empty collection, first manual tool, relationship and explanation, private save, reload, optional public identity, exact selected preview and no publication. The remaining cases prove claimed pending-prefixed identity, unclaimed after upload and unavailable capability.
- Production build passed with `PUBLIC_SITE_ORIGIN=https://proper-respect.com PROPER_RESPECT_E2E_REFERENCE=1 NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY= CLERK_SECRET_KEY= NEXT_PUBLIC_CONVEX_URL= npm run build -- --webpack`. Served on port 8870 with the same synthetic configuration. `/tmp/u25-onboarding-frontend-evidence-20260923/build.log`.
- Built homepage and WebMCP contract browser checks: eleven passed via `browser.config.ts` in that evidence directory. Includes desktop/mobile homepage navigation and unsupported-browser continuity. `browser-final.log`.
- Built native Chrome WebMCP checks: ten passed via `native.config.ts`. Scratch spec copies unchanged source tests and changes only expected canonical strings from public.example to proper-respect.com for this build. Profile and homepage guide invocation, same-document cleanup and switching, and no tools on private/trust/missing pages remain intact. `native.log`.
- Inventory development fixture: eight passed via `inventory.config.ts` against isolated webpack development port 8871. Covers manual retry identity, private save/review, exact sharing approval, evidence removal and grouped usage at desktop/mobile widths. `inventory.log`. The fixture deliberately requires development mode, so an initial attempt against the production build returned 404 and was stopped. The fixture gate was preserved; no assertion or application behavior was weakened. The development server stopped afterward and its two generated next-env.d.ts path changes were restored to the tracked bytes.
- `git diff --check`: passed. Source-identity assertions prove the six selected PR54 files and all 62 U17 Convex files match their pinned commits. `/tmp/u25-onboarding-frontend-evidence-20260923/source-identity.json`.

The first-card browser journey uses a synthetic Convex boundary with test-origin localStorage for reload, intercepts its document and blocks all other requests. It exercises the actual components, not a real backend or signed-in session. Publication is excluded by the fixture and remains uninvoked. Missing usage stays absent rather than becoming zero.

Viewed the new mobile empty-state and desktop/mobile exact-preview screenshots. The first-tool link is legible; the preview shows the chosen explanation and a separate unchecked publication approval. Screenshot paths in the candidate worktree:

- `test-results/components/account-setup-first-privat-24250-without-publishing-at-390px/fresh-user-empty-390.png`
- `test-results/components/account-setup-first-privat-24250-without-publishing-at-390px/fresh-user-preview-390.png`
- `test-results/components/account-setup-first-privat-24556-ithout-publishing-at-1280px/fresh-user-preview-1280.png`

The original dated PR54 receipt is retained as historical evidence, not presented as this candidate's current test result. Exact candidate SHA, tree, final public-helper results and any subsequent independent review belong in the coordinator's candidate report.

## Remaining acceptance

No deployment, backend synchronization, real sign-in, account/provider read, seed, migration, publication or recurrence change was performed by this unit. Fresh hosted signup/login, email-code delivery, persistence against actual Convex, existing-owner continuity, second-user isolation and provider reconnect/revocation remain distinct acceptance gates. The synthetic flow cannot close them. Root owns exact-head review, backend prerequisite acceptance and any frontend release.

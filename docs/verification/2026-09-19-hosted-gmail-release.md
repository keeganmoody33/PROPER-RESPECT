# Hosted Gmail discovery release

Verified 2026-09-19. The owner approved hosted setup and the exact prepared release.
Application/backend release and hosted Google OAuth configuration succeeded. The
real connection attempt exposed two server-authentication defects. Both the invalid
production key and native-token code path are repaired and released. Real hosted
Add Gmail account now reaches Google account selection. Owner consent and callback
completion remain pending. No mailbox read has started.

## Released source and targets

- Source: `5a0b77fe936c62df60b5a1924c2161b097288006` (approved native-token correction atop `7fa18a7`).
- Vercel: `groundskeep/proper-respect`, project `prj_yxsUnnPW0ka8mkFr7l66eUSzJgT8`.
- READY deployment: `dpl_AJeXca75XZNAhM3NYuhRfYRDcdLX`.
- Deployment URL: https://proper-respect-10n19xd2q-groundskeep.vercel.app.
- Hosted collection: https://proper-respect.com/onboarding, forwarded to `props.lecturesfrom.com`.
- Convex production: `striped-chicken-693`.
- Frontend rollback: `dpl_4oRkjCrgWWbTJYkDJCYyxmXD4ZN2`, source `8b6aa9a`.

The approved binary diff hash matched the retained candidate manifest. A clean source
archive was deployed without local development credentials or Git history. The exact
Vercel project/team and production alias were checked before mutation. Convex dry run
and actual deployment both targeted `striped-chicken-693`; no indexes were deleted.

Backend synchronization added the discovery-run table/index. The remote function
specification now exposes 82 functions, including start/control/claim/expiry and the
scheduled Gmail page action. Vercel's existing build passed configuration validation,
Next.js compilation, TypeScript and a second synchronization to the same backend.

## Approved configuration completed

`MAILBOX_APPLICATION_ORIGIN` is set to `https://props.lecturesfrom.com` in Vercel
Production and Convex production. A fresh production-only AES-256-GCM keyring and
active version were configured in Convex. Private readback matched. The pre-write
snapshot contained no mailbox accounts or secrets, and no previous mailbox key was
replaced. No development OAuth tokens or private evidence were copied.

After the owner completed Google passkey verification, the separate Web application
client `Proper Respect Hosted Gmail — 2026-09-19` was created in the approved
`proper-respect-dev-20260917` project. The saved callback exactly matches
`https://props.lecturesfrom.com/api/connect/mailboxes/google/callback`.
The existing localhost client was not changed. Credentials are retained privately
outside Git and installed only on Convex production `striped-chicken-693`.
All five mailbox settings pass private readback; the active encryption key exists
and loopback HTTP is disabled. No further frontend deployment was necessary.

Google's audience remains External / Testing with the two intended Gmail accounts
already listed as test users. The app was not published or broadened to other users.
Testing-mode limitations remain relevant to future unattended maintenance.

## Hosted verification

The existing signed-in session reloads its collection and exposes Add Gmail account.
The page explicitly distinguishes Google sign-in from mailbox authorization and says
no Gmail accounts are connected. Normal private/sharing cards expose zero brand
retrieval diagnostic sections. No browser errors were recorded.

At the requested 390px breakpoint, measured viewport width was 390px and document
width was 375px; zero selectors extended past the viewport. The viewport override
was reset. This verifies the released overflow correction, not every mobile journey.

Anonymous `/keegan` returns HTTP 200 and preserves its four card identities. Brand
retrieval diagnostics are absent as requested. `/lecturesfrom` still returns 404.
A first HTML comparison accidentally counted front/back headings twice; the corrected
comparison counts one title per article and confirms the same four cards.

All 32 existing application tables are identical before and after release; the new
`mailboxDiscoveryRuns` table is empty. This includes saved owner choices, evidence,
credentials, cursors and publication snapshots. Backups including file storage,
configuration recovery files and comparison results remain outside Git.

## Authentication failure and repair — September 19, 20:35 EDT

The owner's screenshot shows `{"error":"Authentication required."}`. A real
hosted POST carried Clerk session cookies, but its HTTP 401 headers reported
`secret-key-invalid`. The later browser `ERR_BLOCKED_BY_CLIENT` obscured that
response; the earlier browser-only diagnosis was incomplete.

The existing production key was retrieved privately from the correct Clerk
instance, validated with its read-only instance API, and matched to the deployed
publishable key. Only Vercel Production's `CLERK_SECRET_KEY` was replaced. No Clerk
key was generated, rotated or revoked; development and preview were untouched.
The unchanged approved source `7fa18a7` was redeployed as the READY deployment
listed above. Its build and unchanged Convex synchronization passed.

The next real POST passed authentication and returned 400. Production has the
native Clerk Convex integration enabled and zero legacy JWT templates. The
mailbox route unconditionally requested the nonexistent `convex` template.
The installed Convex React adapter already handles both modes. Local source
`5a0b77fe936c62df60b5a1924c2161b097288006` applies the same audience-based selection
to the shared mailbox client: native `aud=convex` uses the session token; other
sessions still request the named template. Backend issuer/audience validation,
owner checks, same-origin checks and null-token rejection remain intact.

Three new native-session regressions first failed for start, callback and read,
then passed. Legacy/mismatched-audience and null-token cases also pass. Focused
route/provider tests: 38 passed. Final checks: 565 Vitest tests passed, one optional
private-file test skipped; six Node tests passed; lint, strict TypeScript,
production build and `git diff --check` passed. These are local code proofs;
the subsequent real hosted start passed and reached Google account selection.
Callback and mailbox read remain unexercised on production.

After the configuration-only redeployment, all 33 application tables match the
prior post-release backup byte-for-byte, including empty OAuth/run tables,
owner choices and publication snapshots. Private key material, backups and
redacted diagnostics remain outside Git. No new source read occurred.

## Next operation and remaining proof

The owner approved and we released `5a0b77fe936c62df60b5a1924c2161b097288006` to
Vercel `groundskeep/proper-respect`. Relative to deployed `7fa18a7`, the only
runtime change is `src/server/mailbox-route.ts`; its regression file and retained
release documentation accompany it. The existing build synchronizes unchanged
backend source to `striped-chicken-693`. No new Convex functions or schema changes.

The clean archived source deployment passed its production build and unchanged
backend synchronization, with no indexes deleted. Existing-session collection
reload passed. A real Add Gmail account click reached Google account selection
with the correct hosted client, exact callback, PKCE S256 and read-only Gmail
scope. Anonymous curl returns 200 for `/keegan` with the same four card identities.
The post-start backup verifies that only `mailboxOAuthStates` changed: one
expiring unconsumed pending state. The other 32 tables, including private records,
credentials, cursors and the public snapshot, are unchanged.
The next owner action is selecting `keeganmoody33@gmail.com` on that Google screen
and completing consent. Obtain an explicit bounded real-read scope
before starting discovery. No setup approval needs to be repeated. No transfer,
recurrence, relationship edit or publication is included.

Fresh sign-in, hosted callback/retention, background continuation after browser
closure, broad discovery coverage and final approved public profile remain
unproven. The separate GitHub connector also uses the legacy template and needs
its own focused compatibility verification before a new connection is claimed.
Use the [prepared rollback procedure](2026-09-19-discovery-release-preparation.md);
keep additive schema and any later retained records intact. Rolling back to the
configuration-repaired deployment restores its known token-template limitation;
never restore the invalid Clerk secret.

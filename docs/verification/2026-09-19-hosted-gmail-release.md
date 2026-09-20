# Hosted Gmail discovery release

Verified 2026-09-19. The owner approved hosted setup and the exact prepared release.
Application/backend release succeeded. Hosted Google OAuth client creation remains
blocked on the owner's Google Cloud passkey verification.

## Released source and targets

- Source: `7fa18a79cf07a9129955c7926d02fe85eeec90e1`.
- Vercel: `groundskeep/proper-respect`, project `prj_yxsUnnPW0ka8mkFr7l66eUSzJgT8`.
- READY deployment: `dpl_DRFWzieUj8ioeyPjXpQuXeZYpzUf`.
- Deployment URL: https://proper-respect-1x7wahgbu-groundskeep.vercel.app.
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

The separate hosted Google client has NOT been created. Its client ID and secret
remain unset. Google Cloud requires passkey verification for the project owner's
account before the approved `proper-respect-dev-20260917` client page is accessible.
The requested callback remains
`https://props.lecturesfrom.com/api/connect/mailboxes/google/callback`.
No new setup approval is needed; complete Google verification, then continue that
already-authorized configuration and validate callback equality before consent.

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

## Next owner action and remaining proof

Complete the Google Cloud passkey prompt for `keeganmoody33@gmail.com`. Then finish
the approved hosted client setup, obtain consent for each Gmail account, and request
an explicit bounded real-read scope before starting discovery. This release itself
performed no provider reads, recurrence, relationship edits, transfer or publication.

Fresh sign-in, real hosted mailbox retention, background continuation after browser
closure, broad discovery coverage and final approved public profile remain unproven.
Use the [prepared rollback procedure](2026-09-19-discovery-release-preparation.md);
keep additive schema and any later retained records intact.

# Hosted Gmail release preparation

Prepared 2026-09-19. This is a release procedure, not a deployment receipt.
Owner approval for hosted configuration and this source remains pending.

## Bound source and targets

Release source: `7fa18a79cf07a9129955c7926d02fe85eeec90e1`.
Production baseline: `8b6aa9a2cd4fb452d7e5c54d54371f4a7580d594`.
The [candidate manifest](2026-09-19-discovery-release-candidate.json) binds the
complete binary diff and lists every changed file. The nine runtime files cover
background Gmail discovery, mobile selector width and hidden brand diagnostics.
No dependency, cron, public-sharing, relationship-editing or publication code changes.

Read-only Vercel inspection resolved `props.lecturesfrom.com` to READY production
`dpl_4oRkjCrgWWbTJYkDJCYyxmXD4ZN2` in `groundskeep/proper-respect`.
The local project binding matches `prj_yxsUnnPW0ka8mkFr7l66eUSzJgT8` and
`team_MfB5K2Npy5oy5SFJ2g9nbL5W`. Production Convex is `striped-chicken-693`.
A fresh names-only inspection confirms all five mailbox settings remain absent.
No environment values or credentials are stored in this record.

## Execute only after exact approval

1. Recheck the candidate diff hash, project IDs, production alias and Convex target.
2. Retain a fresh private production backup and environment recovery record outside Git.
3. Create the separate hosted Google OAuth client in the approved project.
   Register `https://props.lecturesfrom.com/api/connect/mailboxes/google/callback`.
4. Set `MAILBOX_APPLICATION_ORIGIN=https://props.lecturesfrom.com` in Vercel Production
   and Convex production. Set the Google client ID/secret and new versioned mailbox
   encryption keyring only in Convex production. Keep loopback allowance disabled.
5. Dry-run and synchronize the candidate schema/functions to `striped-chicken-693`.
   The schema adds `mailboxDiscoveryRuns` and optional references on accounts/jobs.
6. Deploy the clean candidate archive to the verified Vercel project. Its existing
   build also invokes Convex deployment; validate the same target before that build.
7. Verify signed-in collection loading and visible Gmail setup without initiating reads.
   Verify normal cards lack brand diagnostics and mobile selectors fit.
8. Compare existing application records and public output with the private pre-release
   snapshot. Do not seed, import development records or publish a new snapshot.
9. Have the owner authorize each hosted Gmail account. Obtain explicit bounded-read
   authorization before starting discovery. OAuth consent alone is not that read approval.

Do not claim hosted discovery proof until an actual authorized run produces retained
private evidence and reviewable candidates. Local tests are recorded separately.

## Rollback without erasing evidence

Before any discovery starts, the prior READY frontend is
`dpl_4oRkjCrgWWbTJYkDJCYyxmXD4ZN2`. Reassign the production alias to that deployment
if the new frontend fails acceptance. Preserve the additive backend schema.

If a run has started, pause or cancel it through the authenticated run control before
removing its UI. Verify its status and that queued pages cannot persist or continue.
An already-sent provider request can finish; do not misreport cancellation as revocation.

Do not redeploy the old backend schema wholesale after new records exist. Keep the new
table, optional references and encrypted credentials. Review a compatibility fix if a
backend rollback is necessary. Never restore an old data snapshot over newer evidence,
rotate the encryption key, disconnect an account or revoke consent as an implicit rollback.

## Still unproven

Hosted OAuth setup, account consent, scheduled execution after browser closure, real
coverage expansion and final owner-approved publication remain pending. No production
mutation, mailbox read, transfer, recurrence or publication occurred during preparation.

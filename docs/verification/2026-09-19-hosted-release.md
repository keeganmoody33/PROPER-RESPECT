# Hosted release and first-user verification

Verified: 2026-09-19, America/New_York.

## Release

Owner approved deploying the combined release and continuing the first-user story.
Application/backend source: `d2266faff48bf764e56e93a8536d0fba9ab3783b`.
Vercel project: `groundskeep/proper-respect`, `prj_yxsUnnPW0ka8mkFr7l66eUSzJgT8`.
Deployment: `dpl_DD4jWfKFtrCKYAPxvK8ufntusCW6`, READY.
Production Convex: `striped-chicken-693`.
Open https://proper-respect.com/onboarding, redirecting to the existing Clerk host
https://props.lecturesfrom.com/onboarding.

Source was uploaded from a Git archive of the exact commit. Local credentials,
private receipts and node_modules were excluded. Backend dry run verified the
explicit production target and additive rawEvidence.by_storage index. Backend
was synchronized before the frontend; Vercel's existing build repeated the same
backend synchronization against the verified production target.

Rollback frontend: prior READY deployment `dpl_7Um2KmrvNPajDaUyFPgudX6stvn5`.
Prior application: `adfc813268eb0c90a85b6440982315a94a83ab8a`.
Prefer frontend rollback with the compatible additive backend. If FILE_UPLOAD
records have been retained, backend rollback must preserve their enum/schema.
Do not restore the database or rotate encryption keys as routine rollback.

## Bounded swarm and checks

Two independent read-only slices completed: code-release review PASS, first-user
acceptance-path review PASS. The release reviewer passed 75 focused tests and
found no introduced blocker. Previously verified combined checks: 458 Vitest and
six Node tests, lint, TypeScript and production build; one optional test skipped.
Vercel's production build and backend synchronization completed successfully.

Known limitations remain: first upload retention is not bound to an upload ticket;
existing retained objects are owner protected. Account destination lookup examines
25 proofs and can select an older qualifying account ahead of a current connector.

## Hosted evidence

- Existing signed-in session reloads the collection and its controls successfully.
- The existing custom GitHub profile link is preserved.
- Export upload UI exposes JSON and other accepted formats plus Devin cloud.
- Relationship details load; inspected existing GitHub card correctly reports no
  retained supporting source or saved private relationship history.
- Sharing preview renders; Publish this preview remains disabled without explicit
  owner approval. No publication was submitted.
- Desktop and 390px mobile layout were visually inspected. Mobile document width
  was 375px within a 390px viewport. Viewport override was reset.
- Anonymous curl receives 200 for /keegan with Clerk signed-out headers, 307 from
  proper-respect.com to the existing host, and 404 for the disabled evidence fixture.
  Python urllib requests returned 403; curl and actual browser checks succeeded.
- All 32 preexisting application tables are byte-identical before/after deployment
  and read-only UI checks. Private backups and comparison receipt remain outside Git.

This is existing-session proof, not a fresh sign-out/sign-in proof. Production
has no connected GitHub account and lacks the newer retained development snapshots;
derivation of a new private account destination and selecting a refreshed snapshot
remain fixture-proven until accepted evidence reaches this owner in production.
No provider reads, private-data transfer, upload, relationship save, recurrence,
publication or data cleanup occurred. No telemetry was invented.

## Next first-user step

Reconcile the accepted development Wispr/GitHub originals and owner choices with
existing production records. Prepare a scoped replay-safe transfer bound to the
actual authenticated production owner; obtain its separate approval before writing.
Do not copy credentials, mailbox cursors, development subjects or public snapshots.
Then prove private evidence, selected activity, relationship history and fresh-session
persistence on host. Source consent/reads and unattended maintenance remain separate.

The exact released source is available on origin/codex/cursor-handoff-20260919 and
PR #22. Automated PR reviews restarted after reconciliation; do not treat older
bc29000 statuses as reviews of d2266fa. Git-triggered deployment stays disabled.

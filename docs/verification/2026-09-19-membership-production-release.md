# Current-handle sharing production release

Verified 2026-09-19, America/New_York. Owner explicitly approved the exact source
release, retaining `lecturesfrom` and excluding private transfer/publication.

## Released source and rollback

- Source `8b6aa9a2cd4fb452d7e5c54d54371f4a7580d594`.
- Vercel `groundskeep/proper-respect`, project `prj_yxsUnnPW0ka8mkFr7l66eUSzJgT8`.
- READY deployment `dpl_4oRkjCrgWWbTJYkDJCYyxmXD4ZN2`.
- Deployment URL https://proper-respect-d1paill0h-groundskeep.vercel.app.
- Production Convex `striped-chicken-693`.
- Collection https://proper-respect.com/onboarding redirects to the existing host.
- Rollback frontend `dpl_yek1HfE7u8QNa4E1cfWoCiopCnRU`, source `a2539b9`.

The approved binary diff hash matches. Only three runtime files differ from the
previous release. A clean source archive excluded local configuration and Git
history. Fresh Vercel configuration matched the approved Convex URL and live
Clerk mode; server-held secrets were neither exposed nor replaced.

Convex target, project/team IDs and prior READY frontend were verified before
mutation. A fresh private snapshot preceded the dry run and backend-first sync.
No schema/index deletion occurred. The Vercel build passed deployment preflight,
Next.js compilation and TypeScript, then ran its existing backend deployment
against the same verified target. Remote function specification has 77 functions;
retired restoration functions are absent. No Git push or PR merge occurred.

## Hosted behavior

The existing signed-in session reloads successfully. Eight sharing checkboxes
are unchecked, with unconfirmed discoveries disabled. There are zero misleading
“Already public” labels and no public-page link to the unpublished handle.
The page correctly states “Nothing is published at /lecturesfrom yet.”

Clicking only “Keep selected costs private” with no selections leaves zero
publication choices. Preview returns the current `lecturesfrom` identity and no
cards. “Publish this preview” stays disabled without the separate owner checkbox.
No publication approval checkbox, saved relationship or identity was changed.
The hosted browser error log is empty. This is an existing-session check, not
fresh sign-in proof.

The older `/keegan` page still displays its four previously published cards and
the existing GitHub account link. Anonymous curl returns 200 through the canonical
domain redirect; private source-record text is absent. `/lecturesfrom` and the
production-disabled evidence fixture return 404. A Python urllib probe returned
403 and is not counted as successful anonymous verification.

All 32 application tables are identical before synchronization, after backend
synchronization and after frontend/browser checks. That comparison includes
users/sites, relationships, evidence, links, credentials, cursors and published
snapshots. Private backups and detailed HTTP receipts remain outside Git.

## Limits and next work

Mobile collection acceptance remains open. With a requested 390px browser
viewport, the actual measured content viewport was 319px and document width was
447px. The overflow came from the existing 415.5px GitHub record selector inside
`.source`, not the changed sharing controls. Its stylesheet is unchanged by this
release. A screenshot showed cost buttons wrapping within the panel; this does
not establish a full mobile pass. The temporary viewport override was reset.

No private data transfer, provider read, recurrence, relationship change, handle
change or publication occurred. Richer retained evidence, owner target decisions,
fresh sign-in and final approved publication remain unfinished. Keeping the
account handle does not move the legacy public snapshot automatically.

Rollback must preserve publication guards and additive backend fields. Do not
restore data, rerun seeds, rotate credentials or enable collectors.

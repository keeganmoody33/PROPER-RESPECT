# Cursor continuation — Proper Respect

Updated: 2026-09-19. Canonical remote: https://github.com/keeganmoody33/PROPER-RESPECT.
Earlier released source: `d2266faff48bf764e56e93a8536d0fba9ab3783b`, available on
`origin/codex/cursor-handoff-20260919` and PR #22. The upload and GitHub branches
are reconciled. Verify current main/PR state before further Git operations.

## Current release — hosted discovery

Production application/backend now runs `7fa18a79cf07a9129955c7926d02fe85eeec90e1`,
Vercel `dpl_DRFWzieUj8ioeyPjXpQuXeZYpzUf`, Convex `striped-chicken-693`.
The owner approved hosted setup and this release. Origin and initial mailbox
encryption configuration are complete; the Google client still requires the owner's
Cloud passkey sign-in. Continue that approved setup without re-requesting approval.
No mailbox read, transfer or publication occurred; 32 existing tables are unchanged.
Read [the release receipt](verification/2026-09-19-hosted-gmail-release.md).
Older release details below are historical; development remains at `a2539b9`.

## Open the working product

Current production source is `8b6aa9a2cd4fb452d7e5c54d54371f4a7580d594`, released
with explicit owner approval to Vercel `dpl_4oRkjCrgWWbTJYkDJCYyxmXD4ZN2` and
Convex `striped-chicken-693`. Hosted sharing membership checks passed; all 32
application tables remained unchanged. Full mobile collection acceptance remains
open because the existing GitHub record selector overflows a narrow viewport.
See [the current release receipt](verification/2026-09-19-membership-production-release.md).
The older hosted-release paragraphs below are historical.

Local continuation now fixes that mobile selector overflow and removes brand
retrieval diagnostics from normal cards. Durable catalog/history discovery with
pause/resume/cancel is implemented and fixture-verified, but not deployed.
Hosted Gmail has no connected accounts or required mailbox configuration; prior
Gmail proofs were development-only. Continue from local HEAD, not the older remote
release. Read [the discovery receipt](verification/2026-09-19-durable-discovery.md)
for exact limits, checks and pending setup/release/consent gates.

The owner approved keeping the existing `lecturesfrom` account/site handle.
The `/keegan` restoration is cancelled and its undeployed helper is retired from
active source. Preserve the legacy four-card `/keegan` publication. At present,
`/lecturesfrom` has no published snapshot. Do not silently migrate or publish one.
See [the local sharing correction](verification/2026-09-19-publication-membership.md).

Production is synchronized at `8b6aa9a`; development remains at `a2539b9`.
This release did not authorize or perform a development synchronization. Existing-session development loading and anonymous query
rejection passed; all 32 application tables remained unchanged. No production
release, transfer or publication accompanied that earlier development synchronization.
The separately approved production release is recorded above. Read
[the synchronization receipt](verification/2026-09-19-profile-development-sync.md) and
[the dated readiness receipt](verification/2026-09-19-public-profile-readiness.md)
before restarting the local authenticated application or changing environments.

**September 19 hosted release:** https://proper-respect.com/onboarding forwards
to `props.lecturesfrom.com`. Application/backend `d2266faff48bf764e56e93a8536d0fba9ab3783b`
is deployed to Vercel `dpl_DD4jWfKFtrCKYAPxvK8ufntusCW6` and production Convex
`striped-chicken-693`. All 32 existing tables are unchanged. Existing signed-in
collection reload, export controls and sharing preview pass; private originals,
newer owner choices and live maintenance remain separate acceptance work.
See [the release receipt](verification/2026-09-19-hosted-release.md).

On this Mac, the accepted checkout is
`/Users/keeganmoody/Downloads/PROPER-RESPECT-self-test-20260916`.
Its ignored `.env.local` already contains development configuration.
Continue on `codex/personal-release-main`; do not switch to older local main. The original
`codex/proper-respect-self-test-20260916` branch retains private operator history
and must not be pushed to the public repository. Open this
folder in Cursor. Do not substitute the older dirty `Downloads/PROPER-RESPECT`
checkout or a frozen Codex worktree.

Read `AGENTS.md`, `docs/DEVELOPMENT.md`, this file, and the
[existing Ref](https://plan.ref.tools/oUl8LCIQb32SAicK). Inspect `git status` and
`git log -5 --oneline` before editing. Use pstack-codex as the primary workflow, per the September 19 owner correction.
Compound Engineering is available for focused supporting work.

For a fresh machine, clone the canonical repository's `main` branch, run
`npm ci`, and configure approved development credentials privately using
`docs/DEPLOYMENT.md`. Credentials and original evidence are not in Git.

Run `npm run dev -- --hostname localhost`, then open
`http://localhost:3000/onboarding`. Use the real owner sign-in; a new browser
session may need Google/Clerk consent. Do not seed or reimport to populate it.

## Continue from proven work

Application checkpoint `6bf69c2476c8f4eb0e94136b9c893c23ca3c878e` is synchronized
to development `utmost-mongoose-374` under the completed exact-target approval.
The upload fix retains JSON and other accepted exports as FILE_UPLOAD rather
than screenshots, with private supporting context. It does not parse usage.
See [the upload verification receipt](verification/2026-09-19-export-uploads.md).
The owner's actual Devin JSON retention remains unverified. The private collection already contains owner-saved
relationships. Real retained intake, owner review/save, reload, fresh sign-in,
Context.dev card branding and bounded Gmail discovery were verified. Exact
receipts are in `docs/verification/2026-09-18-personal-product-delivery.md` and
its JSON companion (public placeholders; detailed receipts remain private). Subsequent security updates do not reauthorize any source.

The product tells the owner's history with tools, including testing, go-to,
stopping and returning. Go-to and relationship changes remain owner decisions.
Email discovers possible relationships; product APIs/exports supply activity
when available. Brand data supplies presentation only. See
`docs/003-evidence-surfaces.md`; generic uploads do not yet authenticate images
or extract Screen Time automatically.

## Current integration

PR #22 implements private GitHub account destinations, optional account-link
sharing through explicit preview, and selectable connector activity snapshots.
Those changes are deployed with the upload correction. The sole merge conflict
was this handoff document. Full personal-release acceptance remains unfinished.
An added regression reproduced an unrelated source account identifier becoming
a GitHub profile. The correction requires both GitHub source type and GitHub
origin issuer before deriving an account destination from retained evidence. Do not publish private URLs or change owner choices during verification.

## Branch disposition checked September 19

PR #22 carries the reconciled release; verify its current review/merge status. Keep one active delivery branch, `codex/personal-release-main`.
Do not merge every branch to make the list shorter.

- `codex/composio-integration-20260918` at `00a097f` preserves explicitly incomplete
  integration work; consult `docs/COMPOSIO_CURSOR_HANDOFF.md` on that branch before
  resuming it. It is not an accepted production replacement.
- The Composio spike and onboarding prototype branches are retained references.
- `codex/proper-respect-self-test-20260916` contains private operator history and
  must never be pushed to the public remote.
- The original `Downloads/PROPER-RESPECT` checkout is dirty with local agent setup
  and generated files. Preserve it; do not sweep those files into this release.
- Frozen worktrees have Finder metadata changes. Leave them alone.

## Next unfinished work and exact gates

- Finish hosted acceptance and the scoped transfer of newer development-only
  private records and owner choices to the verified production owner. Never
  copy a development Clerk subject or replace the production database.
- Use the existing direct GitHub connector for the next supported activity
  refresh proof under exact source authorization. The retained GitHub/Wispr
  captures remain historical. No personal Wispr usage API is established.
- Additional Gmail reads are paused: the approved four pages/twenty headers
  were exhausted. Recurring collection remains off. Source reads, recurrence,
  development sync, release and publication retain their existing gates.
- Git-triggered Vercel deployment remains disabled in `vercel.json`. The
  September 18 manual production release was authorized and completed;
  subsequent releases retain their applicable approval boundary.
- **proper-respect.com on Cloudflare** has verified DNS and HTTPS routing to
  the existing host. Making it the primary host still needs matching Clerk,
  callback and canonical/OpenGraph configuration; do not remove the working
  redirect before authentication is ready there.
- Production remains `props.lecturesfrom.com` / Convex `striped-chicken-693`.
  Preserve its four curated public cards. Hosting does not approve publication;
  sharing needs the owner's exact preview approval and signed-out verification.

## Preserved work and PR audit

- Task 1, Gmail implementation and owner-auth fixes are complete; do not relaunch.
- Composio evaluation `b562bf0a6d6f296a62f2d1a5ea827e985f1177b3` is complete,
  separately preserved and unaccepted as a production replacement.
- Prototype checkpoint `b19ab3ea7b2c69ab5bdf7bc1089241ed94118b6e` stays separate;
  A/B remains unselected and does not block the working collection.
- PR #19's key fix is already included. PR #18's dependency proposal was stale;
  the current lockfile security repair replaces it. PR #17's old UI/seed must
  not replace current code; its useful metadata remainder is recorded above.
  PR #3's optional skill bundle is not adopted. Verify their current GitHub
  state before any further action.
- The checked-in CE example contains comments only; it activates no settings.
  The dated ideation HTML is historical research, not an approved work program.

Continue one coherent product. A successful local build, source merge or
development sync does not complete hosted acceptance or authorize publication.

Private, machine-local operator history is preserved at
`/Users/keeganmoody/Documents/PROPER-RESPECT-private/2026-09-18-cursor-operator-history`.
It is not required for an ordinary contributor clone and must not be committed.
Original checkpoints remain on the private local self-test branch. Public main
uses a source checkpoint without that private commit ancestry.

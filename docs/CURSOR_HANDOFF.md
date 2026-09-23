# Cursor continuation: Proper Respect

Updated: 2026-09-23. Canonical remote: https://github.com/keeganmoody33/PROPER-RESPECT.

## Current checkpoint

Continue from the accepted work and [release gaps #24](https://github.com/keeganmoody33/PROPER-RESPECT/issues/24).
Main includes PRs #25–64. Runtime changes from PRs #52, #58, #60, and #64
remain excluded from production.
The backend and frontend have distinct accepted commits. Read the
[release reconciliation](verification/2026-09-23-release-documentation-reconciliation.md)
for the exact SHAs, deployment, source comparison, and hosted evidence.

Production is native on `https://proper-respect.com`. The September 23 release
adds the empty-collection first-tool flow, private-save confirmation, and optional
public identity until sharing. Existing-owner collection access works. Fresh
hosted signup, email-code delivery, second-user isolation, and provider
reconnect/revocation remain unproven.

The owner wants the `lecturesfrom` handle. Its canonical migration is merged in
PR #52 but remains unreleased and unapplied. The four-card publication is still
at `/keegan`; `/lecturesfrom` returns 404. Keep the live URL in runnable examples
until the separately approved migration and public verification are complete.
Do not silently migrate or publish a profile.

## Continue in the accepted checkout

Read `AGENTS.md`, [DEVELOPMENT.md](DEVELOPMENT.md), this file, and the
[original Tasks 1–4 Ref](https://plan.ref.tools/oUl8LCIQb32SAicK). Track current
work in the [delivery Ref](https://plan.ref.tools/rjPzMsTtYGRHP7TA) and
[Ora Ref](https://plan.ref.tools/d6fedvHQMy4bpEJW). Inspect `git status` and
`git log -5 --oneline` before editing. Preserve the current accepted checkout,
Tasks 1–4, unrelated changes, dirty checkouts, and private operator history.
Never push `codex/proper-respect-self-test-20260916`; it contains private history.
Do not switch an
existing checkout to a historical branch or restart completed discovery runs.
Use pstack-codex as the primary workflow; Compound Engineering remains available
for focused supporting work.

For a fresh machine, clone the canonical repository's `main` branch, run
`npm ci`, and configure approved development credentials privately using
[DEPLOYMENT.md](DEPLOYMENT.md). A development checkout of main is not an approved
production release candidate. Run `npm run dev -- --hostname localhost` and open
`http://localhost:3000/onboarding`. Do not seed or reimport to populate an account.

Generic uploads preserve originals but do not authenticate images or parse usage.
Email discovers candidates and brand data supplies presentation; neither proves
usage. Go-to and relationship changes remain owner decisions. See
[source roles](003-evidence-surfaces.md).

## Remaining work

- Complete the fresh-user and two-user hosted acceptance checks recorded in #24.
- Prepare each held runtime change against the current accepted sources before
  requesting its release. A future GitHub backend candidate must retain the
  September 23 onboarding query; the older standalone candidate would revert it.
- Obtain exact source authorization before new provider reads. Retained GitHub
  and Wispr captures remain historical; no personal Wispr usage API is established.
- Keep additional Gmail reads and recurrence paused. The completed bounded runs
  and retained-only recheck do not authorize another run.
- Keep data transfer and owner choices separate from deployment. Never copy a
  development Clerk subject into production or replace the production database.
- Use exact owner selection and preview approval for publication, followed by
  signed-out verification. Preserve the four curated public cards.

Git-triggered deployments remain disabled. The repository's Vercel build invokes
Convex deployment; use the selective procedure in the deployment runbook for
future releases. The native-domain transition is complete and must not be
restarted from a September 19 checklist.

## Historical source corrections

The following entries retain the September 20 implementation history. Their
original verification receipts remain unchanged; current release status is above.

### PR #22 GitHub lookup correction, September 20, 2026

The owner authorized the Devin findings on
[PR #22](https://github.com/keeganmoody33/PROPER-RESPECT/pull/22) with review body
“Devin fixes”. GitHub private-card lookup now prefers a CONNECTED connector
account over historical proofs, and GitHub cards scan the newest 200 proofs
instead of the oldest 200. Owner-selected non-homepage links and publication
remain on stored primaries. This is still a bounded scan, not an exhaustive
search: a GitHub snapshot older than the newest 200 proofs can still be missed
when no CONNECTED connector exists. No new evidence index or current-account
table was added.

This correction is merged to `main` as `4df11b5fd3ff4e4747f61fa2d72998842970fd7b`
(head `a29ceab24db4a0bd3ac34e69e5140f6398937963`). At that checkpoint it was not deployed. The accepted September 23 sources
include the correction. This history does not authorize a new synchronization. See
[the lookup receipt](verification/2026-09-20-github-connector-precedence.md).

### Upload replay issuer binding, September 20, 2026

[Issue #24](https://github.com/keeganmoody33/PROPER-RESPECT/issues/24) first
item: verified `retainUpload` replay now requires the current
`tokenIdentifier` to match stored `uploadAttribution`. Legacy rows without
attribution still replay for the same owner. Merged to `main` as
`d27920adc5c0e6af3b7597a6e93126df0c5af490`. That merge was source-only; the accepted September 23 backend now contains
the issuer-bound upload correction. See
[the replay receipt](verification/2026-09-20-upload-replay-issuer.md).

### GitHub capture chronology, September 20, 2026

Without a live connector, GitHub snapshots inside the existing 200-proof
window rank by capture time, not proof attachment time. CONNECTED connector
and owner-selected links still win. Merged to `main` as
`e086131a03d7a68ea50b2feca298a11d152a40f5`. See
[the chronology receipt](verification/2026-09-20-github-capture-chronology.md).

### Unknown-product identity collisions, September 20, 2026

The merged #24 correction means unknown `app.*` hosts
no longer share the first hostname label as a slug. Derived identities use a
37-character SHA-256-derived key of the normalized full hostname, preserving
DNS label boundaries without exceeding the card key limit. Catalog matches are
unchanged. See
[the identity receipt](verification/2026-09-20-unknown-product-identity.md).

## Preserved work and PR audit

- Task 1, Gmail implementation and owner-auth fixes are complete; do not relaunch.
- Composio evaluation `b562bf0a6d6f296a62f2d1a5ea827e985f1177b3` is complete,
  separately preserved, unaccepted as a production replacement, and nonblocking.
- Prototype checkpoint `b19ab3ea7b2c69ab5bdf7bc1089241ed94118b6e` stays separate;
  A/B remains unselected and does not block the working collection.
- PR #19's key fix is already included. PR #18's dependency proposal was stale;
  the current lockfile security repair replaces it. PR #17's old UI/seed must
  not replace current code; its useful metadata work is now in the accepted source.
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

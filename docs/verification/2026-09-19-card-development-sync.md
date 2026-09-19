# Card preparation development synchronization

Date: 2026-09-19, America/New_York.
Approved application checkpoint: `e8834bea40d65c17b1cca5d027a7f2fa0e9b86a8`.
Target: **development `utmost-mongoose-374` only**.

## Target and synchronization

The accepted checkout was clean and exactly at the approved SHA. Ignored local
configuration and remote function-spec readback both identified
`https://utmost-mongoose-374.convex.cloud`. A private target file pinned
`CONVEX_DEPLOYMENT=dev:utmost-mongoose-374`; the shell had no deploy key.
The CLI also printed the approved development dashboard and URL before sync.

Root `npm run typecheck` passed. Convex's separate `--typecheck enable` attempt
stopped before synchronization because this repository has no
`convex/tsconfig.json`. The retry used the existing root TypeScript check and
`convex dev --once --codegen disable --typecheck disable --tail-logs disable`
with the pinned private `--env-file`, without changing source or configuration.
The CLI completed successfully at 05:58:10 local time.

Function-spec readback lists 73 functions, including
`productBrands:prepareForProps`, `productBrands:getPreparationForProps`, and
`mailboxGoogle:read`. The approved source includes the optional ambiguity
result in mailbox receipts. No seed, migration script, provider read or
relationship mutation was invoked.

## Data preservation

Private exports were captured before sync, after sync, and after authenticated
browser verification. All 32 application tables are identical across all three
exports after canonical record comparison. This includes source accounts,
credentials, cursors, evidence, relationship decisions, links, brand snapshots
and stored public profiles. Schema/system metadata is excluded.
Exports and detailed comparison files remain outside Git under the private
operator directory `2026-09-19-card-development-sync`.

## Actual application verification

The old local `next start` process was serving its prior in-memory build. It
was restarted in the accepted checkout using the already-verified approved
build, at `http://localhost:3000/onboarding`; no hosted application changed.

The existing signed-in Clerk session successfully accessed the synchronized
Convex backend. The current introduction and new preparation control render;
the control reports four ready products, zero pending and zero unavailable.
Existing valid snapshots were reused without adding generations or records.
The private collection shows one GitHub card. Its destination resolves to the
associated account, and its previously retained contribution calendar renders
with stale-snapshot and unknown-measurement-period labels intact. Computed
styles confirm retained Mona Sans on the expanded content, `overflow-y: visible`,
and no clipped content. No personal choice was edited or saved.

Anonymous access to the new preparation query rejects with
`Authentication required.` Fresh sign-in was not repeated; this verifies the
existing authenticated session and reload, not a new consent flow.

Duplicate-record interactions, ambiguous ingestion, parent-brand rejection and
mobile layout retain the prior automated/component evidence in
[the implementation receipt](2026-09-19-card-feedback.md). No real source read
was used to re-exercise those branches. No fixture was inserted into the owner
collection. The new runtime contains no duplicate owner/product records to use
for a real grouping test.

## Remaining boundary

Production remains unchanged by this operation. No push, deployment, usage
read, development-to-production transfer, recurrence, relationship edit or
publication occurred. Verified product-specific assets for NotebookLM, Copilot
and Devin Desktop, persistent ambiguity reconciliation, and the broader hosted
personal-release acceptance remain open. This sync does not authorize a
production release or additional source operation.

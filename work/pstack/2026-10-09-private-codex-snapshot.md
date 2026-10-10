# Private Codex snapshot: local implementation decision

Base: `f82bffa89c1ea5b3a49fb84ff88299867e48ed75`, the verified local selective integration of main, PR162, PR157, PR158 and PR161. This work is explicitly authorized as a local dependent slice. It is not a new release, PR, deployment, live-account read or public-profile write.

## User path and ownership

The owner opens one connected Codex source, selects one to seven UTC days, and saves a private snapshot to their Codex card. Existing measurement review selects exact rows. Existing sharing preview and hash-bound publication separately approve the public projection. Every server entry resolves the signed-in owner; no client total, source identity assertion, prompt, code or credential becomes evidence.

## Alternatives and decision

1. Submit displayed totals through the generic import path. Rejected: the browser would become the authority for a server-retained derivation, and the existing generic import says source-reported.
2. Load the whole source into a mutation/action array. Rejected: retained history can exceed 100,000 rows; mutation read and action memory budgets make this unsafe.
3. Chosen: page the existing source/key/fingerprint index through an authenticated action, stream distinct response groups, and atomically save a compact immutable projection in existing retained evidence. No new Convex module or generated-file edit is needed.

The window has an exclusive end. All variants of a response are reconciled before deciding window membership, including conflicts across timestamps. Legacy cumulative counters are excluded. Any conflicting selected response blocks all totals; missing quantities remain null. Integer strings stay exact. Coverage is partial, scope is one device, identity and activity actor are unverified. The new derivation is `SUMMED_RESPONSES`, never source-reported, cost, quota or proof of human work.

## Concurrency, lifecycle and compatibility

Each page and final mutation checks an owner/source checkpoint covering the current grant, packet sequence and monotonic source revision. Accepted ingestion, re-pairing, disconnect and erasure invalidate an in-progress save. An unchanged replay returns the same capture; tombstoned captures cannot return through replay. A new saved version of the same source/window requires a fresh review and preview. Different sources/windows remain non-additive entries. Later sync never silently changes an approved public snapshot.

Source erasure immediately blocks review/publication from its snapshots, then removes their private payloads and approvals in bounded batches. Tombstones remain for replay protection. Already published copies retain the existing separate owner unpublish boundary, stated in the UI.

The scan has explicit row, byte, page and elapsed-time limits. Each relationship retains the existing 32-capture/750KB history and 256-review limits. Empty modern windows create no card.

Modern private/public readers and preview/publish callers opt into `measurementVersion: 2`. Default readers omit new snapshots/summed rows. Legacy preview/publish callers reject a resulting profile containing unsupported summed rows, including preserved cards, rather than approving unseen measurements. Removing all cards remains available. Full JSON export stays faithful. Backend-first release is required; backend rollback after publishing summed rows must retain the widened stored-snapshot validator or first remove those rows through an owner-approved change.

## Verification and release boundary

Synthetic tests must cover ownership, unknown/exact counters, replay, cross-window conflicts, concurrent source changes, deletion, stale review/preview, modern and legacy readers/writers, and the browser private-save flow on desktop/mobile. Fixtures do not establish real Codex/Cursor account acceptance, Mac behavior, deployment readiness, or second-user acceptance. The receiver stack still needs owner-authorized generated API synchronization and development acceptance before release. No #123 receipt/recovery changes are included.

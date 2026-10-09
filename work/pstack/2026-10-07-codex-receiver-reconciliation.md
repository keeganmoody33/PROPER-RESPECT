# Codex receiver reconciliation

Source inspection: local `1fff45e`, main `6cf026b` (#156), PR #157 `a6c670b`.
Local merge `bb17d07` preserves both implementations. Attachment instructions are
historical input; the user's current permissions and the Cursor ownership assignment
control this work.

## Contract and module ownership

| Boundary | Owner and behavior |
| --- | --- |
| Codex counting | Existing `codex-history-collector.ts`: exact counters, response/fork identity, compaction exclusion, conservative legacy deltas. |
| Codex/Cursor complete reports | PR #157 `collector-contract.ts`: strict numeric reviews, complete manifests/chunks, chained checkpoints and matching receipts. Cursor contract and adapter remain unchanged. |
| Paged Codex sync | `usage-sync.ts` reuses shared Codex row schemas. Legacy rows require the opaque thread field for modern/legacy exclusion across separate deliveries. The shared legacy field is optional for older complete reviews. |
| Hosted authority | Convex `usageConnections.ts`: Clerk owner approval, one current grant per owner/source, immutable device/context binding, signed device proof, private evidence, durable receipts and bounded deletion. |
| Mac authority cache | `codex-companion.ts`: approved source pin, private atomic state, pending packets saved before send, checkpoint after matching ACK, acknowledged review digests saved after all ACKs. |
| Recurrence | `codex-sync-loop.ts`: foreground retry, disk reload each attempt, outage pauses reads, structured revocation/proof errors stop, local expiry stops even during outage. |
| Native acquisition | PR #157 reader serves its explicit bounded preview/complete-review fixture. The paged reader serves multi-window connection backfill and the OS lock. Both use descriptor-relative acquisition; their binary protocols and tests are separate. |

## Alternatives and decision

Sending every directory page as a complete manifest would claim completeness it
does not have. Replacing a window view could also remove earlier evidence when
files move between pages. The live Codex path therefore sends at most 200 strict
rows per transaction and preserves accepted variants. It shares numeric semantics
with the complete-report fixture without interpreting Cursor reports as Codex packets.
The receiver never writes a public snapshot.

Porting the entire SQLite service into a single Convex transaction would allow
8 MiB/128-chunk reviews to exceed hosted transaction budgets. Bounded numeric
packets make each acknowledgment atomic and each row lookup indexed. Source-wide
retention erasure processes at most 200 evidence rows or receipts per phase; no
unbounded grant scan is needed to revoke current authority.

A one-shot pairing exchange stranded the Mac if the activation response was lost.
The approved public key can recover the same grant during the original five-minute
deadline, with a fresh signed pairing proof. Other keys, revoked grants and expired
deadlines reject. Same-grant pairing preserves the local pending outbox.

Saving a scan digest before ACK would silently skip uncommitted evidence after a
crash. Saving it after every packet ACK allows safe replay and suppresses receipts
from unchanged polls. The digest ignores the changing end time of the currently
open window, but covers every numeric row. It is a bounded optimization, never
proof of complete coverage. Eviction or file reordering can cause safe replay.

The current source stores the latest retention consent. An older revoked grant
cannot override it when an owner disconnects the source. Every device operation
checks the source's current grant; a new approval fences old capabilities immediately.

## Coordination and acceptance

PR #157's Cursor adapter and its tests are integrated without modification.
The optional Codex legacy thread field does not change Cursor rows, report
replacement, grant fields, chunks or receipts. No callable cross-thread messaging
tool is available; this document records the contract for thread
`01a112e0-7bfe-7548-9a95-40a8afdbf0f3` and does not claim delivery there.

The research decisions in the original architecture continue to apply: explicit
active/archive selection (ccusage), stable response identity (Tokscale), historical
account uncertainty and distinct quota/cost categories (CodexBar), and checkpoint
advancement after upload acknowledgment (VibeUsage).

Actual values reached the session for the intended development deployment and
public Clerk app; the matching secret and backend issuer remain unverified. The
effective host policy blocks their live verification. Darwin and approved real
Mac backfill/restart/revocation remain acceptance gates. Linux fixtures and a
prepared macOS workflow do not clear them. No push, remote merge or deployment
occurred.

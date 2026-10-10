# Durable private collector connections

This document describes PR #157's complete-report fixture. The October 7
[reconciliation](../../work/pstack/2026-10-07-codex-receiver-reconciliation.md)
adds the authenticated Convex receiver for bounded Codex rows, sharing numeric
validation while retaining partial directory pages. Live configuration and real
Mac acceptance remain gated.

User direction, October 6, 2026: reuse the supplied Codex collector, implement
macOS acquisition and pairing/sync against fixtures, and keep live acceptance
paused until the development deployment and matching Clerk instance are verified.
The final gate remains an approved real Mac connection. Fixture success is not
that gate.

## Caller flow

```text
helper requests pairing for a named device/source and proposed access
signed-in owner inspects the request and approves a bounded grant
helper claims the grant with its private verifier
helper checks the grant, collects approved numeric history and saves an outbox
service validates chunks and atomically accepts the complete review
helper verifies the receipt, advances its checkpoint and clears the outbox
owner disconnects; subsequent collection and ingestion reject
accepted private history remains available under its retention authorization
```

The owner identity is supplied by the authenticated approval boundary. It is
never taken from a helper payload. Pairing proves the Proper Respect owner who
approved access; it does not verify historical Codex/Cursor account identity.
Personal/work context is an owner association, separate from measured facts.

## Ownership and alternatives

A local-ledger design would make the Mac authoritative for accepted history and
consent, with hosted copies. That simplifies offline results but duplicates
revocation and publication authority across devices.

The chosen service-ledger design makes the receiver authoritative for grants,
epochs, accepted history, receipts and checkpoints. The companion owns approved
acquisition and a durable outbox. It checks receiver authority before every new
read; an unavailable receiver pauses acquisition. Already staged deliveries
can retry after connectivity returns, while revoked or expired grants reject.

The implementation in this slice uses private SQLite stores and a loopback
fixture transport. It creates no Convex deployment, Clerk credentials, provider
login or production endpoint. A live Convex adapter remains a separately gated
integration. Database transactions are real; owner authentication is explicitly
synthetic in the fixture server.

## Modules

- `src/domain/collector-contract.ts` owns strict grants, sanitized review/chunk
  contracts, integrity identities and receipt validation. It has no filesystem,
  provider SDK or database dependency.
- `src/local/codex-history-collector.ts` owns response/fork/compaction and legacy
  counting. Its existing synthetic connection contract remains unchanged.
- `native/codex-rollout-reader.c` and `src/local/codex-rollout-native.ts` own
  descriptor-relative native acquisition and bounded subprocess transport.
- `src/local/cursor-report-adapter.ts` owns an explicitly complete supplied
  report, source-native metric parsing and report replacement semantics.
- `src/local/collector-service.ts` owns one-use pairing, owner/source isolation,
  generation fencing, validated staging and atomic durable acceptance.
- `src/local/collector-companion.ts` owns a private outbox, receipt verification,
  restart recovery, acquisition cancellation and local disconnection.
- `src/local/collector-private-store.ts` owns canonical, private, owned SQLite
  locations for both stores. It rejects links and unsafe permissions.
- Fixture server, CLI and browser tests exercise these boundaries. They cannot
  authenticate a live account or publish owner data.

## Recovery and measurement rules

The supplied collector rescans a bounded window. Do not infer durable file byte
offsets for files that move, compact or grow. Queue the complete sanitized review
before transmitting it. Send bounded typed row chunks, not arbitrary raw JSON
or transcript fragments. A changed chunk under the same identity rejects. Commit
the complete review, event variants and replay receipt in one receiver transaction.
Only the matching committed receipt can advance the companion checkpoint.
Checkpoint identity includes its predecessor, grant generation and descriptor,
so A to B to A to B cannot reuse a previous transition's receipt. A pending
delivery whose predecessor differs from current receiver authority uses an
authenticated delivery-status lookup. An already committed delivery recovers
its exact receipt without a new read. Stale unaccepted work is discarded under
the local revision fence, then collected again under fresh authority.

Codex response identities are scoped by connection/source and include owning
thread and response aliases. Repeated reads and active/archive copies do not
inflate totals. Conflicting variants remain visible. A later partial rescan
does not delete previously accepted responses. Legacy window reviews remain
separate replacements; overlapping legacy views are never summed. Cursor
complete-window reports replace the same source/window view only after complete
acceptance. Equal rows within one report remain distinct. Immutable sanitized
reviews are archived once per unique digest and remain inspectable by their
owner through the original receipt, including after replacement or revocation.
The final commit timestamp is checked against expiry inside the transaction;
expired work rolls back observations, archives, views, receipt and checkpoint.

Native counters remain exact strings. Unknown stays unknown. Cached input and
reasoning output are subsets, not additional total tokens. Source usage-cost
estimates, API-equivalent estimates, subscription payments and actual charges
are different metric families; this slice never manufactures the latter three.
Referral links, revenue and props have no dependency into measurement rules.

Sync changes private evidence only. The existing exact measurement review and
preview/publication gate remains the future disclosure boundary. No automatic
sync path writes public snapshots. Revocation preserves accepted private history;
deleting retained history or changing its retention permission is a separate act.

## Risks and proof gates

Rollout files contain mixed prompts, code and usage. Approval must disclose local
file reads; only allowlisted numeric fields leave the collector. Historical
provider identity remains unknown. Hashes do not authenticate an account.

The supplied scan bounds and seven-day windows are explicit coverage limits.
Backfill uses separate acknowledged windows, retaining partial/missing coverage.
Compressed files, referenced prefixes and ambiguous legacy lineage remain
excluded. A Linux run can prove portable native logic but cannot prove macOS
filesystem flags, permissions, signing, packaging or restart installation.

Required proof covers cancellation before reads; invalid/mutated files; duplicate
and conflicting data; lost acknowledgments; receiver/companion restarts; concurrent
delivery; cross-owner/source rejection; expiry and revocation during collection;
retained private results; and explicit public selection. Real Mac/platform tests,
verified development configuration and approved real history remain visible gates.

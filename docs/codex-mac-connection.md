# Codex Mac connection

Updated 2026-10-08, America/New_York. The approved development receiver and real
backfill, updates, restart, lost-ACK recovery and revocation passed on October 7:
see the [real Mac receipt](verification/2026-10-07-real-mac-connection.md).
The main grant expired at `2026-10-08T00:00:00Z`; the archive is revoked, retained
history remains private, and the foreground helper is stopped. Fresh acquisition
requires renewed scope. Mixed roots remain explicitly unclassified.

The October 8 local efficiency pass reconciles each validated numeric page once
across its time windows. The browser can reuse calculated totals while the same
owner's queried grant/checkpoint is unchanged. It bypasses that cache for revoked
sources, and clears it on failed loads. First loads still page retained history;
native acquisition still scans the selected tree. This pass changes no backend
schema or functions. See the [efficiency receipt](verification/2026-10-08-connection-efficiency.md)
for generated-fixture and retained-history proof; fresh real acquisition with
the optimized collector has not been run.

The local synthetic demo exercises the actual
connection panel, native reader, numeric collector, backend mutations, disk queue,
lost ACK recovery, private insight and revocation. Its backend is `convex-test`,
not a live Convex deployment.

## Run the local synthetic demo

```sh
npm ci --cache /tmp/proper-respect-npm-cache
npm run codex:connection:demo
```

Open `http://127.0.0.1:4179`. Copy the displayed synthetic source and device digest
into the form. Choose October 1, 2026 as history start and a future access expiry
within 31 days. Approve, copy the one-use code into the synthetic helper control,
and choose Pair synthetic helper and backfill. View private usage. The initial
response total is 40. Repeated sync retains 40; Add synthetic response changes
it to 80. Lose next acknowledgment leaves pending state on disk. Restart helper
and sync recovers it. Reload retains server evidence for the current demo process.
Disconnect rejects further sync and retains only the history approved for retention.

The demo's temporary directory contains generated synthetic history and a synthetic
device key. It is removed when the process stops. This demo does not prove hosted
backend persistence through restart. Convex transaction tests establish atomic
evidence/receipt behavior; a real deployment restart remains an acceptance gate.

## Review the development setup

```sh
npm run codex:development:check
```

This reports presence, target equality and key class without printing key values.
It never infers that two Clerk keys belong to the same app. The October 7 Mac
verification established matching development Clerk keys, issuer and `convex`
JWT template, then authenticated the owner against `dev:utmost-mongoose-374`
and `https://utmost-mongoose-374.convex.cloud`. That live proof supersedes the
earlier cloud executor's unknown credential binding and blocked network state.
Saved environment variables alone still do not establish authentication.

## Approve the real test before running these steps

Approval must identify the Mac, exact canonical source directory, personal/work
context, history start/end, expiry, permitted numeric fields, local state location,
retention choice, and development destination. A source containing both personal
and employer activity must be split or explicitly authorized for its selected
context. Present-day login cannot identify past history.

The proposed acquisition is read-only `rollout-*.jsonl` under the selected directory,
including selected active and archived history. The reader never opens `auth.json`,
credential stores or arbitrary files. No home discovery, auth RPC or Codex process
launch occurs. Local source records may contain prompts and code; the local parser
discards them. Only the numeric allowlist, opaque identities and required time/
status metadata enter packets. Device private keys stay on the Mac; public keys
and signed proofs authorize requests. Pairing codes can activate only the approved
device. That device can recover a lost pairing response within the original
five-minute deadline; a new signature is required. Revocation prevents recovery.

Installation, compiling the helper on the Mac, real acquisition, uploading numeric
history, foreground recurrence, and any persistent installation require the user's
scoped approval. Publishing the branch, merging and development deployment require
separate approval. Production `striped-chicken-693` is refused by this implementation.

After approved installation, verify Node 24 and a C compiler, then build and run the
host fixture checks on Darwin:

```sh
npm run codex:mac:check
```

Use canonical Mac paths. `/tmp` is commonly a symlink on macOS; test fixtures
resolve it to `/private/tmp`. Symlinked source roots or ancestors are rejected.
The tests cover ancestor rename, mutation during reads, symlinks, hardlinks,
partial writes, invalid UTF-8, paging and lock recovery. Passing them on Linux is
not evidence that they pass on Darwin.

Once the reviewed development backend is approved and deployed, run the local app
with the matching development credentials and use `http://localhost:3000/app/connections`.
Create an approved private state directory with mode `0700`. In the following
commands, replace the paths with those in the approval. Prepare creates a key and
pins the selected source; it does not read history.

```sh
node --experimental-strip-types scripts/codex-companion.mjs prepare /approved/private-state/state.json /approved/canonical/codex-history
node --experimental-strip-types scripts/codex-companion.mjs pair /approved/private-state/state.json
node --experimental-strip-types scripts/codex-companion.mjs sync /approved/private-state/state.json
```

Copy the helper's source identity and public-key digest into the app. The owner
approves the personal/work context, history window, expiry and retention choice.
Enter the app's one-use code in the helper within five minutes, then run sync.
The exact destination is `https://utmost-mongoose-374.convex.cloud`.
`identity` displays the existing source identity and public-key digest for
re-pairing after expiry. It never displays the private key. HTTP requests stay on
the approved origin, refuse redirects and have a 60-second abortable deadline.

With separate recurrence approval, `watch` runs foreground sync every 30 seconds
after the previous pass completes. It does not install a daemon or login item.
Interrupted reads and receiver outages retry. During an outage no new source
read begins; the pending numeric queue remains on disk until authority returns.
Revocation and expiry stop the loop. Retries reload the durable queue.
Stop it with Ctrl-C. The OS lock releases on process exit. Restarting the helper
reloads pending numeric packets before new acquisition. Lost ACK retries use the
same packet identity and a fresh signed proof. The server saves evidence and the
receipt in one transaction before returning ACK. Private state writes use `0600`,
atomic replacement and fsync.
Acknowledged review digests suppress unchanged uploads after restart. They are
saved only after all packets in a review have receipts. A crash before that save
may replay accepted rows safely. Evicting the bounded digest cache is also safe.

Disconnect in the app immediately revokes access for the source. The latest source
retention approval governs disconnect, including requests through an older grant.
The prepared source cannot change its device or personal/work association.
Queued replays
are rejected too. If retention was declined, server-side deletion continues in
bounded jobs even if the browser closes. With retention approval, history remains
private until erased or authorization changes. Erase imported history removes
evidence and packet receipts. The revoked grant remains to reject old capabilities.
`forget` removes the local key/state; server revocation still requires Disconnect.

## Coverage and acceptance

Modern response identity, archive copies, forks and compaction rules come from
the attached collector. Legacy increases remain separate. Backend conflicts do
not resolve to a maximum or a smaller plausible total. Modern evidence suppresses
legacy accounting for the same thread. Historical account identity stays unverified.
Quota, API-equivalent estimates and actual charges remain unavailable from this
source. Private ingestion does not publish profile facts.

Original raw-reader pages read at most 64 files/32 MiB, with a 4 MiB file limit, 256 KiB line
limit and five-second native budget. Enumeration is bounded at 100,000 entries.
Each collection window is at most seven days; a grant covers at most 366 days
and expires within 31 days. UTC precision is currently limited to milliseconds
by the attached collector. Unsupported precision, malformed files, live mutation,
links and incomplete final lines fail closed. Previous accepted history remains.
These are the original raw-reader limits. The active streaming companion path
instead reads at most 512 MiB/64 files per native page, with a five-second native
deadline, a 64 MiB line bound, and a 32 MiB/100,000-line numeric projection bound.
Malformed files remain whole-file coverage gaps. These bounds were checked against
the approved Mac on October 7; see the real Mac receipt for exact dispositions.

Each pass replays the tree, including archive movements. The scan-local page cursor
does not establish complete history or become a durable usage checkpoint. Movement
between pages can leave a gap in a pass; later rescans can recover it. Coverage
stays partial, and gaps never become measured zero. Large histories may need a
longer pass; recurrence waits rather than overlapping reads.

Final acceptance requires approved real history backfill, independent token checks,
fresh updates, actual helper/process restart, lost-ACK recovery, backend persistence,
owner/context isolation, expiry and revocation on the intended development target.
The receipt must distinguish fixture results from that proof.

## Shared contracts and research

[Architecture and ownership](../work/pstack/2026-10-07-codex-mac-private-sync.md)
defines the shared consent, device proof, receipts, checkpoints and revocation.
Cursor report accounting belongs to thread `01a112e0-7bfe-7548-9a95-40a8afdbf0f3`.
PR #157's adapter and complete-report fixture are integrated unchanged. The live
Codex receiver reuses its Codex row schemas. An optional opaque legacy thread
field permits modern/legacy exclusion across packets without changing Cursor
contracts. No available tool could deliver a message to that thread. See the
[reconciliation decisions](../work/pstack/2026-10-07-codex-receiver-reconciliation.md).

The kickoff research was carried forward and source rechecked on October 7.
All four inspected repositories declare MIT licenses; no implementation was copied.

| Source and inspected commit | Design input reused |
| --- | --- |
| CodexBar `d919d2387ede5dc73eba9c32be1eb1a20690425d` | `CodexAccountReconciliation.swift` distinguishes live, managed and profile sources. `CodexExtraUsageCost.swift` keeps credits, caps and balances separate. Current login is not historical identity. |
| Tokscale `d4d1c751856e25913bce97bfbd7b254308863239` | `crates/tokscale-core/src/sessions/codex.rs` documents session identity across active/archive history and mutable cumulative totals. |
| ccusage `1b445ce44275904b3615f586e816dfaa85ec52e2` | `rust/adapters/codex/src/paths.rs` separates home discovery from active/archive sources and shared deduplication scope. ProperRespect requires explicit selection. |
| VibeUsage `4891a5882781e2fff65bf4f7b6609d521265ae98` | `src/lib/uploader.js` saves queue offsets after upload results. Its pairing/queue pattern informed durable ACK sequencing; project metadata and credential collection were excluded. |

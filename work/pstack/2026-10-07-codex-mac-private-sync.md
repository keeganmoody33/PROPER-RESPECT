# Codex Mac connection design

Inspected local and remote main `6cf026b11499854b53f8aaae01f9a133df7578dd`.
#154 and #156 are present. The attached collector patch matches SHA-256
`a52dd054d44633635d00aad17b3532a6e2ee22b530c29ed1c8f3d36c7f28e1dc`
and passed `git apply --check` before integration. Its instructions are historical
design input; the current user's request controls permissions and ownership.

## Usage and ownership

The owner chooses personal or work, an explicitly unbound local source, a history
start, an expiry, and whether already imported history may be retained. The Mac
helper creates a P-256 signing key and a source identity. The signed-in owner
approves the helper's displayed identities and one-use pairing code. The helper
exchanges that code with a signed proof, checks the grant before acquisition,
reads the selected directory, projects numeric evidence, and sends bounded packets.
The server transaction stores evidence and the receipt before returning an ACK.
The helper records pending packets before sending and advances only after ACK.

`usage-sync.ts` owns the versioned envelope and Codex evidence validation. This
transport contract does not define Cursor report replacement or counting rules.
`usageConnections.ts` owns authenticated consent, device binding, expiry,
revocation, receipts, and private persistence. `codex-companion.ts` owns the local
queue and approved reads. The existing collector owns response/fork/compaction
accounting. A small native C reader owns `openat`, `fstatat`, `fdopendir`, and
descriptor-relative acquisition on Darwin. The browser never receives local paths.

## States and contracts

Pairing is pending, exchanged, expired, or revoked. Grants are device-bound,
source-bound, context-bound, and explicitly account-unbound. A pairing code lives
five minutes. The server stores the public key and its SHA-256 digest. The
private key never leaves the Mac. Status proofs bind the grant; ingest proofs bind
the grant and exact packet digest. Proofs expire after 30 seconds and retries sign
again. The helper's private state contains its key, pending packets and acknowledged
sequence. A grant is checked before every scan and inside every ingest transaction.
Expiry requires new consent. Disconnect rejects retries as well as new packets.
Retention is the owner's explicit grant decision; deleting retained history removes
the source's evidence and receipts, while keeping revoked grant state.

Packets contain exact decimal counters, opaque identities, UTC timestamps,
coverage, and accounting status only. They contain no prompts, source paths,
repository names, code, tool output, auth stores, quota or price estimates.
Modern response evidence and legacy observations remain separate. Conflicting
variants remain visible. Source identity stays stable across re-pairing; context
cannot change on re-pairing. Identical evidence across selected devices is counted
once per source, without claiming verified historical account identity.

## Flow and failure

Selected directory → native read → existing numeric projection → bounded packets
→ durable pending queue → authenticated transaction → receipt → local checkpoint.
Lost ACK repeats the pending packet. Server restart does not lose persisted data.
Helper restart sends pending packets before acquiring again. Scan failures keep
prior evidence and report partial coverage. Seven-day slices allow older history
within a user-approved bounded overall range. Rescans preserve event identities
instead of treating a filesystem offset as proof of accounting completeness.
Native pages contain at most 64 files and 32 MiB; scans restart from the root after
process restart. Native enumeration uses a scan-local cursor, never a trusted
usage checkpoint. File movement between pages can leave gaps in one scan, so
coverage stays partial and subsequent scans replay the tree. The server merges
response identities and conflicts across pages. No cross-page completeness claim
is made. The OS lock releases on process exit, rather than trusting a stale PID.

## Alternatives

An official hosted account route would avoid local filesystem acquisition but the
existing pinned app-server adapter has unresolved containment and hosted auth
constraints. It also does not establish past-history account identity. This design
uses selected numeric history without reading credentials or launching Codex.

Full snapshot replacement is simpler, but moved or missing files can erase earlier
authorized evidence. Append-only evidence with transaction receipts preserves it
and quarantines conflicts. This choice requires bounded pagination and explicit
deletion instead of silently taking a newest total.

## Coordination and risks

Cursor report adapter belongs to thread `01a112e0-7bfe-7548-9a95-40a8afdbf0f3`.
No thread messaging capability is exposed here. This document is the reviewable
coordination contract, not proof of delivery to that thread. Cursor must add its
own versioned report body and completeness rules; it must not pass report rows to
the Codex evidence endpoint. Existing fixture lifecycle contracts remain intact.

Linux native tests cannot prove Darwin filesystem behavior. Mac fixture tests,
approved installation/access/upload, matching Clerk development identity, live
development backend, restart acceptance and revocation remain release gates.
No deploy, push, merge, real history access or persistent installation is authorized.

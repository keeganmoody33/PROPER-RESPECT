# Bounded Codex connection prototype

Base: `51e5224f60fafb141029235fceeb41fa101d701e`, reviewed October 6, 2026.

## Try the fixture

Run `npm ci`, then:

```sh
node scripts/codex-connection-preview.mjs --out /tmp/codex-connection-demo
python3 -m http.server 8765 --bind 127.0.0.1 --directory /tmp/codex-connection-demo
```

Open `http://127.0.0.1:8765`. The output directory must be new. This is a local
static prototype, not a production route. No account, filesystem, authentication
store, provider process or network endpoint is connected. Its browser bundle
contains synthetic fixtures. Refreshing the page clears the in-memory demo.

1. Choose Connect. Inspect the named synthetic source and seven-day window.
2. Cancel. No acquisition occurs.
3. Connect again and approve. The first bounded acquisition runs automatically.
4. Initial observed increases total 150 tokens. Sync again retains 150.
5. Simulate new usage. The next sync raises the observed total to 200.
6. Disconnect. The current page keeps retained history but cannot acquire more.
   Reconnecting requires new approval and replays the same observations safely.

The grant expires after ten minutes. Each read lasts at most five seconds and
cannot commit after expiry or disconnect. No recurring collection is installed.

## What this proves

The small connection owner controls approval, expiry, concurrent reads, failure,
retry and disconnect. The source description is pinned for the whole grant.
A returned change to provider, source, device, source kind or collector version
rejects the batch. Unknown account identity stays null. Present-day login is
never used to label historical activity.

`src/local/usage-connection.ts` owns the lifecycle and atomic retention.
`src/local/codex-history-collector.ts` translates a deliberately restricted
synthetic Codex event format into allowlisted counters.
`src/domain/connection-history.ts` owns exact cumulative reconciliation.
The UI owns only presentation and explicit button actions.

A collector returns sanitized cumulative observations with opaque stream aliases,
UTC instants, native metric/unit and exact decimal integer strings or null. It
cannot append arbitrary provider payloads to the retained schema. The receiver
validates the batch, pinned source and requested time bounds before committing
any of it. A failed read retains the last good history and a generic diagnostic.
Raw error messages are not exposed.

The lifecycle is provider-independent for this local-history contract. A Cursor
report adapter would need its own report identity, complete-page checkpoint and
replacement semantics. It must not reuse cumulative-log reconciliation merely
because both sources contain token counts. Other source kinds are not enabled
by this prototype.

## Counting rules

The first known counter in each stream is a baseline. Later nonnegative
cumulative differences count as observed increases. Values use BigInt arithmetic
and remain strings, including values beyond JavaScript's safe-integer range.
Input, cached input, output, reasoning output and total counters stay separate.
Cached/reasoning counts are subsets, not extra tokens to add to totals.

A missing counter stays null and interrupts the baseline. A subsequent known
value establishes a new baseline rather than bridging an unknown interval.
An actual measured zero stays zero. The displayed total means the sum of known
increases only, with partial coverage. It is not a complete account lifetime total.

Within the one synthetic source, the collector supplies a stream alias and UTC
observation instant. Repeating that position and value is a replay. Different
values at the same position quarantine the stream. A cumulative decrease also
quarantines the stream because a reset has not been established. A conflicted
metric produces an unknown total; it is never silently removed from a plausible
smaller total. Identical counts at different instants can be legitimate zero
increments and remain separate observations.

No cross-device deduplication or historical-account attribution is claimed.
Synthetic session aliases are supplied by the fixture manifest, not discovered
from private filenames. New collectors must establish stable identities and
proven replay boundaries. Content hashes alone cannot prove event identity.

## Deliberate limits

- Seven-day half-open history window, with an inclusive start and exclusive end
- Ten-minute approval, five-second read deadline, no automatic background timer
- At most eight fixture files, 1,000 input lines and 256,000 source bytes per read
- At most 1,000 retained sanitized observations and 256,000 returned JSON bytes
- Only synthetic, unauthenticated, account-unknown local history is accepted
- No file-picker, path option, directory discovery, auth lookup or real rollout read
- No hosted storage, durable checkpoint, public sharing, pairing token or installation
- No account lifetime/quota/billing acquisition and no dollar estimates

The restricted parser only understands fixture `event_msg`/`token_count`
cumulative counters and ignores synthetic `response_item` content. It rejects
other event shapes, session metadata, fork and compaction formats. This is an
intentional fail-closed limit, not compatibility with genuine rollout files.

## Why this shape

Two approaches were considered. Adding Connect to the existing account snapshot
importer would incorrectly suggest that the disabled native adapter had been
cleared, and would blur account snapshots with local token history. Instead,
this prototype isolates one consent lifecycle and one fixture collector. It
reuses the project's exact JSON decoder and follows its existing private,
non-additive measurement rules without changing hosted schemas or native gates.

Before a real connection, separately establish helper installation and consent,
read-only collection boundaries, stable session/response identity, fork/archive
handling, original-account attribution where available, durable replay-safe
checkpoints, transport pairing/revocation and persistence. If official account
RPCs are included, resolve startup containment, account selection and applicable
hosted/commercial authentication eligibility. The existing native-adapter
blockers remain unchanged.

The browser cannot discover or read local Codex history by itself. A real local
companion would sanitize approved sources before transmission; that companion
and transmission approval are outside this prototype.

## Verification

Focused tests cover automatic backfill, consent/cancel, duplicate sync,
concurrent calls, exact arithmetic, unknown counters, conflicts, source changes,
expiry, stuck reads, disconnect during acquisition, retry and retained history.
Browser tests exercise the generated artifact at desktop and mobile widths,
including cancellation, replay, new fixture usage, failures and disconnect.
See the dated verification receipt for actual check results and limitations.

## Architecture check against a second provider

The lifecycle pins the owner alias, provider, source, device and collector version.
That permission boundary is reusable. The cumulative accounting policy is not a
shared definition of all provider usage. A report-style Cursor fixture therefore
rejects at the local-history boundary without altering retained Codex history.

A future Cursor adapter would need a complete account/window report before it
replaces a prior report. Equal rows can be legitimate separate events. Its own
source contract must establish pagination completeness and event identity before
any deduplication. This prototype does not add a speculative provider framework
or force remote report pages into cumulative observation streams.

The architecture decision is to share the bounded connection lifecycle and keep
acquisition, checkpoint and counting semantics with the provider/source adapter.
The current implementation proves only the local-history branch of that design.

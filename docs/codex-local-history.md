# Codex local numeric history collector

This command reads a selected directory of genuine-format Codex rollout JSONL
and emits a private numeric review. The implementation is exercised with
synthetic official-format fixtures. It has not been verified against an actual
account or private session history.

The command requires Node.js 24. Linux can use its descriptor reader directly.
macOS requires an explicitly compiled native reader, described below. This
preview command does not install a helper, connect the hosted app or enable the
existing native account RPC adapter. The separate durable connection fixture
exercises pairing and sync with synthetic sources only.

## Run the included fixture

From the repository root after installing dependencies:

```sh
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/codex-history-preview.mjs \
  --directory "$PWD/tests/fixtures/codex-rollouts" \
  --start 2026-10-01T00:00:00.000Z \
  --end 2026-10-08T00:00:00.000Z
```

The expected response total is 30 tokens. The separate legacy observed increase
is 20 tokens. The active/archive copy counts once. These numbers are fixture
values, not the user's activity.

The narrow Node warning flag suppresses a module-format startup warning that
otherwise prints the checkout path. It does not suppress application errors.
The command's own errors omit paths and source excerpts.

For an operator-authorized real read, replace the directory with one explicitly
selected absolute directory and choose a UTC window of at most seven days.
There is no default path, home-directory discovery, environment lookup, or
current-login lookup. Selecting a staging directory containing only the intended
rollouts makes the read boundary easiest to inspect. The command writes only to
stdout. Redirecting that output is an operator choice.

The JSON review contains two separately labeled groups:

- responses: source-reported usage from completed response records
- legacy: validated increases between older cumulative UI snapshots

There is no combined total, price estimate, quota, subscription charge, or
account lifetime claim. Cached input, cache-write input and reasoning output
remain detail counters. They are never added to the reported total.

## What counts

A file's first session_meta.id owns the file. Later copied metadata does not
rename it. Only token_usage_record rows whose thread_id matches that first ID
can count. This excludes ancestor responses copied into forks, including copies
whose timestamps changed. Missing ancestor files do not make those responses
new child usage.

The stable event identity is the owning thread ID plus response ID. Both become
opaque SHA-256 aliases before output. File names and archive locations do not
identify events. Distinct response IDs at the same millisecond remain distinct.
Exact duplicates replay once. Conflicting counts or timestamps for the same
identity remain quarantined. No variant is silently selected.

Only usage is counted. turn_token_usage and thread_token_usage are cumulative
snapshots. compacted.latest_token_usage_record is a checkpoint of an old event.
None of those is a new charge. A genuine model-backed compaction response with
its own token_usage_record does count once.

If any accepted response record exists for a thread, that thread's legacy
snapshots are excluded. Older cumulative counters never fill gaps in a modern
response ledger. Missing completed-response records remain missing coverage.

Legacy root threads use the existing cumulative reconciler. The first known
sample is a baseline. A subsequent increase must agree with last_token_usage
for every available counter. Missing values, resets, unmatched changes and
synthetic total-only context-window fills start a new baseline. A compaction
also starts a baseline, conservatively losing any increase that cannot be
established across the boundary. Same-instant incompatible vectors quarantine
all metrics of that legacy segment.

A pre-window baseline can establish the first in-window increase but is never
returned. Endpoints are inclusive start and exclusive end. Timestamps finer
than milliseconds reject rather than round. All counters retain their original
integer lexemes and use BigInt arithmetic. Missing counters stay unknown.

Unnumbered legacy forks have no reliable own-history boundary. This version
excludes legacy accounting for forks, subagents, and referenced histories,
rather than assigning inherited usage to the child. Modern own-thread response
records in those files remain usable. It never follows history_base references.

## Read and privacy boundaries

The Linux reader pins directory descriptors, opens each component without
following links, and verifies file and directory identity before accepting the
result. It rejects symlinks, hardlinked rollout files, special files, replaced
entries, changed files and incomplete final lines. Concurrent writes can make a
read fail; retrying after the writer flushes does not erase earlier saved output.

The scanner visits at most five levels, 1,000 directory entries and 64 matching
files. A matching file is named rollout-*.jsonl. Limits are 4 MiB per file,
32 MiB total, 100,000 lines, and 256,000 bytes per parsed JSON line. The shared
exact decoder also bounds nesting and structure sizes. All acquisition,
validation and serialization must finish within five elapsed seconds; final
output is capped at 8 MiB. Any failure rejects the whole review.

Prompts, code, instructions, tool output, paths, credentials, model labels and
account metadata are not retained or uploaded. They may be transiently decoded
inside the selected local files before allowlisted numeric projection. Original
thread/response IDs are hashed. Account identity stays null even if current
source metadata includes an account ID. Source files are unauthenticated, so
neither the hashes nor numeric counts prove who performed the activity.

Compressed .jsonl.zst files are ignored, and the scan reports ignored-entry
counts. This is a known coverage gap. Other devices, unselected directories,
referenced prefixes, missing records and excluded legacy ranges also limit
coverage. No empty or partial scan is labeled complete.

## Replay and connection integration

Each run reconstructs a complete bounded review from the selected directory.
Rerunning replaces that review; it does not append totals to a prior run. This
avoids inventing durable byte offsets while rollout files can move, compact,
revert or grow. No checkpoint file is created in this slice.

A paired helper uses this numeric projection behind an explicit
owner/device/source/window grant. The local fixture now implements short-lived
pairing, grant checks, typed numeric delivery, durable receipts, private storage,
restart recovery and disconnect. See [the architecture](architecture/collector-connection.md)
and [fixture instructions](collector-fixture-ui.md). Live acceptance still needs:

1. A supported signed helper and filesystem picker for the target OS
2. Verified development Convex and matching Clerk identity, plus the live
   authenticated receiver adapter
3. Approved real Mac evidence of backfill, updates after restart, replay and
   revocation through that receiver
4. Deliberate sharing through the existing authenticated publication flow

The existing UsageConnection fixture lifecycle is useful for those tests, but
its synthetic descriptor is not widened here. No helper installation, account
access, persistent grant, transmission, merge or deployment occurs in this
command.

## Sources and license

The independent parser was checked against official Codex source at
[c0c230e](https://github.com/openai/codex/tree/c0c230e6730b3b3c9101b8aff4b9aea4027cea5b).
Relevant contracts are the [rollout wire format](https://github.com/openai/codex/blob/c0c230e6730b3b3c9101b8aff4b9aea4027cea5b/codex-rs/history/src/rollout_payload.rs),
[token structures](https://github.com/openai/codex/blob/c0c230e6730b3b3c9101b8aff4b9aea4027cea5b/codex-rs/protocol/src/protocol.rs#L2219-L2325),
[response recording](https://github.com/openai/codex/blob/c0c230e6730b3b3c9101b8aff4b9aea4027cea5b/codex-rs/core/src/session/mod.rs#L4703-L4735),
and [fresh timestamps on copied records](https://github.com/openai/codex/blob/c0c230e6730b3b3c9101b8aff4b9aea4027cea5b/codex-rs/rollout/src/recorder.rs#L2085-L2110).
The source uses [Apache-2.0](https://github.com/openai/codex/blob/c0c230e6730b3b3c9101b8aff4b9aea4027cea5b/LICENSE)
and includes a [NOTICE](https://github.com/openai/codex/blob/c0c230e6730b3b3c9101b8aff4b9aea4027cea5b/NOTICE).
No upstream implementation was copied. The committed fixture data is synthetic.

## macOS acquisition and remaining proof

The numeric parser is platform-independent TypeScript. Linux provides
descriptor-relative paths under /proc/self/fd;
Node 24's public filesystem API has no openat or fdopendir equivalent. Checking
absolute paths before and after a read would detect some substitutions only
after bytes had already been read, so it is not the same boundary.

Apple's [filesystem flags](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/sys/fcntl.h)
include O_NOFOLLOW_ANY, but that does not make Node's directory iteration
descriptor-relative. The new portable C reader uses openat/fdopendir and is
connected to this parser through bounded private IPC. Compile and select it
explicitly:

```sh
node scripts/build-codex-rollout-reader.mjs --output /absolute/new/reader
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/codex-history-preview.mjs \
  --directory /absolute/approved/rollouts \
  --start 2026-10-01T00:00:00.000Z --end 2026-10-08T00:00:00.000Z \
  --native-reader /absolute/new/reader
```

The native symlink, ancestor-rename, hardlink, partial-write, mutation and CLI
tests passed on Linux. GitHub Actions run
[`37531009381`](https://github.com/keeganmoody33/PROPER-RESPECT/actions/runs/37531009381)
succeeded at `a6c670b6fc71b418d608c75d612c06112195a701`, including compilation
and the synthetic native acquisition/durable-sync step on a macOS runner.
This is synthetic platform evidence, not owner-device acceptance. Packaging and
signing remain unfinished. See
[native acquisition details](codex-macos-acquisition.md).

The [development Mac connection](codex-mac-connection.md) adds a signed-device
Convex receiver and bounded, durable numeric backfill. The complete-report
SQLite fixture remains a reference for the shared Codex/Cursor contract. Neither
fixture success nor this integration establishes fresh approved real Mac acceptance.
The [October 7 receipt](verification/2026-10-07-real-mac-connection.md) records
historical development acceptance at its stated source and scope.

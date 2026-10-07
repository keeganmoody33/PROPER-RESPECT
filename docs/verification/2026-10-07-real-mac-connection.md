# Real Mac connection verification

Date: 2026-10-07, America/New_York.

Imported `17f8a52e2e7c43d3785303d62cc15131c98ca5eb` from the supplied
bundle into `codex/real-mac-sync-20261007`. The original checkout at
`884db6b6d5f7e079a4d42cf158f1d78512bc4063` and its untracked changes remain intact.

## Live prerequisites

- Darwin arm64, Node v24.19.0, Apple clang 21.0.0.
- Imported Mac check: 141 passed, 3 skipped. Imported typecheck passed.
- Only destination: `dev:utmost-mongoose-374`.
- Development Clerk public/secret keys match the same development instance.
  The backend issuer matches, and the `convex` JWT template exists.
- Before deployment, the live query returned `Could not find public function for 'usageConnections:list'.`
  The owner approved receiver-only development deployment on 2026-10-07.
  The deployed query now exists and rejects unauthenticated access.
  No Git push or merge is authorized or performed.
- The owner authorizes all local usage history. Historical account attribution
  remains unverified; mixed history must not be relabeled personal or work.

## Findings and dispositions before changes

1. Fix now: the native reader rejects real files larger than 4 MiB and content
   lines larger than 256 KiB. The actual history exceeds those limits. Add a
   bounded streaming acquisition path, discard content locally, and preserve
   descriptor, mutation, cancellation, and approval checks.
2. Fix now: the grant requires a personal/work label for an entire root, but the
   authorized roots contain mixed contexts. Add an explicit unclassified context;
   preserve isolation from existing personal/work sources and never infer labels.
3. Fixed after owner approval: the development receiver was absent. Deploy only
   the reviewed receiver while preserving existing backend behavior and tables.
4. Fix now: the first real scan exceeded the collector's per-window result bound.
   Dense windows now split in time while retaining complete lineage/baselines.

## Candidate changes and local evidence

- The existing raw native reader remains available unchanged. A streaming build
  reuses its descriptor-relative traversal, file identity, and ancestor checks.
  It streams at most 512 MiB/64 files per page through a local pipe with a
  five-second native deadline. The TypeScript consumer retains usage records,
  reduces metadata to lineage, and discards prompt/code content locally. No
  projection returns before a successful child exit and final identity checks.
- Malformed files are excluded as whole-file coverage gaps, with their count
  reported by the helper. Existing raw-reader rejection tests remain intact.
- Whole-root mixed history is explicitly `unclassified`, with historical account
  identity still unverified. It cannot replace a personal or work source.
- Real local acquisition traversed both canonical roots. One malformed file was
  excluded. A separate Python parser matched every accepted modern response at
  the recorded snapshot cutoffs, with no missing or unexpected numeric records.
  Detailed counts, timestamps, and numeric originals remain outside Git.
- Initial local acquisition sent no history packets. The subsequent approved
  live tests below sent strict numeric packets only. Token counters do not
  represent bills or quotas.

## Candidate checks

- `npm run codex:mac:check`: 147 passed, 3 skipped, 16 files passed.
- `npm run typecheck`: passed.
- ESLint over the changed TypeScript/JavaScript files: passed.
- Broad Vitest run: 2,192 passed, 36 skipped, two failures. The imported browser
  test defaulted to Linux's `/usr/bin/chromium`; an unrelated Claude CLI test
  reached its five-second timeout under broad concurrency. Both failing files
  passed unchanged with the installed Chrome executable and two workers: 8 tests.
- Node script suite: 125 passed, 0 failed.
- Existing UI harness passed desktop 1440x1100 and mobile 390x844 checks using
  synthetic data. New screenshots were retained privately; imported screenshots
  were restored byte-for-byte. These screenshots do not prove a real connection.
- Convex `dev --once --debug-bundle-path ... --codegen disable` produced a local
  bundle and stopped at the installed CLI's explicit `Skipping rest of push`
  branch. It did not call the deployment analysis/push path. The CLI added the
  development HTTP actions URL to ignored local configuration.
- Read-only live inventory: 77 existing functions and 32 declared tables;
  `usageConnections` and its four tables are absent. Existing backend content
  must be preserved when preparing the authorized receiver deployment.

## Approved receiver-only deployment

Owner authorization on 2026-10-07: "can you do this for me? I approve".
Receiver application code corresponds to local commit
`0aee17a36d7a6ec73737e138c1d39fee2c239542`.

The first package was rejected by `start_push` with `CanonicalizationConflict`
because `schema.js` appeared both as the replacement schema and an unchanged
module hash. That request did not activate a deployment. The corrected package
omits the old schema module from unchanged hashes; all 32 existing table
validators and indexes are retained exactly.

The corrected package was deployed at `2026-10-07T10:51:37.794Z` only to
`dev:utmost-mongoose-374`. Its SHA-256 is
`3d9ab924833fc190a01453873e78b5023ebea7781a08efe0ab2e84eca33400d0`.
Fresh module and schema comparisons passed immediately before deployment.

Observed deployment evidence:

```json
{"existingModulesPreserved":54,"existingTablesPreserved":32,"tablesAfter":36,"moduleDiff":{"added":["usageConnections.js"],"removed":[]},"authDiff":{"added":[],"removed":[]},"cronDiff":{"added":[],"updated":[],"deleted":[]},"removedIndexes":0}
```

All 54 existing non-schema module hashes were compared after deployment and
remained identical. The new schema adds only `usageSources`, `usageGrants`,
`usageEvidence`, and `usageReceipts`. Every pre-existing table definition was
compared against the server's deployment diff and remained identical.

Application receiver code was uploaded under the explicit deployment approval.
No prompts, code from Codex history, or stored credentials were uploaded as
source data. Deployment authentication remained in memory and was sent only to
the first-party authorization/deployment endpoints. No migration, seeding,
recurring installation, frontend deployment, Git push, or merge was performed.

## Live timeout finding

Fix now: repeated main-source resumes failed with `TimeoutError` while durable
packets remained queued. The development client imposed a 10-second timeout on
every receiver request. A regression using a 13-second acknowledgement failed
at 10 seconds; immediate companion cancellation still passed. Raise only the
local request deadline to 60 seconds, retaining the caller abort signal, fixed
development destination, device proof, receiver authority checks, and durable
checkpoint rules. The backend receiver is unchanged.

## Live receiver verification

The owner completed development sign-in and paired both canonical local roots
through the authenticated connection screen. Both sources remain unclassified;
private device keys stay on the Mac. The temporary loopback pairing bridge
closed after both pairings, without recording or displaying the one-use codes.

Archive verification on 2026-10-07:

```json
{"scannedFiles":14,"skippedFiles":0,"localSequence":82,"remoteSequence":82,"pendingPackets":0}
{"localUniqueRows":6352,"remoteRows":6352,"missing":0,"unexpected":0,"duplicates":0,"totalsMatch":true}
{"revokedAccessRejected":true,"rejectionCode":"CODEX_ACCESS_UNAVAILABLE","directIngestRejectionCode":"CODEX_ACCESS_UNAVAILABLE","historyReadsAfterRevocation":0,"packetSendsAfterRevocation":0,"localSequence":82}
```

Every stored archive row was fetched through the actual signed-in owner's
query, validated against the strict numeric schema, and compared with the local
numeric projection. All displayed counters matched. A new helper process rescanned
the archive without advancing either checkpoint. Browser reload preserved the
connection states. Revocation rejected both device status and a direct empty
numeric packet probe; retained private counters remained readable by the owner.

Sessions restart recovery, before the full backfill:

```json
{"scenario":"real server accepted packet, response loss injected locally before saving checkpoint","remoteSequence":1,"localSequence":0,"pendingPackets":16,"numericRows":200}
```

The helper process exited after that injected acknowledgement loss. The ordinary
CLI, launched as a new process with the same private state, resent the durable
pending packet, verified its exact acknowledgement, and continued advancing.
This was a local failure injection against the real development receiver.

A separate collection page mismatch appeared after sign-in:

> ArgumentValidationError: Object contains extra field `includeAccountEvidence` that is not in the validator.

Disposition: deferred outside the receiver-only deployment. The imported
collection frontend and preserved older backend have different interfaces.
The connections page works independently and is the acceptance route for this
task. No unrelated backend modules were replaced to hide that mismatch.

## Acceptance

Real archive backfill, unchanged restart, owner-only readback, retention, and
revocation are proven. Sessions recovery from a lost acknowledgement is proven;
the full sessions backfill and subsequent new-usage update are still running.
Detailed numeric evidence, screenshots, keys, and configuration stay outside Git.

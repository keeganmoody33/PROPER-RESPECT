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
- No real-history packet has been sent to Convex. Local acquisition is not
  receiver acceptance, and local usage totals do not represent bills or quotas.

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

## Acceptance

Real local acquisition and independent modern-response checks passed. Remote
backfill, updates, restart, and revocation remain unproven. Development receiver
deployment is confirmed; the in-app browser owner sign-in is pending. Both local
source/device identities are prepared, with private keys retained only locally.
Platform tests do not establish live acceptance. Detailed source evidence and
configuration remain outside Git.

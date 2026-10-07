# Codex local history collector verification

Date: October 6, 2026. Branch: feat/codex-history-collector.
Base: 6cf026b11499854b53f8aaae01f9a133df7578dd, independently matched to remote main.

## Delivered scope

A local-only Linux/Node 24 command reads one explicitly selected bounded
directory and projects genuine Codex rollout structures into exact numeric
history. It extends the existing collector and reuses the exact JSON decoder,
window schema and cumulative reconciler. Response IDs, fork inheritance,
archive replay, compaction checkpoints and older cumulative snapshots have
separate tested accounting rules.

The fixture directory uses synthetic data shaped from official Codex source at
c0c230e6730b3b3c9101b8aff4b9aea4027cea5b. The source license and NOTICE were checked;
no upstream implementation was copied. This is schema-based compatibility
proof, not an actual-account acceptance run.

## Checks

- 93 focused tests passed across the collector, filesystem reader, exact decoder
  and actual CLI.
- 122 Node script tests passed.
- TypeScript typecheck passed.
- Repository ESLint passed.
- Next.js production build passed with PUBLIC_SITE_ORIGIN=https://example.invalid,
  an explicitly synthetic build-time origin. No deployment occurred.
- Final full Vitest with two workers passed 1,999 tests and skipped two, with 50 failures in
  three existing native-capture/evidence suites. All 50 case names reproduced
  on untouched base 6cf026b, with no current-only or base-only failures. This
  sandbox exposes /tmp/.git, so those tests reject their temporary directories
  under the existing outside-Git guard. The guard was not changed or bypassed. An unconstrained parallel rerun also
  hit six existing timeout failures; all 62 tests in those three suites passed
  on focused rerun, and the two-worker full run returned to exactly the same
  50 baseline failures.
- Whitespace/diff checks passed.

The initial worktree dependency symlink was rejected by Turbopack. A real local
copy of the already installed dependencies resolved that environment issue.
An initial build then stopped at the required PUBLIC_SITE_ORIGIN setting; the
synthetic origin above allowed the completed production build.

No browser or hosted UI behavior changed in this slice. CLI checks exercise the
actual command and inspect its JSON and stderr. UNIX-socket creation is denied
in this sandbox; special-file rejection uses the same tested predicate as the
FIFO case. No socket-specific success is claimed.

## Independent review dispositions

1. Synthetic total-only full-context events could pass the legacy delta check
   after zero. Fixed now with an explicit synthetic-vector exclusion and a
   regression covering the official shape. The original reproduction now
   returns an unknown total and an excluded-interval diagnostic.
2. A vector conflict could disable discontinuity handling and allow an unrelated
   metric to count an unverified increase. Fixed now by preserving interval
   boundaries and quarantining the whole conflicting vector segment. The
   original reproduction returns unknown totals and conflicted rows.
3. Node's module-type startup warning exposed the checkout path on stderr.
   Fixed for the supported invocation with a narrowly scoped warning flag in
   command help, docs and CLI tests. Application imports run inside the
   sanitized error boundary. Help and successful documented commands have clean
   stderr. Calling Node without the documented flag can still produce Node's
   startup warning during collection.
4. Equal totals with differing last-usage vectors could make diagnostics and
   stream hashes depend on file order. Fixed now by sorting the complete
   counts-plus-last fingerprint. The reversed-file regression compares the
   entire result rather than totals alone.

## Remaining acceptance work

The directory backend is Linux-specific. The parser is portable, but macOS needs
native descriptor-relative acquisition plus platform tests and signed packaging.
Compressed histories, referenced-prefix traversal and ambiguous legacy forks
are not collected. Coverage remains partial. No durable checkpoint is installed;
each run emits a replacement window review rather than appending previous sums.

Hosted pairing, persistent grants, transmission, restart-safe acknowledgments,
installation and an authorized real-history acceptance run remain separate
work. The existing browser grant remains synthetic-only. No private history,
authentication store, credential, account RPC, user computer or live backend was
read. No merge, release or deployment was performed.

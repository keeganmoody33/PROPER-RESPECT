# Durable collector connection verification

Date: October 6, 2026. Branch: `feat/codex-durable-connection`.
Inspected base: `6cf026b11499854b53f8aaae01f9a133df7578dd`, matched to remote main.

The uploaded handoff manifest was verified before applying its collector patch.
Patch SHA-256: `a52dd054d44633635d00aad17b3532a6e2ee22b530c29ed1c8f3d36c7f28e1dc`.
`git apply --check` passed against that base. All 93 supplied focused tests passed
after application. Attached documents supplied implementation guidance, not
authorization to access a provider, upload data or use production.

## Implemented and demonstrated locally

The portable native reader uses pinned POSIX descriptors, bounded private IPC,
strict framing and cancellation. Its actual executable feeds the numeric parser
and CLI. The shared contract owns grants, metrics, review identities, typed
chunks and receipt checks. Provider behavior stays in the Codex collector and
Cursor supplied-report adapter.

The fixture receiver and companion use real private SQLite stores and loopback
HTTP. Tests exercise owner approval, source/device/account-context attribution,
expired and revoked access, chunk replay/collision rejection, atomic acceptance,
lost acknowledgments, concurrent stale work and retained private history.
Immutable sanitized reviews remain owner-inspectable after replacement and
revocation. Modern response variants preserve conflicts and missing rescans.
Legacy overlapping windows remain separate. Cursor complete-file views replace
the same window without collapsing equal rows or manufacturing requests.

An actual Node process stops and restarts with the same two stores. Its automatic
five-second fixture loop discovers a newly appended synthetic response without
re-pairing or a manual sync call. Subsequent revocation survives another process
restart and retains the accepted private result.

Browser tests use that receiver and companion. They verify approval, backfill,
replay, updates, store reopening, retained disconnect results, personal/work
sources and explicit preview selection. The sharing preview clears on reload
and publishes nothing. Six desktop/mobile screenshots contain synthetic data
only. All six accessibility scans passed.

## Checks

- Full Vitest: 2,174 passed; two existing owner-evidence tests skipped without
  separately supplied private evidence.
- Node script tests: 122 passed, zero skipped.
- Native/contract/SQLite/HTTP/Cursor platform selection: 153 passed on Linux
  before the additional startup-failure regression. Both process tests and all
  three HTTP integration tests passed after that cleanup fix.
- ESLint, strict TypeScript, production application build and diff checks passed.
- Three desktop/mobile browser tests passed against the actual fixture server.
- Prepared Ubuntu fixture and macOS native/durable-sync workflows. A workflow
  file is not a recorded platform pass; inspect its exact commit result.

Full suites used `TMPDIR=/var/tmp`. This machine's `/tmp/.git` and `/workspace/.git`
markers cause the existing private-original guards to reject descendants.
No guard or fixture assertion was weakened. The earlier handoff receipt's
baseline failures describe its prior environment, not this full passing run.
Build origin `https://public.example` is explicitly synthetic. No deployment,
Convex synchronization, seeding or provider read occurred.

## Review dispositions

1. Fixed now: Node's ASCII decoder masked high bits in native response magic.
   A failing high-bit-header regression led to exact byte comparison.
2. Fixed now: A to B to A to B report changes reused a former checkpoint and
   receipt, leaving the receiver on A. Checkpoints now include their predecessor,
   generation and descriptor. A real SQLite regression verifies all transitions.
3. Fixed now: an unaccepted pending review retried forever after another writer
   committed. Authenticated delivery status distinguishes committed, ready and
   stale work. Committed pending work recovers its exact receipt; stale work
   reacquires under current authority. Both cases have real SQLite regressions.
4. Fixed now: expiry during writes could produce a receipt at `expiresAt`.
   The final commit timestamp now supplies the expiry check inside the same
   transaction. Expired observations, archives, views and receipts roll back.
5. Fixed now: malformed companion storage left a fixture listener alive after
   failed startup. The real CLI regression first timed out with that listener;
   startup now closes acquired resources, exits with status 1, preserves the
   invalid input and emits only its fixed diagnostic.
6. Fixed now: the actual macOS compiler rejected `st_mtimespec` with strict POSIX
   feature selection. A failed Darwin build identified the missing extension
   fields. Apple builds now explicitly enable `_DARWIN_C_SOURCE`; Linux retains
   its POSIX selection. The 66-test Linux native/accounting/CLI selection passed
   after the change. The corrected Darwin workflow result remains a separate
   platform acceptance check.

Independent local review found these issues and reread the fixes. This is
implementation review, not approval to merge our own PR.

## Configuration and remaining limits

The runtime has no verified development Convex/Clerk configuration. Secure
requirements and reusable fixture startup instructions were saved to the cloud
draft; no credential values were supplied. See
[the exact names and real acceptance sequence](../collector-development-acceptance.md).
Real-data upload and authenticated acceptance remain paused.

No real Mac usage, Darwin runtime, signed installation, provider account,
Clerk authentication, Convex collector endpoint or public publication was
demonstrated locally. The SQLite owner boundary is synthetic and storage uses
private permissions, not encryption. Fixture pairing verifiers are in memory
until approval. Fixture actions serialize, so its disconnect button waits behind
an active sync; companion cancellation and receiver revocation have separate
tests. Each grant covers one window of at most seven days. Broad and rolling
history, compression, native installation/recurrence, Cursor dashboard format
verification, hosted retention/quotas and deliberate live sharing remain gates.

An approved real Mac connection remains the final acceptance bar.

# Offline Codex account capture verification

Dated 2026-09-23. Source commit `a53fdf44d8bbf9fd7a37038b0f784ce11f6b5a2f`,
based on `a87e97910f2d88d71ec9b806d1391166bb34d69d`.
Branch `codex/codex-bounded-capture-20260923`.

`captureCodexAccount` accepts local aliases, capture metadata, a private base,
a new directory name, and a trusted child-process factory. It sends initialize,
initialized, and exactly one empty-params account/usage/read. This change provides
only synthetic Node fixtures. It includes no native Codex launcher or CLI.
The factory is trusted injection; it cannot prevent its caller from launching
another executable. A production adapter requires separate review and authorization.

The client returns fixed status codes. It keeps stream bodies and accepted
metrics out of ambient output. A successful attempt writes `capture.json` in the
caller-named new directory, then reads that same file twice through the existing
parser and reviewer. Acceptance requires one account, one snapshot, one replay,
and zero conflicts. The metric formatter is never invoked.

## Contract

The protocol state is initializing, requesting, draining, rejected, or closed.
Rejection is absorbing. Response IDs must have the exact raw tokens `1` and `2`.
A bounded JSON scanner rejects duplicate keys, including escaped equivalents,
and preserves the raw result substring for the unchanged numeric parser.
Non-null thread usage and extra result fields fail before retention. Missing
and null counts remain unknown. Explicit zero remains zero.

Limits are 512,000 stdout bytes, 64,000 stderr bytes, 260,000 bytes per frame,
128 messages, 32 nested JSON levels, 256,000 capture bytes, and 3,660 daily buckets.
The 81 notification methods match Codex 0.153.4's pinned ServerNotification.json,
SHA-256 `b3e76cf11842f3e8b3270c05e000212b56eabafb0152fc38e8f920e2ef902991`.
Known notifications are discarded. Unknown methods and server requests fail.

Acquisition has 27 seconds. A valid reply ends stdin and permits one second for
natural closure. Persistence requires drained stdout and stderr, successful
write callbacks, and child close with code zero and no signal. Any failure sends
TERM and escalates to KILL after 500 milliseconds. The original 30-second
transport deadline reports unconfirmed termination if close never arrives.
This is not a hard operating-system scheduling or filesystem-completion guarantee.
The client controls the supplied child, not a native launcher's descendant tree.

The existing base must be canonical, owner-controlled, mode 0700, and outside a
Git checkout. The new directory is exclusive mode 0700. The file is exclusive,
no-follow, regular, single-link, owner-controlled mode 0600. Readback checks its
identity, mode, byte bound, and exact contents. Cleanup removes only artifacts
whose observed identities still match. Unconfirmed cleanup has its own status.
Portable Node operations cannot protect against malicious concurrent same-UID
ancestor replacement. That trusted-base limitation remains explicit.

## Executed checks

All final commands used Node `v22.20.0` through
`/Users/keeganmoody/.nvm/versions/node/v22.20.0/bin` on PATH.

| Command | Result |
| --- | --- |
| `node node_modules/vitest/vitest.mjs run src/local/codex-account-capture.test.ts` | 56 passed, 2.72 seconds |
| `npm test` | 1,092 Vitest tests passed, 2 skipped; 83 files passed, 2 skipped; 7 Node script tests passed |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `git diff --check` | Passed |

The first regression run failed because the client module did not exist.
A later input-mutation regression failed before the input snapshot fix and
passed afterward. Earlier iterations used Node 22.17.0. One concurrent full
run exceeded an existing mailbox-discovery test's five-second timeout. The
final unchanged full-suite rerun under Node 22.20.0 passed.

Real Node fixture subprocesses verify outbound order, clean shutdown, queued
and delayed duplicates, EOF, nonzero exit, signal exit, drain hangs, ignored
TERM, malformed and truncated UTF-8, byte-by-byte multibyte initialization,
message and byte floods, depth, daily limits, numeric rounding and underflow,
wrong IDs, extra fields, and private sentinels. Real fixture streams also verify
responses before delayed write callbacks and callback errors. A deterministic
stream fixture covers missing close after termination attempts.

Actual temporary files verify directory and file modes, existing names,
symlinks, Git destinations, replay, altered readback, and readback errors.
Filesystem failure tests inject at the open boundary but use real file handles,
files, and symlinks. The private base and synthetic artifacts are removed by tests.

## Review dispositions

- Root's rounded response-ID finding: fixed with exact raw ID tokens and two regressions.
- Root's normalized-size finding: fixed with a byte check before directory creation.
- Root's missing null fixture: fixed with distinct null and omitted payloads and saved-value assertions.
- Root's multibyte split finding: fixed with one-byte timed initialization writes.
- U44's mutable-input destination escape: fixed by copying caller fields before the first await. The regression changes destination, aliases, capture ID, and time during process creation and verifies the original values persist.

No account identity, billing, coverage, freshness, native startup isolation, or
live provider compatibility has been established. No real Codex app server,
account request, private configuration, authentication, session, or transcript
read occurred. No frontend, API, Convex, deployment, or publication change is
included. Independent exact-commit review and hosted CI follow this receipt.

## PR 66 review remediation

Reviewed head `fad5e857dded275bcafcb7673abff8cbfa49fc07`.

- Ordinary `HEAD` or `head` directory rejected as Git: fixed. Any `.git` marker still rejects the destination. Bare-layout rejection now requires a regular `HEAD` file and `objects` and `refs` directories together. Both ordinary-directory regressions failed before the fix on this case-insensitive macOS filesystem. The bare-layout regression rejects before child creation.
- No-comments review's deadline catch comment: removed. Exception handling and the deadline behavior are unchanged.

Node 22.20.0 remediation checks passed: 59 focused tests in 3.46 seconds,
`npm run lint`, `npm run typecheck`, and `git diff --check`.
The full suite was not repeated for this bounded destination-check correction;
the prior full-suite result above remains tied to its source commit. Hosted CI
and independent review must check the replacement head before merge.

## PR 66 cleanup identity correction

CI head `39e23bb646e867db300c1572a597ec6257a3fb78` failed the replaced-symlink
readback case. It returned `storage-rejected` instead of `cleanup-unconfirmed`.
The other 1,094 executed Vitest tests passed. CI did not record inode values,
so the log alone does not prove the allocator behavior.

The cleanup check compared only device and inode after the original file
handle had closed. A replacement could reuse those values and be unlinked as
though it were the owned file. Four deterministic regressions reproduced that
failure with matching device/inode and changed type, owner, mode, or link count.
They use real files and symlinks with controlled stat metadata. They are not
claims of native Linux allocator reproduction.

The fix holds the original write handle open through readback and cleanup,
which prevents that inode from being recycled during those checks. Cleanup
also requires a regular file, the current owner, mode 0600, and one link. The
directory checks require directory type, current ownership, and mode 0700.
A mismatched entry remains untouched and reports `cleanup-unconfirmed`.
The retained handle closes after either outcome. A close error returns a fixed
uncertainty status without exposing the error text. The documented same-UID
ancestor-mutation limitation still applies.

New tests verify preservation of the replacement path, descriptor lifetime
through readback, closure on success and rejection, and fixed close-error
handling. The original symlink assertion remains unchanged.

Node 22.20.0 checks passed: 66 focused tests, 1,102 full-suite Vitest tests with
two skipped, seven Node script tests, lint, typecheck, and `git diff --check`.
The full suite was repeated because cleanup ownership changed. Replacement-head
Linux CI and independent review remain required before merge.

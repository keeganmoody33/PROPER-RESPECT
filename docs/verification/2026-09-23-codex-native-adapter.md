# Codex native adapter preparation verification

Dated 2026-09-23. Base `c6cb1ceff1de30c41ff651a30951627c5f982e0b`.
Branch `codex/codex-native-adapter-20260923`. PStack U45–U47.

## Delivered boundary

`inspectPinnedCodexAdapter` reads a supplied public executable only. Its fixed
pin is version0.153.4 darwin-arm64, SHA-256
`b973d440acac501fd2594a43e7ca9ce41e0a65b9dfb28d0d7a7837c99e1261e3`,
220584000 bytes. Matching bytes return blocked and nativeExecuted:false;
there is no native spawn operation or approval switch. Author and independent
reviewer each downloaded the official npm artifact, verified SHA-512 integrity
and matched its executable digest with the installed public binary. This does
not attest a reproducible build from the associated source tag.

The actual public installed binary was read through the new inspection API and
returned blocked. No native executable was launched, including --version.
The [startup source audit](2026-09-23-codex-native-startup.md) found concrete
system-config/managed-preference and conditional background-service paths that
empty HOME/CODEX_HOME/cwd do not isolate. The
[one-attempt proposal](2026-09-23-codex-native-attempt-proposal.md) therefore stays
on hold with exact invocation, retention and authorization boundaries.

`captureCodexAccount` adds a trusted optional completion barrier. It runs after
input rejection or acquisition, before retention, with an additional two-second
deadline. Only complete permits a successful acquisition to proceed. Exceptions,
unknown values and timeout return fixed termination-unconfirmed; cleanup failure
has cleanup-unconfirmed. Existing parser, request sequence, fields, byte/time
limits and replay rules remain unchanged. The callback is trusted code; the
timeout does not cancel its JavaScript or forcibly interrupt an OS operation.

The test-only supervisor runs checked-in Node fixtures in a fresh private
scratch tree with fixed argv, explicit environment, separate empty cwd, pipe
stdio, shell:false and a POSIX process group. Exit-event supervision handles
inherited pipes without waiting for the fixture's eight-second fallback exit.
A surviving same-group descendant rejects even after forced TERM/KILL cleanup.
Scratch cleanup occurs before normalized retention; unexpected entries or
replaced directory identities are preserved and rejected. No recursive native
artifact cleanup or general session-escaping descendant containment is claimed.

## Author verification

All final commands used Node22.20.0. Root full suite/lint ran with explicit
PATH-only environment. Unit tests launch only synthetic Node fixtures.

| Check | Observed result |
| --- | --- |
| Focused new adapter + existing capture | 101 passed: 35 new, 66 existing |
| Full npm test | 1137 Vitest passed, 2 optional private-input tests skipped; 7 Node checks passed |
| npm run typecheck | Passed |
| npm run lint | Passed |
| git diff --check | Passed |
| Actual public binary read-only preparation | blocked, nativeExecuted:false |

RED evidence first demonstrated that the old capture operation ignored the
proposed completion rejection and saved. Subsequent tests cover barrier failure,
throw, timeout, delayed retention, invalid-input/spawn/protocol cleanup, fixed
pin rejection, identity changes, file growth, read/close failure, no-follow and
nonblocking flags, inspection deadline, immutable policy, exact supplied launch
options, input mutation, scratch symlinks/replacement/unexpected files, output
containment and surviving/TERM-resistant/inherited-pipe descendants.

Identity-positive unit cases deliberately inject synthetic stat/hash results;
they prove branch/error behavior, not native identity. Actual package digest
comparison and public-binary inspection are separate evidence. macOS Node adds
`__CF_USER_TEXT_ENCODING` after spawn; child-visible checks allow only that
platform-added key, and independent supplied-options assertions keep the passed
environment exact. No value of that added key was recorded. This is Node fixture
evidence, not native Codex runtime proof.

## Design and review dispositions

Three independent inherited-parent design candidates and one independent judge
selected the inspection-only API. Candidate3's clean-descendant requirement,
candidate2's identity snapshot checks and candidate1's all-outcome completion
barrier were combined. This is same-model independent work, not cross-provider
validation.

- U47-D1: fixed. Proposal now discloses formatVersion:1, requestedThreadId:null
  and threadUsage:null alongside the metadata field allowlist.
- U46-E1: fixed. Separate exact supplied environment from the observed macOS
  runtime-added variable; no global inherited-variable exemption.
- U46-L1: fixed. Supervise the process group on direct-child exit so inherited
  pipes cannot defer cleanup until the synthetic descendant self-expires.
- Preliminary no-comments pass: zero deletion recommendations, zero suppression
  directives, two exported API contract comments retained. No source edits.

Independent exact-head implementation/probe review, final comment check and
hosted Linux CI are pending this commit. Final SHAs/verdicts are recorded in the
external receipt `/tmp/proper-respect-native-adapter-20260923/receipt.md` and the
[delivery Ref](https://plan.ref.tools/rjPzMsTtYGRHP7TA) after observation.

No genuine account/usage/read, personal Codex configuration, credential,
session/transcript/account read, provider capture, UI/backend change,
deployment, publication or recurrence occurred. The proposed native process
never ran. Source/account identity, availability/coverage, billed spend, hosted
saving and Ora improvement remain unproved. Issue24's eight hosted acceptance
gates and Ora90+ stay open. A genuine attempt requires separately reviewed
startup containment, a specific account/auth mechanism and explicit approval.

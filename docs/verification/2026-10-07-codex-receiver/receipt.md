# Codex authenticated receiver reconciliation — October 7

Inspected local `feat/codex-mac-private-sync` at `1fff45ee8a4fc4b7f436f3ca58c34d79cd33df90`,
remote main `6cf026b11499854b53f8aaae01f9a133df7578dd`, and PR #157
at `a6c670b6fc71b418d608c75d612c06112195a701`. Main remains at #156.
The three #157 commits are authored by lecturesfrom; none is Devin-authored.
Git refs and source were available. GitHub review comments/check conclusions
were unavailable under the effective API network policy; no review clearance is claimed.

## Findings and dispositions before implementation

- Integrate #157 locally: keep its Cursor adapter and fixture lifecycle unchanged;
  it belongs to thread `01a112e0-7bfe-7548-9a95-40a8afdbf0f3`. No cross-thread delivery
  channel is available here. Preserve its public contract, with only an optional
  opaque Codex legacy thread field for cross-delivery modern/legacy exclusion.
- Fix now: share Codex response/legacy validation with the authenticated receiver.
  Keep the bounded packet protocol distinct from complete-report manifests:
  native partial directory pages cannot claim a complete report or delete unseen history.
- Fix now: make same-device pairing response recovery idempotent within the
  original five-minute pairing deadline. A code never authorizes another device.
- Fix now: avoid new receiver receipts on unchanged scans by persisting acknowledged
  review digests locally. A pending outbox always takes priority over rescanning.
- Fix now: use the source's latest retention authorization when disconnecting via
  an older grant; bind source identity to its prepared device as well as context.
- Fix now: bound evidence deduplication to indexed source/key/fingerprint lookup;
  recheck active authority after asynchronous proof verification.
- Fix now: incorporate #157's Darwin namespace correction and extend its macOS
  workflow to the live companion/receiver's synthetic tests.
- Deferred: real Darwin compilation, Clerk-authenticated deployed receiver proof,
  real history, installation, recurrence and uploads require a named Mac/source
  scope and approval. No production target, push, merge or deployment is authorized.

## Fresh configuration evidence

Process values match `dev:utmost-mongoose-374` and
`https://utmost-mongoose-374.convex.cloud`. The public Clerk key is a development
key for `relevant-oriole-27.clerk.accounts.dev`. A secret is present but has neither
recognized development nor production prefix. It may be an opaque managed
credential; its relationship to the public app remains unverified.
`CLERK_JWT_ISSUER_DOMAIN` and `CONVEX_DEPLOY_KEY` are absent. The effective network
policy lists neither the development Convex cloud/site hosts nor the Clerk app/API
hosts. Configuration publication is not evidence of live readiness. No values
of secret credentials were printed and no live history was accessed.

Validation and delivery evidence will be appended after implementation.

## Implementation and regression evidence

Local merge `bb17d07` integrates the inspected #157 head with `1fff45e`.
The Cursor adapter, its tests, SQLite receiver and companion match #157 exactly.
The shared Codex legacy schema gains an optional opaque thread hash; the live
Codex packet requires it. No Cursor grant, report row, chunk or receipt changes.
See the [architecture decisions](../../../work/pstack/2026-10-07-codex-receiver-reconciliation.md).

The initial regression run reproduced **7 failures / 20 passes** in two files:
pairing recovery, two stale-retention cases, source device identity, expiry during
proof verification, invented legacy baseline deltas and unchanged scan receipts.
After fixes, receiver/companion/shared-contract checks passed **48/48**.

The final scoped run passed **252/252 in 20 files**. A further native/Convex
integration test passed **1/1**: 65 distinct historical responses plus an archive
copy across two native pages and three history slices produce 65 tokens; unchanged
replay creates no receipt; a five-token update survives lost acknowledgment and
actual state-file reload, producing 70 tokens; revocation rejects further sends.
Raw prompts, code, credentials and paths are absent from its captured packets.

The real Convex HTTP client was exercised against a test-runtime receiver boundary:
signed packet encoding, duplicate receipt recovery and structured revocation errors
pass. This does not establish a live Convex service or matching Clerk authentication.

The shared UI browser test uses a native reader, real file queue and Convex test
transactions. Desktop and mobile accessibility checks have **0 violations**;
screenshots show approval, 80 private response tokens, partial coverage, unverified
identity and retained revocation. Separate original Codex Playwright checks pass
**8/8**; #157's collector browser checks pass **3/3**, including SQLite store reopen
and the unchanged Cursor adapter. No public publication occurs.

Node script checks pass **125/125**. Lint, strict TypeScript and the Next build
pass. The build uses a synthetic public origin and removes the unresolved Clerk
secret from the child environment; no deployment is implied. C builds use
`-std=c11 -Wall -Wextra -Werror`; Darwin is not available here.

`codex:mac:check` correctly refuses this Linux host before building or reading
history. Its actual Darwin result remains pending. The macOS workflow retains
separate native/receiver JUnit evidence and actual platform/compiler metadata.

## Final repository run

`npx vitest run --maxWorkers=2`: **2,172 passed, 2 skipped, 50 failed**;
149 files passed, 2 skipped, 3 failed (154 files total). Every failing case name
matches the untouched `6cf026b` baseline captured earlier in this session:
`codex-account-capture.test.ts`, `codex-native-adapter.test.ts`, and
`retained-product-evidence.test.ts`. No new failing case appeared. Those fixtures
hit the existing boundary for protected sources outside the checkout in this
sandbox; this work did not loosen those guards. The full suite is not green.

Final lint and typecheck pass after the added multi-page test and Mac checker.
`node --check` passes for both CLI scripts; `git diff --check` passes. Build passed
after receiver/companion changes; subsequent changes are tests, Mac check command,
workflow and documentation. Git refs were rechecked at delivery: main is still
`6cf026b`, #157 is still `a6c670b`.

The first failing regression log, scoped success, backfill success, full suite,
unchanged-main comparison, Node checks, build, lint, typecheck and two browser
runs are included in the review package. Its manifest records the final head,
base heads and SHA-256 identities without creating a commit-hash cycle here.

## Real acceptance remains pending

No real Mac source, provider credential, prompt or code was accessed or uploaded.
No daemon or persistent Mac access was installed. No push, GitHub merge,
deployment or publication occurred. Actual Darwin compilation, matching Clerk
authentication and development Convex persistence still need live proof.

The [Mac test gate](mac-test-gate.md) gives the exact next command after approved
installation, the source/read/upload/state/destination scope to approve, and the
real backfill/restart/revocation sequence. The owner was asked for Mac name,
canonical source roots, personal/work context and UTC history range; no answer
has arrived. No access approval was inferred from that silence.

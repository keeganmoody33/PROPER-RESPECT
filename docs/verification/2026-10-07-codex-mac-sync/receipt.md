# Codex Mac private sync verification

Date: October 7, 2026. Branch: `feat/codex-mac-private-sync`.
Inspected parent and remote main: `6cf026b11499854b53f8aaae01f9a133df7578dd`.
The immutable delivered commit and patch checksum are in the review package manifest.
No branch/PR was published, no merge or deployment occurred, and no Mac, real
history, Codex credentials or authentication stores were accessed. Runtime
configuration was checked for presence and class without printing secret values. Private fixture originals and
device keys stayed in temporary directories outside the repository.

## Reconciliation and scope

PRs #154 and #156 are in current main. The original checkout was clean.
Remote main was checked again after implementation and still matched the parent.
The attached collector patch hash matched
`a52dd054d44633635d00aad17b3532a6e2ee22b530c29ed1c8f3d36c7f28e1dc`,
passed application check, and was integrated on this separate branch. Its numeric
accounting was reused. Legacy rows gained an opaque thread identity so modern
records can suppress duplicate legacy accounting across server packets.

PStack Architect guided module ownership, alternatives and failure cases in the
[design](../../../work/pstack/2026-10-07-codex-mac-private-sync.md).
The kickoff's instructions were treated as historical design input, with the
current user's permissions and Cursor ownership controlling this work.

Delivered changes include a native descriptor-relative reader for Darwin/Linux,
bounded file pages and seven-day collection windows, source/context-bound owner
consent, one-use pairing, P-256 signed proofs, private evidence, atomic receipts,
disk-backed pending packets, fsync/checkpoints, an OS lock, foreground recurrence,
expiry, disconnect and bounded server-side deletion. The private key is never
sent. Tokens, quota, API-equivalent estimates and actual charges remain separate.

## Exact checks

| Check | Result |
| --- | --- |
| Focused collector, native, helper, pairing, backend, CLI and shared-panel browser tests | 128 passed in 12 files, 0 failed |
| Full Vitest, `npx vitest run --maxWorkers=2` | 2,034 passed, 2 skipped, 50 failed; 139 files passed, 2 skipped, 3 failed |
| Same three failure suites on untouched parent worktree | 57 passed, 50 failed; all 50 failure case names match the final full run |
| Node script tests, including secret-free development preflight | 124 passed, 0 failed |
| Existing #154/#156 desktop/mobile prototype Playwright checks | 8 passed, 0 failed |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed with `PUBLIC_SITE_ORIGIN=https://example.invalid` and unverified `CLERK_SECRET_KEY` omitted |
| `git diff --check` | Passed |
| Native C build | Passed with C11, warnings enabled and warnings treated as errors on Linux |

The 50 failures are in unchanged `src/local/codex-account-capture.test.ts`,
`src/local/codex-native-adapter.test.ts`, and
`src/server/retained-product-evidence.test.ts`. This sandbox cannot establish
their outside-Git temporary-directory boundary. The exact failure set reproduced
on untouched main. These were not fixed or weakened. `npm test` remains red
because its first Vitest command fails; the Node command was run separately.

The full and focused browser scenario uses the actual shared connection panel,
actual native reader, existing genuine-format parser, actual backend functions
under `convex-test`, and actual helper state on disk. It proves synthetic approval,
pairing, automatic backfill after pairing, exact private totals, duplicate sync,
lost ACK, helper reload, new source records, browser reload and rejected sync after
disconnect. Desktop and mobile axe scans had zero violations. Screenshots are
synthetic: [approval](screenshots/approval.png), [desktop](screenshots/desktop.png),
[mobile](screenshots/mobile.png), and [revoked](screenshots/revoked.png).

Host tests cover links and ancestors, pinned-directory rename, mutation during
read, hardlinks, UTF-8, incomplete lines, a 65-file paged tree and actual CLI
preparation without source access. Backend tests cover owner isolation, sequence
conflicts, evidence conflicts, re-pairing, retention/deletion, missing owners,
expired pairing/grants, wrong devices, tampered packets, operation binding,
proof expiry, and refusal of a production destination.

## Environment observed

Runtime observations were rechecked at managed spec revision 8, with
`observations_current: true`. All four configured runtime variables and network
enforcement still report `unknown`, not ready/enforced in the status API.
The executor policy snapshot specifies restricted egress and lacks the intended
Convex and Clerk hosts. GitHub's release API returned Forbidden. Git source main
is verified; latest release/deployment state is unverified.

Actual shell checks, with no secret values printed, found:

- `CONVEX_DEPLOYMENT` exactly matches `dev:utmost-mongoose-374`.
- `NEXT_PUBLIC_CONVEX_URL` exactly matches `https://utmost-mongoose-374.convex.cloud`.
- Clerk's public key is a development key for `relevant-oriole-27.clerk.accounts.dev`.
- `CLERK_SECRET_KEY` is present and has neither a development nor production Clerk
  key prefix. Matching Clerk app and backend JWT issuer are unverified.
- The development Convex host, Clerk frontend and `api.clerk.com` are absent from
  the executor's allowed-host snapshot. No policy bypass was attempted.

No secret values were printed or placed in the package. No live backend
was seeded or synchronized. Environment publication is not treated as setup proof.

## Acceptance still pending

Darwin compilation and host fixture tests have not run. The selected Mac and exact
source/access route were requested but not supplied in this turn. The existing
collector's size, precision and format bounds must be assessed against the approved
source. Coverage remains partial; unavailable intervals do not become zero.

The final acceptance gate requires scoped approval for installation/access/upload/
recurrence, matching development configuration and approved development deployment.
Then verify real backfill, independent counts, fresh source updates, helper restart,
lost ACK, hosted backend persistence and revocation on the Mac. Synthetic success
does not satisfy that gate. See [the run guide](../../codex-mac-connection.md).

Cursor report adapter ownership remains with thread
`01a112e0-7bfe-7548-9a95-40a8afdbf0f3`. No Cursor implementation was added. The shared
contract is documented; this session exposes no tool to deliver it to that thread.

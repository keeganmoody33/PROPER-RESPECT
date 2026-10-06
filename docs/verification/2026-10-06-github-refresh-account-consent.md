# GitHub refresh consent bound to an account and generation

Date: 2026-10-06. Baseline: `8cab986ee3e5f638b320d4baacefff0302a45615`.
Branch: `fix/github-account-refresh-consent`.

## Confirmed defect and disposition

Fix now: replacing connected GitHub account A with B before the next scheduled
run reused A's public refresh permission. The subscription named a mutable
connector row, and the refresh inferred identity from its current login.
The regression `replacing account A with B before the next run cannot reuse A's
public refresh consent` failed on the baseline because the scheduled action
made one provider request with B's synthetic token.

The existing fingerprint already blocked changes during an in-flight request.
It did not bind the original approval to A after a completed reconnect.

## Contract and ownership

- The GitHub adapter requests and validates `viewer.id`. The account login is
  still a display label and a consistency check. GitHub recommends persisting
  global node IDs for object identity across APIs in its
  [global node ID guide](https://docs.github.com/en/graphql/guides/using-global-node-ids).
- `connectorAccounts.githubBinding` contains `providerAccountId` and a positive
  safe-integer `generation`. Every successful explicit GitHub connection advances
  the generation and revokes the connector's old subscriptions in the same
  mutation as the credential replacement.
- `metricSubscriptions.githubBinding` copies the account and generation approved
  in the sharing preview. The server hashes the binding and account label into
  the exact preview and checks that hash again when publishing. The preview
  returns private `refreshAccounts` metadata for account-specific consent copy.
- A changed or revoked binding gets a new subscription on approval. The old
  subscription keeps its account, generation and revocation record.
- Scheduled credential acquisition and completion both require a matching
  binding. Completion also verifies the response's immutable account ID and
  current authorization fingerprint. A login reused by another GitHub account
  cannot pass the immutable-ID check.

The alternatives were carrying consent forward for a matching login, or carrying
it forward for a matching immutable account after changing credentials. The first
cannot establish account identity. The second would silently retarget an existing
generation-bound approval. This change instead requires a fresh sharing preview
on every reconnect, including the same account with a new token. It does not
change the public snapshot or the owner's retained private history.

## Compatibility and release consequences

The new schema fields are optional so existing rows remain readable. Missing or
invalid bindings never authorize a scheduled read or write, and owner state no
longer reports such consent as active. There is no backfill from login labels.
Existing owners must reconnect and explicitly approve refresh in a fresh sharing
preview. A fixed snapshot can still be published without reconnecting.

Older internal save calls that omit the immutable account ID fail before writes.
Older in-flight completions cannot regain permission. Public profile schemas,
retained originals, evidence reviews, relationship history and Devin behavior
are unchanged. Existing GitHub capture provenance is not rewritten or migrated.

If GitHub changes the representation of a node ID, the comparison fails closed
until reconnect and reapproval. The connector still supports one current account
per provider; this change does not add simultaneous accounts.

A release changing this refresh path restarts the 30-day receipt window under
`docs/runbooks/receipt.md`. No production release, provider read, credential
change, scheduled-job change or permission backfill was performed here.

## Verification

All provider responses and credentials in tests are synthetic.

RED on detached baseline `8cab986` with only the regression added:

```sh
./node_modules/.bin/vitest run convex/githubRefreshSafety.test.ts -t 'replacing account A'
```

The assertion expected no provider read and observed one request using the
replacement account's synthetic token. The same regression passes on this branch.

Focused GREEN:

```sh
./node_modules/.bin/vitest run convex/connectorPrivacy.test.ts convex/githubRefreshSafety.test.ts convex/githubProviderBoundary.test.ts convex/githubCaptureIntegrity.test.ts convex/evidenceClaims.test.ts convex/publication.test.ts convex/rateLimits.test.ts src/server/github-activity.test.ts
```

270 tests pass, covering replacement before the next run, same-account reconnect,
old A success/failure completion after B replacement, withheld/fixed/removed
publication, stable-ID mismatch under the same login, old preview rejection,
legacy connection behavior, retained private history, old grant immutability, and
fresh B approval through a successful scheduled refresh.

The full Vitest run with `TMPDIR=/dev/shm` and `--maxWorkers=2` passed 1,847 tests
with two explicit skips. One further missing-ID regression was added afterward
and passes in the focused command above. All 122 Node script tests pass.
Typecheck, focused ESLint, and `git diff --check` pass.

An earlier unrestricted parallel run timed out in existing mailbox/native CLI
tests during concurrent suite activity. The bounded-worker run passes without
changing those tests. The temporary-directory override avoids the executor's
artificial `/tmp/.git` sentinel in synthetic file-isolation tests.

## Issue #123 remains unproved at the provider boundary

[Issue #123](https://github.com/keeganmoody33/PROPER-RESPECT/issues/123) began with
`BAD_CONFIGURATION` and an empty receipt handle. Later comments show a September
30 GitHub capture remaining stale through October 5. Those later failures do not
establish a credential, HTTP, GraphQL or parser cause.

[PR #142](https://github.com/keeganmoody33/PROPER-RESPECT/pull/142) records that the
October 1 refresh reached its approved relationship and logged
`PROVIDER_UNAVAILABLE`. It added sanitized diagnostic categories because the old
catch discarded the narrower cause. The PR and issue contain no later runtime
category. This consent fix is not claimed to repair #123. Further diagnosis needs
authorized access to the sanitized category and status from a post-#142 natural
refresh, without requesting new credentials or triggering a real provider read.

## Independent review disposition: visible account consent

Fix now, 2026-10-06: the first version returned and hashed account-specific
consent metadata, but its preview UI did not display the account name. The UI
now names the account that future daily refreshes will read, even when the saved
snapshot still attributes its activity to an earlier account. Connector changes
invalidate the visible approval. The optional field keeps older previews readable.

The new account-B disclosure regression failed on `6e19d7d` and passes after
`fe8a69c`. All 79 focused SSR/auth/publication tests, all 277 client tests,
typecheck, focused ESLint and diff checks pass. Four synthetic desktop/mobile
browser cases cover account replacement and same-account reconnect; their
execution remains subject to the exact-head CI result. This consent-specific
UI correction belongs in this PR so it can ship independently of R27.

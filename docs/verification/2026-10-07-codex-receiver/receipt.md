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

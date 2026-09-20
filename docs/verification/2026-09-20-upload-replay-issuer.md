# Verified upload replay issuer binding

Date: 2026-09-20. Base: `origin/main`
`4df11b5fd3ff4e4747f61fa2d72998842970fd7b` (merge of PR #22 head `a29ceab`).
Finding: [PR #23 discussion](https://github.com/keeganmoody33/PROPER-RESPECT/pull/23#discussion_r4055875525),
queued as the first item of [issue #24](https://github.com/keeganmoody33/PROPER-RESPECT/issues/24).
This is a source correction, not upload-boundary production release, Convex
sync, data transfer or publication.

## Disposition

The finding is real. `retainUpload` looked up existing `rawEvidence` by storage
ID and returned it after a same-owner check. First retention still required
`ownedUploadTicket` (issuer-qualified `tokenIdentifier`). Replay skipped that
check. `requireUser` keys on `identity.subject`, so a second issuer with the
same subject mapped to the same user and reused the verified original.

## Correction

On replay, verified rows must match `existing.uploadAttribution.tokenIdentifier`
to the current identity. Rows without `uploadAttribution` stay
`UNVERIFIED_LEGACY`: same owner may replay, including another issuer; nothing
is backfilled. Cross-owner replay remains unavailable. Exact-owner same-issuer
idempotence is unchanged.

RED: `test: reproduce verified upload replay across issuers`.
GREEN: `fix: bind verified upload replay to the original issuer`.

Local checks after GREEN: `convex/evidenceUploadHttp.test.ts` 9 passed;
`npm test` 616 Vitest passed, 2 skipped, 6 Node checks; lint and typecheck
passed. No Playwright hosted pass. No Vercel or Convex mutation.

## Remaining gates

This does not release the upload boundary. Backend schema/functions/HTTP action
must still precede frontend under a later owner-authorized production release.
Issue #24 items after this one remain unstarted. No deployment, Convex sync,
provider read, transfer or publication.

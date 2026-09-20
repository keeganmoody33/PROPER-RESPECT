# GitHub connector precedence and bounded later-proof lookup

Date: 2026-09-20. Branch: `cursor/github-card-account-destination-7318`.
Parent: `e4a6ac8e15b470127432b7e9d6401b6edaced9d3` on
[PR #22](https://github.com/keeganmoody33/PROPER-RESPECT/pull/22).
Owner authorization: PR review body “Devin fixes” covering
[stale proof vs connector](https://github.com/keeganmoody33/PROPER-RESPECT/pull/22#discussion_r4057273533)
and
[200 total-proof prefix](https://github.com/keeganmoody33/PROPER-RESPECT/pull/22#discussion_r4057273504).
This receipt is not merge, deploy, Convex sync, or GitHub-thread resolution.

## Reproduced defect

On the 200-scan helper, 25 manual proofs plus a September 19 `late-account`
snapshot outranked a CONNECTED `github.com/current-account` connector from
September 20. Private destination was `https://github.com/late-account`. The
same fixture with main’s helper returned `https://github.com/current-account`
because the older 25-proof prefix never saw the snapshot, so the connector
won. Historical GitHub proofs could therefore override the current connector
after the prefix was widened.

Separately, `.take(200)` on `by_prop` is a creation-order prefix. A qualifying
GitHub snapshot after 200 earlier proofs never entered the destination rules.

## Correction

`associatedAccountEvidenceForProp` now:

1. Emits a CONNECTED GitHub connector account first when the label parses as
   `github.com/{login}`.
2. For GitHub cards, reads the newest 200 proofs (`order("desc").take(200)`),
   then keeps the existing GitHub source-type and origin-issuer filters.
3. Leaves other products at the existing 25-proof prefix.
4. Does not add an index, current-account table, or planning program.

`privateCardPrimaryLink` is unchanged: owner-selected non-homepage links still
win; publication and `defaultReview` still use stored primaries.

## Remaining bound

This is not an exhaustive GitHub-evidence search. A qualifying snapshot older
than the newest 200 proofs on the card is still missed when no CONNECTED
connector is present. Devin’s recommended indexable fields / direct
relationship-to-current-account reference were not implemented.

## Checks

Recorded after the local run on this correction:

- Focused Vitest: `convex/retainedEvidence.test.ts` (includes the reproduced
  connector-precedence fixture and a 200-earlier-proof later-snapshot case).
- Full `npm test`, `npm run lint`, and `npm run typecheck` counts are filled
  after those commands complete.

No Playwright hosted signed-in pass. No Vercel or Convex mutation.

## Hosted gate

Production remains `32aa043c48ee32686b3c656127f2d58ed7d1388b` /
`dpl_8zGq3Exu68QgVvCKmdy4Hm9SoRTh` / Convex `striped-chicken-693`. Owner merge
of PR #22 and a separately authorized production release are still required
before this lookup is hosted.

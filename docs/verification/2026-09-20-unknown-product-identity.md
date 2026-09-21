# Unknown-product identity collisions

Date: 2026-09-20. Base: `origin/main`
`e086131a03d7a68ea50b2feca298a11d152a40f5` (merge of PR #27 head `d024b6c`).
Finding: [issue #24](https://github.com/keeganmoody33/PROPER-RESPECT/issues/24)
unknown-product identity collisions, from
[PR #16 comment 3650427663](https://github.com/keeganmoody33/PROPER-RESPECT/pull/16#discussion_r3650427663).
Skipped byte-budget isolation and exhaustive GitHub index architecture.
No deploy, Convex sync, transfer or publication.

## Disposition

The finding is real. `deriveIdentity` used the first hostname label as the
product slug. `proposeDrafts` keys on that slug, so `app.linear.app` and
`app.clickup.com` became one pending draft. Shared hosts such as
`app.herokuapp.com` collapsed the same way. Catalog matches were not involved.

## Correction

Unknown identities now slug the full hostname (`app.linear.app` →
`app-linear-app`). Display names stay the capitalized first label. The stored
domain stays the host. Same-host signals still merge. Catalog products,
including `app.devin.ai` → `devin`, are unchanged. Unresolved products remain
private pending drafts.

This does not use a public-suffix list. An eTLD+1 merge would still glue
`*.herokuapp.com` together.

Already-stored `products.slug === "app"` rows and mixed `app` drafts are not
split. New ingest looks up the hyphenated host and does not attach to that
leftover row.

RED: `test: reproduce unknown app hosts merging on first hostname label`.
GREEN: `fix: key derived product identities on the full hostname`.

Local checks after GREEN: `src/domain/discovery.test.ts` 21 passed;
`npm test` 625 Vitest passed, 2 skipped, 6 Node checks; lint and typecheck
passed. No Playwright hosted pass. No Vercel or Convex mutation.

## Remaining gates

Vendor `Cisco` suffix tokens and legacy `syncGithub` login path validation are
the remaining source #24 items that do not need deploy, transfer, or a new
index. Lookup completeness beyond 200 proofs and byte-budget isolation still
need a later indexed design if the owner authorizes it. This change does not
deploy `main`. Hosted signed-in proof, upload-boundary production, development
transfer, extra Gmail, recurrence and publication remain owner-gated.

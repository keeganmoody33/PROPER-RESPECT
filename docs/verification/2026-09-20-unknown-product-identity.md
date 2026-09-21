# Unknown-product identity collisions

## September 21 correction — current candidate

Reviewed PR #28 head: `bfb0e2eed99288192b1662ec746bd06d51afdfb0`.
RED regression commit: `dc48b20`.
Corrected code: `cb8b86a386d212bd9a8e08ebd632573a279b546c`.
Observed main: `3a1413f3deb34c417cb9bdbdbfa4d34096e47e77`.

The original full-hostname hyphenation still collapsed
`app.foobaz.example` and `app-foobaz.example` into one proposal. A valid
50-character DNS label also produced a key rejected by the public-card
39-character slug contract. Both regressions failed at the reviewed head.

Derived identities now use `host-` plus 128 bits of SHA-256 over the normalized
full hostname (37 characters). Pinned `@noble/hashes` 2.4.0 supplies synchronous
isomorphic hashing without a Node-only import; its Node >=20.19 requirement is
met by the repository's Node 22 verification environment. The lock change adds
only this dependency. This is collision resistance, not absolute uniqueness;
ingestion's existing stored-domain conflict check remains in place.

Both regressions pass. Same-host evidence still groups and catalog identities
remain unchanged. No stored products, mixed drafts, owner relationships or
publication records are migrated. Already stored ambiguous identities still
need separate review; new keys do not retroactively repair their attribution.

Checks passed at the corrected code: 627 Vitest tests (two optional skips),
six Node script checks, ESLint, typecheck, production build with synthetic
Clerk/Convex values, all 18 component browser checks, and `git diff --check`.
The two new regressions directly exercise proposal grouping and the existing
public-card slug schema. Browser fixtures cover existing discovery/card UI;
they are not a real provider ingestion, signed-in hosted acceptance or release.
Logs: `/tmp/proper-respect-identity-{red,tests,build,browser}.log`.

PR #28's existing history is preserved; no rebase or merge. Owner review and
fresh remote checks remain required. No deployment, synchronization, live
provider request, transfer, publication or stored-data rewrite occurred.

## Original September 20 checkpoint — superseded key encoding

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

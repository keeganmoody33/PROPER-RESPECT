# Profile development synchronization — 2026-09-19

## Authorized source and target

Owner approved application checkpoint `a2539b91e84cd93271daa71550430e32fc95e24e`
for development Convex `utmost-mongoose-374` only. Checkout documentation HEAD
was `f73522dcc778fc6adc7c45aaf8aec296ded0fd05`; application, backend, assets,
scripts and package configuration had no diff from the approved checkpoint.

Before mutation, the pinned environment and remote function specification both
identified `https://utmost-mongoose-374.convex.cloud`. No shell deploy key was
present. Executed from the accepted checkout:

```sh
env -u CONVEX_DEPLOY_KEY node_modules/.bin/convex dev \
  --once --codegen disable --typecheck disable --tail-logs disable \
  --env-file <private-pinned-development-target.env>
```

The CLI identified the development target and reported functions ready at
18:15:08 America/New_York. Code generation was disabled to preserve the reviewed
generated types. The repository uses its verified application build for
TypeScript checking; no separate Convex tsconfig was introduced.

## Verified results

- Remote functions increased from 73 to 77. `discoveryReview:list`, `candidates`,
  `details` and `attach` are exposed. `publishSelected` requires both
  `expectedPreviewHash` and `expectedPublicationRevision`.
- Read-only exports before synchronization, afterward and after browser
  verification contained identical records in all 32 application tables.
  Evidence, owner choices, credentials, generations, cursors and published
  profiles were unchanged. System metadata is outside this comparison.
- Anonymous access to `discoveryReview:list` was rejected with
  `Authentication required`.
- Restarted the existing local application against the approved development
  backend. Existing Clerk session loaded four private products successfully;
  card appearance reported four ready, zero pending and zero unavailable.
  Browser error logs were empty. The real discovery-review queue was empty;
  no test records were inserted.
- Existing ready brand records were reused. Recurring subscriptions and source
  jobs were absent; mailbox maintenance remained disabled. No provider-read
  control was invoked and no retained brand records changed.

Private exports and detailed comparisons remain outside Git. Earlier source
checks are recorded in [profile readiness](2026-09-19-public-profile-readiness.md).

## Boundaries and remaining proof

This was a development backend synchronization, not a frontend or production
release. No push, data transfer, provider read, evidence attachment, relationship
edit, recurring collection or publication occurred. Production remains on the
previously recorded release.

Existing-session authenticated loading is proven. Fresh sign-in and an actual
owner-directed discovery attachment were not exercised; synthetic mutation tests
remain labeled as such. Canonical public URL selection, any private transfer,
broader production release approval and explicit publication acceptance remain
separate work.

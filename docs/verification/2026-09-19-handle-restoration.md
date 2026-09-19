# Original handle restoration — local verification

Verified 2026-09-19, America/New_York. Continues existing Tasks 2/4 and the
owner-selected `proper-respect.com/keegan` address. This is local source proof,
not a production restoration or permission to publish.

## Observed problem and correction

The existing hosted authenticated account and its site use `/lecturesfrom`;
the legacy public snapshot remains at `/keegan`. The normal handle editor
correctly refuses to reclaim a published handle. Keep that restriction.
The retained production export ties the seeded owner to the original address
and four matching PUBLIC relationships. It does not resolve which GitHub sibling
should become the legacy card's explicit identity.

`accountRecovery.ts` now exposes an internal read-only restoration preview and
an internal guarded mutation. Preview binds complete retained account, site,
publication, reviewed relationship and product documents to before/after SHA-256
fingerprints. The mutation rechecks unique subject/seed/site ownership, both
handle namespaces, original publication and reviewed card correspondence.
It atomically patches only `users.handle` and `sites.handle`. A matching replay
is a no-op; any later bound-record change rejects the prior approval.

The operation does not write publication content, revisions, card IDs, auth
subjects, timestamps, owner choices, links or evidence. It cannot replace a
foreign account, repair mixed state or claim an arbitrary published address.
Existing null/absent card mappings remain unresolved. No schema or UI changed.

## Verification

Failing regression checkpoint: `0e76ae0`.

```text
Test Files 1 failed (1)
Tests 16 failed | 11 passed (27)
Expected a Convex function exported from module "accountRecovery"
as `previewHandleRestoration`, but there is no such export.
```

The eleven early negative cases rejected because the export was absent; those
results were not counted as safety proof. After implementation and four additional
cases, all 31 restoration tests pass. Focused recovery/publication-handle suite:
46 tests across three files. Full command `npm test`:

```text
Test Files 53 passed | 1 skipped (54)
Tests 552 passed | 1 skipped (553)
Node tests 6 passed, 0 failed
```

`npm run lint`, `npm run build` (including TypeScript), separate nonincremental
TypeScript and `git diff --check` pass. One optional private-file test is skipped.
Tests use synthetic accounts. A new synthetic authenticated context reads the
restored handle; this does not prove a fresh Clerk session or hosted restoration.
No new browser proof is claimed for this backend-only local change.

Independent read-only review found no concrete blocker. Card correspondence
checks headline, note, status, start date, product slug and domain; it does not
prove historical link or activity equivalence. Separate links/evidence records
are outside the fingerprints. Internal access supplies operator privileges;
fingerprints do not prove human approval. No live restoration was exercised.

## Owner decision superseding execution

The owner subsequently approved retaining the existing `lecturesfrom` account
and site handles. Do not synchronize or execute this helper as a requirement for
the current profile. The helper and its tests are removed from active source. The reviewed
implementation remains recoverable at `ed0962d` in local Git history.

## Superseded execution proposal

Production still serves approved application `a2539b9`; its release is recorded
in [the production receipt](2026-09-19-profile-production-release.md). No new
backend synchronization, production record mutation, provider read, transfer,
recurrence or publication accompanied this implementation.

Next authorized action must name the new code checkpoint and production Convex
`striped-chicken-693`: synchronize the operator functions, take a fresh private
snapshot, preview the exact verified account/site restoration from
`lecturesfrom` to `keegan`, then apply only the reviewed two-handle change when
all guards and fingerprints match. Verify all other application records remain
identical, authenticated sharing uses `/keegan`, the existing signed-out profile
is unchanged, and a replay is a no-op. Stop on any changed identity or conflict.
This needs its own exact approval; the earlier source-release approval covered
`a2539b9` only. No Vercel release is needed for these internal functions.

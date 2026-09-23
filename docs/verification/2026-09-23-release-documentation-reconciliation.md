# Release documentation reconciliation

Verified: September 23, 2026. Documentation-only correction of seven active
references after the PR #25–64 audit. Historical verification receipts are unchanged.

## Source and release identities

| Role | Accepted identity |
| --- | --- |
| Audited main and documentation base | `4566f17f85fbe5b6eab4545f1c9f8eb1d7be41d0` |
| Accepted backend | `082e90cf21a37ff1e95fbcdd26d50b430ea4a62e` |
| Accepted frontend | `5aa32e6ad1cc6729fd620fa30ba3b98444a0d670` |
| Production frontend deployment | `dpl_B1M4ceGnXE6hFDGTKGmU1Pqr7Xg2` |
| Production origin | `https://proper-respect.com` |
| Production Convex target | `striped-chicken-693`, project `lecturesfrom/proper-respect` |

All 40 PRs from #25 through #64 are merged in audited main. That does not make
main an approved deployment candidate. These runtime changes remain excluded
from accepted production:

| PR | Held runtime change |
| --- | --- |
| [#52](https://github.com/keeganmoody33/PROPER-RESPECT/pull/52) | Canonical `lecturesfrom` profile, alias, and migration |
| [#58](https://github.com/keeganmoody33/PROPER-RESPECT/pull/58) | GitHub capture identity, deduplication, and review preservation |
| [#60](https://github.com/keeganmoody33/PROPER-RESPECT/pull/60) | Validated and bounded GitHub provider adapter |
| [#64](https://github.com/keeganmoody33/PROPER-RESPECT/pull/64) | Scheduled GitHub authority, fingerprint, and replay guards |

PR #49 is a local public-reading prototype. PR #56 is a local parser/CLI. Neither
is a hosted capability. The audit's per-file matrix retains the remaining PR
classifications and selective-release evidence.

The accepted frontend embeds the same 62 `convex/` files as the accepted backend.
The following read-only comparison produced no diff:

```sh
git diff --name-only 082e90cf21a37ff1e95fbcdd26d50b430ea4a62e 5aa32e6ad1cc6729fd620fa30ba3b98444a0d670 -- convex/
git ls-tree -r --name-only 082e90cf21a37ff1e95fbcdd26d50b430ea4a62e convex/ | wc -l
```

This proves source equality, not a new hosted backend inspection. The accepted
backend's runtime verification comes from the September 23 release receipt.

## Completed operations and remaining acceptance

[Issue #24](https://github.com/keeganmoody33/PROPER-RESPECT/issues/24), under
"Scope routing and documentation," records the native app/auth cutover at
`dbbc42770ea9ad1c70477698b70792c0585d07c7` on September 21. Its exact wording is:

> Hobby primary-domain migration invalidated sessions; old callbacks/DNS are retained for an explicit rollback, not simultaneous old-host authentication.

The [September 21 public redirect observation](2026-09-21-sharing-isolation.md#release-state-and-remaining-acceptance)
proves path/query continuity only. It explicitly does not prove authenticated
old-host rollback. Do not repeat the superseded dual-host-authentication plan.

The September 23 release added the empty-collection first-tool flow, private-save
confirmation, and optional public identity until sharing. The release receipt
records all 57 deployed module fingerprints matching the accepted backend,
163 anonymous production HTTP assertions passing, and 21 native browser checks
passing. Existing-owner collection access and the same 22 loaded product regions
were observed. These are prior release results, not tests rerun for this docs fix.

Fresh hosted signup, email-code delivery, a new user's first private save across
a fresh session, direct two-user isolation, designated-identity upload/replay,
approved publication, provider reconnect/revocation, and authentic unattended
usage remain acceptance work. Completed Gmail consent and bounded runs are
historical evidence; further reads and recurrence remain paused.

The September 23 completed Ora result is 71/100, B. Native public WebMCP guide and
profile tools worked in the audit despite Ora's missed detection. The 90+ goal
remains open. No usage counts are inferred from public examples or a working tool.

## Verified selective-release procedure

The [September 22 release receipt](2026-09-22-ora-release-and-rescan.md#source-and-release)
records the isolated frontend upload procedure. It changed only the deployment
package's `vercel.json` to use `npm run deploy:check && npm run build`, confirmed
that command in uploaded settings and the actual build log, tested the candidate,
and then promoted it. It did not run a Convex deployment.

The September 23 onboarding release used that frontend build command after its
separately approved backend synchronization. Shared project settings stayed
unchanged, and the accepted backend remained unchanged after frontend promotion.
The repository's default `vercel.json` still invokes Convex deployment and disables
Git-triggered deployments. The active [deployment runbook](../DEPLOYMENT.md#prepare-a-selective-release)
now uses this verified separation. A later backend candidate must include the
accepted onboarding query; the older standalone GitHub candidate would revert it.
No command in these receipts was executed during this documentation correction.

## Reproduction and correction

The old plugin README's runnable example asked to read
`https://proper-respect.com/lecturesfrom`; the local MCP README used
`get_public_profile({"profileReference":"lecturesfrom"})`. Anonymous probes on
September 23 reproduced 404 for that public path and 200 for `/keegan`.
Both examples now use `/keegan`, with an explicit pending-migration note. This
preserves the owner's desired future handle. The reading skill is unchanged and
still requires the user's intended public profile URL without guessing a handle.

Anonymous HTTP verification for this correction returned:

| Request | Result |
| --- | --- |
| `/lecturesfrom` | 404 |
| `/keegan` | 200 HTML |
| `/onboarding` | Final 200 at `/app/collection` on the same origin |
| `/sitemap.xml` | 200 XML |
| `/share-image.png?v=20260922` | 200 PNG |

The initial exploratory `/opengraph-image` probe returned 404. Source inspection
identified `/share-image.png` as the real route, and the follow-up probe above
verified it. No route implementation was changed.

`src/server/public-site.ts` supplies configured-origin canonical and
OpenGraph/Twitter metadata. `app/share-image.png/route.tsx` generates the generic
brand image without owner data. `app/sitemap.ts` lists the homepage and three
trust pages with last-modified dates. ADR-056 now distinguishes those implemented
features from the still-unimplemented profile-specific artwork.

## Verification and evidence

Existing focused contracts passed:

```sh
./node_modules/.bin/vitest run src/server/public-reading-package.test.ts src/server/public-site.test.ts src/server/public-metadata.test.ts
node --test scripts/deployment-preflight.test.mjs
git diff --check
```

The results were 18 Vitest tests and six Node script tests passing. Dependencies
were reused through an ignored local `node_modules` symlink. The Vitest run emitted
its existing future Vite config-loader warning; all tests passed. No new test
mirrors the prose. Link targets, named paths, package scripts, and the release
build command were inspected against source. Local metadata tests exercise main,
including the unreleased alias behavior, and do not establish live migration.

Local evidence retained outside Git:

- `/tmp/proper-respect-reconciliation-20260923/` contains `pr-matrix.md`,
  `issue24-audit.md`, `runtime-findings.md`, and `receipt.md` from the completed audit.
- `/tmp/proper-respect-onboarding-release-evidence-20260923/release-receipt-20260923.md`
  records the accepted backend/frontend release and remaining acceptance work.
- `/tmp/u35-public-http-20260923.json` records this correction's anonymous probes.
- `/tmp/u35-focused-contracts-20260923.log` and
  `/tmp/u35-preflight-contract-20260923.log` retain the focused test output.
- `/tmp/u35-release-docs-report.md` records the immutable documentation commit,
  tree, patch ID, and handoff to independent review.

These machine-local paths are evidence pointers, not contributor prerequisites.
This correction performs no deployment, backend synchronization, configuration
change, private-account read, provider read, migration, seed, or publication.

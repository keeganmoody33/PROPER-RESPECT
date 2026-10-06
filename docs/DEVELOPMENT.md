# Developing PROPER-RESPECT

Updated: 2026-10-06. Start with [AGENTS.md](../AGENTS.md), the
[remediation brief](remediation/CODEX-BRIEF.md), the
[Cursor handoff](CURSOR_HANDOFF.md), the
[deployment runbook](DEPLOYMENT.md) and the
[canonical Ref](https://plan.ref.tools/oUl8LCIQb32SAicK).

## Latest deployed state

Checked 2026-10-06. Release `v0.2.6` deployed
`8cab986ee3e5f638b320d4baacefff0302a45615`, including the collection editor
in #149 and truthful footer categories in #148.
[Release run 37439623114](https://github.com/keeganmoody33/PROPER-RESPECT/actions/runs/37439623114)
completed its verification, production backend, and production frontend jobs.
The frontend job also passed the production-domain check and live smoke test.

An independent anonymous GET to
[`/lecturesfrom`](https://proper-respect.com/lecturesfrom) returned HTTP 200
on 2026-10-06 with Wispr Flow, NotebookLM, Devin Desktop, and GitHub cards.
The GitHub card's retained activity was visibly stale. No signed-in save,
provider read, fresh signup, or publication was performed during this check.

For adding tools and sharing a profile, start with the
[product walkthrough](../README.md#build-your-tool-profile). For the current
Codex and Claude Code boundaries, read
[usage measurement](usage-measurement.md). The native Codex launcher remains
blocked. The release above predates R27 hosted measurement imports; do not infer
that unmerged source changes are deployed.

The dated state and invited-tester observations below are retained as historical
evidence. They are not the current deployment or backlog. The remediation brief
and linked issues remain the task records.

### Historical deployment observation, September 27

Checked 2026-09-27 from a cloud session. It could read git, GitHub and
Vercel deployment metadata. It could not reach Convex, the live site, or
the owner's local machine.

| Layer | State | How it was established |
| --- | --- | --- |
| Current source | `main` at `7510f9e` (#98). R01 merged; K01 done. | git |
| Release candidate | None. There is no `v*` tag, and the release pipeline (R10) isn't built yet. | git |
| Production frontend | `dpl_5poDzGmiTmCdsGTjwdbMfrrsrEYt`, deployed from the CLI on 2026-09-25 at 15:13 EDT, with no commit SHA. All 446 uploaded source files match `archive/live-frontend-2026-09-25` at `e9df8cc`: `5aa32e6` plus the ARD trust manifest, built without `convex deploy`. | Vercel API; hash of every file |
| Production backend | `striped-chicken-693`, last verified at `082e90c` on 2026-09-23 ([receipt](verification/2026-09-23-release-documentation-reconciliation.md)). **Unknown** whether anyone ran a Convex deploy after that. | receipt only |
| On main, not deployed | 17 Convex files: #52's migration, #58, #60, #64, #81, #90, #91 and R01. `/lecturesfrom` depends on #52. | `git diff 082e90c main -- convex/` |
| Runtime checks | Last run 2026-09-23. Clerk sign-up read `restricted` on 2026-09-26. None since. | receipts |

Do not deploy main outside the release workflow. Releases push a `v*` tag and
run `.github/workflows/release.yml` ([deployment runbook](DEPLOYMENT.md),
[v0.2.0](releases/v0.2.0.md)); after R10, the brief's next steps are K02, then K03.

### Historical invited-tester observations, September 27

The [remediation brief](remediation/CODEX-BRIEF.md) and
[#24](https://github.com/keeganmoody33/PROPER-RESPECT/issues/24) were the
backlog for these observations. This table recorded the mapping at that time.

| Outcome | Status in source | Tasks |
| --- | --- | --- |
| Reach a useful private collection | Empty state and setup retry work. `/app/*` has no error boundary, and production likely replaces every validation message with "Server Error". | #104, #105; R05 covers the public page |
| Review discoveries without retyping | The "use this observed date" shortcut never renders. | #102 |
| Add or correct a product without an integration | Adding works. Renaming a product, fixing its website or removing a mistaken relationship doesn't exist. | None yet: owner decides |
| Save status, go-to, explanation and history | Works (`inventory.save`, `relationshipEvents`). | None |
| See decisions in a fresh session | Proven in `convex-test` and a fixture only. | R29; K07 step 4 |
| Inspect supporting information and its limits | Mostly works. Uploaded originals can't be reopened. One-off captures read "Updated" forever. | None yet for reopening; #103; R12 |
| Preview, publish selected cards, unpublish | Publish works. Unpublishing is hidden behind a republish. | R15 |
| Data controls | No delete-original UI, no unpublish-all, no export. Gmail disconnect keeps Google's grant. | R15, R17 |
| Owner isolation | Denial tests exist across most modules. Cross-owner delete and revoke aren't tested. | R15; K07 step 5 |
| Same behavior for API, artifact (Wispr Flow) and manual products | Save, history and publish are shared. An artifact metric still needs a developer-run script. | K07 step 3; R21; R27 later |
| Refresh keeps decisions; failure never becomes zero | Failures go stale, never zero. No user can turn refresh on. | R08, R09, R11, K04 |
| Finished cards and brands | Unknown products show initials; Terms says "Coming soon". | R26, R07 |
| A released build | Production is `e9df8cc`; main is undeployed. | R10, K02, K03 |

## Current product

The product represents tools a person has used or tested, what they are testing
now, their explicitly selected go-to stack, and their changing relationship
history. Evidence supports that story; activity does not rank importance.
Private save and explicit publication remain separate.

## Existing Tasks 1–4

- Task 1: source/account identity and immutable retention are implemented.
- Task 2: owner-bound Gmail OAuth, encrypted generation-bound credentials,
  bounded discovery, provenance, private review and maintenance controls are
  implemented. The authorized live capture/candidate gate passed. Further
  mailbox reads are paused; recurring collection remains off. Historical depth,
  live recovery and authorized hosted maintenance remain follow-up work.
- Task 3: both prototypes are preserved. A/B remains unselected and nonblocking.
- Task 4: private intake, manual product entry, owner relationships/go-to/history,
  compact cards, retained branding, exact sharing preview and source controls
  are integrated. Existing-owner access is verified; fresh-user and full release acceptance remain.

The existing direct GitHub connector is retained. The Composio evaluation is
complete; production replacement is unaccepted and nonblocking. Reuse the current
evidence model and read [source roles](003-evidence-surfaces.md). Email discovers
possible relationships; product APIs/exports supply actual activity when exposed.
Generic uploads retain originals but do not authenticate images or extract
Screen Time automatically.

## Optional request tally

Updated: 2026-10-06. The footer's aggregate tally uses Upstash Redis through its
REST API. Supply a URL and its matching token together in the server environment,
using either `KV_REST_API_URL` / `KV_REST_API_TOKEN` or the
`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` aliases. The KV names take
precedence when present. Keep the token server-side; none of these names uses a
`NEXT_PUBLIC_` prefix.

If the URL or token is absent, the store is disabled, `/api/tally` returns 503 and
the footer tally stays hidden. `VERCEL_ENV=production` uses the
`pr:tally:v1` category hash and `pr:tally:v1:since` timestamp; every other value,
including preview, development and unset, uses `pr:preview:tally:v1` and
`pr:preview:tally:v1:since`. The existing `PROPER_RESPECT_E2E_REFERENCE=1` fixture
disables both store reads and writes even when credentials are inherited.

Eligible page requests include private collection, sign-in, sign-up and
onboarding pages. The store receives only aggregate categories and the start
timestamp, without visitor IP addresses, account identifiers, request paths or
raw User-Agent strings. Classification is an inference from client claims;
missing identification has a separate unidentified total. Counts represent
requests, not unique people or product usage. Static assets, API requests,
prefetches, prerenders and client-side data fetches are excluded. Counting is
best effort: failed or interrupted writes can be dropped, and cached totals can
be delayed. The [shared privacy page](../src/server/trust-pages.ts) describes the
same boundaries in HTML and Markdown.

The author of [PR #148](https://github.com/keeganmoody33/PROPER-RESPECT/pull/148)
reported that KV was configured in Vercel. That report is unverified: this pass
has not inspected hosted settings or values, read a production tally, or sent
requests to the configured store. Source integration does not establish a
configured or accepted production tally.

## Work and verification

Use pstack-codex as the primary workflow for scoped implementation, focused tests,
browser verification and review, per the September 19 owner direction. Compound
Engineering remains available for focused supporting work. Preserve the existing
Ref, Tasks 1–4, unrelated work and accepted checkpoints. Source, capture,
observation, review and relationship remain distinct.

The [September 18 source verification](verification/2026-09-18-main-consolidation.md)
and the September 19 release receipts retain their original dated results.
They do not describe the current production source. Detailed real-account
operator receipts and originals remain private.

The native `proper-respect.com` cutover is complete. Do not restart the former
apex-to-`props.lecturesfrom.com` transition. Git-triggered deployments remain
disabled, and the Vercel build is frontend-only. The backend deploys only from
the tagged release workflow, after the owner's approval.
Additional provider reads, recurrence, data transfer, and publication retain
their separate authorization boundaries.

## Supporting a relationship

Use provider telemetry when available. Where it is unavailable, retain an
export/screenshot or ask for owner-described history, dates and context. Label
the basis and coverage; never manufacture numbers or require telemetry to save
a relationship. A screenshot hash preserves bytes, not authenticity. Brand
metadata never strengthens evidence. A parent-company logo is not a verified
subproduct logo, even when the requested domain matches.

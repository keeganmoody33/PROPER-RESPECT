# Developing PROPER-RESPECT

Updated: 2026-09-27. Start with [AGENTS.md](../AGENTS.md), the
[remediation brief](remediation/CODEX-BRIEF.md), the
[Cursor handoff](CURSOR_HANDOFF.md), the
[deployment runbook](DEPLOYMENT.md) and the
[canonical Ref](https://plan.ref.tools/oUl8LCIQb32SAicK).

## Latest deployed state

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

Do not deploy main as a shortcut. Releases follow the brief: R10, then K02,
then K03.

### Invited-tester outcomes and the tasks that cover them

The [remediation brief](remediation/CODEX-BRIEF.md) and
[#24](https://github.com/keeganmoody33/PROPER-RESPECT/issues/24) stay the
backlog. This table only points into them.

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
disabled, and the repository's Vercel build command still deploys Convex.
Follow the deployment runbook for a separately reviewed selective release.
Additional provider reads, recurrence, data transfer, and publication retain
their separate authorization boundaries.

## Supporting a relationship

Use provider telemetry when available. Where it is unavailable, retain an
export/screenshot or ask for owner-described history, dates and context. Label
the basis and coverage; never manufacture numbers or require telemetry to save
a relationship. A screenshot hash preserves bytes, not authenticity. Brand
metadata never strengthens evidence. A parent-company logo is not a verified
subproduct logo, even when the requested domain matches.

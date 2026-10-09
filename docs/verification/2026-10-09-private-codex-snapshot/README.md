# Retained Codex history to a deliberately published card

This is a local, synthetic acceptance receipt. It does not establish hosted authentication, real Codex/Cursor account acceptance, Mac acquisition, second-user acceptance or production behavior.

Verification candidate: `dc28ba8790450193060d869f003d340addbb1fc3`, on `feat/private-codex-snapshots-local` at `/workspace/pr-usage-snapshot`. Application code is identical to `a00e98ccf827d8e8fd56b2d4d9e27ab18542a42b`; the last commit updates an authentication test mock for the new action hook. Base: verified local receiver integration `f82bffa89c1ea5b3a49fb84ff88299867e48ed75`.

## What a user can do

Open retained Codex usage, choose one to seven UTC days, and save a private snapshot to the existing Codex card or a new draft. The server derives the counters from the retained source. No browser total is accepted. A lost response can be retried without duplicating the card or capture.

The existing private review selects individual measurements. The user confirms the relationship, chooses the reviewed source for sharing, opens an exact preview, and separately approves publication. Public output includes only the approved measurements and their truthful units, period and limitations. Opaque source/device/response identifiers stay private. No price, billed charge, API-equivalent cost, quota or human-skill claim is inferred.

The source is one owner-associated device, with partial coverage and unverified account identity. The new derivation is explicitly “Sum of distinct response counters.” Unknown values remain unknown. Legacy cumulative rows are excluded. Conflicting variants, including timestamps outside the chosen window, cannot become publishable totals. Existing native/generic measurement imports retain their earlier behavior.

## Lifecycle and compatibility

Each ordered page and the final write rechecks the authenticated owner and source checkpoint. Source changes invalidate an in-progress save. New saved versions require new review; refresh never silently updates a saved or public copy. Exact replays reuse a capture, while deleted captures cannot be restored by replay.

Disconnect follows the current retention choice. Source erasure blocks snapshot review immediately and removes private values and approvals in bounded batches. Completion is reported only when evidence, receipts and private snapshot payloads are gone. Already published copies require the existing separate unpublish action, disclosed next to the controls.

Modern readers and preview/publish calls opt into `measurementVersion: 2`. Default readers omit unsupported summed values. Legacy preview/publish calls reject profiles containing sums, including preserved cards, rather than approving invisible content. Remove-all remains available; owner export preserves the complete snapshot.

Limits: one source, at most seven UTC days per snapshot, 200 rows per page, 200,000 scanned rows, 64MiB scanned canonical evidence, three-minute scan deadline; existing 32-capture, 750KB retained-history and 256-review limits per relationship. All source history is scanned so cross-window conflicting response variants remain visible. Empty modern windows create no card. Specific empty-window and scan-limit messages give a useful next step.

## Findings and disposition

| Finding | Disposition and evidence |
| --- | --- |
| No retained-history-to-card bridge | Implemented the bounded server action and existing review/publication path; backend RED then GREEN. |
| Final page could return after the scan deadline | Fixed post-page and pre-commit checks; delayed-final-page regression leaves no capture. |
| Erase returned success before private snapshot cleanup | Reproduced with paused scheduler, fixed shared bounded cleanup in `94fece5`; manual/scheduled completion and retention regressions pass. |
| A long private source ID overflowed the 390px sharing form | Reproduced in the actual-backend browser journey; fieldset and label wrapping fixed. |
| New browser test would run before browser installation in CI | Executed through the existing selected component suite after its browser install; no workflow changes. |
| Hosted Chrome unavailable in this cloud workspace | Ten native WebMCP checks passed using real Chromium 151 with webpack; this does not replace the required hosted Chrome job. |

The domain review covers 105,246 synthetic responses, exact integer sums, missing counters, duplicates, ordered group boundaries, cross-window conflicts and scan limits. Backend checks cover ownership, 205-row pagination, concurrent duplicate saves, stale checkpoints, review/publication hashes, deletion and retention. Browser checks use actual Convex functions with synthetic sessions and retained rows on desktop and mobile, including lost-response recovery, explicit approval, public projection, axe and overflow assertions.

An implementation review at `dc28ba8` found no remaining functional blocker. This is internal work verification, not the external exact-head review required for release.

Screenshots: [private save, mobile](saved-390.png), [publication preview, mobile](preview-390.png), [private save, desktop](saved-1280.png), [publication preview, desktop](preview-1280.png). These show the same application code as the final verification candidate. They were captured by the isolated actual-backend browser test, with synthetic retained rows and session identity.

## Final local checks

Node 24.19.0; matching installed dependencies, synthetic build values only. Evidence directory: `/tmp/pr-usage-snapshot-evidence`.

| Check | Result |
| --- | --- |
| Full Vitest suite, two workers, unchanged timeouts | 2,298 passed; four skipped: two existing cases and the two browser cases executed separately below |
| All seven Node script suites from `npm test` | 125 passed |
| ESLint / strict TypeScript | Passed |
| Default production build, Turbopack | Passed |
| Component Playwright suite | 98 passed, including the real-backend desktop/mobile snapshot journey |
| Public application pages / navigation / security headers / WebMCP contracts | 98 passed |
| Isolated Cursor environment | 7 passed |
| Private usage previews | 10 passed |
| Preview trust pages / searchable analytics | 5 / 3 passed |
| Production representation-negotiation build and browser checks | Webpack build passed; 5 checks passed |
| Synthetic connection prototype | 8 passed |
| Unchanged public MCP subsystem, isolated lane | Typecheck/lint/build passed; 16 server and 5 browser tests passed |
| Native WebMCP, system Chromium 151 fallback | 10 passed; exact hosted Chrome remains unverified |
| Pinned Vercel CLI, credential-free smoke | Default and JS modes passed |

The first broad run identified the auth mock omission and one unchanged mailbox test exceeding its existing five-second timeout under concurrent build/browser load. The mock was corrected. That mailbox test passed unchanged in isolation, then the complete suite passed with two workers. No timeout or gate was weakened. The final browser batches and schema/application code were unchanged during their runs. Original Oct7 screenshots and Next-generated development paths were restored after verification.

## Release and rollback boundary

No new branch was pushed, PR opened, Copilot review requested, merge performed, schema synchronized, environment changed, deployment made, real provider account read, or public profile written for this slice. #123 recovery/receipts are untouched.

Current remote main remains `baff7e8d85827872ede63ada2297d92c03adf37d`. PR162 remains `1b8a44baad03ab4dcae2e9dc0017d3600cfb4c13`; PR157 remains `3268abadbfd13abd79ae2e0ffabda5b07ea82dcf`. This slice depends on the separately documented selective integration of PR157/158/161 plus PR162, not on an assumed merge of those PRs. Last verified production remains v0.2.7, `51e5224f60fafb141029235fceeb41fa101d701e`.

Before release: reconcile those exact dependency heads, obtain external exact-head review and required hosted CI, authorize development-only generated API synchronization for the receiver modules, and prove the hosted owner/collector journey. Production `striped-chicken-693` remains excluded. Development `utmost-mongoose-374` also holds real owner data and needs explicit authorization for writes.

Before any snapshot writes, the patch can be reverted. Once snapshots exist, rollback should disable the frontend feature while retaining the additive snapshot fields/index, widened public-measurement validator, compatibility gates and deletion cleanup. Restoring an older backend wholesale could reject stored data or leave derived private values outside deletion. Any backend release/rollback remains an owner decision.

# Usage measurements and example cards

Researched: 2026-09-21. Official sources below were read for this pass. The carousel is a design demonstration with synthetic values, not a claim of connected accounts or new import support.

## Clay

Source: https://university.clay.com/docs/actions-data-credits

> Clay uses two separate metrics to track your usage: Actions and Data Credits.

Source: https://university.clay.com/docs/credit-usage

> All views allow you to download the data as a CSV for further analysis.

Clay documents workspace usage plus table-level time, column and run views. The table history coverage begins November 5, 2025. Usage can belong to a workspace; project ownership is not proof that one person performed every action. CSV data must be inspected before promising a row-count importer.

Our proposed distinct-row metric is a derived count: distinct `(workspace, table, row identifier)` values with a successful qualifying enrichment in the selected period. Multiple enriched columns and reruns can increase actions without increasing distinct rows. Attempts, failed runs, credits, and distinct companies/people remain separate. Stable row identities and success records are prerequisites. If an export lacks them, show its supported actions/credits only; do not reconstruct rows by dividing credits. No Clay activity was read and no paid action ran.

## Wispr Flow

Source: https://docs.wisprflow.ai/articles/8760230576-your-usage-tab-track-your-dictation-stats-in-wispr-flow

> Total words dictated: A running count of every word you've dictated with Flow

Insights documents average speed, word totals, streaks, app usage and shareable image cards. Keep cumulative word totals separate from a monthly comparison. Capture timestamp and device coverage belong with the snapshot. A screenshot can be retained and owner-reviewed; it is not an authenticated structured API response. This pass did not confirm a public personal-usage API. The existing retained Wispr evidence path remains unchanged; no dictation content was accessed.

## Claude Code

Source: https://code.claude.com/docs/en/monitoring-usage

> Cost metrics are approximations.

The documented OpenTelemetry token counter distinguishes input, output, cacheRead and cacheCreation. Prefer metadata-only collection and preserve source version, model, session identity and coverage. Historical local transcript formats are version-dependent. Prospective telemetry does not prove earlier usage; cumulative exports require reset-aware deltas and deduplication.

Source: https://code.claude.com/docs/en/costs

> the session cost figure isn’t relevant for billing purposes

That statement applies to Max/Pro subscription billing. Usage metrics, API-equivalent estimates, extra usage charges and the subscription bill are different measures. The example has token categories only. No telemetry was enabled and no local transcript was opened. Private import validation remains a prerequisite to any public metering promise.

## GitHub

Source: https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference

The current connector supplies a contribution calendar. Keep its contributions label; commit-only counts require a separately scoped commit source. Captured account/date coverage remains visible. No new capture ran.

## Demonstration behavior

Four selectable cards use the existing ProductCard renderer. Previous/next controls wrap; playback is opt-in and pauses on focus or pointer entry. The sample label, source documentation and metric caveat remain visible. The bottom fist bump stays. Cards retain separate presentation: dark GitHub, light Clay, cream/green Wispr, warm terminal-style Claude Code. Clay/Wispr favicons are copied from their official pages with hashes in `2026-09-21-usage-example-assets.json`. Unavailable licensed brand typefaces use system fallbacks; these are not claimed as full verified brand snapshots. The Claude Code text mark is not an invented official logo.

## Release boundary

PR #37 merged `1d6b7162c2cf23d1397245450b01ccb807fa2ee0` through merge `0354d0fe327bc2d7981dd7a70822a927399b9f08`. The subsequent profile/calendar commits were not in that merge. This branch carries them forward as `4a41560` and `0c33db2`, alongside the slideshow. The original worktree and its running preview were preserved. No merge, deployment, backend synchronization, provider capture or publication occurred in this pass.

## Verified implementation

Application commit: `cd4360f49775c97f3f5cad6b56f9899eb202dc36`.

- `npm test`: 682 passed, 2 optional skipped; 7 script tests passed.
- `npx playwright test`: 59 passed, including manual selection, looping, opt-in playback, focus pause, card reset, mobile320/390, source labels and axe checks for every new slide.
- `npm run lint`, `npm run typecheck`, `git diff --check`: passed.
- Production build passed with synthetic Clerk/Convex configuration and `PUBLIC_SITE_ORIGIN=https://public.example`.
- Desktop and mobile screenshots are in `2026-09-21-usage-slideshow/`; Clay/mobile and Claude/desktop inspected directly.

Backend-first synchronization is still needed for the carried-forward optional profile links at authorized release. The slideshow itself performs no provider requests, imports or writes. Existing hosted acceptance gaps remain unchanged.

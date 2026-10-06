# Homepage title review

Date: 2026-09-26. PR: #74. Ref: https://plan.ref.tools/d6fedvHQMy4bpEJW.

The owner authorized reviewing the outstanding comments, fixing the title
regression gap, reconciling current main and merging the reviewed source. This
does not authorize a deployment or any backend or private-data operation.

## Source and scope

- Original PR head: `dadc78e830414967d7f947fea2dc5c6fac53eaa1`.
- Inspected main: `6d6964187aef61a9accb0d304ad621a7aac2efe8`.
- Conflict-free local merge: `3275edb0e0a9519c76e3d1c9a6720157253193c7`,
  with main first and the original PR head second.
- Runtime change: the existing one-line homepage metadata correction to
  `Proper Respect: Your tools. Your track record.`
- Added persistent desktop/mobile browser assertions in the existing
  `tests/e2e/public-metadata.spec.ts`, which the application CI already runs.
- Root layout, ARD source/tests, Convex, publication code and deployment settings
  remain identical to inspected main. The original title receipt is retained.
- Work happened in a separate checkout; the original author branch and protected
  checkouts were not switched, reset or stashed. The remote update is a normal
  fast-forward, preserving the original PR commit.

## Review dispositions

The raw comments and dispositions were retained before code changes in
`/tmp/proper-respect-pr74-review-20260926/`.

- Owner review trigger (5840930325): superseded by the latest explicit work order;
  no new bot trigger posted.
- Codex status/error (5840932448 and 5840948433): service failure, not a code
  finding or successful review. No retry requested.
- Copilot quota review: no code finding or review coverage.
- Cursor router approval: historical automation state, superseded for the new
  head; not counted as substantive review.
- Copilot's unintended suffix claim: not a bug. Installed Next 16.3.5 guidance
  at `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md:285-287`
  says the layout template does not apply to a page in the same route segment.
  The actual served document, Open Graph and Twitter titles match the exact
  approved string, with no suffix, in development and production fixture runs.
- Missing focused homepage assertions: fixed now with the persistent regression.
- Owner-account Claude comment (5847043186): suffix reasoning independently
  verified; missing test fixed; behind-main state reconciled without rewriting.
- No inline review threads existed at the initial inspection. Fresh comments,
  exact-head independent review, hosted checks and merge are later gates recorded
  in the PR thread and the external outcome receipt, not inferred here.

## Verification

- RED on exact inspected main: both new viewport tests failed all three title
  assertions, receiving `Your tools. Your track record.` instead of the approved
  wording. HTTP, canonical and Markdown assertions passed. Retained `red-main.log`.
- GREEN after reconciliation: both new tests passed in development. The first
  six-test development run passed five tests; the existing onboarding navigation
  hit `net::ERR_ABORTED`. Its isolated rerun passed without any code change. Both
  outcomes are retained; the first run is not reported as all green.
- Served production fixture: all six public-metadata tests passed, including
  both homepage widths, public profile metadata, private/missing-page noindex,
  sitemap and share-image checks.
- Focused Vitest: 25 tests across metadata, authentication indexing and ARD passed.
- Focused ESLint and whitespace validation passed.
- `npm run build -- --webpack`: production build and TypeScript passed, 28/28
  static pages generated. Fixture mode used a synthetic public origin and blank
  Clerk/Convex configuration; no real provider or backend access.

The external evidence directory retains exact commands, exit codes, timestamps,
logs, raw PR data, protected-checkout snapshots and the isolated Playwright
configuration. No Google indexing, Ora improvement or deployed title is claimed.

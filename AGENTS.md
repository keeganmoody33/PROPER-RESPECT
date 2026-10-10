# Repository Guidelines

Updated: 2026-10-09.

## Reviewer direction for every agent

The October 9 owner decision applies to every agent and integration, including
Cursor, and every PR: use independent Claude review and do not request Copilot
review through comments, the reviewer API or automation. Missing Claude access
blocks review; it does not authorize a fallback. Claude-written work requires
an owner-appointed independent reviewer other than Claude, with Copilot still
excluded. Read the current review policy in `docs/remediation/CODEX-BRIEF.md`
before requesting review. CI and the writer's own inspection cannot clear a PR.

## Active remediation program

Owner-approved 2026-09-25. When the owner asks you to continue remediation, or
names a task from it (for example R05 or K03), first read
[`docs/remediation/CODEX-BRIEF.md`](docs/remediation/CODEX-BRIEF.md) and
follow it: one task, one branch, one PR. For that work only, the brief
replaces five rules in this file:

- "Do not reset to main": each remediation task starts a new branch from
  `origin/main`. Existing checkouts and branches stay as they are.
- Commit and PR titles: keep the `fix:`, `docs:` and `feat:` prefixes, and end
  the PR title and every commit subject with the task ID, for example
  `fix: reserve route-shadowed handles (R01)`.
- Concurrent Review Protocol: the PR description is the task's receipt, and
  review dispositions go in the PR thread. New bugs are listed in the PR and,
  where Codex can create issues, filed as their own `bug` issues linked from
  #24.
- "Start fixes with a RED regression": the brief exempts tasks that change
  only docs, configuration or workflow files.
- Merge authorization: Claude is the required independent outside reviewer
  for Codex-written PRs (owner decision, 2026-10-09). Copilot no longer clears
  PRs or receives review requests. The autopilot is paused; the owner alone
  authorizes landing after clean exact-head Claude review and passing CI.
  Every code, dependency or base change requires fresh checks and review.
  Codex never clears or merges its own work (the brief's Section 4).

Every other rule here still applies to remediation work.

**Delivery-pass lead.** Owner assignment, 2026-09-27. For the invited-tester
delivery, a Claude Code session leads implementation. It may write the
brief's Codex (C) tasks under every brief rule, one `remediate/<ID>-<slug>`
branch and PR per task. That also applies:

- **Claiming a task.** Before starting one, check that no open PR and no
  `remediate/<ID>-*` branch already names it. Either one means another writer
  holds the task.
- **Review.** It never reviews or clears its own PRs. Claude-written work
  waits for the owner to appoint an independent reviewer other than Claude;
  the required Claude route cannot clear its own writer. Copilot is retired
  from this review workflow. A failed or unavailable reviewer never waives
  independent review.
- **Autopilot.** All automatic starts, fixes, review requests and merges are
  paused. Existing `needs-owner` labels stay in place.
- **Authority.** The role adds no authority to deploy, change production
  configuration, run migrations, read providers, turn on recurring collection,
  change sign-up or publish. Owner (K) tasks stay with the owner.

## Project Structure & Module Organization

- `app/`: Next.js App Router pages, layouts, styles, and API routes.
- `components/`: React collection, onboarding, review, and product-card components.
- `src/domain/`: validated domain models and pure business rules; `src/server/`: provider adapters; `src/client/` and `src/data/`: client helpers and data access.
- `convex/`: schema, authenticated queries/mutations/actions, and backend tests. Do not hand-edit `convex/_generated/`.
- `public/`: static assets; `scripts/`: operational checks; `tests/e2e/`: browser tests.
- `docs/`: product decisions, plans, deployment instructions, and dated verification receipts. Start with `docs/DEVELOPMENT.md`.

## Build, Test, and Development Commands

- `npm run dev -- --hostname localhost`: start the local application; use localhost for Clerk authentication.
- `npm run build` / `npm start`: build and serve the production application locally.
- `npm run lint`: run ESLint with Next.js and TypeScript rules.
- `npm run typecheck`: check strict TypeScript without emitting files.
- `npm test`: run Vitest and Node script tests; `npm run test:watch` enables watch mode.
- `npm run test:e2e`: run Playwright browser checks.
- `npm run deploy:check`: inspect deployment prerequisites without deploying.

## Coding Style & Naming Conventions

Match existing TypeScript/TSX: two-space indentation, double quotes, semicolons, PascalCase components/types, and camelCase functions/variables. Component/domain filenames generally use kebab-case; preserve existing Convex module naming. Use `@/` for repository-root imports. Validate external data at adapter boundaries; keep credentials server-side.

## Testing Guidelines

Place `*.test.ts` beside domain, adapter, or Convex code; use `convex-test` for backend behavior. Browser tests use `tests/e2e/*.spec.ts` and Playwright/axe. Cover ownership, replay safety, provenance, fallback behavior, and private/public separation. No numeric coverage threshold is configured. Keep fixture E2E separate from the real signed-in runtime. Verify changed UI on desktop/mobile; distinguish synthetic checks from authorized live proof.

## Commit & Pull Request Guidelines

Follow existing imperative prefixes: `fix:` and `docs:`; use `feat:` for new capabilities. Stage named files only; preserve unrelated changes. PRs should explain the problem, resulting behavior, linked Ref/task, checks, and limitations; include screenshots for visual changes.

## Evidence, Configuration & Execution Boundaries

Keep source, capture, observation, review, relationship, and publication distinct. Email discovers candidates; brand data supplies presentation; neither proves usage. Go-to requires an owner decision.

Keep secrets in ignored configuration and private originals outside Git. Follow `docs/DEPLOYMENT.md`; verify target and authorization before backend synchronization, real reads, recurrence, deployment, or publication. Never seed over owner data. Use pstack-codex as the primary execution workflow per the September 19 owner direction. Preserve the accepted checkout, existing Ref and Tasks 1–4; do not reset to main or restart completed slices. Compound Engineering remains available for focused supporting work.

## Concurrent Review Protocol

Devin reports; Codex, or the delivery-pass lead named under "Active
remediation program", writes. Do not build on a Devin-pushed branch or commit;
report it to the owner first. Record every review comment in the current dated
verification receipt as fix now, deferred with reason, superseded, or not a bug
with evidence before changing code. Resolve contradictory findings by regression
test. Valid bugs join release-gaps issue #24. After PR #22, use one small branch
off main per concern; do not interleave unrelated remediation. Start fixes with
a RED regression. Name the inspected branch/head in reports; any new commit
restarts review and exact-head merge authorization must be rechecked.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

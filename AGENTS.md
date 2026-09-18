# Repository Guidelines

Updated: 2026-09-18.

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

Keep secrets in ignored configuration and private originals outside Git. Follow `docs/DEPLOYMENT.md`; verify target and authorization before backend synchronization, real reads, recurrence, deployment, or publication. Never seed over owner data. Continue the accepted checkout and Tasks 1–4 using Compound Engineering; do not reset to main or restart completed slices.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

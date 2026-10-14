@AGENTS.md

# Claude Code notes

AGENTS.md is the source of truth. This file only adds rules Claude Code
learned in the improve-every-run loop. Each rule names the run that taught it.
Rules that apply to every agent belong in AGENTS.md (via PR).

## Learned rules

- **Every visitor-facing URL passes `isHttpUrl` at all four layers:**
  publish (`projectPublicProfile` / `preparePublication`), read
  (`readPublishedProfile`), projection (`visible-public-profile.ts`) and render
  (`components/product-card.tsx`). Fixing one layer is not enough. (#107)
- **Owner-chosen links are refused; evidence-derived links are dropped
  quietly.** Refuse a bad primary link with a message the owner can act on.
  Drop bad artifact links (evidence the owner can't edit) without blocking the
  publish. (#107, owner decision)
- **Keep read schemas tolerant.** Don't tighten `activityModuleSchema` or Convex
  validators to reject stored data. Filter instead, so old profiles still load. (#107)
- **Reuse R03's bad-URL set in link tests:** `javascript:alert(1)`,
  `data:text/html,x`, `ftp://…` and `https://user:pass@…`, next to one good
  https link. (#107)
- **Commit trailers:** findings keep the brief's IDs (for example
  `Findings: G17`). When there's no R/K task ID, the issue number takes its
  place in titles and subjects. (#107)
- **The box can be heavily loaded:** run Vitest one file at a time with a
  timeout, and run long Claude Code jobs in the background. (#107 run)

## Recovery program

Started 2026-10-14. Resume from [docs/recovery/HANDOFF.md](docs/recovery/HANDOFF.md);
the other recovery artifacts (baseline, inventory, STATE, BACKLOG,
VERIFICATION) sit beside it.

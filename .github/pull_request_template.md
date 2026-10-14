## Task

- Remediation task, if any: R__ (see `docs/remediation/CODEX-BRIEF.md`). End
  the PR title and every commit subject with it, for example `(R05)`.
- Findings: G__

## Problem

<!-- What was wrong, with file:line evidence. -->

## Change

<!-- What this PR changes, and what it deliberately leaves alone. -->

## Proof

- RED: the regression test that failed before the change, with its failing
  assertion. Docs-only and config-only tasks write "exempt" and name the check.
- GREEN: the commands you ran and their results (`npm test`, lint, typecheck,
  build, browser specs). Name any CI step you couldn't run locally.
- Screenshots, desktop and mobile, for visible UI changes.

## Independent review before landing

- [ ] Record the final head/base SHAs, passing CI and independent Claude review
  URL. If Claude wrote or helped write this change, obtain an owner-appointed
  independent reviewer other than Claude. The writer never clears its own work.
- [ ] Do not request Copilot review, including `@copilot` comments or API
  requests. Missing Claude access blocks review without a reviewer fallback.
- [ ] Obtain explicit owner landing approval after the exact candidate is
  reviewed. CI success or a quota refusal is not independent clearance.

## Owner actions after merge

- [ ] None, or list each one (release, setting, publication, approval).

## Found, not fixed

<!-- Other problems noticed while working. File a `bug` issue for each valid one if you can. -->

## Limitations

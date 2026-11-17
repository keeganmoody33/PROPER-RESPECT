# Public-ready audit, 17 Nov 2026

A read-only audit of the repository at `main` `6ae1fcd`, run by a build agent for the public-ready pass. Nothing was edited, deleted or rewritten by the audit. What the pass then changed is listed under "Done in this pass".

## Secrets in git history

**Method.** A regex sweep of `git log --all -p` over 1,265 commits on every local ref, remote ref, tag and pull request head. Neither gitleaks nor trufflehog is installed, so no entropy scanner ran. Lockfiles were excluded. Images and binaries were not scanned.

**Result: no real credential found.** No private key, live Clerk key, GitHub token, Google client secret, model provider key, Convex deploy key, AWS key or JWT. GitHub secret scanning and push protection are on, with 0 alerts. The only env file ever committed is `.env.example`, which holds placeholders.

| Finding | Where | Verdict |
| --- | --- | --- |
| Clerk publishable and secret key shaped strings | workflows, tests, `.env.example`, old receipts | Synthetic. The publishable one decodes to `example.clerk.accounts.dev`. |
| Convex deployment names for production and development | `release.yml`, `docs/DEVELOPMENT.md`, `docs/DEPLOYMENT.md` | Identifiers, not credentials. The URL ships to every browser. |
| The owner's personal email address | one line in `docs/verification/2026-09-19-hosted-gmail-release.md`, and the author field of about 1,000 commits | Real. Removing it from commit authorship needs a history rewrite, which is the owner's call. |
| A real-looking name beside an email address, used as an example | `docs/adr/013-floating-lineage.md` | Replaced with an example name and address in this pass. |
| Absolute local paths that show a username | 20 tracked docs | Not secret. |
| An 80 KB owner data receipt | a local branch only, never pushed | Not public. Do not push the branch `codex/proper-respect-self-test-20260916`. |

**Not checked:** Actions logs, issue and PR comments, image contents and EXIF data, and objects no ref points to.

## Remote branches

181 remote branches besides `main`. The repository setting that deletes a branch when its PR merges is off, which is why most are still there.

- **140 branches** have a merged PR and their tip inside that PR's head. Their work is on `main`. Safe to delete.
- **`receipts`** is written by the receipt workflow. Keep.
- **`archive/live-frontend-2026-09-25`** is cited by `docs/DEVELOPMENT.md`. Keep, or turn it into a tag.
- **Open PRs with their own branch:** #152, #161, #163, #164, #165, #186, #187, #192, #193, #196, #210. #186's change is now on `main` (`9de5feb`). #152 and #165 are about Copilot review, which the owner dropped.
- **Closed without merging, work redone on `main`:** `fix/one-yellow` (#226), `fix/release-journey-20261008` (#162), five `cursor/ci-autofix-automation-*`, three `codex/collection-*` and `codex/observed-date-draft-20260928`, `cursor/collection-editor-layout-refinement-a3b8`.
- **No PR, September release candidates:** eleven `codex/*-frontend-release-*` and `codex/github-*-candidate-*` branches. Their unique commits match work that landed through other PRs, but patch equivalence was not proven for each. Delete after the owner's OK.
- **No PR, owner decides:** `recovery/baseline` (469 lines of docs not on `main`), `review/connection-dependencies-20261009`, `codex/real-mac-sync-20261007`, `integrate/private-measurement-first-result`.

Nothing was deleted.

## Dependencies

| Lockfile | Before | After this pass |
| --- | --- | --- |
| root | 2 critical, 3 high, 9 moderate | 0 |
| `release-tools/` | 1 critical, 20 high | unchanged |
| `prototypes/public-mcp/` | 3 high | unchanged |
| `.github/claude-review/` | 0 | 0 |

- **Root, fixed with `npm audit fix` and no `--force`:** `next` 16.3.8 to 16.4.6 (two critical remote code execution advisories and one high), `zod` to 4.6.7, `dompurify` through `posthog-js`, `undici` through `cheerio`, `vite` through `vitest`. 
- **`release-tools/`, not fixed:** `vercel` is pinned at 61.0.0 and the fix is a major bump to 65. It runs only in CI, with the production deploy token. Bump it alone and dry-run the release workflow.
- **`prototypes/public-mcp/`, not fixed:** exact pins; the fix rewrites them. It runs only in a CI prototype job.
- Dependabot PR #210 is 235 commits behind and is superseded for the root lockfile by this pass.

## Dead code

- **Removed in this pass:** `components/profile-loading.tsx`, imported only by a test (in the Phase D PR).
- **Proven unused, left in place:** the `linkCredits` and `metricDefinitions` tables in `convex/schema.ts`. Removing a table from the schema can fail a deploy if production holds rows in it, and nobody has checked.
- **Public Convex functions with no caller outside tests:** `privateCodexSnapshots.keep` and `.read`, `mailboxes.disconnect`, `onboarding.generateUploadUrl`, `productBrands.historyForProp`. Left in place: some may be operator entry points.

## CI

- `verify.yml` runs on every PR and on push to `main`. `release.yml` runs on a `v*` tag.
- `main` requires `verify`, `browser` and `Native Chrome WebMCP`, up to date, enforced for admins. A direct push is refused.
- The receipt workflow runs daily and has failed since 2026-10-10 because the owner's GitHub card is stale (#175).
- The remediation autopilot runs twice an hour and skips every time: its switch is off.
- GitHub's Copilot workflows are still active although the owner dropped Copilot review.

## Done in this pass

- Root dependencies fixed.
- `.env*` is ignored except `.env.example`. Before, a file named `.env` could have been committed.
- The browser test that wrote screenshots into `docs/verification/` on every run now writes to its own output folder.
- The example address in ADR-013 replaced.

## For the owner

- Choose a license. The repository is public with none, so all rights are reserved.
- Decide which branches to delete, and whether to turn on "delete branch on merge".
- Decide what to do about the personal email address in commit authorship.
- Decide whether `.impeccable/`, `skills-lock.json` and two local skill folders should be ignored or committed.

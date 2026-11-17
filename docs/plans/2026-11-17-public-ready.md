# Public ready: main, 17 Nov 2026

Owner instruction, 2026-11-17: get `main` public ready, in small green commits, delivered as one PR per phase. The lead (Claude Code) plans, briefs, reviews every diff, runs the checks and commits. Build agents never push.

**Checks before every push:** `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

**Stops for the owner:** a `v*` tag, deleting a remote branch, closing or merging a PR, a license, a schema change that needs a migration on production data, anything a revert can't undo.

## What the product is

Proper Respect is your tooling page: one link that shows every tool you use, test and used before, with the usage behind it, so you earn respect for what you actually run and give props to whoever put you on.

- **Respect** is what usage earns. **Props** is credit to who put you on a tool. Nothing else gets those words.
- "Backed by your usage", never "verified".
- **Page** is the public page. **Collection** is the private list.
- No dashes in copy. No invented personal facts.

## Found while reading

- `main` has branch protection: three required checks, up to date with `main`, enforced for admins. See "Delivery" below.
- The repo is already public on GitHub. It has no license.
- The launch readiness notes and the positioning brief the instruction names were not in the repo at first. The owner supplied them the same day: [`2026-11-17-launch-readiness.md`](2026-11-17-launch-readiness.md) (blockers, the build plan by phase, the text-first walkthrough, the voice notes) and [`2026-11-17-positioning-brief.md`](2026-11-17-positioning-brief.md) (the one sentence, the vocabulary, the hero options and every drift area with file paths). Read both before working on any phase.
- `CONTEXT.md`, `docs/002-v2-product-motion.md` and `docs/DEVELOPMENT.md` said sign-up is closed. Owner, 2026-11-17: the sign-up mode is an open decision, with a waitlist recommended, and today's behaviour is that sign-up is public. The docs change; Clerk does not.
- `verify.yml` already runs on push to `main`.

## Delivery

A direct push to `main` is refused: branch protection requires three passing checks on every commit, for admins too. Owner, 2026-11-17: leave branch protection as it is. Cut a branch from the local work, open one PR per phase, and merge each only when all three checks pass and Codex and Devin have reviewed it.

## File ownership

No two agents working at the same time edit the same file. The lead owns the shared files (`AGENTS.md`, `CONTEXT.md`, `README.md`, this plan) and lands the open PRs' diffs.

| Slice | Owner | Files it may edit |
| --- | --- | --- |
| A3 open PRs (#226, #162, #186) | Lead | whatever each diff touches, landed before agents start |
| B1 reserved handles | Lead | `src/domain/handle.ts`, its test, `scripts/` read-only check |
| A1 no placeholder, A2 suggested line | Agent 1 | `src/domain/share-all.ts`, `src/domain/visible-public-profile.ts`, new `src/domain/suggested-headline.ts`, `convex/stack.ts`, `convex/connectors.ts` (two headline sites), `convex/onboarding.ts:507`, `components/share-all-step.tsx`, `components/private-inventory.tsx`, `components/product-card.tsx` (placeholder only), their tests |
| A4 stale GitHub card (#175) | Agent 2, read only first | reports a diagnosis; the fix is briefed after Agent 1 lands |
| D1 to D4, D6 homepage and words | Agent 3 | `app/page.tsx`, `app/homepage.module.css`, `src/server/agent-discovery.ts`, `src/server/trust-pages.ts`, `src/data/homepage-examples.ts`, `app/[handle]/page.tsx`, their tests |
| A5 errors (#104, #105) | Agent 4, after Agent 1 | `convex/*.ts` throws, new error helper, `app/app/error.tsx`, `app/global-error.tsx`, `app/[handle]/error.tsx`, client message helper |
| B2 onboarding order, D5 affiliate, D7 phone bugs | Agent 5, after Agent 1 | `components/onboarding-client.tsx`, `components/signed-out-collection.tsx`, `components/site-frame.tsx`, `app/globals.css` (frame rules only), `components/trust-article.module.css` |
| C1 to C4 search | Agent 6, after A and B | new `convex/search*.ts`, `convex/schema.ts` (additive only), `app/search/`, `app/tools/`, `app/sitemap.ts`, card tool link in `components/product-card.tsx` |
| B3 walkthrough | Agent 7, after B2 | new `components/walkthrough*.tsx`, a mount point in `components/onboarding-client.tsx` |
| E repo | Lead plus one read-only audit agent | `README.md`, `docs/`, `.gitignore` |

## Checklist

### Phase A: no robotic text, ship-ready main

- [x] A1 Share skips cards with no headline and names them; no placeholder goes public; system text removed
- [x] A2 Suggested first line: pure function, prefilled and marked as a suggestion, tested per level
- [x] A3 Land #226, #162, #186 on main after re-review
- [x] A4 Find why the GitHub card stopped refreshing (#175) and fix it, or say what the owner must check (diagnosed; a dead token now reads as "Reconnect GitHub"; the lasting fix is the owner's decision)
- [x] A5 Real validation messages (#105) and an error boundary (#104)

### Phase B: one clear first run

- [x] B1 Reserve `search`, `tools`, `people`, `explore`, `app`, `about` (#222); read-only check for taken ones
- [x] B2 Onboarding order: sign in, build your stack, handle asked right before sharing, sources below; checked at 390px
- [x] B3 Text-first walkthrough, one tool per screen

### Phase C: search people and tools

- [ ] C1 Read model of published cards with a search index; listing switch, default on, isolated in one place
- [ ] C2 `/search` with People and Tools
- [ ] C3 `/tools/{slug}`: who uses it now, who used it before
- [ ] C4 Card tool name links to its tool page; sitemap lists listed pages and tool pages

### Phase D: drift fixes and the option B hero

- [x] D1 Hero: "Every tool you've used counts."
- [x] D2 One meaning each for respect and props
- [x] D3 A stopped or paused tool in the featured examples; referral example out of the featured set
- [x] D4 "Tooling page" label; page and collection used consistently
- [x] D5 Affiliate link behind more options
- [ ] D6 Browse section points at `/search`
- [x] D7 Phone nav, Start button, tab scroll cue, About marker contrast

### Phase E: public ready repo

- [x] README
- [x] Secrets sweep of full history, reported
- [x] Stale docs fixed; `docs/acceptance/second-user.md` filled
- [x] `.gitignore`, dead code, dependency audit
- [x] Remote branches listed against main
- [x] `AGENTS.md` says what we do now

## Log

- 2026-11-17: plan written.
- 2026-11-17: groundwork merged as PR #227 (`6ae1fcd`): B1 reserved handles, the plan and the two source documents, the sign-up wording, and #226, #162 and #186 landed (A3).
- 2026-11-17: Phase D merged as PR #228 (`bd46ca9`): the option B hero, one meaning each for respect and props, a stopped tool in the featured examples, "tooling page".
- 2026-11-17: Phase A merged as PR #230 (`b97ca68`): no placeholder or app-written line goes public, the suggested first line, real error messages and error boundaries, and the GitHub refresh diagnosis.
- 2026-11-17: Phase E opened as PR #229: dependency fixes, README, stale docs, the audit in `docs/verification/2026-11-17-public-ready-audit.md`, and this pass's rules in `AGENTS.md`.
- 2026-11-17: Phase B opened as PR #231: the stack-first order (B2), the affiliate option behind More options (D5), and the phone fixes (D7).
- 2026-11-17: the walkthrough (B3) follows Phase B in its own PR. Phase C (search, tool pages, D6) follows in its own PR; its boxes are ticked there.

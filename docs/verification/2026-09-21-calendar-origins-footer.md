# Calendar, Origins and footer verification

Date: 2026-09-21 (America/New_York).
Tested application snapshot: `c64ce6c6bbf0c2d3f969a7250e9ca6a25b04277d`.
Original reviewed PR head: `51c220a630d6808a114eefc4cd3ca000e2d630cb`.
Base: `6cc9533367759892973784438075f8ef14ee1709`.
Ref: https://plan.ref.tools/aGrDHnZ8uoiYcMlA (Task 4).
Branch: `codex/calendar-origins-footer-20260921`.

These SHAs intentionally differ: the original reviewed PR head adds this receipt and four fixture screenshots to the tested application snapshot. `git diff --name-only c64ce6c6bbf0c2d3f969a7250e9ca6a25b04277d 51c220a630d6808a114eefc4cd3ca000e2d630cb` confirms that only this Markdown file and the four PNGs linked below changed. No application or test code changed between those commits. The results below document that original verification; subsequent PR revisions require their own verification receipt.

## Owner comments and disposition

1. “While is this only on the left side this should be reflecting how github presents”
   - The homepage previously supplied only 28 illustrative days. Combined with a capped grid, this produced the small left-hand cluster.
   - The example now supplies a deterministic 365-day sample, 2025-09-01 through 2026-08-31, totaling 859 contributions. It remains explicitly labeled sample data, with no connected account.
   - Shared calendar rendering has square cells, aligned month/day labels, GitHub colors, a right-aligned legend and a keyboard-focusable horizontal scroller. Real captures retain their actual period; missing days remain missing rather than becoming zero contributions. No connector or owner data changed.
2. “Need another tap titled origins / lineage kinda like about and I will give you the copy”
   - Header and footer link to `/about/origins`. The page reserves space for the owner's copy without inventing history.
   - The route is noindex and absent from the sitemap. Canonical metadata derives from configured public origin.
   - Existing `/about` and `/origins` profile handles remain reachable; fixture browser checks cover both.
3. “need logo down here . should reflect footers found at companies like hex.tech and other dope solutions. What we dont have jsut create a place holder.”
   - The global footer now contains the existing PR mark/wordmark, Give props/Get props, and Product, Company and Resources columns.
   - Contact, Social, Help, Privacy and Terms are noninteractive Coming soon placeholders. Existing destinations are real links.
   - Shared framing applies across pages. Product-native card identity and the previously approved lower fist bump remain intact.

## References inspected

- https://github.com/keeganmoody33 — visual calendar arrangement only; personal contribution counts were not copied into the example.
- https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference — contributions include more than commits.
- https://hex.tech/ — footer hierarchy: brand, grouped navigation, bottom information row. No Hex assets or copy reused.

## Original verification

All checks ran in an isolated worktree with synthetic fixtures, without live Clerk or Convex credentials.

| Check | Result |
| --- | --- |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS: 702 Vitest tests, 2 skipped; 7 Node script tests |
| `npm run test:e2e` | PASS: 73 Chromium browser checks |
| `npm run build` | PASS with `PUBLIC_SITE_ORIGIN=https://public.example`, fixture mode and blank Clerk/Convex settings |
| `git diff --check` | PASS |
| Independent agent diff review | No blocking findings; same inherited model, not a cross-model review |
| Changed-lines comment review | No new suppression directives; no comment deletions needed |

An initial local build using an HTTP origin was correctly rejected by the existing production HTTPS guard. Re-running with the HTTPS fixture origin passed; the guard was not weakened.

Browser checks cover 1440, 460, 390 and 320px where applicable. Root manually inspected desktop and the reported 460px layout, navigated Origins, and checked the footer. At 460px the calendar's local scroll area was 339px wide with 732px of content; arrow keys moved scrollLeft to 120. The document itself did not overflow. Dark scrollbar styling was verified after reload. The production build was then served on port 8824; a fresh browser tab verified the homepage and Origins route. An older preview tab had retained a connection-error page during the server restart; it is not the current preview.

Screenshots below are generated fixture evidence, not live authenticated acceptance. The development indicator visible in a fixture screenshot is not production content.

- [Desktop homepage](assets/2026-09-21-calendar-origins-footer/homepage-1440.png)
- [Mobile homepage](assets/2026-09-21-calendar-origins-footer/homepage-390.png)
- [Desktop GitHub example](assets/2026-09-21-calendar-origins-footer/github-1440.png)
- [Mobile GitHub example](assets/2026-09-21-calendar-origins-footer/github-390.png)

## Pstack decisions

- Model the domain: sample activity, captured activity and missing coverage remain separate.
- Prove it works: manual browser verification accompanies automated responsive, route and calendar checks.
- Sequence verifiable units: calendar behavior and shared framing received focused checks before the full suite and production build.
- One implementation writer owned shared CSS; separate read-only explanation and review avoided conflicting changes. Architect exploration was skipped because the existing domain contract and shared layout ownership were retained.

## Release boundary

No merge, deployment, authentication setting change, backend sync, publication or real-account import was performed for this slice. Origins copy and unavailable footer content remain pending the owner. Fresh-user signup, two-user isolation and provider lifecycle acceptance remain separate open gates; these fixture checks do not prove them.

The original checkout remained clean at `4df11b5fd3ff4e4747f61fa2d72998842970fd7b`.

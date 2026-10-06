# Searchable reconciliation preflight

Date: 2026-10-06 UTC. Source PR #141 head: `884db6b6d5f7e079a4d42cf158f1d78512bc4063`. Reconciliation baseline: `258660ce212ed50623ff2b93765f7cf8d327dff6`. Original checkout remains outside this work.

## Review dispositions recorded before edits

- Copilot COMMENTED at source head: “Copilot was unable to review this pull request because the user who requested the review has reached their quota limit.” Disposition: **not a bug with evidence**; this is missing outside-review coverage, never approval. There are zero captured substantive review comments or PR comments in the old audit and refreshed pr-141-current.json. New-head review is required.
- Hosted Verify failure: hardcoded `tests/e2e/trust-pages.spec.ts` expected three September 28 lastmods after privacy date changed. Disposition: **fix now**; assert sitemap dates per trust-document slug rather than a stale global count. Preserve full trust-page checks.
- Original global tracker privacy mismatch with newer PostHog: **fix now**; stop loading automatic SDK on the shared application. Current official script source reads every history navigation URL/title/referrer and retains listeners after React unmount. `data-cookie=false` does not gate private paths.

## Before-implementation evidence

Official public script: https://tracker.searchableanalytics.com/s.js, captured 2026-10-06, SHA-256 `fe952f7cd52da87da8b5d1a95ffcb77b0883fb5d67ef26e5bc42fdc8f99c3a84`, embedded version `7507b5e9218c2e8243834ad1e48204b10ebad60a`. The automatic V pageview includes `p:n,u:t,tl:e,r:document.referrer`; the script replaces both history methods and subscribes to popstate/hashchange. Its beacon batch JSON is `{v:1,d:n.domain,tk:n.token,vid:o,sid:r,sn:c,events:t}`. A manual minimal sender is a source-derived protocol adapter; local interception is not live vendor acceptance.

## Intended useful behavior and bounds

Production-only public path pageviews, no private/auth/onboarding requests, no private or public page text, no account identity, no query/fragment/referrer path, no vendor automatic plugins/replay, no Searchable cookies or browser storage. Preserve PostHog and its private replay/event rules. Use fresh ephemeral UUIDs for beacon envelope identifiers. No provider/account/production-data reads or deployment.

## Throughput checkpoint

1. Blocking first steps: inspect old/current source and official vendor behavior; record review dispositions; prove old SDK private-navigation leak with intercepted synthetic traffic before replacing it.
2. Independent workstreams: parent owns ProductCard/tooling; collection worker owns inventory/CSS. This worker alone owns analytics/disclosure/security files.
3. Shared mutable state: separate isolated worktree; no original checkout edits. Merge baseline into source-derived new local branch, retaining main PostHog.
4. Smallest safe decomposition: one bounded public-path sender and thin component, plus privacy/CSP/tests. Architect skipped: native automatic tracker incompatibility is demonstrated; sandbox tracker and forced full navigation add complexity or inaccurate pageviews. Nested delegation unavailable at four active slots; implementation owned directly by this worker with parent independent diff review.

Workflow: inherited pstack feature/refactoring route, Boundary Discipline puts privacy filtering at the outbound beacon boundary; Laziness Protocol avoids SDK teardown/iframe infrastructure. RED regression -> smallest safe implementation -> intercepted synthetic browser proof -> focused/full checks -> exact-head PR update and parent review.

## Measured native isolation decision

The proposed manual beacon sender was rejected by the coordinator before implementation: undocumented transport is too fragile. The native SDK can run accurately in an opaque `sandbox=allow-scripts` iframe. Chromium allowed its URL to be replaced with a sanitized public pathname before SDK loading while denying parent DOM access. Adding allow-same-origin would permit parent DOM access and is excluded. Same public-page frame persists for native history tracking; it is removed on excluded navigation. No route hierarchy changes.

Three native feasibility scenarios and raw intercepted events are preserved at `/tmp/proper-respect-pickup-20261006/searchable-native-feasibility.json`. Old global SDK captured synthetic private path/query/fragment/title despite zero cookies (RED). Opaque frame captured only /keegan with empty title/referrer and no cookies.

## Verification progression

- Runtime: bundled Node v24.19.0; npm ci installed 445 and audited 446 packages. Reported 6 high / 1 critical advisories; no dependency mutations or audit fix; parent owns tooling reconciliation.
- Source-derived local branch codex/searchable-reconcile-20261006; merge b8e957e brings 258660c into 884db, preserving old records/current PostHog. Original checkout untouched.
- RED: new rendered-document isolation/private-route regressions9 failed / 3 passed against old native component.
- GREEN: full suite: 1,761 passed / 2 retained-real-source skipped, plus 121 script tests. Final focused: 108 passed. Lint/typecheck and production build passed.
- Native SDK interception:2 desktop/mobile cases passed on 390/1440px, proving accurate 3 pageviews public→public→private→back, no duplicate public view or private-data event, source/origin checks, parent DOM/storage denial, no cookies/plugins, one persistent public session and fresh session on return. Native endpoint requests all intercepted; no events sent to Searchable.
- Synthetic tracker:2 desktop/mobile cases passed. Native evidence attachment added afterward; repeat needed only to persist raw same-surface traffic.
- Trust-page contract: 11 passed, including HTML/Markdown/sitemap, axe and overflow at 320/1440px in both themes. Initial concurrently started dev-server suite hit own Next lock; serial retry passed without changing gates or reusing other servers.
- Stable diff independently reviewable; no outside review or release claimed.

- Durable native proof repeat completed: 2/2; raw batches preserved in `/tmp/proper-respect-pickup-20261006/searchable-native-batches-390.json` and `searchable-native-batches-1440.json`. Source functional bytes remained stable. Production build regenerated transient Next types to baseline; no generated declaration changes retained. Final reviewer is binding the full file manifest.

## Reserved-root correction verification — 2026-10-06 UTC

GREEN after the independent finding: full 1,775 Vitest tests passed / 2 retained-real-source tests skipped, plus 121 Node script tests passed. Actual SDK browser suite: 3/3 passed, including direct navigation of excluded frame paths (HTTP 404, empty body and zero tracker requests) plus desktop/mobile native lifecycle. Direct Chromium empty-404 navigation errors are accepted only after the independent HTTP assertions; no implementation or verification gate was weakened. The same two durable native-batch JSON files were refreshed with these final source captures.

- Independent internal functional and changed-comment review PASS at the corrected 24-file manifest; finding resolved. Functional commit c74deaf.
- Refreshed main1dd933 cleanly without analytics source changes, preserving release CLI verification and analytics browser invocation in the overlapping workflow. Parent will check/merge the final exact head under strict current-base CI.

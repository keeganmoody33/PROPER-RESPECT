# Authentication Markdown compatibility — 2026-09-22

Initial base: `0188d5cdcadd0d29b9d7696c01db8b86b8ca73af`.
Integrated main before final verification: `144602e548074e8a937e4bf3f2b0664e5b52c35a`.
Branch: `codex/auth-markdown-compatibility-20260922`.

## Observed regression and decision

The completed Ora scan captured at `2026-09-23T03:18:21.191Z` reported score 68, after the preceding score 69. Its metadata check passed for `/agents.md`; `auth-md-exists` lost two points. The exact finding was:

> Path https://proper-respect.com/auth.md returned 1476 chars but does not look like markdown (no leading heading; content-type text/markdown; charset=utf-8)

This was a compatibility regression despite valid Markdown and the earlier release checks passing. PStack reproduce/fix/verify: a fresh local production build of the initial base reproduced that precise condition over actual HTTP. GET200, Markdown MIME, truthful prose and HEAD parity passed, while the raw body began with `---` and the heading-first assertion failed.

Fix now: `/auth.md` returns its unchanged `authenticationMarkdown()` body directly, beginning at byte zero with `# Proper Respect authentication`. Existing Markdown MIME, CORS and nosniff headers remain. No new canonical header, authentication method, API, OAuth exchange or agent capability is introduced. Metadata on every other document remains unchanged and mandatory in tests.

The focused unit test checks exact equality to the existing authentication body, first heading, content length and truthful credential boundaries. The discovery browser test contains an explicit `/auth.md` branch; it still requires frontmatter on the homepage and agent guide. Shared Markdown parsing is not weakened.

## Verification

Production build and server used synthetic public fixtures with blank Clerk/backend configuration, `PUBLIC_SITE_ORIGIN=https://public.example`, and local port 8862:

```sh
PUBLIC_SITE_ORIGIN=https://public.example PROPER_RESPECT_E2E_REFERENCE=1 NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY= CLERK_SECRET_KEY= NEXT_PUBLIC_CONVEX_URL= NEXT_TELEMETRY_DISABLED=1 npm run build -- --webpack
PUBLIC_SITE_ORIGIN=https://public.example PROPER_RESPECT_E2E_REFERENCE=1 NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY= CLERK_SECRET_KEY= NEXT_PUBLIC_CONVEX_URL= NEXT_TELEMETRY_DISABLED=1 npm run start -- --hostname 127.0.0.1 --port 8862
npx vitest run src/server/markdown-metadata.test.ts src/server/homepage-markdown.test.ts src/server/agent-discovery.test.ts src/server/agent-instructions.test.ts src/server/trust-pages.test.ts src/server/public-site.test.ts
npm run lint
npm run typecheck
```

Results: **21 focused tests passed across five matched files**; production webpack build, lint, typecheck and diff check passed. The initial route attempt exposed the metadata wrapper's required second argument; the final route intentionally constructs the plain Response locally without changing that shared wrapper.

Actual built HTTP: the same seven-condition scanner regression changed from RED (only heading-first failed) to **7/7 GREEN**. HEAD remains empty with matching content type/CORS/nosniff. Across discovery, Markdown negotiation and trust-page browser suites, **28 checks passed** against the built app; unrelated visual/axe repetitions were excluded because the change is Markdown bytes only.

## Release-helper handoff

External copies live in `/tmp/proper-respect-auth-markdown-evidence-20260922`, derived from the prior U8 helper directory. All **135 original baseline assertions** remain. Complete release runs still contain **145 assertions**; only U8's added authentication-frontmatter assertion becomes an explicit heading-first authentication assertion. Other frontmatter/canonical/body checks, exact skill digest and plain llms.txt parity remain intact.

Runtime, runtime tests, identity verifier, Markdown verifier, icon verifier and icon tests are byte-identical to U8. A structural comparison verifies that the public verifier changes only its auth-helper import and single added auth check. Helper hashes and inherited assertion names are recorded externally. **23 helper tests passed**, including rejection of the old frontmatter-first auth response and continued rejection of missing metadata for other documents.

No production release, backend synchronization, provider/account read, authentication change or new Ora scan occurred. A completed post-release scan is required to prove recovered auth credit and retained metadata credit. Local passing checks do not establish a score increase. Root owns selective release attribution; integrated main also contains the separately reviewed GitHub boundary patch, which this auth-only change does not deploy.

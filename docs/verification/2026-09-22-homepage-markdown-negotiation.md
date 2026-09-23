# Homepage Markdown negotiation verification

Date: 2026-09-22, America/New_York. Local HTTP captures occurred on 2026-09-23 UTC.
Branch: `codex/ora-markdown-20260922`.
Base: `669027099a38a15bed3f9502b72fe532b07b43a5`.
Scope: U3, explicit homepage Accept negotiation. No deployment, production query, private/provider read, schema migration, or publication occurred.

## Problem and resulting behavior

Before this change, `GET /` with `Accept: text/markdown` returned 200 HTML. The site already advertised and served `/index.md`, but the homepage request did not negotiate that representation.

The existing Clerk proxy now rewrites root GET/HEAD requests to `/index.md` when an explicit acceptable `text/markdown` range has a higher quality than HTML. It uses the existing `homepageMarkdown()` body. Missing Accept, wildcard-only requests, malformed quality values, and equal preferences retain HTML. More-specific ranges override wildcards for each representation. Unknown media parameters do not match the available UTF-8 representation. If no acceptable supported preference wins, the existing HTML response remains the server default; this does not introduce 406 handling.

Negotiation never depends on User-Agent. Unsupported paths remain their existing routes or 404s. Profiles do not acquire a new Markdown endpoint. Clerk's configured middleware and its matcher, including API/trpc and `/__clerk/:path*`, remain in place. The existing onboarding redirect, private-page metadata and endpoint authorization are unchanged.

`/index.md` now supplies its canonical HTML Link and Content-Location using PUBLIC_SITE_ORIGIN, plus Vary: Accept and preview noindex. The root HTML page retains its existing discovery Link header and canonical metadata. No frontmatter or WebMCP change is included.

## Architecture and framework findings

Two approaches were compared in [the PStack design record](../../work/pstack/2026-09-22-homepage-markdown.md): rewrite to the existing route, or generate the body directly in Proxy. The rewrite keeps a single response endpoint and lets Next provide HEAD behavior. A root `app/route.ts` cannot coexist with `app/page.tsx` under the installed Next conventions.

Next 16.3.5 overwrites an HTML response's Vary header in `node_modules/next/dist/build/templates/app-page-runtime.js` through `res.setHeader('Vary', varyHeader)`. Actual local production HTTP confirmed that a proxy Vary: Accept survives on Markdown but not on rendered HTML. Both homepage choices therefore send `Cache-Control: private, no-store`, independently verified under `next start`. This prevents an intermediary from caching one representation for the other despite the framework's HTML Vary replacement. Markdown still returns Vary: Accept. HTML remains prerendered internally, but HTTP/shared caching is disabled for this route, a deliberate performance tradeoff limited to the homepage and its explicit Markdown representation.

Development mode replaces HTML Cache-Control with `no-cache, must-revalidate`; the CI gate uses a production build/start so that this development behavior cannot mask a broken production safeguard.

Next also strips Flight headers and its internal `_rsc` query before passing the normalized request to Proxy. An attempted internal-header/query exception could not work and was removed. The final decision uses only public pathname, method, and Accept. Ordinary component requests, which do not prefer Markdown, retain Next's component response. An explicit conflicting text/markdown preference selects Markdown; no hidden Flight-header detection is claimed.

Sources consulted:

- Installed Next `01-app/03-api-reference/03-file-conventions/proxy.md`, including “RSC requests and rewrites”.
- Installed Next `01-app/01-getting-started/15-route-handlers.md`, including route conflicts, methods and caching.
- [RFC 9110 Accept and quality semantics](https://www.rfc-editor.org/rfc/rfc9110.html#section-12.5.1).
- [RFC 9110 Vary](https://www.rfc-editor.org/rfc/rfc9110.html#section-12.5.5).

## Verification performed

All runtime checks used port 8883 and synthetic public fixtures. Clerk publishable/secret keys and the Convex URL were explicitly empty. PUBLIC_SITE_ORIGIN was `https://public.example`. No environment file or secret was read.

| Check | Outcome |
| --- | --- |
| Baseline curl: `Accept: text/markdown` on `/` | Reproduced 200 `text/html; charset=utf-8`, HTML body, no Accept in Vary |
| RED test before helper implementation | New focused suite failed because the negotiation module did not exist |
| Focused unit suites, including proxy dispatch and existing auth metadata | 42 passed |
| Full `npm test` | 819 passed, 2 skipped; 7 Node script tests passed |
| `npm run lint` | Passed |
| `npm run typecheck` and production build TypeScript stage | Passed |
| Synthetic `npm run build -- --webpack` | Passed |
| Production browser/HTTP suite | 5 passed |
| Preview-mode build plus production browser/HTTP suite | 5 passed, including HTML noindex and Markdown noindex |
| Local curl under production server | Markdown body/media type and HTML no-store confirmed |
| `git diff --check` | Passed |

The production gate checks exact body equality between negotiated `/` and `/index.md`, heading-led text, GET/HEAD media type and canonical/Content-Location parity, quality/wildcard specificity, actual Chromium HTML navigation, ordinary Next RSC handling, identical text for browser/agent User-Agents, and unsupported/private-path behavior. No UI styling or branding changed; browser verification checks the existing visible homepage heading and canonical rather than adding a visual snapshot test.

Reproduce the production gate without real credentials:

```sh
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY='' CLERK_SECRET_KEY='' NEXT_PUBLIC_CONVEX_URL='' PROPER_RESPECT_E2E_REFERENCE=1 PUBLIC_SITE_ORIGIN=https://public.example NEXT_TELEMETRY_DISABLED=1 npm run build -- --webpack
NEGOTIATION_PRODUCTION=1 npx playwright test --config tests/e2e/markdown-negotiation.config.ts
```

For preview verification, set `VERCEL_ENV=preview` on both commands. The new workflow step builds with empty auth/backend values and executes this dedicated production config after the existing browser checks. It preserves the existing workflow inventory line for the separately owned U1 change.

## Observed limitations and dispositions

- HTML Vary replacement: fixed now through verified no-store caching policy; no framework patch or production configuration change. Markdown's Vary remains required and tested.
- Synthetic sign-in/sign-up: with Clerk deliberately unconfigured, the existing pages log `useSession can only be used within the <ClerkProvider /> component`. Tests compare the unchanged response status for HTML versus Markdown Accept and verify noindex; they do not call those errors successful authentication. No signed-in runtime or Clerk-provider availability is proven by this fixture. Existing metadata and mocked configured-Clerk dispatch tests are separate evidence.
- Two early browser failures were test assumptions, not relaxed product requirements. Next normalizes the root canonical without its trailing slash, so the test accepts the equivalent exact origin URL. Flight metadata is not exposed to Proxy, so the final test uses an ordinary component Accept request, and the unsupported hidden-header guard was removed.
- The final full and focused suites, lint, build/typecheck and production browser gate ran after removal of the ineffective internal-query guard. Preview checks exercised the same observable behavior before that removal; no hidden-query support is claimed.
- Independent exact-head review, hosted CI, deployment and a subsequent Ora rescan remain parent-owned. This receipt does not claim an updated Ora score or deployed negotiation.

## PR 55 review disposition — 2026-09-22

Inspected integrated head: `9eeafdf8143425e2e03cb96eeadc94351a4051e3`.

[Copilot thread PRRT_kwDOSyRAjs6k-dIf](https://github.com/keeganmoody33/PROPER-RESPECT/pull/55#discussion_r4078028540): **not a bug under the current HTTP standard**. The comment applies the former `accept-ext` distinction after `q`. [RFC 9110 §12.5.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-12.5.1) removed that grammar and says: “Recipients SHOULD process any parameter named "q" as weight, regardless of parameter ordering.” RFC 9110 obsoletes RFC 7231.

The current parser treats `q` as the weight in either position, matches the offered UTF-8 charset, and refuses an unsupported `profile=agent` media parameter in either position. Ignoring all parameters after `q` would silently select a representation that does not satisfy the requested parameters. Keep the parser unchanged. Add explicit regressions for supported charset and unsupported profile before/after `q`, including lower Markdown preference, because these order combinations were not previously named tests. These are characterization regressions for correct existing behavior, so no product RED failure is claimed.

Verification: `npx vitest run src/server/homepage-representation.test.ts` passed **42 tests**, including all six added ordering cases (`/tmp/pr55-parameter-ordering.log`). Focused ESLint and `git diff --check` passed. Only the test and this receipt changed; no production parser, proxy, caching, auth, route or configuration behavior changed. Existing production verification above was not rerun for this test-only addition.

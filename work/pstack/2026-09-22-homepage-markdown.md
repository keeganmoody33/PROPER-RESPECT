# Homepage Markdown negotiation

Date: 2026-09-22. Base: 669027099a38a15bed3f9502b72fe532b07b43a5. Assigned unit U3.

## Workflow

1. Ground. complete. Read AGENTS.md, DEVELOPMENT.md, installed Next proxy/route/caching documentation, current Clerk proxy, discovery routes, and RFC 9110 Accept semantics.
2. Sketch. complete. Compared both candidates below locally. No nested agents are available for this unit; this is not independent design review.
3. Agree. complete. No approval checkpoint requested; proceed within the assigned scope.
4. Implement. complete. Focused and full unit/script checks, lint, typecheck/build, and production/preview browser checks recorded in the verification receipt.
5. Scrap. not needed. The rewrite remains selected; runtime evidence required no-store caching and removal of an ineffective internal-Flight guard.

## Existing request path

Next configuration sets discovery Link headers on `/`. The broad proxy matcher includes `/`, application routes, API/trpc, and `/__clerk`; configured Clerk middleware handles those requests. Private page/API authorization remains downstream. `/index.md` already renders `homepageMarkdown()` with the shared Markdown response helper. The homepage currently ignores Accept and renders HTML.

Baseline local curl on port 8883 with `Accept: text/markdown` returned 200 `text/html; charset=utf-8`, an HTML document, and Vary without Accept. Synthetic configuration contains no configured authentication or backend credentials.

## Two designs

A. In the existing Clerk proxy callback, rewrite only eligible GET/HEAD `/` requests to `/index.md`. Keep the original representation route, one body generator, native HEAD handling, and existing HTML page. Add Vary to both homepage choices and representation metadata to the explicit Markdown route. Preserve the Clerk matcher and callback pipeline.

B. Return the existing Markdown body directly from the proxy. This avoids an internal rewrite but moves response/body/HEAD/preview behavior into the request interceptor alongside the existing route. Sharing another response function can reduce duplication, but the proxy still becomes a content endpoint.

Choose A. It reuses the exact existing endpoint and leaves response generation outside the proxy. An `app/route.ts` alternative cannot coexist with `app/page.tsx` according to the installed Next documentation.

## Types and policy

`prefersHomepageMarkdown(accept: string | null): boolean` compares supported media ranges and qualities. Require explicit acceptable text/markdown with quality higher than HTML. HTML wins equal preference and wildcard-only/missing/malformed input. More-specific ranges determine each representation's quality. Unsupported media parameters do not match the available representation.

`homepageRepresentation(request: NextRequest): NextResponse` negotiates only root GET/HEAD. Ordinary RSC Accept requests retain Next's normal path. Next strips internal Flight headers/query before Proxy, so no hidden internal-request detection is attempted. Every other path/method passes through, including auth/private and unsupported API-like paths. No User-Agent or bot detection.

Tests must establish real HTTP body/media-type parity with `/index.md`, Vary/Link metadata, GET/HEAD, mixed qualities and normal Chromium navigation, missing/unpublished routes, and unchanged Clerk dispatch/matcher. Preview Markdown remains noindex. No profile Markdown API, frontmatter format, or WebMCP change is introduced.

## Sources

- Installed Next `01-app/03-api-reference/03-file-conventions/proxy.md` and `01-app/01-getting-started/15-route-handlers.md`.
- https://www.rfc-editor.org/rfc/rfc9110.html#section-12.5.1
- https://www.rfc-editor.org/rfc/rfc9110.html#section-12.5.5

## Runtime correction

Next overwrites HTML Vary even after Proxy sets it. Both homepage representations now use private, no-store, verified under next start, while Markdown retains Vary: Accept. See [the verification receipt](../../docs/verification/2026-09-22-homepage-markdown-negotiation.md). The receipt distinguishes current source checks, real local HTTP/browser behavior, and untested hosted/authenticated behavior.

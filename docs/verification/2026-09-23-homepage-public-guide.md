# Homepage public guide verification

Date: 2026-09-23. Authoring base: `deea1bdaf2bed2fdf435057f6d1fc5966f8a66e1`. Branch: `codex/homepage-public-guide-20260923`.

The approved homepage tool is `get_public_site_guide({})`. Its description is exactly: "Explains Proper Respect, links to public documentation, and describes how to read a supplied published profile."

`app/page.tsx` passes `publicSiteGuide()` into the new client component. The server builds a JSON-serializable guide using the existing product description and `publicSiteOrigin()`. The result has `name`, `description`, `homepage`, `documentation`, `profileReading`, and `limits`. Its six documentation URLs point to existing Markdown routes. The reading procedure starts with the user's supplied published profile URL. No example handle or account information is returned.

A local snapshot avoids the extra networking, parsing, failure and cancellation paths that fetching documentation during execution would introduce. Each call receives a fresh clone of the snapshot captured at registration. The component registers only on the homepage, accepts only an empty object, rejects extra own keys including symbols, honors cancellation, and aborts registration on cleanup or registration failure. Its fixed invalid-input error is "Use an empty object {}. This tool returns the public site guide and accepts no URL, handle, or other arguments."

`readOnlyHint` is true. `untrustedContentHint` is false because this result contains only fixed first-party facts and documentation, with no owner or third-party text. The existing profile tool remains unchanged and retains `untrustedContentHint:true`. These annotations follow the [Chrome imperative API documentation](https://developer.chrome.com/docs/ai/webmcp/imperative-api), checked on 2026-09-23. The installed Next guide at `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md` requires serializable props at the client boundary. The new client import from the server module is type-only and erased during compilation.

The current agent instructions and authentication document describe the separate guide. The installable profile-reading skill, package version and digest are unchanged: its statement that the homepage has no profile tool remains true. Existing profile links remain `/lecturesfrom` on this branch. The guide has no release-specific profile link. There are no application layout, style, backend, dependency or configuration changes.

## Checks actually run

- RED: the new client suite could not import the absent component and the new server case failed because `publicSiteGuide` did not exist. Existing four server cases passed.
- `npx vitest run src/client/public-site-guide-webmcp.test.ts src/client/public-profile-webmcp.test.ts src/server/agent-discovery.test.ts src/server/markdown-metadata.test.ts src/server/public-reading-package.test.ts`: 41 passed. These cover static facts and canonical origin, exact description/schema/error, invalid input, snapshot mutation, execution without fetch, cancellation, retained callbacks, pending registration, and synchronous/asynchronous registration failure.
- `npm run lint` and `npm run typecheck`: passed.
- `PUBLIC_SITE_ORIGIN=https://public.example PROPER_RESPECT_E2E_REFERENCE=1 NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY= CLERK_SECRET_KEY= NEXT_PUBLIC_CONVEX_URL= npm run build -- --webpack`: passed. Served this production build on `127.0.0.1:8866` with the same synthetic configuration.
- `npx playwright test --config /tmp/u19-homepage-guide-evidence-20260923/native.config.ts`: 10 passed against the built app in installed Chrome 153.0.8010.54, using `--enable-features=WebMCPTesting,DevToolsWebMCPSupport`. Registration polling is bounded. The guide returns the expected canonical public.example links. Invalid URL/handle arguments return the fixed error or are rejected by native schema validation. Execution produces no requests after existing page prefetch activity settles. Same-document profile → Origins → homepage → profile → homepage navigation preserves a sentinel, revokes retained old tools, and leaves exactly the appropriate current tool. Origins, Contact, Privacy, the synthetic private-collection page and missing profile register neither tool. Original profile output and published-empty result assertions pass.
- `npx playwright test --config /tmp/u19-homepage-guide-evidence-20260923/browser.config.ts`: 31 passed against the built app. This runs `webmcp-contract.spec.ts`, `discovery.spec.ts` and `homepage.spec.ts`. Includes StrictMode and pending registration doubles, unsupported/rejected browser behavior, a real unsupported-browser homepage-to-profile navigation, existing Markdown discovery/package digests, and homepage entry checks at 1440, 390 and 320 pixels.
- `git diff --check`: passed. No comments or suppressions added. Existing profile implementation is byte-identical to the base.

The added tests live in the existing files already selected by `.github/workflows/verify.yml`. Native CI continues to run its existing development fixture; the local native proof above used a production build. No new test can be silently omitted by the native config's `profile.spec.ts` match.

## Failures resolved and limits

An initially added `/sign-in` fixture check reached a Clerk error page because all Clerk configuration is intentionally absent. That added case was removed; the original private/missing/Origins negative cases remain. This work does not verify real signed-in or Clerk runtime behavior.

The first no-network monitor also captured normal Next.js route chunk prefetches. It now waits up to ten seconds for network idle after native registration, then blocks and records requests while executing the guide. The final native suite passed all ten cases. Unit invocation separately proves that the guide callback never calls fetch.

No remote tool, profile lookup, provider connection, account read, write, publication, polyfill or public endpoint was added. No deployment, backend synchronization, live provider read or Ora rescan occurred. Local native Chrome proof does not establish hosted registration or a scanner score. This invisible registration change has no new visual UI; existing desktop/mobile homepage checks passed. Independent exact-head review and CI remain release gates owned by the coordinator.

Local logs and native result attachments: `/tmp/u19-homepage-guide-evidence-20260923/`. Production build log: `/tmp/u19-build.log`.

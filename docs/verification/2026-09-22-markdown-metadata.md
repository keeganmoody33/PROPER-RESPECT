# Public Markdown metadata — 2026-09-22

Base: `724216e6c415b0b06927dbe36e3f81683fcf9b70`.
Branch: `codex/markdown-metadata-20260922`.

## Contract and scope

The supplied completed Ora result reports `markdown-frontmatter` failed, 0/1, emerging. Ora's current public [check catalog](https://ora.ai/api/checks) requires a leading frontmatter block with title and at least one of description, canonical or last-updated. Its own [homepage Markdown](https://ora.ai/index.md) begins with YAML followed by a heading. This work does not claim a new scan result or score.

`MarkdownMetadata` contains a title, an optional description and a canonical URL. `markdownResponse` adds fixed-key YAML using quoted strings, then appends the existing body without alteration. JSON string quoting escapes embedded newlines, quotes and delimiters; additional escapes preserve C1 and Unicode line separators through YAML parsing. Tests use the existing lockfile-installed js-yaml parser; no dependency was added.

The homepage reuses its existing product identity. The agent guide reuses its public catalog entry. Authentication uses its existing heading. Trust pages reuse their existing title and description. Canonical URLs come only from `publicSiteOrigin`: `/`, `/agents.md`, `/auth.md`, and each trust page's HTML URL. The `/.well-known/agent-skills` aliases identify `/agents.md` as their canonical document. No author, license, language or date is inferred.

Bodies, URLs inside those bodies, plain `/llms.txt`, the installed skill's bytes/digest, HTTP headers, noindex behavior, negotiation, profiles, authentication and public capabilities are unchanged. Existing browser assertions now parse frontmatter and continue to require the original heading-led body. Unrelated HTML and static skill checks retain their existing expectations.

## PStack checkpoint

- Blocking first steps: inspected AGENTS, DEVELOPMENT, installed Next Route Handler docs, current Ora check catalog, all Markdown response callers and tests. Initial regression failed with `Markdown frontmatter unavailable`; the plain-text parity test passed.
- Independent workstreams: n/a; the response helper, caller arguments and representation tests share one contract.
- Shared mutable state: exclusive worktree and port 8860. Root approved the four route callers and three existing browser test files as a narrow scope extension.
- Smallest safe decomposition: one implementation owner; root provides independent review. Architect parallel exploration skipped for this bounded response-layer choice; response wrapping preserves plain-text and body consumers better than changing the shared renderers. No nested agent or application state mutation was needed.

## Verification

```
npx vitest run src/server/markdown-metadata.test.ts src/server/homepage-markdown.test.ts src/server/trust-pages.test.ts src/server/agent-discovery.test.ts src/server/public-site.test.ts src/server/public-reading-package.test.ts
npm run lint
npm run typecheck
PUBLIC_SITE_ORIGIN=https://public.example PROPER_RESPECT_E2E_REFERENCE=1 NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY= CLERK_SECRET_KEY= NEXT_PUBLIC_CONVEX_URL= NEXT_TELEMETRY_DISABLED=1 npm run build -- --webpack
PUBLIC_SITE_ORIGIN=https://public.example PROPER_RESPECT_E2E_REFERENCE=1 NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY= CLERK_SECRET_KEY= NEXT_PUBLIC_CONVEX_URL= NEXT_TELEMETRY_DISABLED=1 npm run start -- --hostname 127.0.0.1 --port 8860
npx playwright test -c /tmp/u8-playwright.config.ts --grep-invert 'trust pages remain readable'
git diff --check
```

23 focused unit tests passed across six files. Production webpack build, lint and typecheck passed. The temporary Playwright config points the three changed suites at the built application on 8860: 28 browser/HTTP checks passed. This covers GET/HEAD, canonical origin, HTML/Markdown negotiation, quality values, alternate links, unchanged llms.txt body, exact skill bytes/digest, public profile continuity, missing resources, and private/auth noindex boundaries. Unit tests preserve preview noindex on existing homepage/trust Markdown responses and reject invalid configured origins through the existing origin suite.

The first Playwright attempt caught the test helper's import.meta/CommonJS incompatibility before running tests. The loader now resolves js-yaml from the repository package; the complete targeted browser run then passed. Scalar tests independently parse the output and recover literal YAML-sensitive and control-character input, including exact title and body.

No visual design changed, so unrelated light/dark screenshot and axe repetitions were excluded. These are synthetic local runtime checks with authentication/backend configuration blank. They do not establish hosted sign-in, provider behavior, owner data, production release, or Ora credit. Release helpers and exact source/HTTP receipts are retained outside Git for the root's later candidate checks.

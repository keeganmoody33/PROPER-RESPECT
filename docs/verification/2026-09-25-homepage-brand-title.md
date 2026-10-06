# Homepage brand title verification

Date: 2026-09-25.

Branch: `codex/brand-title-20260925`.
Base: `43e2eef20a2edd8991d569b7e8dd4dbc03ced313`.
Ref: https://plan.ref.tools/d6fedvHQMy4bpEJW.

## Finding disposition

- Fix now: the homepage document, Open Graph and Twitter titles omit the product
  name. The owner approved adding Proper Respect and removing the proposed em dash.
- Approved title: `Proper Respect: Your tools. Your track record.`
- Scope: homepage metadata only. Search Console registration and external search
  ranking are separate from this source correction.

## Verification

Before the code change, an HTTP assertion against the running unchanged homepage
at `http://127.0.0.1:58425/` failed as expected. All three rendered titles were
`Your tools. Your track record.` instead of the approved title (RED).

After the change, both the development server and the served production build
returned `Proper Respect: Your tools. Your track record.` for the document,
Open Graph and Twitter titles (GREEN). The canonical URL remained
`https://proper-respect.com`; the Markdown alternate remained
`https://proper-respect.com/index.md`.

Passed:

- `npx vitest run src/server/public-site.test.ts src/server/public-metadata.test.ts src/server/auth-metadata.test.ts`: 17 tests.
- `npx eslint app/page.tsx`.
- `git diff --check`.
- `PROPER_RESPECT_E2E_REFERENCE=1 PUBLIC_SITE_ORIGIN=https://proper-respect.com NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY= CLERK_SECRET_KEY= NEXT_PUBLIC_CONVEX_URL= npm run build -- --webpack` (including TypeScript).
- Rendered metadata assertion against `npm start` on port 58426.

The first post-change check incorrectly expected a relative Markdown alternate;
Next.js resolves it against the metadata base. The assertion was corrected to
the existing absolute URL; no application change followed that check failure.

The original accepted checkout remained clean at
`20b91787feca9f99ef81a8be7c9a6fd06147c99e`. This branch changes only the homepage
title and this receipt. No permanent test was added for the copy-only change.

## Release boundary

This receipt does not establish a production release, Google indexing or an Ora
score increase. Production excludes other changes on main; use the selective
frontend release procedure in `docs/DEPLOYMENT.md`.

# Product asset source verification

Verified 2026-09-19, completed at 20:43 UTC (16:43 America/New_York).
Inspected checkout: `3809cb79053435c928357886ead1784a8533478f`.

Verdict: **ISSUES**. Official product identity sources and downloadable GitHub Copilot assets are verified. No complete, permission-cleared, product-specific asset set for all three products is established. Keep the existing identity guards. This document is research, not a retrieval receipt or authorization to publish assets.

Research-phase scope: read-only local source inspection, public official websites, public GitHub repository metadata, and unauthenticated HTTP GETs. During that phase, downloaded bytes were inspected in memory only and this note was the only file written. The subsequently authorized Copilot implementation is recorded below. Neither phase used Context.dev requests, credentials, usage reads, backend writes, or deployments.

## Existing contract, directly inspected

- `convex/productBrands.ts:24`: `productBrandEligibility` requires a verified catalog identity/domain. NotebookLM explicitly returns `PRODUCT_IDENTITY_REQUIRED`; root-domain resolution must match the product slug, which also blocks GitHub Copilot and Devin Desktop.
- `src/domain/discovery.ts`: `github-copilot` shares `github.com` with GitHub; `devin-desktop` shares `devin.ai` with Devin; NotebookLM has canonical `notebooklm.google.com` and marketing alias `notebooklm.google`.
- `src/domain/product-brand.ts:65` and `convex/productBrandTables.ts:17`: provider is literally `context.dev`. Official-site research cannot truthfully be serialized as an existing Context.dev snapshot. The normalization function checks exact domain, not the semantic identity of a logo.
- `src/domain/product-brand.ts:99`: logo selection prefers an icon over a logo within each surface mode. A future GitHub Copilot asset set should contain the approved full product lockup, not a mascot icon that would win this selection.
- `components/product-card.tsx:51`: retained logos take precedence over `logoUrl`, followed by the text mark when images fail. `logoUrl` offers a small existing integration surface, but does not itself retain asset provenance or permissions.
- `components/product-brand-fonts.tsx`: v2 retained font files are emitted as scoped font faces; each file requires one scalar weight. A font family name alone does not prove a usable or licensed font file. Neutral fallbacks already exist.
- `docs/adr/008-product-rebrand-handling.md`: “Current product name is primary.” “Old names are stored as aliases.” Product continuity must not be inferred solely from a redirect.

## NotebookLM / Gemini Notebook

Official identity evidence:

> “NotebookLM is now Gemini Notebook”

Source: [Google Workspace announcement, July 16, 2026](https://workspaceupdates.googleblog.com/2026/07/notebooklm-now-gemini-notebook.html).

Observed public HTTP behavior: `https://notebooklm.google/` redirects to `https://notebook.google/` with title `Gemini Notebook | AI Research Tool & Thinking Partner`. Unauthenticated `https://notebooklm.google.com/` reaches Google sign-in; its Google logo is an authentication-page asset, not product identity evidence. No sign-in was performed.

Product assets discovered in official source HTML, then individually fetched:

| Source page | Exact asset | HTTP / bytes / SHA-256 |
| --- | --- | --- |
| [Gemini Notebook Help](https://support.google.com/gemininotebook?hl=en), image title `Gemini Notebook logo` | [64dp product PNG](https://www.gstatic.com/images/branding/productlogos/gemini_notebook/v1/web-64dp/logo_gemini_notebook_color_1x_web_64dp.png) | 200, `image/png`, 1,287 bytes; `1cc44080414a37b7bb6a4d98eda660048c44c3189bf084a47ab982201409bac3` |
| [Product marketing page](https://notebook.google/), light-scheme favicon link | [light-path SVG](https://notebook.google/_/static/branding/v6/light_mode/favicon/favicon.svg) | 200, `image/svg+xml`, 2,470 bytes; `0e369abeda7894c1d9762e9ae709c07d9007574ecc439fff95c675f9a7adf563` |
| Same page, dark-scheme favicon link | [dark-path SVG](https://notebook.google/_/static/branding/v6/dark_mode/favicon/favicon.svg) | 200, `image/svg+xml`, 2,470 bytes; same SHA-256 as light path |

The favicon paths have identical bytes; their names are not evidence of distinct light/dark artwork. These are current Gemini Notebook assets. They must not be silently presented as the historical NotebookLM mark. No current official downloadable legacy NotebookLM icon kit was established in this bounded investigation.

The Google [Products and Services resource page](https://about.google/brand-resource-center/products-and-services/) directs unspecified products to its general icon guidance. That link currently redirects to [How to show Google's brand](https://partnermarketinghub.withgoogle.com/brands/google/branding-guidelines/how-to-show-googles-brand/). Its Product icons section directs users to request permission through the Partner Marketing Hub. Its Colors and fonts section states:

> “Never use Google's brand colors or brand fonts in your work.”

The marketing page contains Google Sans / Google Sans Text / Google Sans Flex font references, but their technical availability is not a third-party reuse grant. **Recommendation:** keep neutral card typography and the text fallback; retain the rejected parent-Google provider result as rejected. A separately reviewed rebrand mapping can preserve the NotebookLM slug/history while making the current name and aliases conform to ADR-008. Bind a current Gemini Notebook icon only after recording applicable permission; the public HTTP responses alone do not establish that permission.

## GitHub Copilot

Official current guidance:

> “Beginning in 2025, GitHub Copilot no longer has a standalone logo that heros the Copilot icon.”

Source: [Copilot, GitHub Brand Toolkit](https://brand.github.com/brand-identity/copilot). The official product lockup includes both GitHub and Copilot; use the complete vendor asset, not the GitHub-only mark or a reconstructed text-plus-icon arrangement.

The [Logo page](https://brand.github.com/foundations/logo) links directly to [GitHub_Logos.zip](https://brand.github.com/GitHub_Logos.zip). Verified HTTP 200; archive SHA-256 `e2a67d6cc51d990a52c46c1cf6bcab688db4830982174bca50e0be7a5c2f3194`. Read in memory; no archive extraction to disk.

Verified exact archive members:

| Member | Dimensions / bytes | SHA-256 |
| --- | --- | --- |
| `GitHub Logos/SVG/GitHub_Copilot_Lockup_Black.svg` | 734 × 95; 9,620 bytes | `204fcf55a8e36a3e233483561ec80d4c025c997d04cd37a13941b8fe2c976f1b` |
| `GitHub Logos/SVG/GitHub_Copilot_Lockup_White.svg` | 734 × 95; 9,620 bytes | `e5cebbd6ebaa4dcc11ffb1f400e1e0fa2b319395e88d084f17464d412fed2a96` |

These are archive members, not standalone public URLs. Do not invent `/GitHub_Copilot_Lockup_Black.svg` on the vendor host. A later implementation can retain the verified original bytes as app assets with the archive URL, member path, digest, date, and applicable use terms. Black is a light-surface candidate; white is a dark-surface candidate. Their 7.7:1 aspect ratio requires a legible wordmark treatment, not a forced square crop.

The Logo page's Legal section includes:

> “Use a permitted GitHub logo to link to GitHub.”

It also constrains permission, prominence, modifications, and implied affiliation. The card's intended link to `https://github.com/features/copilot` is a candidate permitted use; the kit's existence is not an unrestricted license. Record the applicable permitted-use basis before shipping.

Official font evidence:

> “We rely on a handful of custom fonts to carry forward our brand message, centered on Mona Sans and Mona Sans Mono.”

Source: [GitHub Typography](https://brand.github.com/foundations/typography), which directly links [github/mona-sans](https://github.com/github/mona-sans/). Its [OFL.txt](https://raw.githubusercontent.com/github/mona-sans/main/OFL.txt) is SIL Open Font License 1.1; verified SHA-256 `9261dcb61fb5e3c587d50d7a9fdae12bc7422d8822d7ac06b8f34550479575de`.

The following files were discovered through the official repository's public contents API and fetched successfully:

| Font | Verified file URL | Bytes / SHA-256 |
| --- | --- | --- |
| Mona Sans Regular | [MonaSans-Regular.woff2](https://raw.githubusercontent.com/github/mona-sans/main/fonts/webfonts/static/MonaSans-Regular.woff2) | 60,104; `c87e8077d26694c2c41596475d2948cf3e697852db7e75e40a953e9baae7c02b` |
| Mona Sans Medium | [MonaSans-Medium.woff2](https://raw.githubusercontent.com/github/mona-sans/main/fonts/webfonts/static/MonaSans-Medium.woff2) | 60,108; `c5a156a8a830ac392eda1abda25fff2f5564e6c2c568868a79aed8979cbce2e4` |
| Mona Sans Bold | [MonaSans-Bold.woff2](https://raw.githubusercontent.com/github/mona-sans/main/fonts/webfonts/static/MonaSans-Bold.woff2) | 61,088; `c9ab2a28f7f44972d94c7732d17b35e9fb0bad732bfefc4dc38fdf2a7053dafc` |

All returned HTTP 200. `main` URLs can change; pin exact source revision or retain checked bytes and license during implementation. Regular/Medium/Bold provide static candidates for the existing 400/500/700 scalar-weight contract. Choosing card heading/body roles is an implementation decision, not a measured vendor page role. **Recommendation:** GitHub Copilot is the first viable curated product-asset implementation, using the complete lockup and OFL-covered Mona Sans. Do not label this source Context.dev.

## Devin Desktop

Official identity evidence:

> “Devin Desktop is the new name for Windsurf.”

Source: [Devin download page](https://devin.ai/download). Additional product-specific sources: [Devin Desktop](https://devin.ai/desktop) and [Windsurf is now Devin Desktop](https://devin.ai/blog/windsurf-is-now-devin-desktop).

Verified assets:

| Source binding | Exact asset | HTTP / SHA-256 | Decision |
| --- | --- | --- | --- |
| Shared favicon on root, download, and Desktop pages | [Devin favicon](https://devin.ai/favicon.svg) | 200; `fe0753d2e3823bc1eb8a37943234fac63733b8c9e8abff0ca0402a6c7ddcd682` | Shared Devin product-family mark; does not distinguish Desktop |
| Desktop page image with `alt="Devin"` in agent-logo collection | [Devin agent logo](https://devin.ai/images/acp-logos/logo-00-devin.svg) | 200, 3,087 bytes; `15e7f18dd4bda88d3ed6db41d8d4cc5a34966ccfaba35d6d1b418a78d0759db1` | Explicitly Devin, not a verified Desktop-only lockup |

The source-linked [site CSS](https://devin.ai/_next/static/immutable/chunks/1lfksx_meu96q.css) contains `nbInternationalPro`, `stkBureauSerif`, `geistMono`, `inter`, and `ibmPlexMono` font faces. The same stylesheet is used on root and download pages. Its mere presence does not establish Desktop typography roles or a redistribution license for the commercial fonts. No public Desktop-specific logo kit or applicable external logo/font reuse grant was established.

**Recommendation:** preserve `devin-desktop` as a separate product and retain its text mark and neutral typography. Do not lift the Cognition corporate mark, the shared Devin favicon, an unrelated integration logo, or the old Windsurf logo into a Desktop-specific provider result. A later verified vendor kit or explicit vendor-approved shared-mark association can supply that mapping; this research does not authorize one.

## Bounded implementation options and acceptance checks

1. **Smallest viable slice:** add an explicit, source-backed curated asset record for `github-copilot`; use the existing `logoUrl` path only if its source record and light/dark presentation remain reviewable. A full-wordmark card layout adjustment may be necessary. Do not set brand preparation `READY` merely because a generic fallback URL is present.
2. **If persisted brand snapshots are required:** add a separately discriminated official/curated provider with source page, asset/archive-member identity, retrieval time, byte digest, product slug, and use basis. Preserve existing Context.dev records and endpoint receipts as-is. Do not weaken the current eligibility guard or forge Context.dev receipts. This is a bounded provider addition, not a new ingestion architecture.
3. Keep NotebookLM and Devin Desktop blocked for product-asset preparation until the missing identity/use conditions above are satisfied. Rebrand presentation must preserve evidence, owner relationship, and historical matching.

Before claiming completion of a later implementation, verify the rendered full lockup at desktop/mobile sizes, both surface modes, broken-asset fallback, unchanged provider-call behavior during render, and no identity/owner/usage mutations. Verify font network success and computed family separately from metadata presence. This research did not exercise those application gates.

## Authorized Copilot implementation — 2026-09-19, 20:56 UTC

Local implementation verdict: **PASS**. This does not change the research verdict for the three-product set or establish hosted-runtime readiness.

- Retained the exact reviewed black/white lockups, three font files, and OFL under `public/product-assets/github-copilot/2026-09-19/`. `source-manifest.json` preserves upstream URLs, archive members, byte digests, use basis, and verification time. Fonts and license are pinned to upstream revision `0f7dc66ddd766605eb0e75c3f47bf9d1dd38ceca`.
- `src/domain/verified-product-assets.ts` validates the versioned official-vendor manifest and indexes exact product slug plus canonical domain. The record cannot parse as a Context.dev snapshot. No brand eligibility guards or backend tables changed.
- `components/product-card.tsx` selects the complete surface-specific lockup, keeps accessible product naming, serves locally scoped Mona Sans faces, and exposes the official source record separately in details. A failed official lockup falls back to product text; a failed font falls back to Arial/Helvetica/sans-serif. `app/globals.css` preserves wordmark proportions and scopes the font to the reviewed card.
- `src/domain/verified-product-assets.test.ts` covers identity isolation, exact retained bytes, provenance, surface selection, local font declarations, and card rendering without invented activity.
- `tests/e2e/verified-product-assets.spec.ts`, included by `tests/e2e/components.config.ts`, mounts the actual component with **synthetic activity and real retained official asset bytes**. Public files are served through local route fulfillment; all external requests are blocked and asserted absent. It checks desktop/mobile, light/dark lockups, loaded fonts, scoped typography, provenance, and separate missing-logo/missing-font cases.

Executed successfully:

```text
npx vitest run src/domain/verified-product-assets.test.ts src/client/product-card.test.ts src/client/product-brand-fonts.test.ts src/domain/product-brand.test.ts
4 files passed; 75 tests passed.

PLAYWRIGHT_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npx playwright test --config tests/e2e/components.config.ts
7 tests passed, including the existing card layout and private-record switching checks.

npm run typecheck
Passed.

npx eslint src/domain/verified-product-assets.ts src/domain/verified-product-assets.test.ts components/product-card.tsx tests/e2e/verified-product-assets.spec.ts tests/e2e/components.config.ts
Passed.

git diff --check
Passed.
```

Screenshots generated under ignored `test-results/components/` were visually inspected: front and details at 390px/1280px, missing-logo mobile, and missing-font mobile. The complete wordmarks remain legible and uncropped; details and fallback text remain readable without horizontal overflow. No live owner activity, provider jobs, backend persistence, or hosted deployment was exercised. NotebookLM and Devin Desktop retain their existing blocked asset preparation state.

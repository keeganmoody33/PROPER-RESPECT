# NotebookLM and Devin Desktop card icons — 2026-09-22

Base: `19ed17012397c4e2bcca1a8ae9ac59da0fa5314e`. Branch: `codex/exact-product-logos-20260922`.

## Defect and change

Synthetic cards for the exact `notebooklm@notebooklm.google.com` and `devin-desktop@devin.ai` identities displayed initials because no corresponding official app-icon record existed. The existing `product-icons` registry was the correct smaller structure: identity, source, retained file, dimensions and hash. Copilot's separate verified wordmark/font schema is unchanged.

Two dated registry entries now select retained original artwork. No ProductCard rendering, typography, brand color, profile, relationship, backend or publication behavior changed. Exact slug/domain matching still rejects parent domains and sibling products. Failed image requests still produce initials. No remote artwork request is needed at card-render time.

## Official sources and asset chain

### NotebookLM

- Official former product URL: <https://notebooklm.google/>, observed redirecting to <https://notebook.google/>.
- Google's product-continuity announcement: <https://blog.google/innovation-and-ai/products/gemini-notebook/notebooklm-gemini-notebook/>. Its July 16, 2026 announcement identifies Gemini Notebook as the same standalone product formerly called NotebookLM. This establishes product continuity; no generic Google or Gemini-app logo is used and existing card identity/name is preserved.
- The official landing page directly advertises the retained 180×180 touch icon: <https://notebook.google/_/static/branding/v6/light_mode/favicon/apple-touch-icon.png>.
- Original PNG bytes, dimensions and SHA-256 are recorded in `public/product-assets/2026-09-22-product-icons.json`. The 180px asset supports the current 48px card icon at 3× density. No recoloring, resizing or re-encoding.

### Devin Desktop

- Exact product page and download: <https://devin.ai/desktop>, <https://devin.ai/download>.
- The Mac download confirmation links through the official frontend's resolver: <https://windsurf.com/api/windsurf/download-redirect?build=darwin-arm64&isNext=false>.
- Observed resolver destination: <https://windsurf-stable.codeiumdata.com/darwin-arm64/stable/b98cc43128712ba73c60cca73876f58a710aaa27/Devin-darwin-arm64-3.10.31.zip>.
- Read only the ZIP central directory and two members with bounded HTTP byte ranges. No installation or application execution. The entire 359,267,011-byte archive was not downloaded or hashed; no whole-archive integrity claim is made.
- `Devin.app/Contents/Info.plist` identifies bundle `com.exafunction.windsurf`, app name `Devin`, version `3.10.31`, and `CFBundleIconFile = Devin.icns`. The official Desktop page describes the Windsurf-to-Devin Desktop transition, supporting the retained bundle identifier.
- `Devin.app/Contents/Resources/Devin.icns` was extracted with ZIP CRC verification. Its original 1024×1024 `ic10` PNG payload is retained unchanged as the rendered asset; the original ICNS is also retained. A regression verifies payload-byte equality and source/file hashes. The registry records both member paths and hashes, the resolver and exact versioned archive URL.
- The generic website icon was rejected as sufficient evidence: official article JSON-LD identifies it as the publisher Cognition's logo. The chosen asset instead comes from the desktop bundle's explicitly selected app icon.

Presentation provenance never establishes product ownership, usage, activity, endorsement or a publication decision.

## Verification

PStack poteto-mode bug-fix/how workflow and Model the Domain: reused the existing registry, reproduced first, retained source provenance separately from usage, then verified the same real component. No nested delegation per root scope; independent review remains parent-owned. Installed Next Image guidance and repository development instructions were read before edits.

RED (`/tmp/u5-icons-red-unit.log`):

```text
Test Files  1 failed (1)
Tests  1 failed | 1 passed (2)
```

RED (`/tmp/u5-icons-red-browser.log`), both 1280px and 390px cases:

```text
Locator: locator('.product-card').first().locator('.product-logo img')
Expected: visible
Error: element(s) not found
2 failed
```

GREEN:

- `npx vitest run src/domain/product-icons.test.ts src/domain/verified-product-assets.test.ts`: **10 passed** (`/tmp/u5-icons-green-unit.log`). Includes exact identity, parent/sibling mismatch, retained-byte hashes and original embedded PNG proof.
- `npx playwright test --config tests/e2e/components.config.ts verified-product-assets.spec.ts`: **7 passed** (`/tmp/u5-icons-green-browser.log`). New cases cover both products on light/dark cards at desktop/mobile, 3× image density, no overflow, no external requests and failed-image initials. Existing Copilot wordmark/font and fallback regressions pass.
- `npm run typecheck`, focused ESLint and `git diff --check`: passed.

The browser uses real Chromium and ProductCard at the local synthetic origin `http://127.0.0.1:8852/`. Playwright fulfills the fixture document and retained asset bytes locally, matching the existing component-test pattern; this is not a running Next server or hosted/account acceptance. Screenshots were visually inspected:

- `test-results/components/verified-product-assets-ex-fc11c--on-both-surfaces-at-1280px/2026-09-22-exact-icons-1280-3x.png`
- `test-results/components/verified-product-assets-ex-af835-s-on-both-surfaces-at-390px/2026-09-22-exact-icons-390-3x.png`

No full-suite repetition, live owner/provider reads, account mutation, backend synchronization, deployment, publication or auth changes occurred. Existing product names, canonical domains and profile content remain unchanged. Root owns PR creation, review and release.

Root's final identity check: the checked-in seed and canonical catalog both use `notebooklm@notebooklm.google.com` and `devin-desktop@devin.ai`. Added a regression passing existing NotebookLM/Devin Desktop names and the explicit `/download` alias through `resolveCatalogProduct` before selecting an icon. The focused icon suite then passed **4 tests**; no identity aliases or resolution rules were changed.

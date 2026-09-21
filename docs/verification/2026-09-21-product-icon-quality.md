# Product icon quality — September 21, 2026

Branch: `codex/brand-assets-metering-20260921`. Base: `b6974bb967cd5be7b4693c009b406637300a6a9e`.

Owner findings before implementation:

| Finding | Disposition | Observed cause |
| --- | --- | --- |
| Clay and Wispr Flow look blurry | Fix now | Both bundled favicons are 32×32 PNGs; shared CSS displays them at 80% of a 48px container, exceeding native resolution even at 1× density. |
| Wispr Flow is missing on the profile | Fix now | The reference profile has no logo URL and no retained brand snapshot for that exact product; it falls back to initials. |
| Wispr Flow has an unintended surrounding edge | Fix now | Shared icon CSS adds a colored/background container and scales the image to 80%, exposing a frame. Use full-size official app artwork with a transparent outer container. |

Use exact `(slug, domain)` matching to select reviewed local app icons consistently, without editing saved evidence or profile fixtures to pretend account data changed. Existing full Copilot lockups and typography retain their path. Unknown products retain existing fallback behavior. Failed reviewed icons fall back to text instead of silently reverting to the low-resolution favicon.

Official sources checked: [Clay press page](https://www.clay.com/press), [Wispr media kit](https://wisprflow.ai/media-kit), and the App Store listing linked by Wispr. Clay's official HTML declares a 512×512 icon separately from the similarly named 32px file; actual bytes verify the dimensions. Wispr's linked App Store record identifies `com.wispr.flowapp`, seller `Wispr AI INC`, and 512px original artwork. Copy original bytes without redrawing, sharpening or recoloring. These identify the products being discussed and imply no sponsorship. Asset URLs, dimensions and hashes accompany the retained files.

Checklist: https://plan.ref.tools/aGrDHnZ8uoiYcMlA. Usage measurement research is a separate documentation deliverable; no telemetry activation, account reads, backend sync, merge or deployment in this pass.

## Verification

Initial RED: 2 rendering regressions failed (62 passed); 3 browser density cases failed because the asset had only 32 native pixels. Asset replacement passed all 65 focused unit checks. The next browser run exposed two additional causes: the slideshow's CSS separately forced a white logo background, and an image that failed before React hydration retained a broken image because its native error event had already fired. Restrict the white backing to GitHub's dark vector symbol and inspect completed failed images when their ref attaches, while retaining normal onError handling. These failures refine the initial shared-style-only diagnosis; they are covered by actual page-load regressions.

Final local verification:

- Focused rendering/source checks: 65 passed. Icon source bytes match retained SHA-256 manifests; wrong-domain and lookalike slug identities do not match.
- Browser regression: all four icon checks passed at desktop 1×/2× and mobile 3×. Both actual assets decode to 512×512, exceed rendered pixel requirements, and fill a transparent 48px container without distortion or border. Homepage and profile select identical Wispr artwork.
- The final fallback test holds Next.js scripts until the server-rendered image has definitively failed, then releases hydration and verifies initials replace the broken image. No timing-based sleep is used.
- `npm test`: 700 passed, 2 optional skipped; all 7 Node script tests passed.
- `npm run lint`, `npm run typecheck`, `git diff --check`: passed.
- Synthetic production build: passed. No production credentials or backend synchronization.
- `npx playwright test`: all 68 passed, including existing Copilot assets, slideshow, profile routes and publication controls.
- Independent focused review: no actionable code findings. Its pre-hydration timing coverage note was addressed in the deterministic test above. Simplification scan retained the small shared selector and existing brand/wordmark paths; no further abstraction or unrelated cleanup.

Screenshots: [mobile Wispr profile](2026-09-21-product-icons/2026-09-21-profile-wispr-390-3x.png), [mobile Wispr example](2026-09-21-product-icons/2026-09-21-Wispr-Flow-390-3x.png), [desktop Clay](2026-09-21-product-icons/2026-09-21-Clay-1440-2x.png). The profile and official source artworks were visually inspected. This proves the local presentation correction; remaining owner-connected brands and hosted release acceptance stay on the to-do list.

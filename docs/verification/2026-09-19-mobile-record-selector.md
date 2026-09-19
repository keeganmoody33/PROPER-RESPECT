# Private record selector mobile correction

Verified 2026-09-19, America/New_York. Local source only.

## Defect and change

Hosted inspection found a GitHub record dropdown extending beyond the private
collection at a measured 319px viewport. Long option text determined its intrinsic
width. The local browser regression reproduced the overflow at 320, 390 and
1280px using the actual component and bundled CSS modules.

RED commit `99fd95110a1a1559073c44160e2a7644002c3147` records the failing test.
GREEN commit `d5df93bd44ac98b1f2306d386fb744685bb5a2e8` adds one scoped CSS rule,
`.source select { max-width: 100%; }`. Native options and selection remain intact.
No records, claims, account links or publication controls changed.

## Verification

```sh
PLAYWRIGHT_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npx playwright test --config tests/e2e/components.config.ts --reporter=list,json
npx eslint tests/e2e/product-card.spec.ts
npx tsc --noEmit --incremental false
```

The component suite passed all 11 tests with zero skipped or flaky tests. ESLint
and TypeScript passed. Before the fix the dropdown right edge was 734px at both
mobile widths. Afterward it fits its group exactly.

| Viewport | Dropdown left | Dropdown width | Horizontal document overflow |
| --- | --- | --- | --- |
| 320px | 32px | 256px | None |
| 390px | 32px | 326px | None |
| 1280px | 64px | 370.125px | None |

Tests switch active/testing/archived records and filters, preserve the separate
Copilot product, and assert zero saves. Root reviewed the diff and 320px screenshot.
Synthetic browser artifacts are under ignored `test-results/components/`; the
machine-readable run is `test-results/mobile-selector-results.json`.

## Release boundary

Production remains `8b6aa9a`, deployment `dpl_4oRkjCrgWWbTJYkDJCYyxmXD4ZN2`.
This local fix has not been deployed or verified on the hosted application.
No backend synchronization, provider read, private transfer or publication occurred.
The complete profile still needs owner/target decisions for retained evidence,
fresh sign-in proof and an explicitly approved publication preview.

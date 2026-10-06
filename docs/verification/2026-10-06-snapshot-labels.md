# Snapshot-label reconciliation — 2026-10-06

Source proposal: [PR #118](https://github.com/keeganmoody33/PROPER-RESPECT/pull/118), original head `5aaa72c61806383b9dc59772c764e00d7c8419f7`.
Current base: `258660ce212ed50623ff2b93765f7cf8d327dff6`.
Reconciled source commit: `90b1be0a238b032afee4f9f3a5d47b54cab57548`.
Ref: https://plan.ref.tools/oLGxQYBMTcFHrrvg.

## Review dispositions before editing

The original Copilot review at the original head recommends approval and has no inline findings. That older result does not clear a new reconciled head. The September receipt and images remain historical evidence. This receipt records fresh checks on current main and unchanged production source from the original correction.

Fresh independent review found a fixed September date in the screenshot output filename: fix now before editing. The output now uses the current UTC run date; historical assets remain unchanged. The two synthetic browser cases were rerun after this correction.

## Behavior and verification

A stored successful capture displays its snapshot date and measurement period, without the unsupported “Updated” label. Non-FRESH warnings, provenance and owner relationship status remain independent. No provider, persisted schema, subscription, auth or publication behavior changes.

- RED: restored the exact current-main ProductCard implementation temporarily while retaining the new tests. Twelve intended failures contain “Updated”; 77 tests pass. Restored the reconciled implementation immediately afterward. Raw output: `/tmp/proper-respect-pickup-20261006/snapshot-red.txt`.
- GREEN: 107 cases pass across card and visible-profile projection tests. Raw output: `/tmp/proper-respect-pickup-20261006/snapshot-green.txt`.
- `npm run typecheck` and `npm run lint`: pass at the reconciled source. Outputs: `/tmp/proper-respect-pickup-20261006/snapshot-{typecheck,lint}.txt`.
- Chromium real-component synthetic disclosure checks: two pass, 1280px and 390px; date, absent positive update label, keyboard focus and overflow pass. Output: `/tmp/proper-respect-pickup-20261006/snapshot-e2e-final.txt`.
- [Desktop image](./2026-10-06-snapshot-label-assets/desktop.png) and [mobile image](./2026-10-06-snapshot-label-assets/mobile.png) captured and inspected on October 6. The date shown inside is a fixture capture date, not an execution date.

## Source identity

- `components/product-card.tsx`: `2cb07ea6e59a1167b0ae90c987e2ab9ef4218f0f5dceb9b8363d790a250391a8`
- `src/client/product-card.test.ts`: `79bb91e098d484d9e19973c28596f1158489a4eb1902f532dd8918572b5e31ca`
- `tests/e2e/product-card.spec.ts`: `ef0f97fc4bca5419a7f226476200f0ee7539bfb0a2a9f43c657834eccf6b456d`

Independent fresh review and strict hosted checks must bind the final commit before merge. This is synthetic source verification, not production release or a live provider refresh. No provider/account read, deployment or publication was performed.

# Grouped private-card usage evidence — 2026-09-22

Base: `669027099a38a15bed3f9502b72fe532b07b43a5`.
Branch: `codex/usage-card-evidence-20260922`.

## Finding and model

A private collection groups records by owner and product, then supplies only the explicitly inspected record to `InventoryCard`. Each record has its own `prop.activity`, optional `activityEvidenceId`, relationship and publication state. `ProductCard` already renders that selected activity on its front and in the flipped details. A grouped product whose default record has no activity therefore looks like it has no usage, even if another loaded record has a saved snapshot. The selector previously described relationship and narrative only.

Reproduced with a synthetic four-record GitHub group: record 1 has narrative only, record 2 has a retained seven-contribution snapshot, record 3 references an unavailable snapshot, and record 4 has a manual note. No production records or provider reads were used.

## Decision

Compared annotating the existing record selector with introducing a second usage picker. Chose the existing selector because activity belongs to a specific record and a second independent picker could imply that usage may be mixed into a different record's narrative. Kept default selection, ordering and record IDs unchanged.

The selector now distinguishes a saved usage snapshot, no selected snapshot and an unavailable selected snapshot. A nearby message identifies other loaded records with saved usage and directs the owner to inspect one explicitly. Selecting a record only changes this local inspection state; it never merges records, changes source association, saves a relationship or publishes a card.

The UI calls missing measurements unknown. It reports availability only from loaded `prop.activity` objects. This is not a claim that all retained evidence was searched: unused retained originals still require review through the existing relationship/context flow, and unloaded pages remain outside this count.

## Implementation

- `components/private-inventory.tsx`: option labels and selected-record availability guidance; no backend calls added.
- `components/private-inventory.module.css`: readable selector sizing and a compact availability note at mobile and desktop widths.
- `app/evidence-fixture/inventory/view.tsx`: opt-in grouped GitHub fixture. Synthetic saves now target only the requested prop ID, preserving other fixture records.
- `tests/e2e/inventory.spec.ts`: explicit record selection, missing/unavailable state, source/freshness on flipped card, reset on record change, Escape focus, no save operations or publication, and viewport overflow checks.

ProductCard rendering, branding, public profile projection and publication controls are unchanged.

## Verification

- RED: both new tests failed against the unchanged component because the selected record's missing-usage message was absent. `/tmp/usage-card-red.log`.
- GREEN: all 8 inventory browser tests passed at 1280px and 390px, including existing private save, retained import/removal, retry identity and publication approval checks. `/tmp/usage-card-final.log`.
- Command: `npx playwright test tests/e2e/inventory.spec.ts --config playwright.usage.local.ts --workers=1`. The temporary local config uses port 8881 and webpack because node_modules is linked; it retains the repository's credential-free reference fixture environment and is not committed.
- Focused lint passed: `npx eslint components/private-inventory.tsx app/evidence-fixture/inventory/view.tsx tests/e2e/inventory.spec.ts`.
- `npm run typecheck` passed. `/tmp/usage-card-final-typecheck.log`.
- Actual Chromium desktop/mobile walkthrough captured both missing and explicitly selected usage states. Axe found zero violations at either viewport; no horizontal overflow. `/tmp/usage-card-visual.log`.
- Screenshots: `/tmp/usage-card-1280-missing.png`, `/tmp/usage-card-1280-evidence.png`, `/tmp/usage-card-390-missing.png`, `/tmp/usage-card-390-evidence.png`. Animation was disabled for captures so the card is shown after its normal flip completes. All card content and counts in these images are synthetic.
- `git diff --check` passed.

## Limits and release gate

No deployment, backend migration, real account read, provider refresh, data correction, publication or recurrence occurred. This corrects discoverability of an already saved activity snapshot; it does not invent usage or attach evidence across records. Hosted owner verification still needs to confirm the saved snapshot association in the actual collection after release. The inventory browser file is now included in the existing gated `verify` browser command. Package `test:e2e` delegates directly to Playwright; neither a separate browser-list script nor the component-test configuration includes this inventory test, so this adds one gate without duplicate execution. YAML parsing and the single-inclusion check passed. Independent review and exact-head GitHub CI remain required before merge.

# First private card journey — 2026-09-22

Base: `669027099a38a15bed3f9502b72fe532b07b43a5`.
Branch: `codex/fresh-user-flow-20260922`.

## Problem and change

An empty signed-in collection presented inventory filters and an empty-view message before manual entry. Pending handles also opened the public-identity form automatically, although neither a public handle nor social links is required for private saving. Successful manual entry named Discoveries without a direct next step.

The empty collection now starts with one action: **Add your first tool**. It leads to the existing manual form. A successful add offers **Review your card**, returning to the existing private relationship review. Public identity stays collapsed until the user opens it; sharing explains that a handle and display name are needed for a public preview and social links remain optional. The placeholder pending handle is no longer presented as a public URL.

This changes guidance and navigation only. Existing inventory, product branding, source intake, relationship decisions, publication selection and preview approval remain their existing components and domain rules. No new onboarding wizard, backend state, required field or provider connection was added.

## PStack grounding and design

- Ground: read AGENTS, DEVELOPMENT, installed Next.js server/client guidance and PStack how, model-the-domain, architect and runtime instructions. Traced `ensureAccount` → `getState` → manual add → `inventory.save` → `previewPublication` → separately approved publication.
- Domain: a manual product is initially a private discovery; a saved owner relationship is a private card; choosing a public identity does not publish it; a sharing preview is not a published profile. The add-form notice uses a discriminated saved/error state so only successful adds offer review navigation.
- Sketch: compared a separate first-run wizard with an empty-state prompt reusing current components. Selected the latter to avoid duplicating account, collection and publication state. Existing accounts bypass the empty prompt.
- Agree: proceeded within the assigned fresh-user slice. Nested agents were unavailable; no independent design-panel claim.
- Implement: changes confined to onboarding-client, its already-gated account-setup browser suite and synthetic boundary fixture. No private-inventory or profile-link fields were edited.
- Scrap: no architectural replacement needed; existing separation supported the journey.

## Verification

1. RED: added integrated browser cases at 1280px and 390px. Both failed on the missing **Start with one tool** heading against base UI. `/tmp/fresh-user-u2-red.log`.
2. GREEN: four account-setup browser cases pass: existing recoverable setup failure at both widths, plus first manual card through exact sharing preview at both widths. `/tmp/fresh-user-u2-final-browser.log`.
3. Journey uses the actual OnboardingClient, PrivateInventory, relationship editor, product card, profile form and SharingPreview. Only Clerk/Convex boundaries are mocked. It adds an owner note, confirms an Active relationship, changes the explanation, reloads, proves saved fixture bytes unchanged, supplies only handle/display name with no social links, selects precisely one card and verifies its visitor-facing headline and flipped-card explanation. Saved activity remains absent, not zero. No publication mutation is invoked and Publish remains disabled pending explicit approval.
4. Fixture persistence uses test-origin localStorage to model reloads. All requests except the synthetic document at port 8882 are blocked. No server, account or provider is contacted. This is not proof of Clerk signup, hosted persistence, authorization or two-user isolation.
5. Scoped Vitest: `src/client/onboarding-auth.test.ts`, `src/client/private-inventory.test.ts`, `src/domain/review.test.ts` — 36 passed. `/tmp/fresh-user-u2-units.log`.
6. TypeScript, focused ESLint and `git diff --check` pass. The existing components CI job already includes account-setup.spec.ts, so no workflow edit was needed.
7. Viewed mobile empty-state and exact-preview screenshots; no horizontal overflow. Artifacts are generated beneath `test-results/components/account-setup-first-privat-*/fresh-user-{empty,preview}-{1280,390}.png`. Preview screenshots disable animation capture to avoid recording a half-completed card flip.

During fixture development, an exact label query for a select and mock normalization of a null preferred link were corrected. These were fixture errors, not product defects; logs `/tmp/fresh-user-u2-green.log` and `/tmp/fresh-user-u2-journey.log` retain the failures.

## Remaining acceptance

Real fresh login/signup, email-code delivery, hosted reload, second-user isolation, provider reconnect/revocation and publication are separate acceptance gates. This slice does not claim them complete. Existing owner data was neither inspected nor changed. No deployment, backend synchronization, auth/DNS change, recurrence, provider read or publication occurred.

## Independent review follow-up

Finding: the existing manual-entry inventory regression still expected the old success text after the guidance change. Disposition: fix now. Reproduced its failure at the removed text in `/tmp/fresh-user-u2-inventory-red.log`. Updated only that assertion to the new private-save wording and verified the review link targets the collection. Existing replay-identity and no-invented-decisions assertions remain unchanged; the other worker's grouped-usage additions are outside this branch and were not edited.

Combined verification: all 10 current account-setup and inventory browser tests passed through `/tmp/u2-combined.config.cjs`, with webpack on isolated port 8882 and the same credential-free reference environment. `/tmp/fresh-user-u2-combined.log`. Next-generated type import paths were restored to the exact pre-test file after the server stopped. No permanent configuration change was made. The subsequent combined main branch additionally contains U1's two grouped-usage cases; root must verify that final merged integration separately.

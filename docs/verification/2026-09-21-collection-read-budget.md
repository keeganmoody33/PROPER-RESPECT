# Collection read budget — September 21, 2026 UTC

Current base: `3a1413f3deb34c417cb9bdbdbfa4d34096e47e77` (owner-merged #30/#31). Original base: `bb108413d937abb9082f88fd3ded3e168f93e574`.
Rebased implementation: `3c2dd07a40b47580860aaf51cad1dfeb0b08f5fc`. Full fresh verification ran on receipt head `388e03d24ceddbcc542b3652a8e153e202a314a8`. Earlier implementation `d84180eb7722c2e9a9b76f53dae8928f6ec232e1` is superseded.
Rebased compatibility correction: `8256fa24f7c1aafc8b508016318731a51a4b6ee8`.
Issue #24 findings: actual account lookup resources and completeness beyond 200 proofs.

## Change and proof

The current frontend requests neither legacy raw-evidence/draft lists nor per-card raw-account joins from getState; inventory.list also omits those joins. Default query arguments retain compatibility for older frontends and callers. A real-handler database probe with a 25-card inventory confirms zero raw-original reads on both new list paths.

GitHub account lookup is a separate owner-bound paginated query with at most three proof records and three originals per call. An oversized requested page is clamped. Each original is at most the platform document-size limit; the original payload portion is therefore at most 3 MiB per page, rather than the earlier 200-document/20.48 MB synthetic path. Source records and supporting owner/product/connector reads are additional; a normal page makes at most 11 logical get/query calls. The tests measure actual raw-document reads (three 100 KiB originals in the fixture), not a deployed Convex byte-meter. [Convex transaction/document limits](https://docs.convex.dev/production/state/limits).

The page returns ranking/account metadata, never raw payload or observation text. It rechecks raw owner, source owner/type, issuer and deletedAt. A valid current connector wins without scanning originals; an invalid connector falls back. Revocation/deletion are reactive database dependencies, with no cached metadata or backfill to go stale. Existing source-date/native-time/deterministic-account ordering is shared with legacy lookup. A 205-attachment regression reaches a newest capture excluded by the old newest-attached-200 window.

Both private inventory cards and sharing offers use the bounded query. They automatically inspect up to 30 retained attachment records in three-record requests, then show explicit continuation. Until exhaustion, no historical candidate replaces the fallback link or becomes a sharing offer. Current valid connectors are complete immediately. Explicit owner-selected destinations remain selected throughout. A query error retains usable saved links and offers sanitized retry; no diagnostic is rendered. Sharing still requires selecting the offered destination and approving the exact preview; the lookup performs no writes or provider reads.

## Verification

- RED: new legacy-list option rejected by the original query contract; one publication test failed before implementation.
- RED: both new paginated-account tests failed while the endpoint was absent. Prior retained read probes independently established amplification; see issue #24.
- `npm test`: 652 Vitest passes, two optional skips, seven Node checks pass.
- `npm run lint`, `npm run typecheck`, `git diff --check`: pass.
- Build passed with the existing CI synthetic environment: `PUBLIC_SITE_ORIGIN=https://public.example NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk NEXT_TELEMETRY_DISABLED=1 npm run build`.
- `npm run test:e2e`: all 46 browser checks pass, including desktop/mobile partial-to-complete lookup and failure/retry. The actual sharing renderer is separately checked for incomplete and complete coverage; stored primary-link defaults remain unchanged.
- Existing chronology and reversed attachment-order regressions remain green after comparator extraction.
- A first measurement harness incorrectly called two paginated handlers in one synthetic execution; split into the separate executions used by the application. A sharing test fixture was updated to supply the new account-page response instead of an unused legacy list. Neither correction weakened its publication assertions.

Screenshots are isolated component fixtures, not authenticated production: [mobile partial](assets/2026-09-21-account-partial-390.png), [mobile complete](assets/2026-09-21-account-complete-390.png), [desktop partial](assets/2026-09-21-account-partial-1280.png), [desktop complete](assets/2026-09-21-account-complete-1280.png). Mobile partial fixture visually inspected. Fresh post-rebase raw temporary logs: `/tmp/proper-respect-budget-rebased-{tests,lint,types,browser,build}.log`, `/tmp/proper-respect-account-pages-red.log`.

## Release and limits

No schema or stored-data migration. After owner merge and separate exact-target deployment authorization: deploy the compatible backend with optional query arguments and accountEvidencePage first, then the new frontend. An old backend rejects the new arguments; do not reverse the release order. Roll back the frontend before removing the new backend function/arguments. Default older calls remain supported.

Legacy callers that omit the new options retain their old unbounded metadata and 200-proof behavior. This PR removes those paths from the current collection UI; it does not make every legacy/admin query safe at arbitrary data volume. getState still assembles the sharing-card set and is not claimed globally paginated. Very large numbers of cards/links need separate whole-sharing pagination work. Raw detail readers are outside this account-lookup correction. Pages beyond the first 30 require explicit retained-record continuation; partial coverage is visible and never called newest-complete.

No live limit-exhaustion reproduction, fresh Clerk login, hosted two-user acceptance, backend synchronization, deployment, provider read or publication occurred. Existing profile/data remain untouched. PR #30/#31 are included through owner-merged main; PR #28/#32 remain excluded and preserved. Owner review/merge remains required.

Rebase resolved one component-test-list conflict by retaining both the merged account-setup tests and the new account-evidence tests. Fresh unit/script/lint/typecheck/build and all 46 browser checks passed after rebase. No source fix was dropped.

## Devin review correction — September 21

Finding [r4058967862](https://github.com/keeganmoody33/PROPER-RESPECT/pull/33#discussion_r4058967862) confirmed at 4757755815f2617f5e822590308ff5fb28018bd6. Corrected in `a439d6f6dfda157aa2ab68f054c7bf505f18f596`: the unmatched-mailbox picker now passes includeAccountEvidence:false. All production inventory.list callers were audited; only PrivateInventory and UnmatchedRecords call it, and both now omit account joins. The earlier legacy-query limitation does not excuse a missed current UI caller.

RED: the actual MailboxManagement component could not render the unmatched-record picker when a synthetic query adapter rejected the expensive options. GREEN: it renders a GitHub choice and submits exactly mailboxDiscovery.reviewUnknown with the selected retained record/relationship; no provider HTTP call is made. This adapter models the budget failure, while the existing real-handler 25-card probe verifies zero original joins for the selected option.

Fresh correction checks passed: 652 Vitest tests, two optional skips, seven Node checks, lint/typecheck, configured production build and all 47 browser checks. Commands match the main receipt; temporary logs are /tmp/proper-respect-picker-{red,tests,browser,build}.log. No source/configuration outside the picker correction was changed. No deployment, provider read or publication.

# Request-tally reconciliation — 2026-10-06 UTC

Source: PR #148, latest Claude commit `b0ac3586d7d108c33d508352e5eaadeeb7bb4716`, preserved in the reconciliation branch. Starting main: `06e4215003e6df9f92aa79c4ca7b314761814bf3`.
Ref: https://plan.ref.tools/oLGxQYBMTcFHrrvg.

## Findings and dispositions before functional changes

Independent reviewer identified the following concrete findings before the regression edits. This durable receipt was written after the regression edits and before functional fixes.

- Proxy unit tests inherit Redis credentials and call the real store: **fix now**. Fake inherited credentials and intercepted fetch reproduce a production-prefix HINCRBY; real provider requests remain zero. Isolate the proxy unit fixture and disable store reads/writes in the existing synthetic public fixture.
- Missing user-agent identification is included in automated totals and labeled Not humans: **fix now**. Preserve the undeclared raw category, return a separate unidentified aggregate, and expose it separately from presumed human and automated requests.
- Missing/invalid since timestamp is displayed as since launch: **fix now**. Omit the date when no valid start date is supplied.
- Historical Copilot endpoint exclusion, command-error, interactive browser coverage and repository-style comments: **superseded by b0ac source fixes**, subject to fresh exact-head review. They do not establish approval of a new head.

The installed Next 16.3.5 proxy guide was read before these changes; it documents proxy routing and NextFetchEvent.waitUntil. Source review and intercepted tests do not establish a configured or accepted production store.

## RED

Regression tests run before functional implementation. Raw logs are retained in `/tmp/proper-respect-pickup-20261006/tally-red-unit.txt` and `tally-red-browser.txt`. The unit run produced three intended failures and 31 passes. The browser run produced four intended failures: two unidentified controls and two missing/invalid dates.

## Execution boundary

No production credentials or provider state were inspected. Synthetic tests use fake credentials and intercepted fetch. No deployment, hosted tally configuration, production request collection or public-profile publication is performed by this receipt.

## GREEN — 2026-10-06 UTC

- All 34 tally unit tests pass; synthetic fixture reads/writes and the credential-canary proxy test make no provider request.
- Nine site-frame browser cases pass, including separate unidentified controls and omitted unknown dates.
- Four additional keyboard/theme cases pass at 1440px and 320px using the actual Appearance selector. All four dated screenshots were individually inspected. There is no horizontal overflow and the focused control has a 3px outline.
- Full tests (1,758 Vitest passes with two existing skips), 122 script tests, lint, typecheck and the production build with CI synthetic configuration pass. The full Vitest count is bound by `tally-full-test.txt`; two existing retained-real-source cases remain skipped.
- Raw outputs: `/tmp/proper-respect-pickup-20261006/tally-green-unit.txt`, `tally-green-browser.txt`, `tally-theme-browser.txt`, and `tally-full-{test,lint,typecheck,build}.txt`.

The AI-assistant and link-preview definitions now state only the User-Agent claim, without asserting that a person requested a page or shared a link. Source review, final commit binding and strict current-head/current-base hosted checks still precede merge.

## Further review dispositions — before the following edits

- Privacy/service coverage: **fix before delivery**. Disclose aggregate Upstash fields, private/sign-in/onboarding coverage, User-Agent inference and request-versus-person/usage limits in the shared trust source and development configuration guidance. The author's claim that KV is connected is unverified; no dashboard receipt is implied. This source change will follow the analytics integration to preserve that privacy disclosure too.
- Start date year: **fix now**. Include the year in valid dates so retained running totals do not imply only the present year.
- Six changed narration comments named in the independent report: **remove now** before final changed-comment review; preserve the accurate exported/storage contracts.
- Original b0 auth and payload review: **not a bug with evidence**. No auth bypass, account identifier or private path is transmitted by the tally commands; only aggregate categories and the start timestamp are stored. Classification remains an inference from User-Agent claims.

## Follow-up GREEN — 2026-10-06 UTC

Valid-date year regressions first produced two intended browser failures (`tally-red-year.txt`). After the date/copy/comment corrections, all 13 site-frame browser cases passed (`tally-final-browser.txt`), recapturing the four theme/focus images with the final copy. The earlier full-check result above is a recorded initial implementation stage; latest integrated-tree checks will be recorded separately.

The delegated privacy implementation stayed within `src/server/trust-pages.ts`, `src/server/trust-pages.test.ts` and `docs/DEVELOPMENT.md`. Two new HTML/Markdown regressions failed with eight existing passes before implementation; all ten then passed with a fake canonical origin and intercepted fetch (`tally-privacy-handoff.md` and its raw logs). The source records the aggregate Upstash fields, coverage, exclusions, inference and missing-write limits; production service configuration remains author-reported and unverified. The new section is separate from Searchable's services paragraph so both disclosures can survive the forthcoming main merge.

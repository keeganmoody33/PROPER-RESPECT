# GitHub provider boundary — 2026-09-22

Original audit base: `724216e6c415b0b06927dbe36e3f81683fcf9b70`.
Integrated main before final verification: `0188d5cdcadd0d29b9d7696c01db8b86b8ca73af`.
Branch: `codex/github-provider-boundary-20260922`.

PStack boundary discipline / prove-it-works: reproduce malformed source behavior through the actual action, validate at the provider boundary, then preserve the existing retention and review contract. This is an offline repair. No account/provider read, backend synchronization, deployment, publication or recurring task occurred.

## Findings and disposition

- **Fix now — numeric precision:** ordinary JSON parsing previously converted source `1e-999`, `1.0000000000000001` and `9007199254740991.1` into accepted integer counts. A parallel lexical tree now preserves numeric tokens outside JSON strings, and the expected count positions are checked against their original mathematical integer value. Required numeric types reject quoted-number spoofing. Escaped field names are decoded by native JSON.parse in both trees. Coefficients/exponents are bounded before constructing an at-most-16-digit BigInt. Exact `1.0`, `10e-1`, scientific integer notation and genuine zero remain supported; negative count syntax including `-0` is rejected. No JSON reviver-source runtime feature is required.
- **Fix now — invalid source shape:** missing/null login, invalid dates/timestamps, unknown intensity enums, duplicate dates, excessive weeks/days and malformed/nonempty GraphQL errors now fail before capture writes. Unknown values never become zero or a fabricated account name.
- **Fix now — transport and diagnostics:** one 10-second deadline covers fetch and body consumption, including adapters that ignore AbortSignal. Actual bytes are capped at 128 KiB regardless of Content-Length. Non-OK/redirected/non-JSON, malformed JSON/UTF-8, network failure and oversized responses produce one fixed bounded message, never provider text or credentials. Failure/timeout cancels the reader; late fetch responses are cancelled; timers are cleared without awaiting an unbounded cancellation promise.
- **Fix now — coverage wording:** returned total and day counts remain unchanged. Exact sum mismatch and out-of-request-period dates produce factual provenance-label caveats. No calendar-padding tolerance or reason for a mismatch is invented. The baseline label states that visibility and coverage follow the source. Capture freshness does not establish completeness.
- **Deferred — original-response provenance:** the existing payload remains the explicitly labelled normalized API snapshot. Original GraphQL bytes, response hash, full request-time receipt and an independent supplied-file preparer require a separate versioned capture contract; changing them would also affect replay and observation excerpts.

The 128-KiB cap is a conservative application limit, not a GitHub guarantee. The synthetic 366-day response is under 40 KiB; the accepted calendar is bounded to 60 weeks, seven days per week and 400 unique dates. An otherwise valid response with excessive extra metadata is rejected rather than truncated. Duplicate JSON object keys follow native last-value behavior consistently in both trees; this patch does not claim duplicate-key rejection.

## Patch boundary

`src/server/github-activity.ts` owns GitHub transport, parsing and normalization, returning the existing `{accountLabel, activity, value}` shape. `convex/connectors.ts` only imports that helper and removes its previous GitHub fetch implementation. Both connect and approved refresh use the same boundary. PR58's retention/replay/ambiguity logic, schemas, owner decisions, Devin path and publication behavior remain unchanged.

Invalid connect attempts make no capture, connector or secret changes, including an already connected owner and an empty owner. Existing refresh failure handling may still record failure/staleness through `markRefreshFailed`; zero-write claims do not apply to that established bookkeeping path.

## Verification

The initial real-action regression run was **19 failures and one passing valid-zero case**, after correcting the synthetic secret fixture to match the existing schema. Invalid source values reached writes or leaked validation/provider error details before this patch.

Final focused command:

```sh
npx vitest run src/server/github-activity.test.ts convex/githubProviderBoundary.test.ts convex/githubCaptureIntegrity.test.ts convex/evidenceClaims.test.ts convex/connectorPrivacy.test.ts src/server/github-route.test.ts
```

**135 tests passed.** The new tests cover exact numeric source tokens and huge exponents, escaped keys and quoted strings, valid zero, UTF-8 byte bounds, full calendars, aggregate 400/401-day bounds, malformed source objects, GraphQL errors, large private error sentinels, chunked/lying-header bodies, ignored fetch abort, stalled reads and cancellation, existing-connector preservation, empty-owner preservation and factual mismatch caveats. The actual Convex action is exercised using synthetic in-memory state and mocked fetch; no network provider request is made.

Final integrated verification: `npm test`, `npm run typecheck`, `npm run lint`, and `git diff --check` passed. Full suite: **983 Vitest tests passed, two skipped; seven Node script tests passed.** The first typecheck found an unsupported BigInt literal spelling under the repository target; replacing `0n` with `BigInt(0)` preserved arithmetic and passed the final check.

No live GitHub account, OAuth scope, provider completeness, hosted refresh, owner heatmap or deployment was validated. Real usage remains absent until a separately authorized capture/import and owner review occur. Independent exact-head review and CI remain release gates.

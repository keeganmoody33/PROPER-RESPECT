# Codex account usage: private local preview — 2026-09-22

Base: `12be96234e7efaf87e5a5d3c974a3dd41d1cb591`.
Branch: `codex/codex-usage-preview-20260922`.
Scope: installed `account/usage/read` response metadata, synthetic local preview only.

## Grounding and design

Read the existing September 21 usage-metering contract, repository instructions, PStack model-the-domain/prove-it-works/runtime guidance and generated `v2/GetAccountTokenUsageResponse.json`. Reconfirmed `codex --version` reports `codex-cli 0.153.4`. Generated schema SHA-256 remains `a58e58c852c888e5de925d99a66688d55ebb2fff038e795aadf04f8a8426dff8`. This check reads installed protocol metadata only; no authenticated account method, session, transcript or private directory was read.

The shape is a snapshot capture, not a token event. Compared building an event ledger with retaining independent source snapshots. Selected independent snapshots because the installed response supplies account aggregates, daily buckets and optional thread groups without the event identities or verified disjointness needed for a ledger.

Public API in `src/domain/codex-usage.ts`:

- `parseCodexUsageCapture(text)` strictly validates a bounded metadata envelope and normalizes omitted nullable fields to unknown.
- `reviewCodexUsageCaptures(captures)` partitions owner/account namespaces, ignores exact normalized metadata replays and quarantines incompatible variants of one capture identity. It never chooses a maximum or sums snapshots.
- `formatCodexUsagePreview(review)` displays source-reported figures, subsets, source dates, estimates and coverage caveats. It derives no account/day/thread grand total.

No UI, backend schema, acquisition or publication changes. The domain module and its CLI behavior tests are included in the existing `src/**/*.test.ts` Vitest gate. No new dependency or workflow is required.

## Run the preview

```sh
node --no-warnings --experimental-strip-types scripts/codex-usage-preview.mjs \
  tests/fixtures/codex-usage/account-snapshot.json \
  tests/fixtures/codex-usage/account-snapshot.json
```

This actual command prints one synthetic capture, 1,200 source-reported lifetime tokens and one ignored replay. The group retains input 1,000, cached input 800 included within input, net-new input 200, output 200 and reported total 1,200. It prints estimated credits 1.500000 and unknown estimated USD/billed spend. Source dates September 21 (1,200) and September 22 (explicit zero) remain separate buckets. It does not add these overlapping views. `/tmp/codex-usage-u4-preview.txt` records the inspected output. `--no-warnings` prevents Node's experimental/type-loader warnings from printing local module paths; application errors never include input paths or payloads.

For an owner-supplied capture, follow the synthetic envelope exactly:

- `formatVersion: 1` and `source: { method: "account/usage/read", version: "0.153.4" }`.
- `scope.ownerAlias` and `scope.accountAlias`: stable local opaque aliases, not email addresses, filesystem paths or credentials. A thread-bearing response also requires the matching `scope.requestedThreadId`.
- `capture.id`: stable identity for this retained capture, reused on replay; `capture.capturedAt`: supplied UTC capture time. These are declarations, not authenticated provider identity or timestamp proof.
- `response`: only the installed response's summary, daily buckets and optional thread usage fields. All unknown fields are rejected, including content-bearing prompt/code/tool-result fields.

The CLI accepts 1–32 explicitly named regular JSON files, each at most 256,000 bytes. It refuses directories, symlinks and invalid UTF-8, bounds the read even if a file grows, and performs no discovery or network operation. Up to 3,660 unique daily dates and 128 source thread groups per capture are allowed. Counts must be nonnegative safe integers. Labels/identifiers are bounded ASCII identifiers, not prose. Unsupported versions, mismatched thread scope, invalid dates, duplicate day buckets and impossible cached/net-new counts are rejected with one fixed error. No partial preview is printed when an input fails validation.

Exit codes: 0 for a valid preview, 1 for invalid/unreadable input, 2 when same-identity variants conflict. Conflicts quarantine all variants rather than exposing a selected figure. Different captures remain independent even when periods overlap. Different owner/account namespaces never collide. These caller-supplied namespaces are partitioning metadata, **not authorization**; any future authenticated import must bind ownership independently.

## Semantics and privacy boundaries

- Missing/null metrics remain unknown; explicit zero remains zero. An empty source list is not proof of zero lifetime activity.
- Daily bucket dates are retained without invented timezone, missing-day values or capture-day allocation. Thread periods, device coverage and complete historical coverage remain unknown.
- Cached and net-new input are breakdowns, not additional token totals. Source groups are not assumed disjoint. An inconsistent reported total is retained with a visible caveat rather than silently corrected.
- Credits and USD retain integer micro-units, with exact decimal formatting. Estimates are not billed spend, subscription cost, invoice evidence or a modeled savings claim.
- Metadata SHA-256 covers canonical normalized allowlisted metadata, **not the original file bytes**. JSON key order and omitted/null unknowns do not create extra snapshots. Original files remain where the owner supplied them; this preview does not retain or upload them.
- The preview does not prove these caller-supplied values came from Codex. It does not inspect prompts, code, repositories, transcript bodies, credentials or account data. A malicious value disguised inside an allowed opaque label is not authenticated by the parser; only selected metadata should be supplied.
- Live provider semantics and freshness are explicitly unvalidated in every preview. No public product capability claim changes.

## Verification

RED: focused tests initially failed because the new adapter did not exist. `/tmp/codex-usage-u4-red.log`.

GREEN: 27 focused tests cover source/subset preservation, null/zero, exact micro-unit formatting, inconsistent totals, replay/order determinism, overlapping snapshots, same-identity conflicts, account/owner partitioning, source dates, required scope, version/date/integer/bucket/group bounds, unexpected content, malformed JSON, actual CLI replay, safe CLI diagnostics, filesystem/encoding rejection and conflict exit status. `/tmp/codex-usage-u4-final-tests.log`.

Focused ESLint, `npm run typecheck` and `git diff --check` pass. Actual file-to-readable-preview command was run and its output inspected. Tests use synthetic fixture files only. No service or account was started.

## Next private acceptance gate

With separate owner authorization, obtain one bounded `account/usage/read` result for the installed supported version and declared account scope, excluding transcripts and content-bearing surfaces. Privately inspect field availability, source periods, reporting timezone, account/device coverage and estimate meaning; reconcile identical scope/timing with the native UI. Reimport the same capture and a second overlapping capture to confirm behavior. If acquisition is unavailable or shape/semantics differ, stop at an explicit unsupported result and revise the adapter before any persistence or public wording. Backend ownership/isolation, revocation, recurring updates and exact sharing remain separate future work.

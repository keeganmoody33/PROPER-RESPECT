# Run the private usage and cost report

Dated 2026-09-24 UTC. This is a local offline slice, not a deployed meter. All
committed samples are synthetic. No genuine owner source was acquired or validated.

## Reproduce

From the repository root with Node.js 22.20+ and installed dependencies:

```sh
node --no-warnings --experimental-strip-types scripts/usage-cost-report.mjs \
  --synthetic-haiku-20260924 \
  tests/fixtures/usage-cost/priced-synthetic.json \
  tests/fixtures/usage-cost/unknown-and-missing.json \
  tests/fixtures/usage-cost/cumulative-reset.json \
  tests/fixtures/usage-cost/codex-account-synthetic.json \
  tests/fixtures/usage-cost/codex-overlap-synthetic.json
```

Omit `--synthetic-haiku-20260924` for an evidence-only report with every row
unpriced. The flag is a report option, never source evidence. It cannot price an
`owner-supplied` Claude sample. Codex format v1 has no origin field; the report
labels its origin unverified even for these documented synthetic fixtures.

```sh
# Duplicate export: same rows, replay count increases.
node --no-warnings --experimental-strip-types scripts/usage-cost-report.mjs \
  tests/fixtures/usage-cost/priced-synthetic.json \
  tests/fixtures/usage-cost/priced-synthetic.json

# Deliberately conflicting overlap: report emitted, exit code 2.
node --no-warnings --experimental-strip-types scripts/usage-cost-report.mjs \
  tests/fixtures/usage-cost/overlap.json

npx vitest run src/domain/claude-metric-evidence.test.ts src/domain/usage-cost-report.test.ts src/domain/codex-usage.test.ts
```

Exit 0 means a valid report, including valid unpriced/baseline rows; it does not
mean complete coverage. Exit 1 rejects malformed/unsupported files with a fixed
diagnostic and no partial stdout. Exit 2 denotes conflicts. The CLI reads only
named regular files with no symlink following, bounded reads and strict UTF-8.
It writes stdout only. Keep genuine output in an explicitly approved private
destination; do not redirect it into this repository or a cloud task by default.

## Synthetic results

| Source case | Observed categories | Source estimate USD | API equivalent USD | Actual billed USD |
| --- | --- | --- | --- | --- |
| Pinned Haiku delta | input 1000, output 200, cacheRead 100, cacheCreation 0 | 0.009123456789 | 0.002010000000 with explicit synthetic scenario | unknown |
| Missing output | input 1000, output unknown, cacheRead 100, cacheCreation 0 | 0.009123456789 | unpriced: missing category | unknown |
| Mixed model | same complete categories | 0.009123456789 | unpriced: model unresolved | unknown |
| Cumulative 100, 100, 160 | first baseline 100; increments 0, 60 | unknown | only measured intervals eligible for synthetic scenario | unknown |
| New epoch 20, 30 | independent baseline 20; increment 10 | unknown | no subtraction across reset | unknown |
| Two overlapping Codex account snapshots | lifetime total 1200 in each source view | unknown | both unpriced; never 2400 | unknown |
| Overlapping Claude deltas | two overlapping source intervals | retained as source facts | stream quarantined, unpriced | unknown |

Exact demonstration: `(1000 × 1 + 200 × 5 + 100 × 0.10) / 1000000 =
0.002010000000 USD`. Rates are USD per million; amounts use BigInt picodollars,
with exactly 12 displayed decimals and no rounding. One cached token at that rate
is 0.000000100000 USD. Token counts up to 30 digits stay exact. No input/cache or
output/reasoning subset is double-counted. There is no global total.

The rate version is `anthropic-haiku-documentation-2026-09-24-v1`, exact model
`claude-haiku-4-5-20251001`. [Primary rate source](https://platform.claude.com/docs/en/models/haiku-4-5/overview).
The scenario assumes direct API, normal speed, standard synchronous tier, global
geography, at most 200K context and no extra paid features, for September 24 UTC
only. This is a same-day documentation scenario, not a historical effective-date
claim. Cache creation must be exactly zero because the metric lacks TTL. Wrong
date/model/version, unknown timezone/category, nonzero creation, conflicts,
baselines and owner-supplied evidence remain unpriced. Claude versions outside
2.1.214–2.1.274 are outside this reviewed scenario range; no claim that all other
versions are defective. Source cost estimates never fill missing token data.

## Sanitized export contract

The fixture documents every required field. This is **not native OTLP JSON** and
does not implement a sanitizer or collector. All objects are strict; arbitrary
attributes, events, logs, traces, exemplars, prompt/tool/repository text and
invoice fields are rejected. Aliases are caller-supplied and may still identify
someone; a regular expression is not anonymization or authentication.

Counts are canonical unsigned integer strings or explicit null; USD estimates
are unsigned decimal strings with at most 12 fractional digits or null. Timestamps
must be canonical millisecond UTC strings; finer precision is unsupported, never
silently truncated. Reporting timezone is UTC or unknown. A bundle explicitly
attests a common source window, disjoint categories and monotonic semantics;
retain full per-metric keyed stream identities and the category-family identity
in a stable namespace. A keyed digest is an identity assertion, not proof of
the unseen original or a human's work. No individual/session/account counts are
converted into productivity claims.

Each batch is limited to 32 files, 256000 bytes/file, 1024 bundles/file and 2048
bundles in total. Source observations and all capture provenance are retained in
the in-memory report separately from derived intervals and rate valuations.
Capture IDs/digests find incompatible exports. Semantic replay ignores capture
time and point labels, but preserves model/version/origin and scope. Conflicting
capture/point/position metadata, decreases, overlaps or mixed temporalities
quarantine the whole logical stream, a deliberately conservative policy. Separate
namespaces remain independent nonadditive coverage sets.

Cumulative first points are always baselines. Changed nonoverlapping epochs
create new baselines; a fall inside an epoch is unresolved. Missing endpoints
remain unknown. Full-batch source-time sorting makes late arrivals deterministic;
new input may replace previous intervals. No conflict is removed then bridged.
Delta holes are coverage gaps. No daily distribution or interpolation is inferred.

## Verification and remaining gate

Author checks and independent review are recorded with exact SHAs in the final
external receipt and delivery Ref. Initial checks: 32 new tests, existing Codex
regressions, full repository tests, lint and typecheck. Final counts can change
with review fixes; a green local run is not hosted CI or owner validation.

[Source research and real-sample HOLD](2026-09-24-usage-cost-source-contract.md)
specify the next separately authorized input. No personal configuration, auth,
session/transcript file, app-server/account request, telemetry, hook, background
collector, recurrence, provider call, upload, backend sync, publication or
deployment occurred. The existing Codex native execution gate is unchanged.

# Tool usage metering contract and private validation gates

Researched: 2026-09-21. Inspected application head: `b6974bb967cd5be7b4693c009b406637300a6a9e`.

Status: research and proposed acceptance contract. No importer was implemented, account usage requested, personal session/transcript opened, telemetry enabled, data published, or service deployed in this pass. The implementation checklist belongs in the companion product to-do list; the rules below specify what would make that work verifiable.

## What exists in this application

`src/domain/retained-product-evidence.ts` restricts artifacts to `WISPR_INSIGHTS`, `WISPR_OWNER_REVIEW`, and `GITHUB_ACTIVITY`, and product slugs to `wisprflow` and `github`. `src/domain/discovery.ts` has no Codex/Claude source type. `codingActivity` in `src/domain/public-profile.ts` is a generic display variant, not a token ledger. `src/domain/evidence-claims.ts` has a general `USAGE` observation with value/unit/period; it has no token-category, source-event identity, counter-reset or cross-capture overlap contract.

Repository searches of application, adapters, scripts, Convex and tests found no implemented Codex metadata importer at this head. Earlier private-import direction is a release gate, not evidence that an adapter shipped. A collector elsewhere or on an unmerged branch was not audited here.

The Claude carousel fixture is arithmetically consistent:

`500,000 input + 120,000 output + 2,700,000 cache read + 80,000 cache creation = 3,400,000 recorded tokens`.

It is explicitly illustrative and says Claude Code import is unavailable. There is no immediate total correction to make. A real importer must derive this total from retained categories instead of maintaining independent hardcoded values. Prefer the label **Uncached input** for Claude's input category, because its semantics differ from OpenAI's input count.

## Claude Code: official measurement surfaces

[Monitoring documentation](https://code.claude.com/docs/en/monitoring-usage):

> Cost metrics are approximations.

It documents `claude_code.token.usage` with `input`, `output`, `cacheRead`, `cacheCreation`; model and main/subagent/auxiliary attribution are available. OTLP temporality defaults to delta and can be cumulative. Session IDs are included by default; version inclusion is configurable. The docs record a streaming double-count fix in v2.1.214, making source version material. Event sequence restarts per process and can repeat when a session resumes. Transcript joins are version-specific. Metrics-only collection should exclude content-bearing logs/traces; metadata still needs an allowlist and private review.

[Commands reference](https://code.claude.com/docs/en/commands):

> `/stats` | Alias for `/usage`. Opens on the Stats tab

The same reference lists `/cost` as an alias. Treat command names as version-dependent; do not design three independent data feeds around them.

[Costs documentation](https://code.claude.com/docs/en/costs):

> the session cost figure isn’t relevant for billing purposes

That applies to Pro/Max subscription usage. The documented session amount is calculated from list prices or organization-configured rates. Current session totals reset at `/clear`; before v2.1.211 they accumulated for the process lifetime. The 24-hour/7-day usage breakdown uses local history and excludes other devices and claude.ai. UI counters are useful reconciliation evidence, not a stable export API or proof of complete historical coverage.

[Anthropic prompt caching documentation](https://platform.claude.com/docs/en/build-with-claude/prompt-caching):

> `total_input_tokens = cache_read_input_tokens + cache_creation_input_tokens + input_tokens`

For the documented Anthropic usage shape, these three input categories are disjoint. Add output once for recorded token activity. Cache creation TTL breakdowns, if supplied, subdivide cache creation and must not be added again. Do not transplant this formula to Codex. The OTEL token types do not independently supply a reasoning token category; unknown reasoning stays unavailable.

Proposed first Claude implementation: a local, owner-approved metrics-only OTLP export into a private bounded adapter, starting from synthetic fixtures. Historical transcript parsing is a separate versioned fallback, not a prerequisite for prospective metering. No exporter was configured in this task.

## Codex: inspect the installed protocol before collecting anything

The installed executable reports `codex-cli 0.153.4`. Only CLI help and schema generation were run:

```sh
codex --version
codex app-server --help
codex app-server generate-json-schema --help
codex app-server generate-json-schema --out /tmp/proper-respect-codex-schema-20260921
```

This reads the installed protocol; it does not establish that an account supports a method, that all historical usage is available, or that a call is authorized.

The generated `ClientRequest.json` includes `account/usage/read`. `GetAccountTokenUsageResponse.json` exposes:

| Surface | Fields present in generated 0.153.4 schema | Interpretation to validate privately |
| --- | --- | --- |
| Account snapshot | Nullable `summary.lifetimeTokens`, streaks, peak daily tokens, longest turn; nullable `dailyUsageBuckets` with `startDate` and `tokens` | Source-reported aggregate snapshots. Do not sum lifetime values across captures or assume daily history covers lifetime. |
| Optional thread query | `threadId` parameter; nullable `threadUsage`; groups with nullable model, effort, speed, input, cached input, net-new input, output, total | Availability, period, grouping and inclusion rules need a real bounded acceptance test. Missing breakdown is not zero. |
| Thread estimate | `estimatedUsageCreditsMicros`, nullable `estimatedUsageUsdMicros` | Preserve the source's “estimated” label and integer micro-units. Not an invoice. |
| Active-thread notification | `threadId`, `turnId`, `tokenUsage.total`, `tokenUsage.last`, nullable context window; input, cached input, output, reasoning output, total; optional/defaulted cache-write input | A notification is a snapshot/update, not necessarily a new billable event. Context capacity is not usage. |

Exact generated-schema receipts:

- `v2/ThreadTokenUsageUpdatedNotification.json`: SHA-256 `aba4f6c7e4a19b2b842c08ee793b57000c07dafd57b922ad0d8e7c76609108c2`.
- `v2/GetAccountTokenUsageResponse.json`: SHA-256 `a58e58c852c888e5de925d99a66688d55ebb2fff038e795aadf04f8a8426dff8`.

[Official app-server documentation](https://developers.openai.com/codex/app-server/) names:

> `thread/tokenUsage/updated` - usage updates for the active thread.

The installed `account/usage/read` schema is a promising metadata-only candidate to validate before reading local transcripts. It was not found by that exact method name in the opened public app-server documentation, and schema presence alone is not a support or access guarantee. No authenticated app-server connection or account request was made.

[OpenAI protocol source](https://github.com/openai/codex/blob/7d99ee82d74325cabf485ea1e2adbd0c2625ab19/codex-rs/protocol/src/protocol.rs#L2100), pinned at inspected upstream main `7d99ee82d74325cabf485ea1e2adbd0c2625ab19`:

> Best-effort Responses API usage observed for one completed response.

`TokenUsageRecord` carries response, thread, turn, session and root-turn identity plus per-response, turn and thread usage. `TokenUsageInfo` also has cumulative and last usage; rate-limit-only events can lack usage. `fill_to_context_window` can synthesize a context-window total, so a non-null total is not by itself proof of metered response usage. The source defines uncached input as input minus cached input and displays reasoning alongside output. Pin compatibility to the installed version: current upstream source is supporting evidence, not proof every event exists in 0.153.4.

[OpenAI reasoning documentation](https://developers.openai.com/api/docs/guides/reasoning) places reasoning in `output_tokens_details`; its example nests reasoning under output. Therefore do not add reasoning to output again. Cached input is a subset of input for the inspected OpenAI shape; do not add it to input again. Preserve explicit cache-write fields if present, but do not guess their pricing or subset relationship for an unsupported source version.

[Codex pricing documentation](https://developers.openai.com/codex/pricing/):

> Pay for Codex usage based on API pricing

This is the API-key option. Subscription allowances, purchased credits and API-key charges have different billing contexts. `/status`/usage-dashboard quota percentages and reset times cannot be converted into token counts with a fixed multiplier. Public wording must not turn a modeled API equivalent into “you spent” or “you saved.”

## Proposed deterministic storage and aggregation rules

These are Proper Respect requirements to implement and test, not claims about existing code or universal vendor behavior.

1. **Keep evidence and derivation separate.** Retain an immutable metadata capture digest, adapter/version, source application/version, acquisition route, captured time, source period/timezone, source-account scope, meter semantics and a coverage verdict. Store derived aggregates with a rule version and the exact capture/event identities used. Do not upload prompts, code, tool output, credentials, repository paths or transcript bodies for this feature.
2. **Partition before adding.** Ledger identity includes the Proper Respect owner, provider, source account/workspace, installation or process epoch when needed, native event identity, and meter/category. A locally collected agent run is not proof a human performed its actions. Display account/workspace attribution separately from actor attribution.
3. **Prefer native response identity.** A request/response with a stable provider ID is counted once within its source-account namespace. Hashes identify immutable captures and payload conflicts; a raw payload hash alone cannot distinguish two legitimate equal-valued requests. Do not deduplicate different accounts together. Native ID collisions with different values quarantine the conflict; never silently pick the larger value.
4. **Treat every source as one of event, delta, cumulative counter, or snapshot.** Do not add `total` to `last`; do not sum repeated `last` notifications without a new response/event identity. Delta telemetry needs producer identity, metric attributes and start/end interval; exact export retries replay idempotently. Overlapping nonidentical deltas remain a conflict until their provenance can establish disjointness.
5. **Handle counter epochs explicitly.** With cumulative values 100, 100, 160 in one known epoch, the measured increase is 60, not 360. A first observation of 100 is a baseline unless the source establishes the epoch start and complete coverage. A decrease, restart, compaction or rollback is not automatically a reset or negative usage. Establish a new epoch from source evidence or mark the interval unresolved. No silent `max(0, difference)` repair.
6. **Do not merge overlapping views.** An account total, parent thread total, child-agent total, notification stream and local-history export may cover the same work. Keep them separate until native response identities or documented disjoint scopes reconcile them. A fork can copy earlier history; copied events keep their original identity. Parent-attributed child work counts once in an account view.
7. **Keep source units and subsets.** For a supported OpenAI fixture, input 1,000 including cached 800 plus output 200 including reasoning 50 is 1,200 recorded tokens, not 2,050. Display cached as “of input” and reasoning as “of output.” For a supported Anthropic fixture, uncached input 500 + cache read 2,700 + cache creation 80 + output 120 is 3,400. A cross-provider graph may compare separately defined recorded-token counts, but must disclose different tokenization and source coverage; it cannot assert equal work, productivity or cost.
8. **Assign periods without inventing detail.** Normalize instants to UTC and retain reporting timezone. Use half-open intervals `[start, end)`. Retain vendor date-only buckets as date buckets. Do not spread one session total uniformly across days or assign an untimed delta to capture day. Cross-midnight intervals without finer detail remain unresolved for daily allocation. Missing days remain gaps; an explicitly supplied zero is zero.
9. **Version model and price attribution.** Model belongs to the request/interval, not merely the last model of a session. Unknown or mixed-model intervals remain unknown/mixed and unpriced. A priced estimate requires model/provider, applicable dated rate card, billing mode, service tier/speed, cache treatment and currency. Store integer micro-units or exact decimal arithmetic; round only presentation. Actual payments require separate invoice/payment evidence.
10. **Make failures visible.** Return captured/expected coverage where known, unsupported versions, dropped/quarantined records, unavailable fields, stale timestamps and missing devices. A rejected/malformed count never becomes zero. Enforce bounded input sizes, nonnegative exact integers, safe arithmetic and deterministic ordering. “Partial” is an acceptance result, not a parser error to hide.
11. **Keep the journey private.** Preview the source scope, counts, exclusions and sharing result before saving/publication. Import/reimport does not publish or widen existing sharing. Revocation stops future acquisition; data retention/deletion follows an explicit owner choice. Test ownership, reconnect and revocation independently.

## Card-specific display contract and acquisition backlog

| Tool | Primary metric and presentation | Required evidence / next step |
| --- | --- | --- |
| GitHub | Contributions calendar with account, covered dates and capture freshness; commit count separately if sourced | Current connector/retained GraphQL evidence exists. GitHub says contribution types include more than commits. Do not relabel its calendar “commits.” Preserve source-reported days and boundary gaps. [Official definitions](https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference). |
| Clay | Actions and data credits as distinct measures. Distinct successfully enriched rows only when derivable | [Clay documents](https://university.clay.com/docs/credit-usage): “All views allow you to download the data as a CSV for further analysis.” Inspect an owner-provided export privately. Distinct rows require stable `(workspace, table, row)` identities, success state and timestamps; reruns/multiple columns count once per selected period. Do not derive rows by dividing credits. Workspace totals are not individual activity. No Clay importer exists here. |
| Wispr Flow | Cumulative words, average WPM, current streak, apps used; daily words only with daily evidence | [Wispr documents](https://docs.wisprflow.ai/articles/8760230576-your-usage-tab-track-your-dictation-stats-in-wispr-flow): “Total words dictated: A running count of every word you've dictated with Flow”. Existing retained Insights text is supported. A monthly comparison badge does not turn the cumulative total into monthly usage. Preserve desktop/mobile coverage and capture date. Do not sum successive snapshots or average average-WPM values without weighting data. No personal structured usage API was confirmed in this pass. |
| Claude Code | Recorded tokens; uncached input/output/cache read/cache creation; source period, model and covered sessions | Implement prospective metrics-only private fixture adapter first, then reconcile an authorized sample to the native UI. Display estimated cost separately if validated; subscription bill and remaining allowance remain separate sources. |
| Codex | Source-reported account snapshot or validated recorded request tokens; cached/reasoning subsets and coverage visible | Privately validate installed `account/usage/read` availability and meanings first. If insufficient, implement a versioned metadata-only source with native response identities and fixtures. Source snapshot and reconstructed request ledger remain separate until reconciled. No Codex adapter exists at inspected application head. |

## Required fixture and runtime acceptance tests

All tests below are pending implementation. The schema generation, source inspection and arithmetic check above are completed research checks; they are not live metering verification.

- [ ] Replay: import one capture twice and an overlapping capture once; unique native events and totals stay stable. Two distinct equal-valued requests both count.
- [ ] Conflict: same source event ID with altered values is quarantined; no silent overwrite. A separate user's identical IDs never collide.
- [ ] Notification snapshots: repeated totals/last values and rate-limit-only events add no fabricated usage. Synthetic context-window fills do not enter the response ledger.
- [ ] Epochs: cumulative 100, 100, 160 produces a known increase of 60; missing first baseline and unexplained decreases flag incomplete coverage. Valid restart starts a separate epoch.
- [ ] Delta exports: exact retries are idempotent; partially overlapping intervals cannot double count. Arrival order does not change accepted totals.
- [ ] Subsets: OpenAI 1,000 input / 800 cached / 200 output / 50 reasoning totals 1,200. Anthropic 500 / 2,700 / 80 / 120 totals 3,400. Cache TTL children do not add to their parent again.
- [ ] Coverage: missing/zero/null values differ; truncated files, unsupported versions, bad timestamps, unsafe integer sizes and absent account attribution fail closed with counts of excluded records.
- [ ] Forks and subagents: copied history and parent/child overlap count each response once; truly disjoint responses survive. Unproven overlap stays separate.
- [ ] Periods/models: model switch, timezone boundary, date-only snapshot and cross-midnight cumulative interval remain accurate or explicitly unresolved; no invented daily allocation or pricing.
- [ ] Privacy: unexpected content fields are rejected/stripped before retention; payloads and diagnostics contain no prompt/code/tool text, secrets or identifying filesystem paths. No auto-discovery of personal sessions.
- [ ] Private lifecycle: two-user isolation, owner review, exact sharing preview, reconnect/revocation, reimport without publication, and unchanged existing published profile.
- [ ] Native reconciliation: authorized private sample matches the vendor UI/export for the same source, period, version and scope; explain exclusions and timing lag before accepting. No telemetry or real-account reads merely to make this checklist green.
- [ ] Public-claim gate: only advertise each validated source and metric after its adapter and private acceptance pass. Keep all other cards labeled as examples; avoid a universal metering promise.

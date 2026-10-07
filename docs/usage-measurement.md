# Codex and Claude Code usage measurement

Updated: 2026-10-06. R27 implementation builds on release `v0.2.6` at
`8cab986ee3e5f638b320d4baacefff0302a45615`. Source changes need review and a
separately authorized release; this document does not claim live acceptance.

## Hosted import contract

Choose one source at `/app/collection`, sign in, and import one sanitized JSON
file. The chosen source survives sign-in. Successful import opens the exact
private relationship and its usage result. A public handle and email discovery
are optional. Manual tool entry remains available.

The existing local preview generator remains a local tool. R27 adds a separate
reviewed measurement projection through the existing source, retained-original,
relationship, and publication records. It does not attach legacy `privateUsage`
or `privateNativeUsage` objects to public cards.

Accepted inputs:

- Claude `claude-code-native-metrics-v1` from
  `scripts/claude-native-report.mjs --format sanitized`, with the existing
  explicit source mode and sanitizer arguments. Raw OTLP must be sanitized
  locally first. The restricted sanitizer can reject a full exporter payload.
- Codex version 1 metadata captures for `account/usage/read`, source version
  `0.153.4`, using the existing [capture schema](../src/domain/codex-usage.ts).
  Existing safe-integer limits still apply. No native acquisition was enabled.
- `proper-measurements-v1`, the product-independent schema in
  [measurements.ts](../src/domain/measurements.ts). It requires an opaque source
  alias, native metric/unit, exact decimal string or null, scope, period,
  coverage, temporality and aggregation for each row. It accepts uncatalogued
  products without treating email or branding as usage.

`scripts/usage-cost-report.mjs` emits Markdown for local reading. Its output is
not importable JSON. Do not parse that report as an ingestion contract. The
older experimental `claude-code-sanitized-metrics-v1` report input is also not a
hosted input in this bounded release.

## Exactness and history

Exact scalars stay strings through authenticated persistence, private queries,
review, preview and public reads. Unknown is null, not zero. Claude's existing
reconciler owns delta/cumulative baselines, resets, gaps and stream conflicts;
quarantined conflicts cannot be selected. Derived cumulative differences are
labeled separately from source-reported snapshots. Synthetic source status
survives projection. Codex daily buckets and thread views remain separate from
account lifetime totals; no global total is calculated.

Each source/account scope has a separate private group. Changed content under
one capture identity is rejected. Reimporting the same capture is idempotent.
A new capture or deleted original invalidates the source group's review.
Deleted originals cannot be restored by replay. Disconnecting a provider keeps
retained measurements and relationship history.

This is a bounded first import path:

- 256,000 bytes per file
- 32 retained capture identities per relationship, including deletion tombstones
- 750,000 active retained JSON bytes per relationship
- 256 measurement reviews per relationship across all source groups
- 512 rows per generic packet and 8,192 derived rows per source review
- 24 reviewed/public rows per card and 8 selected source groups

Unchanged selections for the current source digest keep their review version
and do not append history. Reaching a limit leaves existing records intact;
reads and unchanged saves or retries still work. This is not yet unlimited
historical synchronization or a general backup/restore format. The existing data
export remains partial; it does not include all new measurement review history.

## Privacy and publication

Strict schemas reject unknown fields, prompts, transcripts, credentials and
workspace content rather than storing arbitrary JSON. Use opaque aliases, not
email addresses, filesystem paths or confidential workspace names. Imported
aliases are owner-supplied, not provider-authenticated identity. The activity
actor remains unknown.

Import and review are private. Review rows, save relationship context, then
select reviewed sources in the existing sharing flow. The public projection
contains only approved measurement values and their units, scope, period,
coverage and interpretation. Private source aliases, hashes, thread identifiers,
model dimensions and raw originals do not copy to the public card. Both the
review version and source digest bind the publication preview; a stale preview
cannot authorize changed evidence. Existing public snapshots remain unchanged
until explicit republishing or unpublishing.

These records do not prove complete account history or verified billed charges.
No automatic collector, private agent API, account-merging operation, native Clay
connector or device-duration collector is included. Public agent reading stays
read-only and uses the same approved visible projection.

## Acceptance boundary

Automated tests use synthetic inputs and authenticated Convex test contexts.
They establish exact-value retention, isolation, replay safety, review and
publication behavior. They do not establish genuine exporter coverage or a live
signed-in service journey. After a separately authorized release, use an approved
genuine sanitized file to check first result, reload, a fresh session, source
revocation/history and deliberate public selection. Do not enter or upload live
credentials for this acceptance path.

## Codex sources

OpenAI's current app-server documentation says:

> Use `account/usage/read` to fetch ChatGPT token-activity summary fields and optional daily buckets.

Source: [Codex app-server documentation](https://developers.openai.com/codex/app-server/).

That endpoint requires authentication backed by Codex services. API-key-only
and Bedrock authentication are excluded. Summary values and daily buckets can
be null, so the endpoint does not promise a complete account history for every
user. This public documentation supersedes the documentation-absence finding
in the dated [September 21 contract](verification/2026-09-21-usage-metering-contract.md).

Installed `codex-cli 0.153.4` publicly generated schemas include account token
snapshots, thread token updates, and optional thread cost estimates. Schema
availability does not prove an authenticated response or its coverage. No
authenticated account request was made for this check.

The native adapter's startup blockers remain:

```text
system-config-not-isolated
managed-preferences-not-isolated
startup-services-not-contained
account-selection-unproved
```

Source: [native adapter](https://github.com/keeganmoody33/PROPER-RESPECT/blob/c002560f209174728b9b138a529f814c94e33872/src/local/codex-native-adapter.ts#L19-L24).

Quota percentages measure a quota window. Account token counts measure token
activity. Neither alone establishes USD paid. The existing Codex card projects
an account lifetime snapshot with unknown period/model, unpriced API-equivalent
value, and unknown billed charges. OpenAI distinguishes subscription allowance,
credits, and API-key pricing in its [pricing documentation](https://developers.openai.com/codex/pricing/).

## Claude Code sources

Claude Code exports `claude_code.token.usage` and `claude_code.cost.usage`
through OpenTelemetry. Token categories include input, output, cache read, and
cache creation. Prospective collection needs an explicit telemetry setup for
the environments being measured.

> Cost metrics are approximations.

Source: [Claude Code monitoring](https://code.claude.com/docs/en/monitoring-usage).

For Pro and Max subscriptions, Anthropic's costs page says:

> the session cost figure isn’t relevant for billing purposes

Source: [Claude Code costs](https://code.claude.com/docs/en/costs).

The `/usage` session figure is locally calculated from token counts and pricing.
It is an estimate. It does not establish subscription payments or an invoice.
Local history does not cover other devices or claude.ai. The organization
[Analytics API](https://platform.claude.com/docs/en/manage-claude/claude-code-analytics-api)
is unavailable to individual accounts and has deployment-specific coverage.

Proper Respect's importer accepts a restricted metrics-only OTLP/HTTP JSON
subset. It rejects other metrics in the request, including ordinary Claude
session metrics. A full exporter payload can therefore be incompatible.
See the exact [adapter contract](verification/2026-09-24-claude-native-metrics-adapter.md).

## Acquisition boundaries

No automatic AI usage collector is enabled by these parsers or imports. PostHog
measures Proper Respect application traffic; it supplies no Codex or Claude token
source. Daily GitHub refresh is a separate connection; [#150](https://github.com/keeganmoody33/PROPER-RESPECT/pull/150) handles account-bound consent. Actual
billed charges need billing evidence separate from token observations or estimates.

## Local Codex rollout collection

The [local numeric history collector](codex-local-history.md) reads an explicitly
selected bounded directory on Linux with Node.js 24. It supports genuine
rollout formats, per-response identities, archive replay, inherited-response
exclusion and conservative legacy cumulative differences. Official-format
synthetic fixtures verify the implementation; no real-account acceptance is
claimed. It emits a private JSON review and has no hosted pairing, installation
or recurring collection. The browser connection prototype remains synthetic.
# Codex development connection

The [Mac connection guide](codex-mac-connection.md) describes the new approved-source
helper, signed pairing, durable private sync, replay-safe backfill and disconnect.
Its cloud fixture verification is preparation for the separately approved real
Mac gate. Native account RPC and production deployment remain unaccepted.

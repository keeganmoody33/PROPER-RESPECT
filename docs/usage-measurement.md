# Codex and Claude Code usage measurement

Checked: 2026-10-06. Repository baseline:
`c002560f209174728b9b138a529f814c94e33872`.

Proper Respect already has local Codex and Claude Code parsers, reports, and
private card previews. It has no hosted AI usage connection or public AI usage
projection. Adding a tool to a profile does not require those measurements.

## Existing implementation

The current private preview says:

> Local snapshot · not saved · not publishable. Genuine owner usage is not validated.
>
> Not connected · automatic updates unavailable.

Source: [private usage card](https://github.com/keeganmoody33/PROPER-RESPECT/blob/c002560f209174728b9b138a529f814c94e33872/components/private-usage-card-details.tsx#L65-L67).

| Work | Source and contract |
| --- | --- |
| Codex account and thread parsing | [Codex parser](../src/domain/codex-usage.ts). Snapshots retain exact counts, coverage, and source estimates. They are not additive events. |
| Native Codex capture | [Native adapter](../src/local/codex-native-adapter.ts). Startup remains blocked; no enabled native collector. |
| Claude metrics import | [Selected-file CLI receipt](verification/2026-09-24-claude-selected-file-cli.md). Both `--synthetic` and `--owner-supplied` modes are implemented. |
| Usage and cost report | [Report receipt](verification/2026-09-24-usage-cost-report.md) and [source contract](verification/2026-09-24-usage-cost-source-contract.md). Token observations, source estimates, and API-equivalent valuations stay separate. |
| Exact private cards | [Private projection](../src/domain/private-usage-card.ts) and [local generator](../scripts/private-usage-card-preview.mjs). No application ingestion caller currently saves or publishes this projection. |

The selected-file receipt states:

> `owner-supplied` is a declaration,
> not producer authentication, account ownership or proof of human activity.

Source: [selected-file receipt, lines 15–18](https://github.com/keeganmoody33/PROPER-RESPECT/blob/c002560f209174728b9b138a529f814c94e33872/docs/verification/2026-09-24-claude-selected-file-cli.md#L15-L18).

This corrects the earlier synthetic-only implementation state. The committed
receipt still records synthetic validation and no genuine-file acquisition.
Historical research and receipts retain their original dates and claims.

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

## Hosted connection boundaries

No automatic AI usage collector is enabled by these parsers. PostHog measures
Proper Respect application traffic; it supplies no Codex or Claude token source.
The existing daily GitHub refresh is a different connection.

Before an AI usage connection can appear on a profile, it needs a validated
source, declared account/device/period coverage, private persistence, replay and
revocation behavior, and an explicitly selected public projection. Actual billed
charges need billing evidence separate from token observations or estimates.
The current local preview must not be attached to a public card.

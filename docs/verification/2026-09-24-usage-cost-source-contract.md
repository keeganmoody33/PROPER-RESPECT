# Usage and cost source contract

Researched 2026-09-24 UTC. Offline implementation scope; no genuine source was read.

## Primary documentation

[Claude monitoring](https://code.claude.com/docs/en/monitoring-usage) specifies
`claude_code.token.usage` with `input`, `output`, `cacheRead`, `cacheCreation`
types, and `claude_code.cost.usage` in USD. Its explicit qualification is:
“Cost metrics are approximations.” Default OTLP temporality is delta; cumulative
is configurable. Model and session attributes exist; version inclusion defaults
off. Before 2.1.214, progressive streaming could inflate counters. Metrics can
include identity and attribution labels, so a metrics-only source still requires
sanitization. Cache creation has no documented TTL breakdown in that metric.

[OpenTelemetry data model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/)
defines start/end timestamps, single-writer stream identity, cumulative epochs,
delta ranges, resets and gaps. Dropping attributes without retaining their
identity can merge separate streams. The importer must preserve an opaque identity
for the complete original resource/scope/attribute set, excluding metric category
only when constructing an explicitly aligned category bundle. A session alone
does not identify a process epoch. First cumulative observations are conservatively
baselines; changed start times begin separate baselines. Decreases within an epoch
are unresolved, never clamped. Arrival order is not event order.

[Claude analytics API](https://platform.claude.com/docs/en/manage-claude/claude-code-analytics-api):
“The Admin API is unavailable for individual accounts.” It is not this personal
onboarding route. [Claude costs](https://code.claude.com/docs/en/costs) and the
monitoring documentation do not establish an invoice from local token counters.

[Haiku 4.5 model documentation](https://platform.claude.com/docs/en/models/haiku-4-5/overview)
identifies `claude-haiku-4-5-20251001`, 200K context, and USD per million rates:
input 1, output 5, cache read 0.10, 5-minute creation 1.25, 1-hour creation 2.
[Pricing](https://platform.claude.com/docs/en/about-claude/pricing) distinguishes
batch, platform, geography and caching conditions. A documentation retrieval date
does not establish historical effective dates. The initial report rate is an
explicit same-day documentation valuation scenario, never an automatically
backdated tariff. Unsupported dates/models/conditions remain unpriced.

[Codex app-server documentation](https://developers.openai.com/codex/app-server)
is a public protocol reference, not permission to launch it. Reuse the existing
0.153.4 parser. Account totals lack priceable categories/model/period information;
thread groups also lack established period, tier and disjointness. Preserve their
facts without a valuation. The native startup gate remains
[HOLD](2026-09-23-codex-native-attempt-proposal.md).

## Minimal genuine-sample proposal — HOLD

Preferred first sample: one owner-selected, already-existing sanitized Claude
metrics export, from one explicitly identified Claude Code version at least
2.1.214, one account alias, one device alias, and at most a ten-minute UTC window.
The owner must name the exact regular file before a separate authorization to
read it. No discovery of personal directories and no credentials are requested.
The authorization must supply exact UTC start/end, immutable file identity/hash,
and emitted terminal Claude Code version (or an already supplied version
attestation); no current installation/configuration query is implied. Cumulative
endpoints and their epoch start must be present in that file. An epoch before the
selected window remains an earlier baseline, not ten-minute usage. Missing
endpoints produce baseline-only/unpriced output; no additional file read.
If no metrics export already exists, stop: prospective telemetry requires a
separate configuration and containment review, not enabling it here.

Retain only contract version, synthetic/owner-supplied designation, source/client
version, owner/account/device/session/process aliases, opaque stream identity,
model, documented category quantities, temporality/start/end, capture timestamp,
reporting timezone and declared coverage. Only `claude_code.token.usage` (tokens)
and `claude_code.cost.usage` (USD) are allowed. The closed contract attests
monotonic counters, aligned intervals and disjoint token categories. Its caps are
32 files, 256000 bytes/file and 2048 bundles/batch. Retain a
SHA-256 of sanitized metadata for replay. Cost remains a source estimate. Remove
emails, raw account IDs, organization IDs, repository paths/names, skill/tool/plugin
names, prompts, code, logs, traces, exemplars, credentials and arbitrary resource
attributes before the importer receives the file. Use a stable local namespace
and keyed SHA-256 identities over complete resource, instrumentation scope,
metric identifying properties and attributes before removing values. Keep the
key outside export/report. Retain per-metric identities and a family identity
removing only category/metric-name distinctions; explicitly attest cost alignment.
All identity/alignment claims remain caller-declared, not authenticated. Accept
only canonical millisecond UTC timestamps; do not truncate nanosecond precision.
An incompatible existing sample remains unsupported rather than silently rounded.
Owner-supplied input remains unpriced. Any future pricing-condition evidence needs
a separately specified source; do not add fields or invent OTel attributes. The
default-off synthetic report scenario is outside the evidence hash.

Proposed local destination: a new owner-controlled directory outside Git, with
0700 directory and 0600 source/report permissions, chosen in the authorization.
This CLI writes only stdout; the operator explicitly chooses any private output
file. The later authorization must specify exact destination and private output
handling; permission to read locally does not authorize rendering raw private data
into a cloud conversation. Stored working copies/report remain until explicitly
instructed deletion. Proposed decision after seven days: review whether to delete
only the new working copies/report, never the original export or upstream archive.
No timer, reminder or scheduled deletion is created. Retain a non-private receipt
only if approved.

Validation: inspect schema and caps before private output; compare only an
owner-provided sanitized category manifest in that same selected artifact, if
present under a separately specified manifest wrapper; otherwise source fidelity
remains unverified. The current strict importer accepts no manifest extension.
Native/raw comparison requires separate named-source authorization. Import twice and permute order;
verify replay stability and unresolved conditions; reconcile source estimate
separately; check no file/network/collector writes. One sample demonstrates only
that sample's import. It cannot prove full account coverage, human productivity,
actual charges, historical pricing or automatic updates. Recurrence remains a
separately designed and authorized feature.

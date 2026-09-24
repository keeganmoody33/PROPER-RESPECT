# Bounded Claude native metrics adapter

Dated 2026-09-24 UTC. Source implementation and synthetic verification only.
No genuine Claude export, account, personal configuration or transcript was read.
No Claude process, telemetry, listener, background process, ingestion or deployment
was started. PR68's aligned sanitized-v1 contract remains unchanged.

## Run the synthetic file pipeline

With Node 22.20+ and installed dependencies, create a temporary synthetic key
outside the repository (the key is never part of a report):

```sh
mkdir -m 700 /tmp/proper-respect-native-synthetic-example
node -e 'require("node:fs").writeFileSync("/tmp/proper-respect-native-synthetic-example/key", require("node:crypto").randomBytes(32), {mode: 0o600, flag: "wx"})'
node --no-warnings --experimental-strip-types scripts/claude-native-report.mjs \
  --synthetic \
  --key-file /tmp/proper-respect-native-synthetic-example/key \
  --source-scope synthetic-device \
  --captured-at 2026-09-24T12:00:00.000Z \
  --content-type application/json \
  tests/fixtures/claude-native/tokens.json \
  tests/fixtures/claude-native/cost.json
```

Use a new directory if the example already exists; do not overwrite a key.
`--format sanitized` before the filename emits one strict sanitized capture, with
exactly one input file. That JSON is consumable by `scripts/usage-cost-report.mjs`.
Default output is the private Markdown report. Only stdout is written. Exit 0 is
valid bounded input (possibly only baselines); exit 1 is atomic rejection with no
partial stdout; exit 2 is a report containing quarantined conflicts. Diagnostics
never print filenames, rejected values or raw exceptions.

The example's independent observations are input `9007199254740993` over Unix
nanoseconds `1790244000000000001`–`1790244000000000100` and source-estimated USD
`0.00000000000000000001234567890123456789` over
`1790244000000000004`–`1790244000000000108`. They are deliberately not aligned.
No missing category becomes zero. No native API-equivalent or billed amount is
computed. The exact decimal is the exported JSON representation, not a claim
of precision or correctness beyond the source's floating-point calculation.

The CLI now requires exactly one leading `--synthetic` or `--owner-supplied`
selector. The selected designation enters the sanitizer directly, without
authenticating the producer. See the [selected-file CLI contract](2026-09-24-claude-selected-file-cli.md)
for operator preflights and the separate genuine-file authorization boundary.

## Supported native subset

Public sources inspected September 24 UTC:

- [Claude monitoring](https://code.claude.com/docs/en/monitoring-usage): the two
  metric names, units, category labels, resource service identity, configured
  exporter protocols, temporality, and client caveats.
- [OTLP JSON](https://opentelemetry.io/docs/specs/otlp/#json-protobuf-encoding):
  numeric enums, lowerCamelCase keys and decimal-string 64-bit fields.
- [Metrics schema](https://github.com/open-telemetry/opentelemetry-proto/blob/main/opentelemetry/proto/metrics/v1/metrics.proto):
  monotonic Sum, NumberDataPoint, native interval timestamps, value alternatives.
- [Common schema](https://github.com/open-telemetry/opentelemetry-proto/blob/main/opentelemetry/proto/common/v1/common.proto):
  typed attribute values and instrumentation scope.

This is an explicitly restricted OTLP/HTTP JSON **file/request-body adapter**, not
a conforming universal OTLP receiver. Accept `application/json` (optional UTF-8
charset), strict UTF-8, resourceMetrics/scopeMetrics/metrics/sum/dataPoints,
`service.name=claude-code`, `isMonotonic=true`, numeric temporality 1 or 2 and
nonzero string uint64 start/end with start strictly before end. Accept only
`claude_code.token.usage` with unit `tokens` and known `type`, or
`claude_code.cost.usage` with unit `USD`. A request containing another metric is
rejected in full, including ordinary Claude session metrics. A genuine exporter
may therefore need a separately reviewed local selection step before this subset
can receive its output. No broad live compatibility claim is made.

Accept nonnegative signed64 decimal-string `asInt` or finite numeric `asDouble`,
exactly one. Token doubles must be mathematically integral. Reject unsupported
NaN/infinite values, string doubles, numeric int64/timestamps, unknown timestamps,
nonzero flags, unknown structural fields, protobuf, gRPC and console formats.
OTLP's general requirement to ignore unknown fields does not apply as a claimed
capability of this restricted importer. Exemplar arrays are bounded and discarded;
logs/traces objects reject. Only scalar string/bool/int64/double attributes are
supported; array/kvlist/bytes attributes reject instead of losing stream identity.
Resource/scope droppedAttributesCount must be absent or zero.

Limits: 256,000 input bytes/file, 32 files, 1,024 points/file, 2,048 points/batch;
32 resources and scopes per parent, 128 metrics per scope and attributes per set,
128 exemplars per point; JSON depth 24, 30,000 nodes, 4,096 entries/container,
8,192 decoded characters/string, 256 characters/attribute key, 160 characters per
native numeric token, 128 significant decimal digits, exponent magnitude 324,
650 characters per expanded decimal. Native double range and underflow are
validated; retained arithmetic never round-trips through Number. Sanitized
captures must also fit the file cap. Every rejection is atomic.

## Privacy and identity

`sanitizeClaudeNativeMetrics` hashes complete typed resource attributes/schema
URL, instrumentation scope/name/version/attributes/schema URL, metric name/unit/
monotonic type/temporality and point attributes using domain-separated HMAC-SHA256.
A required local source scope participates in identity. Attribute ordering is
canonicalized; duplicate decoded JSON keys and duplicate attribute keys reject.
The family digest removes only temporality, permitting conservative quarantine
when the same logical family contains mixed temporalities. Epoch start remains
in the observation position so reset overlap can be detected.

Use a random 32-byte key unique to the authorized local source, kept in a private
0600 regular file outside exports/Git. CLI rejects symlink keys, group/other key
permissions, directories and unbounded files. It does not create or persist keys.
The key-scope digest is keyed, not a raw key hash. Key rotation/source-scope
changes create separate nonadditive coverage sets. Missing upstream account,
device or session identity cannot be recovered; this is locally declared source
identity, not authenticated account ownership or complete device coverage.

Raw attribute text, resource/scope labels, emails, account/org/session IDs,
repository names/paths, prompt/code/tool content, credentials and exemplars never
enter the sanitized contract or report. All supported attribute values affect
only keyed identity. Cleartext model retention uses a finite public allowlist,
not a permissive alias regex; unknown models stay null while affecting identity.
Resource service.version is retained only as bounded numeric semver; otherwise
unknown. Only the finite token category, metric labels, exact quantities/time,
client version, sample designation and opaque digests/provenance survive.
There is no raw input hash in exports. A forged sanitized file is not proof that
this sanitizer processed genuine telemetry.

## Reconciliation and report compatibility

The `claude-code-native-metrics-v1` format is a separate scalar lane. Existing
`claude-code-sanitized-metrics-v1`, Codex parsing, `claude` rows and positional
`valuations` retain their contracts. `nativeClaude` is an additive report section;
the current local private card projection consumes this lane, preserving exact
strings and marking owner-supplied origin unverified.

Semantic replay excludes capture time, normalizes decimal encodings and retains
safe capture digests/times. Same-position disagreements and changed metadata
quarantine the full stream. Delta overlaps, cumulative decreases and overlapping
epochs quarantine; mixed temporality conservatively quarantines the full family.
First cumulative points are baselines, new starts independent reset baselines,
and late arrival recomputes the complete supplied batch. Gaps remain explicit;
there is no cross-category alignment, interpolation, subtraction across epochs
or cross-stream grand total. Each report is bounded by its explicitly supplied
inputs; no persistent replay ledger or automatic update service is implied.

Claude's documented cost is an approximation. Before 2.1.214, progressive
streaming could inflate counters; old and unknown versions remain visibly
qualified. Cache-creation TTL is absent from the metric. Native rows remain
unpriced; independent category intervals cannot inherit the old aligned synthetic
valuation. Source merge establishes none of real freshness, invoice accuracy,
owner-account coverage or public-card readiness.

## Later private pilot proposal — HOLD

First gate: the owner must identify an already-existing, explicitly selected
native OTLP/HTTP JSON export produced by Claude Code **2.1.274**, attest that
version and identify its immutable file hash, exact account/device scope and
UTC window of at most ten minutes. No sample is presumed to exist. The local
invocation would call the pure sanitizer with content type `application/json`,
sample `owner-supplied`, the attested capture time, a new private random key and
a local source scope, then pass only the sanitized capture to the report. A
selected-file CLI now exposes that designation explicitly; its synthetic tests
do not authorize a genuine invocation. No network transport or configuration change occurs for an
existing-file pilot. The owner must name exact input, key and 0700 output
directory paths before authorizing a read/write; do not request credentials.

Retain only the two metric families and closed fields above. If the export has
extra metrics or unsupported representation, reject; any local filtering or
future loopback HTTP receiver must be separately implemented/reviewed. If no
existing file exists, this pilot cannot run: prospective telemetry would change
Claude's enable/exporter/protocol/endpoint settings and requires a new concrete
containment and approval proposal. Do not enable it to satisfy this document.

The later pilot authorizes at most 32 explicit files, 256,000 bytes each and 2,048
points over its named window, one account/device, one invocation. No personal
file discovery, auth/config/session/transcript read, Claude launch, real prompt,
backend ingestion, cloud report paste, recurrence or public projection follows.
Store only sanitized outputs privately with 0600 permissions; key remains
separate, raw original unchanged. No automatic cleanup: after the pilot the
owner chooses deletion of only new outputs/key, preserving originals. Opt-out
means stop processing; no background process or changed configuration remains.

Observable checks: confirm selected version/scope without further private reads,
compare exact metrics/timestamps against an owner-supplied bounded manifest,
repeat and reorder only those inputs, verify stable replay and reset/conflict
behavior, scan all outputs/diagnostics for authorized privacy sentinels and
confirm no network/config writes. Source fidelity remains unverified if no
manifest/comparison is authorized. This measures one sample's processing, not
live freshness, whole-account coverage or a deployed meter. No production or
private pilot action is authorized by this proposal.

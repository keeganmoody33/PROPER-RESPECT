# Cursor report adapter handoff

Branch `feat/cursor-report-adapter` starts at current main
`6cf026b11499854b53f8aaae01f9a133df7578dd`. The isolated worktree is
`/workspace/PROPER-RESPECT-cursor`. Delivery is a local commit and a portable
Git patch. Nothing was pushed or published.

This implements supplied-report normalization and a Cursor-owned replacement
proposal. Acquisition, shared pairing, durable sync, generic measurement import,
and hosted integration belong to thread
`01a1127a-5a46-7429-a813-19becb7c40d8`; none of those modules was edited.
This cloud task used visible parallel research, fixture/test, and review threads.
No Cursor application or live account was connected.

## Use the adapter

```ts
import {
  normalizeCursorAdminEvents,
  normalizeCursorAdminSpend,
  normalizeCursorCsv,
} from "../../src/server/cursor-report/normalizer.ts";
import { replaceCursorReport } from "../../src/server/cursor-report/checkpoint.ts";

const work = {
  source: {
    ownerAlias: "selected-owner", accountAlias: "selected-work-account",
    workspaceAlias: "selected-team", sourceAlias: "cursor-admin-events",
    scope: "team-workspace", sample: "owner-supplied",
  },
  capturedAt: "2026-10-06T12:00:00.000Z",
  billingWindow: null,
} as const;

// Strings containing complete JSON responses, not parsed JavaScript numbers.
const report = normalizeCursorAdminEvents(selectedPageTexts, work, {});
const decision = replaceCursorReport(previousCheckpoint, report);
// Only an approved integration may persist decision.checkpoint.

const spend = normalizeCursorAdminSpend(
  selectedSpendPages, work, { pageSize: 100 },
); // selectedSpendPages = [{ page: 1, text: "..." }, ...]

const personal = {
  ...work,
  source: { ...work.source, accountAlias: "selected-personal-account",
    workspaceAlias: null, sourceAlias: "cursor-dashboard-export",
    scope: "personal-account" },
} as const;
const csv = normalizeCursorCsv(selectedCsvText, personal, {
  window: {
    start: "2026-10-01T00:00:00.000Z",
    end: "2026-10-02T23:59:59.999Z", bounds: "inclusive",
  },
});
```

The variables beginning with `selected` represent an integration's explicitly
supplied report contents. The adapter has no paths, filesystem discovery,
transport, auth, credential, login, or network options. Source aliases label a
selected scope; they do not establish provider ownership. Team imports require
a caller workspace label. Personal account reports are account-wide across
machines, with a null workspace label. They are not local usage ledgers.

`CursorReport` is private. Actor emails and provider attribution identifiers
can appear in normalized rows. It is neither a `proper-measurements-v1` capture
nor an authorized public sharing payload. Do not route it through the existing
Codex cumulative-history reconciler or directly into a public card.

## Chosen shape and ownership

The normalizer accepts raw text and context, validates external representations,
and returns allowlisted exact values plus explicit coverage. It reuses the
existing exact JSON decoder and canonical JSON utility through read-only imports.
Those modules were not edited. Known numeric values become exact decimal
strings, absent values remain null, and malformed known values reject the whole
report with a generic error that does not disclose a source payload.

`types.ts` defines account/workspace scope, report windows, event and member rows,
coverage, and adapter limits. `decode.ts` owns bounded numeric/time/CSV decoding.
`normalizer.ts` owns the verified format translations. `checkpoint.ts` owns
Cursor report keys, completeness gating, freshness ordering, and replacement.
Tests and fixtures sit alongside these files. No generic provider framework was
introduced.

The rejected design was to turn Cursor rows into Codex-style cumulative
observations. That would incorrectly treat equal events as replays and would
lose report pagination and replacement ownership. The selected design keeps
provider accounting private and allows the separate integration owner to reuse
the approved connection lifecycle without inheriting cumulative counting rules.

## Exact schema and coverage

See [source contracts](cursor-source-contracts.md) for official field types,
pinned upstream examples, license review, CSV headers, and unsupported formats.
The executable output contract is [types.ts](../../src/server/cursor-report/types.ts).

| Input | Output schema | Completeness / limits |
| --- | --- | --- |
| Official team `/teams/filtered-usage-events` responses | `cursor-admin-events-2026-10-06` | Complete only when unique matching pages cover every page and the authoritative event count, with valid flags and page offsets. Both epoch-ms window bounds are inclusive. |
| Official team `/teams/spend` responses plus explicit request page numbers/size | `cursor-admin-spend-2026-10-06` | Current-cycle snapshot. Unsearched full matching pages can be complete. Searched member-count semantics remain unknown; `reportedMemberCount` preserves the source value and `expectedRows` is null. |
| Observed dashboard CSV headers v1/v2/v3 | `cursor-dashboard-csv-observed-2026-10-06` | Explicit caller account and window. Completeness stays unknown, even when `expectedRows` matches. Billing context is owner-supplied only. |
| Personal/private dashboard JSON, daily analytics, quotas, summaries, legacy request ledgers | Unsupported | Never disguised as an official Admin report. |

Event timestamp and context instants require an explicit timezone and at most
millisecond precision. CSV headers must exactly match a supported generation.
UTF-8 BOM, CRLF, quoted commas and escaped quotes are supported. Date-only and
zone-less timestamps reject. Empty token cells and cost markers `Included`,
`Free`, and `-` remain missing values or labels. Unknown JSON fields never enter
the retained payload or its digest.

API input/cache-write/cache-read/output categories remain distinct. CSV keeps
`inputWithCacheWrite` and `inputWithoutCacheWrite` literally because maintained
upstreams disagree about their interpretation. Its reported total is retained
independently. No inferred category mapping, model pricing, or token sum is
performed. Missing reasoning, local workspace attribution, earliest available
history, invoice reconciliation, and stable event identity are not manufactured.

Model cents, reported charged cents, Cursor fee cents, request units, and CSV
dollar costs stay separate. Spend includes distinct on-demand and overall
amounts, plus dollar limit values. Fractional cents and large counts never pass
through binary floating-point arithmetic. `cashPaid` stays null for every row.
A numeric included-usage cost is not proof of cash paid.

The spend cycle start comes from `subscriptionCycleStart`. The API supplies no
cycle end. A supplied matching start plus a caller end remains an owner-supplied
window assertion. No calendar end is inferred.

## Replacement and replay

`replaceCursorReport` operates on typed normalizer results within a trusted
process. It does not validate arbitrary normalized JSON arriving over transport.
Re-normalize retained raw reports at any untrusted or persisted-data boundary;
a matching digest is integrity consistency, not schema proof or authentication.
Integration must also validate persisted checkpoint metadata and provenance.

Each checkpoint pins one owner/account/workspace/source/sample, schema, filter,
usage window, and billing window. Incoming different scopes or report slots
block. Complete Admin reports replace that slot atomically. Partial pages,
unknown CSV coverage, and searched spend reports cannot create or replace a
checkpoint. Failed parsing yields no replacement proposal, so the caller keeps
the last good checkpoint. Immutable clones prevent later input mutation from
changing retained content.

An identical normalized report is a report replay. A newer replay advances
`observedAt` without adding usage; an older replay cannot move it backward.
Changed content older than that watermark rejects. Different content at the
same capture time is a conflict. The watermark uses caller capture provenance,
not an authenticated provider clock. Row positions and content digests are not
stable event IDs. Legitimate identical events remain separate, including across
adjacent pages.

Complete means the supplied pagination matched. It does not prove an atomic
upstream snapshot, complete lifetime coverage, or permanence of a changing
report. Event pages, spend snapshots, CSV, personal dashboards, and other
sources can overlap. The adapter emits no totals and never adds those views.

## Bounds and checks

Each normalization accepts at most 256,000 UTF-8 source bytes across all pages,
16 pages, and 1,000 returned rows. Selected event/export windows span at most
31 inclusive days, an adapter policy rather than a claimed provider retention
limit. The existing JSON decoder additionally bounds nesting, nodes, strings,
and array/object sizes. Decimals have at most 128 significant digits and bounded
decimal expansion. Source text fields are allowlisted and capped at 256
characters. There is no unbounded acquisition loop or recurring collector.

The normalized representation has fixed row fields and bounded values, but its
JSON can be larger than the source text. The integration owner must enforce its
own transport size limit without splitting a complete report into additive
partial snapshots. The existing local-history transport contract does not
accept this report schema.

Focused command, using the already installed Node 24 runtime:

```sh
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/server/cursor-report/*.test.mjs
```

Final result: **47 tests passed, 0 failed**. Tests cover exact counts/costs,
missing fields, report scope, inclusive boundaries, duplicate preservation,
pagination and search ambiguity, all three observed CSV layouts, malformed
inputs, byte/row/page/window limits, and replacement/replay/freshness conflicts.
The verification receipt records independent review dispositions.

Project dependencies and a TypeScript compiler are absent. No dependencies were
installed because this task forbids installation. Full `npm run typecheck`,
`npm run lint`, and `npm test` remain integration checks. The new `.test.mjs`
tests run with Node explicitly and are not added to the shared package scripts.

After approved integration in an environment with existing dependencies, run
the focused command plus the project checks. A live Cursor connection and
historical retention proof require separately authorized provider acquisition.
Fixture results establish neither live access nor a production release.

## Apply the delivery

Within the same repository, cherry-pick the delivery commit reported in the task
outcome. For another checkout at the named base, apply the delivered patch:

```sh
git am /path/to/cursor-report-adapter.patch
```

The portable file is generated with `git format-patch -1 --stdout`; it contains
only the Cursor directory, this handoff, the source-contract document, and the
verification receipt. No push or PR was authorized.

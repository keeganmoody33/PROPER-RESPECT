# Cursor integration with the existing collector

Compared local `e168e8d5a91ad31cf55374ce7ccbb483c1aeff32` with
[PR #157](https://github.com/keeganmoody33/PROPER-RESPECT/pull/157) at
`a6c670b6fc71b418d608c75d612c06112195a701`. The canonical integration thread is
`01a114e2-3095-74dd-a6b0-ac5e3728e0e3`. Its reported local `17f8a52` is not an
object in this checkout; compatibility below is verified against the published
PR head, not that unavailable local commit.

| Decision | Implementation and reason |
| --- | --- |
| Keep | Real-format Admin events/spend and observed CSV v1/v2/v3 normalizers, exact source values, duplicate rows, coverage, billing and private scope. |
| Keep | PR #157's fixture parser and sole shared grant, delivery, outbox, receiver, receipt and durable checkpoint lifecycle. |
| Keep privately | Cursor replacement preflight; it gates complete Admin reports and freshness. It neither advances nor replaces the shared durable checkpoint. |
| Drop from integration | An additional receiver, persistence layer, cumulative Cursor ledger, intermediate fixture CSV conversion or inferred charges. No such components are added. |
| Conflict resolved | A pure bridge emits only approved metric families into the existing strict review schema. The original rich report stays private and separate. |
| Remaining limitation | The shared review cannot represent workspace/filter/billing attribution, ambiguous CSV input columns, cache-write tokens or source costs. It has partial historical coverage and unverified account identity. |

## Exact bridge contract

`projectCursorCollectorReport` accepts a trusted normalizer result, an explicit
complete-supplied-file assertion, the approved connection's pinned source ID,
its selected half-open window, its allowed metrics, and the actual shared
`cursorCompleteReportSchema.parse` validator. It acquires and persists nothing.
Re-normalize raw text before using persisted or otherwise untrusted report JSON.

`cursorCollectorSourceId(report)` hashes source/account/workspace/sample aliases,
schema, filters, identity basis and billing context. Pin that ID in the shared
descriptor during approval. Pass the approved descriptor's ID to projection;
do not recompute and substitute it after approval. A hash does not authenticate
a Cursor account. One pinned source belongs to one connection, since the shared
receiver replaces views by connection and window. A changed source/filter/schema
or billing context requires a separately approved descriptor. `reportId` alone
cannot separate receiver slots.

| Source field | Shared metric | Behavior |
| --- | --- | --- |
| Admin `tokens.input` | `input_tokens` | Exact reported integer; CSV input remains null because its two literal columns have unresolved semantics. |
| `tokens.cacheRead` | `cached_input_tokens` | Exact reported integer, separate from input. |
| `tokens.output` | `output_tokens` | Exact reported integer. |
| CSV `tokens.total` | `total_tokens` | Exact source total; no summation. Admin total stays null. |
| Request billing units | `requests` | Null; fractional units and the presence of a row do not establish request counts. |
| Any normalized cost field | `usage_cost_usd` | Null; source charges, fees and CSV costs are not asserted to be the contract's `SOURCE_COST_ESTIMATE`. |

All exact source costs and excluded token categories remain unchanged in the
original private report. The returned `omitted` list makes projection loss
explicit. Raw labels, emails, provider IDs, aliases, billing metadata and rich
coverage do not enter the shared review. Do not upload the private report as
part of this delivery or put it in a public card.

Projection supports complete Admin event pagination and complete supplied CSV
files. CSV historical completeness remains unknown. Partial Admin reports and
all spend snapshots reject. Wire `complete: true` means a full supplied view,
while wire `coverage: "partial"` preserves unknown historical coverage. Empty
reports establish no measured zero. Duplicate events produce distinct ordinal
metric rows; ordinal IDs are scoped to a complete report, not stable event IDs.

The selected approved window must be contained in the normalized inclusive
window and span at most seven days. An inclusive source end at
`23:59:59.999Z` corresponds to exclusive `00:00:00.000Z` the next day. A caller
may explicitly select a contained shorter window; rows outside it are disclosed
as omitted. No automatic splitting, trimming or addition of overlapping views
occurs. The original 31-day normalization limit is unchanged.

## Integration step

Cherry-pick the local Cursor commits onto the integration owner's branch. Only
Cursor-specific files and documentation are changed; shared modules stay with
their owner. After the existing approval gate, use the same grant to project
and build a delivery:

```ts
import { cursorCompleteReportSchema, buildReviewDelivery } from "../../domain/collector-contract.ts";
import { projectCursorCollectorReport } from "./collector-bridge.ts";

const projection = projectCursorCollectorReport(normalizedReport, {
  reportId: selectedReportId,
  sourceId: approvedGrant.descriptor.sourceId,
  window: approvedGrant.window,
  allowedMetrics: approvedCursorMetrics,
  suppliedFileComplete: true,
}, value => cursorCompleteReportSchema.parse(value));

const delivery = buildReviewDelivery({ grant: approvedGrant, review: projection.review });
// Hand delivery to the existing companion/outbox/receiver and verify its receipt.
// Parsing or building this object commits no evidence and creates no grant.
```

At approval, use `cursorCollectorSourceId(normalizedReport)` for the descriptor's
source ID. Context (`PERSONAL`/`WORK`) and owner association stay in that existing
descriptor. Keep the private rich report and projection-loss explanation within
the separately authorized retention policy. Transport grants, revocation and
public sharing remain the existing integration owner's responsibility.

The Node tests use the actual shared contract when present. For isolated
verification against the pinned PR worktree:

```sh
CURSOR_COLLECTOR_CONTRACT_ROOT=/workspace/PROPER-RESPECT-cursor-contract \
  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types \
  --test src/server/cursor-report/*.test.mjs
```

No fixture result proves a live Cursor connection, provider ownership, authorized
historical retention or acceptance on the owner's Mac.

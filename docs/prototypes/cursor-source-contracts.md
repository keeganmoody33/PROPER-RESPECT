# Cursor report source contracts

Reviewed October 6, 2026, for the bounded Cursor report prototype on
`feat/cursor-report-adapter`, based on
`6cf026b11499854b53f8aaae01f9a133df7578dd`.

This is public documentation and upstream format research. The adapter accepts
supplied reports and synthetic fixtures; it does not connect to Cursor. Passing
fixture tests establishes normalization behavior, not a live connection,
authenticated ownership, complete account history, or a deployed integration.

## Sources and review scope

| Source | Revision | Use in this prototype |
| --- | --- | --- |
| [Cursor Admin API](https://cursor.com/docs/account/teams/admin-api) | Public page reviewed October 6, 2026; no immutable documentation revision supplied | Official team event and current-cycle spend contracts |
| [Tokscale Cursor session formats and tests](https://github.com/junhoyeo/tokscale/blob/d4d1c751856e25913bce97bfbd7b254308863239/crates/tokscale-core/src/sessions/cursor.rs) | `d4d1c751856e25913bce97bfbd7b254308863239` | Observed CSV headers, representative rows, token and cost interpretation |
| [Tokscale dashboard report transport](https://github.com/junhoyeo/tokscale/blob/d4d1c751856e25913bce97bfbd7b254308863239/crates/tokscale-cli/src/cursor.rs) | Same pin | Evidence of the preferred JSON report shape and bounded pagination |
| [CodexBar Cursor documentation](https://github.com/steipete/CodexBar/blob/bba06ff6f3a1b97594e6c541dd9d5b12085d413a/docs/cursor.md) | `bba06ff6f3a1b97594e6c541dd9d5b12085d413a` | Account-wide scope and distinction between dashboard and local usage |
| [CodexBar dashboard models](https://github.com/steipete/CodexBar/blob/bba06ff6f3a1b97594e6c541dd9d5b12085d413a/Sources/CodexBarCore/Providers/Cursor/CursorUsageEventsFetcher.swift) | Same pin | Observed private event envelope, optional fields and pagination cautions |
| [CodexBar CSV reader](https://github.com/steipete/CodexBar/blob/bba06ff6f3a1b97594e6c541dd9d5b12085d413a/Sources/CodexBarCore/Providers/Cursor/CursorLocalCSVReader.swift) | Same pin | Independent CSV comparison, including a token-interpretation disagreement |

The pins were checked with public Git references and temporary public repository
reads. Tokscale's pinned commit is dated October 5, 2026; CodexBar's is dated
October 6, 2026. Neither repository was installed or run. This review inspected
report-facing models, parsers, examples, documentation, and root licenses; it
does not certify every dependency or acquisition path in either project.

[Tokscale's root license](https://github.com/junhoyeo/tokscale/blob/d4d1c751856e25913bce97bfbd7b254308863239/LICENSE)
is MIT, copyright 2025 Junho Yeo.
[CodexBar's root license](https://github.com/steipete/CodexBar/blob/bba06ff6f3a1b97594e6c541dd9d5b12085d413a/LICENSE)
is MIT, copyright 2026 Peter Steinberger. The implementation is independently
written. Source contracts informed the synthetic fixtures; upstream acquisition,
credential extraction, and implementation code were not copied. Root license
review is not a dependency-wide license audit.

## Official team Admin API

The official surface is team-scoped at `https://api.cursor.com`. It uses a team
API key through Basic authentication. This prototype neither creates a key nor
makes an authenticated request. Personal dashboard sessions are a separate
surface and are not interchangeable with an Admin API key.

### Event report

`POST /teams/filtered-usage-events` accepts `startDate` and `endDate` as epoch
milliseconds, **both inclusive**. Consecutive non-overlapping windows therefore
need the preceding end to be one millisecond before the following start. The
official page recommends polling at most hourly and lists a limit of 60 requests
per minute per team. This adapter performs no polling.

`page` is one-based, defaulting to 1. `pageSize` defaults to 100 and has a maximum
of 1000. Filters include numeric `userId`, `email`, `serviceAccountId`,
`cloudAgentId`, `automationId`, and `hostingType`; multiple filters combine with
AND. Hosting values are `CLOUD`, `SELF_HOSTED`, `SELF_HOSTED_POOL`, and
`SELF_HOSTED_MACHINE`. An invalid hosting value is an error. Hosting filtering
covers inference spend, not compute on an owner's machines.

The documented envelope has `usageEvents`, `totalUsageEventsCount`, `period`
(`startDate`, `endDate`), and `pagination` (`numPages`, `currentPage`, `pageSize`,
`hasNextPage`, `hasPreviousPage`). A page is evidence for that page, not proof
that all pages or an atomic snapshot were obtained.

| Event field | Documented type / unit | Preservation rule |
| --- | --- | --- |
| `timestamp` | String containing epoch milliseconds | Normalize the instant; never reinterpret as seconds |
| `userEmail` | String | Private actor attribution, not authenticated adapter ownership |
| `model`, `kind` | Strings | Preserve supplied names and billing category |
| `maxMode` | Boolean | Preserve independently of billing category |
| `requestsCosts` | Number, request units | Keep distinct from event count, tokens, and money |
| `isTokenBasedCall`, `isChargeable`, `isHeadless` | Booleans | Preserve source flags; no inferred flag values |
| `tokenUsage` | Optional object | Missing token detail remains missing |
| `tokenUsage.inputTokens`, `outputTokens`, `cacheWriteTokens`, `cacheReadTokens` | Numbers, tokens | Keep categories separately |
| `tokenUsage.totalCents` | Number, model cost in cents | Keep distinct from the reported charge |
| `tokenUsage.discountPercentOff` | Optional number, percent | Preserve without recalculating provider costs |
| `chargedCents` | Number, cents | Dashboard reconciliation amount, including an applicable Cursor Token Rate |
| `cursorTokenFee` | Optional number, cents | Preserve separately; absence does not establish a zero fee |
| `serviceAccountId`, `serviceAccountName` | Optional strings | Omitted for human events |
| `cloudAgentId`, `automationId` | Optional strings | Omitted outside their respective attribution scopes |
| `conversationId` | Optional string | Conversation join key; not a unique usage-event ID |

The documented billing category examples include `Usage-based` and
`Included in Business`. Token details are documented for token-based calls;
historical request-based events can lack them. A documented example has
`isChargeable: false` with a positive `chargedCents`. Consequently, a reported
charge or model cost is not sufficient evidence of out-of-pocket cash paid.
The adapter preserves the source amounts and leaves `cashPaid` null.

The official advice is to reconcile event costs using `chargedCents`, rather
than substituting `tokenUsage.totalCents` or recomputing discounts and fees.
Reconciliation and totals are outside this parser's scope.

### Current-cycle spend report

`POST /teams/spend` reports the current billing cycle. Its query supports
`searchTerm`, `sortBy` (`amount`, `date`, `user`), `sortDirection` (`asc`, `desc`),
and pagination. The documented defaults are sorting by date descending and
page 1. A search restriction must remain visible in report scope; a filtered
member report does not establish whole-team coverage.

The docs do not define whether `totalMembers` is filtered by `searchTerm`.
Searched reports preserve it as `reportedMemberCount`, but their expected row
count stays null. Even all supplied searched pages leave completeness unknown
and cannot authorize a complete-report replacement. Missing searched pages remain
partial. Synthetic fixtures do not resolve live search-count semantics.

The envelope contains `teamMemberSpend`, `subscriptionCycleStart`,
`totalMembers`, and `totalPages`. The example expresses the cycle start in epoch
milliseconds. **No billing-cycle end is supplied by this response.** Keep it
unknown; do not manufacture an end from a calendar month or assume a 30-day
cycle.

| Member field | Unit / meaning |
| --- | --- |
| `userId` | Encoded string ID, sharing the team-members identifier namespace |
| `name`, `email`, `role` | Member presentation and attribution strings |
| `spendCents` | Current-cycle on-demand amount; excludes included usage |
| `overallSpendCents` | Current-cycle amount including on-demand and included usage |
| `fastPremiumRequests` | Usage-based premium request count |
| `hardLimitOverrideDollars` | Dollar limit override; 0 means no override |
| `monthlyLimitDollars` | Dollar limit, or null when absent |
| `effectivePerUserLimitDollars` | Enforced dollar limit derived by Cursor |

The official page records additional precision for `spendCents` and
`overallSpendCents` on June 4, 2026. Cent amounts can be fractional. Do not round
them to integers, convert them through an assumed currency precision, or label
included consumption as cash paid. The prototype retains accepted decimal
values as strings and never adds spend snapshots to event reports.

The official daily-usage and audit endpoints have their own range restrictions.
Their documented 30-day maximum request ranges do not establish a retention
limit or maximum range for filtered usage events. This review found no official
guarantee of the earliest available usage-event date.

## Observed personal dashboard CSV

CSV support is based on maintained examples, not a published official schema
guarantee. Tokscale describes three generations in its pinned session parser:

```text
v1: Date,Model,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Cost,Cost to you
v2: Date,Kind,Model,Max Mode,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Cost
v3: Date,Cloud Agent ID,Automation ID,Kind,Model,Max Mode,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Cost
```

Headers, not column count alone, identify the format. Quoted fields can contain
commas: a representative `Kind` value is `Errored, No Charge`. Examples also
include `Included` and `On-Demand`; `Max Mode` uses `Yes` and `No`. Cloud-agent
and automation attribution can be empty. None of these columns establishes a
unique usage-event ID.

`Date` examples include UTC ISO instants with millisecond precision. Date-only
rows and zone-less timestamps occur in upstream compatibility tests and parser
branches; those branches do not establish official timezone or event-time
semantics. This bounded adapter requires an unambiguous supported instant rather
than inventing a timezone or a noon observation.

Token columns contain counts, but their labels require care. Current Tokscale
treats `Input (w/ Cache Write)` as cache-write tokens and
`Input (w/o Cache Write)` as uncached input, both disjoint from cache reads and
output. Its representative v2 row sums those four buckets to `Total Tokens`.
CodexBar's pinned CSV reader instead computes cache writes by subtracting the
second input column from the first. These upstream interpretations disagree.
An example can support one mapping without proving every export generation uses
it. The adapter therefore preserves both input columns literally as
`inputWithCacheWrite` and `inputWithoutCacheWrite`; it does not silently adopt
either subtraction or a universal category mapping. `Total Tokens` stays a
separate source value. The official JSON token field names have their own
documented meanings.

Upstream examples interpret numeric `Cost` and legacy `Cost to you` as dollar
amounts, with or without a `$` prefix. CSV itself carries no currency field.
`Cost` and `Cost to you` stay separate. A modern row can have `Kind=Included`
and a numeric `Cost`, so neither a numeric cost nor a billing label establishes
cash paid. Nonnumeric markers such as `Included`, `Free`, and `-`, and blank
cells are preserved as labels or missing values. They do not become known
numeric zero. An explicit numeric zero remains known zero.

A CSV has no embedded account identity, workspace identity, billing-cycle
window, capture time, pagination, or completeness guarantee. Caller assertions
must supply provenance separately. The first and last row times do not prove
an export's requested window, gaps, or account lifetime coverage. Multiple
identical rows may be legitimate and are preserved.

## Private dashboard JSON: deliberately unsupported

Maintained tooling observes
`POST https://cursor.com/api/dashboard/get-filtered-usage-events`, with
`usageEventsDisplay` and `totalUsageEventsCount`. Its report-facing models see
epoch-ms timestamps, model and kind, token details, request costs, reported
charges, optional ownership and attribution. Private `kind` values can be
enumeration names such as `USAGE_EVENT_KIND_USAGE_BASED`, unlike the Admin API's
human-readable categories. Numeric fields may arrive as strings.

Tokscale now prefers this JSON cache and retains CSV compatibility. CodexBar
documents exact omitted-array empty/terminal envelopes and removal of only
page-boundary overlap justified by the reported count; equal events included
in that count remain separate. These observations are valuable cautions, not
official stability guarantees. No stable event ID or guaranteed historical
retention contract was established.

Personal summary, identity, and legacy request usage are observed at
`/api/usage-summary`, `/api/auth/me`, and `/api/usage?user=ID`. Summary windows
and budgets are separate from event history and include team/personal
distinctions. No private endpoint, login, local authentication store, browser
cookie, credential refresh, or extraction path is implemented here. The
normalizer deliberately rejects private JSON rather than treating it as an
official Admin response.

## Scope, coverage, and integration boundary

Cursor personal reporting is remote, account-wide usage across machines. A
cached dashboard export is still that remote report; it is not a local
Codex-style usage ledger. This distinction affects identity, retention, overlap,
and report replacement.

The adapter produces private, allowlisted normalized rows with caller-supplied
owner/account/workspace aliases. `identityBasis` remains
`owner-supplied-unverified`: a fixture label, file path, current login, or report
hash does not authenticate historical ownership. Preserve personal and work
scope independently. A team import requires a caller-supplied workspace label;
its provider identity remains unverified. Personal imports have no workspace
label. Billing-window ends can remain unknown. Unknown provider fields are not
a payload-retention escape hatch.

Known accepted numeric values are retained as decimal strings; absent values
remain null. Missing token, money, attribution, and window coverage remains
explicit. Report completeness distinguishes provider pagination, a caller's
export assertion, and an unspecified export. An asserted complete CSV is still
an assertion. Complete supplied pages do not prove an atomic source snapshot
or visibility of history that Cursor did not expose.

Report digests describe allowlisted content. Row/page positions describe this
report only. Neither is a stable provider event ID, replay key, account proof,
or permission grant. Never discard legitimate identical rows or globally dedupe
events on timestamp, model, token counts, conversation ID, or content hash.

The Cursor module owns a pure complete-report replacement proposal and its
checkpoint keys and freshness watermark. It reconciles one scope/window,
retains a last good report on failure, and prevents partial pages from erasing
retained coverage. It does not persist reports or emit totals. Event reports,
spend snapshots, CSV, personal dashboard data, and other
provider sources can overlap; do not add them together without a separately
established reconciliation contract. Shared Codex acquisition, pairing,
durable synchronization, and hosted measurement integration remain outside this
Cursor module.

Historical retention, a real connection, live connector installation on the
user's computer, credential creation,
backend configuration, production deployment, and public sharing require their
own authorized work. No such operation is proved or enabled by this document
or its synthetic fixtures.

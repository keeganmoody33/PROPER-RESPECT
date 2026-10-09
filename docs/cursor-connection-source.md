# Cursor supplied complete reports

The Cursor adapter accepts an approved, supplied CSV file. It performs no account
login, HTTP request, cookie read, credential extraction or filesystem discovery.
The caller supplies the file contents after the shared connection's approval
check. This is a second accounting policy for the shared pairing, outbox, chunk,
receipt and disconnection lifecycle. Codex cumulative counters do not interpret
Cursor report rows.

## Official source limits

The existing [source research](003-evidence-surfaces.md#current-product-paths-and-official-references),
checked September 18, quotes Cursor's official
[Admin API](https://cursor.com/docs/account/teams/admin-api) as retrieving daily
usage metrics for a team. That establishes a team-scoped documented capability.
It does not establish this owner's plan, admin role, permitted key, personal
account access or complete historical team coverage.

On October 6, public requests to the official Admin API and
[account usage documentation](https://cursor.com/docs/account/usage), including
the legacy docs hostname, returned HTTP 403 from this environment. No account API
or authenticated endpoint was contacted. This pass therefore does not assert a
current Admin API response schema, pagination contract or dashboard CSV format.

For personal usage, the default is a file the owner supplies through an approved
export or evidence path. If their Cursor dashboard offers an export, the owner
can select it without copying cookies or tokens into Proper Respect. Export
availability and permissions still need verification for that account. No
universal personal API is claimed. The parser below supports an explicit fixture
format; accepting a raw Cursor dashboard export remains a compatibility gate.
A future team API adapter also needs authorized team access, documented metric
semantics, timezone handling and proven complete pagination.

## Supported CSV fixture

Column names are case-sensitive. Columns may appear in any order. `timestamp`
and at least one numeric column are required. All other supported columns are
optional. Unknown or duplicate headers reject the file.

| Column | Meaning accepted by this adapter |
| --- | --- |
| `timestamp` | UTC ISO timestamp with `Z`, at most millisecond precision, inside the approved half-open window |
| `model` | Optional source label decoded only to validate CSV; discarded before the review leaves the adapter |
| `requests` | Explicitly supplied native per-row request count; never inferred from the presence of a row |
| `input_tokens` | Supplied native input token count |
| `cached_input_tokens` | Supplied native cached input count; not added to input tokens |
| `output_tokens` | Supplied native output token count |
| `total_tokens` | Supplied native total; never derived from other columns |
| `usage_cost_usd` | Supplied source usage-cost estimate in USD; no billed charge, subscription payment or API-equivalent estimate is accepted or calculated |

```csv
timestamp,model,requests,input_tokens,cached_input_tokens,output_tokens,total_tokens,usage_cost_usd
2026-10-01T01:00:00Z,"synthetic, model",2,100,40,25,125,0.125
2026-10-01T02:00:00Z,synthetic-model,,0,,,0,
```

Numbers remain exact strings. Integer quantities allow up to 128 digits. USD
estimates allow up to 128 integer digits and 18 fractional digits. The adapter
removes trailing decimal zeroes without converting through JavaScript numbers.
`0.0100` becomes `0.01`; the value is unchanged. Negative numbers, exponent
notation, leading integer zeroes, spaces, currency symbols and placeholder words
reject. A blank cell or absent numeric column becomes `null`. Explicit `0` stays
`"0"`. Missing requests never become one request, and missing costs never become
zero dollars.

Quoted fields support escaped double quotes, commas, LF and CRLF. A leading UTF-8
BOM is accepted. Unclosed quotes, characters after a closing quote, wrong column
counts and extra blank records reject. Input is bounded to 256,000 UTF-8 bytes,
1,000 source rows and 1,024 characters per field. The shared contract limits the
selected window to seven days. Local-time and offset timestamps reject; a future
export conversion must establish the source timezone before converting it.

## Review and replacement

```ts
const review = parseCursorCompleteReportCsv({
  csv: approvedSuppliedCsv,
  reportId: "owner-supplied-report-1",
  source: {
    provider: "cursor",
    kind: "owner-supplied-report",
    accountAlias: null,
    sample: "unknown",
  },
  window: { start: "2026-10-01T00:00:00Z", end: "2026-10-03T00:00:00Z" },
  complete: true,
});
```

The resulting `cursor-complete-report-v1` review has `coverage: "partial"`.
`complete: true` is an explicit declaration that the entire supplied file was
provided, not proof of account-wide or team-wide history. Header-only complete
files have no rows and establish no measured zero. The adapter cannot detect a
provider export that silently omitted otherwise valid records.

Each source row produces separate allowlisted metric rows. Ordinal row IDs keep
equal source rows distinct. Each quantity has `NATIVE_QUANTITY`; only the
`usage_cost_usd` family has `SOURCE_COST_ESTIMATE`. Raw model labels, account
addresses, prompts and owner context do not appear in the review. Approval must
cover its declared metric families before the shared delivery contract accepts it.

`acceptCursorReportCsv` validates the entire supplied file before constructing a
replacement. `replaceCursorCompleteReport` returns a replacement view for the
same source and exact window. Its retained list must belong to one approved
connection. A failed parse or incomplete declaration leaves that prior list
unchanged. Distinct overlapping windows remain separate report views and are
never summed. Durable receiver acceptance still requires the complete validated
delivery and matching receipt; parsing a CSV does not commit it.

The authenticated Proper Respect owner and their personal/work association live
in the shared grant. They do not verify the historical Cursor account represented
by a file. Pairing, hashes and exact numeric parsing supply no account proof.
Sync retains private evidence only. Public disclosure requires the existing
explicit review and publication gate.

## Fixture verification

`src/local/cursor-report-adapter.test.ts` exercises independent synthetic CSV
input, escaping, equal rows, exact large values, unknown and zero values,
unsupported source and timestamps, completeness and input bounds, failed
replacement and overlapping report views. These checks establish the supplied
fixture contract. They do not establish raw Cursor export compatibility, live
team access or real Mac acceptance.

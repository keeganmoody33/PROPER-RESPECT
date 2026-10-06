# Cursor report adapter verification

Inspected `origin/main` and created `feat/cursor-report-adapter` from
`6cf026b11499854b53f8aaae01f9a133df7578dd`. The accepted `/workspace/PROPER-RESPECT`
checkout remains on `work`. All changes are Cursor-specific new files.

## Review dispositions

Independent source and implementation review ran in visible parallel threads.
The following dispositions were recorded before their implementation changes.

| Finding | Disposition | Evidence / action |
| --- | --- | --- |
| Uneven pages can compensate for a short earlier page and falsely appear complete | Fix now | Reject rows beyond the remaining page offset; full reports must have the expected count on every page. Add events and spend regressions. |
| Email and service-account `*` were interpreted as wildcards | Fix now | The official wildcard contract applies to cloud-agent and automation filters. Match the other fields exactly. |
| Caller billing windows can claim source-reported provenance for formats without cycle fields | Fix now | Events and CSV accept owner-supplied billing assertions only. Spend can establish its reported cycle start. |
| Search-filtered spend count semantics are not officially defined | Fix now | Preserve the search filter and reported member count, but leave the expected filtered count unknown. Full searched pages cannot establish complete-window replacement. |
| Documentation promises unknown team workspace labels despite required alias | Documentation correction | A team import requires a caller scope label. The provider workspace identity is unverified. Personal imports use a null workspace. |
| Converting a discount to Number rounds a value just above 100 down to 100 | Fix now | Compare the exact normalized whole/fraction parts. Add a precision regression before changing the check. |
| A newer identical replay leaves an older freshness timestamp and permits stale changed content | Fix now | Advance a provider-owned observed-at watermark on newer replays, preserving the retained content. Compare changed reports with that watermark. |
| Timezone offsets can normalize outside the supported UTC year range | Fix now | Reject offset-converted instants before 1970 or after year 9999. Add lower/upper offset regressions. |
| Pagination cannot prove an atomic upstream snapshot | Retained limitation | Complete means all reported pages/counts matched for the supplied report. It does not prove account-wide lifetime coverage or stable pagination during a live fetch. |

These are findings in this unpublished local adapter, corrected before handoff.
No remote issue or review comment was posted under the no-publication constraint.

## Validation

The focused checks use the already installed Node 24 runtime. No package,
native helper, plugin, or provider application was installed. Full repository
typecheck, lint, and Vitest checks require the missing project dependencies and
were not run. The handoff gives the integration owner those pending commands.

Final focused results are 47 passed and 0 failed. The exact delivery commit is
reported in the task outcome. All inputs are original synthetic fixtures, including invalid
boundary cases. Tests establish parsing and replacement behavior only.

No live Cursor connection, account login, credential creation, persistent grant,
backend configuration, production deployment, push, PR, or public sharing was
performed. Shared Codex acquisition, pairing, durable synchronization, generic
measurement projection, and integration modules were neither duplicated nor edited.

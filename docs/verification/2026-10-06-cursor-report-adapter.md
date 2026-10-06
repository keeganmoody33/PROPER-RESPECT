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
| Dependency-enabled lint found three unused omitted-field bindings | Fixed | Express omitted canonical fields as undefined, which canonical JSON already excludes; filter the test-only position key directly. Typecheck, lint and all Cursor tests pass after this cleanup. |
| Receipt table grouped the initial Vitest run under post-cleanup checks | Documentation correction | Identify the full run as the initial phase at `5729cbd`; no full-suite success is claimed after the denied temporary-root setup. |
| Pagination cannot prove an atomic upstream snapshot | Retained limitation | Complete means all reported pages/counts matched for the supplied report. It does not prove account-wide lifetime coverage or stable pagination during a live fetch. |

These are findings in this unpublished local adapter, corrected before handoff.
No remote issue or review comment was posted under the no-publication constraint.

## Validation

The initial focused checks used the already installed Node 24 runtime. The
initial pass interpreted the installation restriction broadly and deferred
repository dependencies. The parent clarified that ordinary cloud repository
dependencies are authorized; only live connector installation on the user's
computer was restricted. No reviewer rejected dependency installation.

`npm ci --no-audit --no-fund` first failed with `ENOENT` creating
`/home/agent/.npm/_cacache`. The successful command used a cache within the
writable worktree:

```sh
npm ci --cache /workspace/PROPER-RESPECT-cursor/.cache/npm --no-audit --no-fund --loglevel=error
```

It installed 448 pinned packages. The package and lock files remain unchanged.
No live connector, native helper, provider application, credential, or backend
was installed or configured.

| Validation check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed, no warnings |
| Separate Cursor Node tests | 47 passed, 0 failed |
| Six Node-script test files from `npm test`, run separately | 122 passed, 0 failed |
| Initial full `npm test` Vitest phase at `5729cbd` | 1,938 passed, 50 failed, 2 skipped; three unchanged test files failed |

The Vitest failures occurred in `src/local/codex-account-capture.test.ts`
(33), `src/local/codex-native-adapter.test.ts` (13), and
`src/server/retained-product-evidence.test.ts` (4). Independent inspection
confirmed all affected tests and shared modules are unchanged from the base.
Both `/tmp/.git` and `/workspace/.git` are environment-provided read-only
directories. Existing private-capture/evidence guards reject every synthetic
fixture under those Git-marked ancestors. This is an observed filesystem
precondition failure, not a demonstrated Cursor regression. The original
`npm test` stopped before its Node-script phase, so that phase was run directly.

An attempt to create a clean test root used per-command sandbox write access
for `/var/tmp/proper-respect-cursor-validation-5729cbd`. The exact setup command
`mkdir -m 700 /var/tmp/proper-respect-cursor-validation-5729cbd` returned
`Read-only file system`. The shell continued after failed setup; the attempted
`TMPDIR` rerun executed no tests and is excluded from validation. No escalation,
alternative outside-root write, Git-marker removal, guard change, or repository
file transfer followed that denial. A fully passing Vitest run needs an
environment with an authorized writable temporary path outside Git ancestry.

Final focused results are 47 passed and 0 failed. The exact delivery commit is
reported in the task outcome. All inputs are original synthetic fixtures, including invalid
boundary cases. Tests establish parsing and replacement behavior only.

No live Cursor connection, account login, credential creation, persistent grant,
backend configuration, production deployment, push, PR, upload, repository file
transfer, or public sharing was performed. Shared Codex acquisition, pairing,
durable synchronization, generic measurement projection, and integration modules
were neither duplicated nor edited. The isolated branch remains local.

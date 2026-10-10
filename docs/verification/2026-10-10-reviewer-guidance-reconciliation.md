# Reviewer guidance after the collector merges

Inspected October 10: main `563e5fd0fc47fbc5163f5145a5ebec81d1003d85`,
policy PR165 previously at `a40cc700b3c5d12642f6a1b764a0a34a13e84743`.
PR157 merged at `4b9101d8555d83afee17dbc4ba260e1ea6b47c31`; PR158 merged
at current main. This update incorporates that main history into the existing
policy candidate without reproducing product fixes from PR173/174.

## Request source and disposition

The supplied comments are present and authored by `cursor[bot]`:

- [PR173 comment 6090569654](https://github.com/keeganmoody33/PROPER-RESPECT/pull/173#issuecomment-6090569654)
  asks Copilot to review the QA follow-ups.
- [PR174 comment 6090808586](https://github.com/keeganmoody33/PROPER-RESPECT/pull/174#issuecomment-6090808586)
  asks Copilot to review the fixture/SQLite/loopback follow-ups.

Their available reviews only report exhausted Copilot quota. They provide no
independent clearance. These requests differ from the repository autopilot's
owner-authored, marked comments and reviewer API calls. No tracked repository
file on inspected main emits an `@copilot` comment. There are no tracked Cursor
rules or Cursor-specific agent instructions. The external Cursor agent's
instruction history and settings are unavailable here; causation beyond the
observed actor cannot be established from these comments.

**Fix now:** main's AGENTS and CODEX-BRIEF still select Copilot because PR165
has not landed. The existing PR165 retirement remains intact. This update
makes the rule explicitly apply to every agent/integration, including Cursor,
and adds the same review gate to the PR template. It forbids both comment and
API fallbacks when Claude access is missing. Writer independence still applies:
Claude-authored work needs an owner-appointed independent reviewer other than
Claude, with Copilot excluded.

**Owner/external boundary:** no external Cursor conversation or setting was
changed, no Copilot/Claude review was requested, and no credential was created.
A repository guidance change cannot certify what an external agent will do
until it reads the updated policy. PR165 itself needs independent review and
explicit owner landing approval. The pending reviewers environment secret
remains a separate owner action.

## Validation and scope

Only current-main ancestry and the authorized reviewer guidance change in this
reconciliation. The prior data-only stack-review implementation and paused
zero-I/O autopilot remain unchanged. The existing reviewer/autopilot
regressions pass (90 tests), as does full repository lint. Current-head hosted
CI is recorded separately in PR165; older-head results are historical only.
Documentation-only additions do not need implementation-mirroring tests.

PR173 and PR174 stay on their authors' branches. Their CI is useful engineering
evidence, not Claude clearance. Product candidates are reconciled separately
with explicit dependency SHAs. Parent reports #123 verified and closed; this
work leaves its account, receipt branch/workflow and recovery evidence alone.

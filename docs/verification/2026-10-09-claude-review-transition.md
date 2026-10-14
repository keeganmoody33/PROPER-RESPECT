# Claude review transition

Owner direction on October 9: “we will use claude to review” (04:30:12 UTC),
then “cut copilot” (04:30:47 UTC). This authorizes the repository review-policy
change, not credentials, paid usage, merge, deployment or external enforcement
changes. Codex wrote this change; Claude must independently review it.

## Current boundary

Main remains `baff7e8d85827872ede63ada2297d92c03adf37d`. This draft changes
review guidance and pauses the old autopilot's live dispatcher. It does not
promote an Actions-bot marker into automatic Claude clearance. Automatic task
starts and fixes also pause; authorized implementation and testing continue
directly. Existing finding evidence remains available.

The Claude runner retains its pinned tools, read-only permissions, main-only
secret boundary, writer detection and strict result parser. Only its
owner-facing policy/skip wording changes. Every new commit or dependency/base
change requires fresh review and CI. Owner landing remains a separate gate.

## Validation

Before changing the dispatcher, three regressions failed: with the old enable
switch set to true, both the imported entrypoint and the actual CLI tried to
read `GH_TOKEN`; the workflow still granted write permissions. After the
change, both entrypoints make zero requests and read no credentials even
when all old enable switches are true. The workflow has no schedule,
checkout, secret environment or write permission.

The combined Node script suite passes 106/106 with no skips, including 65
Claude/paused-autopilot cases. Obsolete live-dispatch integration assertions
were removed with their dispatcher, not skipped or bypassed. Pure historical
planning/finding-reader tests remain explicitly dormant. Repository ESLint
and `git diff --check` also pass. Product browser
behavior is unchanged; its existing release-head evidence is listed below.

## Actual reviewer attempt

- [Owner-authored request on PR162](https://github.com/keeganmoody33/PROPER-RESPECT/pull/162#issuecomment-6074324653)
  named exact head `1b8a44baad03ab4dcae2e9dc0017d3600cfb4c13`.
- [Run 37884471404](https://github.com/keeganmoody33/PROPER-RESPECT/actions/runs/37884471404),
  job `113671253166`, started the trusted main workflow successfully.
- Preparation reported the `CLAUDE_CODE_OAUTH_TOKEN` secret missing from
  the `reviewers` environment. [The workflow's skip note](https://github.com/keeganmoody33/PROPER-RESPECT/pull/162#issuecomment-6074327759)
  is the evidence. The model, checkout and post-review steps were skipped.
  The green workflow result is **not** a Claude review.
- No credential was created/read out, and no additional blocked review
  requests were sent. No Copilot request was made after the owner decision.

## Release review map

| PR | Exact candidate | Dependency/review boundary |
| --- | --- | --- |
| #157 | `3268abadbfd13abd79ae2e0ffabda5b07ea82dcf` | Native/durable collectors; base main; independent Claude review pending. |
| #158 | `9bcb173c5815d7524ce40dcc713805826501de1e` | Cursor report adapter; base main; independent Claude review pending. |
| #162 | `1b8a44baad03ab4dcae2e9dc0017d3600cfb4c13` | Profile-name guard; base main; actual Claude attempt blocked by missing token. |
| #163 | `96ab8cec36321bff49f91d28b04dde317ba56e81` | Receiver integration; base dependency bundle `4e8fc6c1791264ad9803daba42652e1f77c2cfb7`; incorporates #161. |
| #164 | `b3c2dc0d43ef0036cb5840d2180340617d0b5c99` | Private snapshots; base #163 at `96ab8ce`; existing full CI passed. |

PR163 Verify run `37868421177` and PR164 Verify run `37868420491` remain
evidence for those exact product heads. This policy draft does not move them.
The current Claude runner refuses non-main bases, so #163/#164 also need a
supported review path after authentication is available. Preserve their
stacked diffs and complete dependency context; do not weaken the base guard
or treat synthetic account tests as real-account acceptance.

## External settings and rollback

The branch read reports required `verify` and `Native Chrome WebMCP` checks
with enforcement for everyone; the rulesets collection returned no entries.
The integration cannot read the administration-only full protection endpoint,
so it cannot certify other review settings. No external setting was changed.
The last visible scheduled autopilot run `37864287774` was skipped; that does
not prove the values of repository variables.

The smallest confirmed owner action is to authorize/provision the existing
Claude-plan OAuth secret in GitHub Settings → Environments → `reviewers` →
`CLAUDE_CODE_OAUTH_TOKEN`, keeping its main-only branch restriction. Do not
place a credential in a comment or chat. Any external Copilot auto-review or
branch-rule change must identify the actual setting and receive separate
scoped authorization. No subscription or unrelated integration is removed.

Rollback is an owner-reviewed revert of this policy PR. Do not use a revert
to silently restart the retired Copilot dispatcher. Production #123 recovery,
the receipts branch, receipt/release workflows, account connections, provider
keys and production deployment are outside this change.

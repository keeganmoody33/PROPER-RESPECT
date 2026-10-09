# Owner setup for required Claude review

Status: the existing trusted-main runner was exercised on PR162 at head
`1b8a44baad03ab4dcae2e9dc0017d3600cfb4c13`. Run
[37884471404](https://github.com/keeganmoody33/PROPER-RESPECT/actions/runs/37884471404)
stopped before model execution because `reviewers/CLAUDE_CODE_OAUTH_TOKEN`
was missing. A successful workflow that skips the model is not review evidence.

Credential creation/replacement is a separate owner action requiring explicit
authorization under CODEX-BRIEF Section 9. This task has not created, retrieved,
printed or installed a credential, or changed environment protection rules.

After that authorization, the owner can use an existing securely stored Claude
subscription token or run `claude setup-token` on their own trusted machine.
Anthropic documents browser authorization and a printed long-lived token for
CI; the command does not store it. The owner should place the value directly
in GitHub, never in chat, a screenshot, a repository file or an Actions log.
See [Anthropic authentication](https://code.claude.com/docs/en/authentication#generate-a-long-lived-token)
and [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions).

Exact destination: [PROPER-RESPECT Settings → Environments](https://github.com/keeganmoody33/PROPER-RESPECT/settings/environments)
→ existing **reviewers** environment → **Environment secrets** → **Add secret**
→ name **CLAUDE_CODE_OAUTH_TOKEN**. The owner enters the value in GitHub.
Preserve the existing main-only environment restriction. If it is missing or
unclear, stop and obtain scoped authorization before changing it. Do not use
a repository-wide secret or the generic app-install setup route for this
already installed, restricted workflow. GitHub documents the environment-secret
steps in [Using secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets#creating-secrets-for-an-environment)
and the branch restriction in [Managing environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).

The existing main runner can independently review the main-based PR165 after
access is restored. The owner must inspect the actual model result, exact head
and CI before separately authorizing landing. Only after the safe stacked
runner is reviewed and landed can it review PR163/164 through their existing
bases. Use Actions → Claude review → Run workflow, select main, and enter
`pr`, `head_sha` and `base_sha`. Fetch fresh SHAs first; the following values
are valid only while those exact pins remain current:

- `pr=163`, `head_sha=96ab8cec36321bff49f91d28b04dde317ba56e81`, `base_sha=4e8fc6c1791264ad9803daba42652e1f77c2cfb7`
- `pr=164`, `head_sha=b3c2dc0d43ef0036cb5840d2180340617d0b5c99`, `base_sha=96ab8cec36321bff49f91d28b04dde317ba56e81`

The proposed runner is dispatch-only: the pinned upstream action refreshes
base configuration on PR comment events after preparation, which would break
the immutable checkout claim. The current main runner still supports comments
for the initial PR165 review; that is historical behavior, not the new route.

A changed head, base, dependency or trusted main requires fresh review context
and CI as applicable. No clean marker authorizes automatic merge. Human
inspection and owner landing approval remain required. Product acceptance
(real account/device/auth, deliberately shared data and #123 freshness) remains
separate from this reviewer infrastructure work.

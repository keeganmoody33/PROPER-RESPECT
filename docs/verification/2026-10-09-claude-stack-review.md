# Exact stacked Claude review context

Parent-authorized continuation of the October 9 reviewer transition: prepare
a safe review route for PR163/164 without retargeting them, exposing secrets
to PR-controlled code, changing external settings or merging anything.

Disposition before implementation: fix the runner's coverage limitation by
supplying immutable data-only context, not by deleting its base guard alone.
Main was `baff7e8d85827872ede63ada2297d92c03adf37d`; the policy candidate was
`33f16b8d82382954cd33605a0847f3c8933644bd`.

The old runner assumes main is the old version of every omitted/deleted file.
That fails for a stacked dependency base. The new route must pin trusted main
(M), dependency ancestor (A), immediate base (B) and head (H), retain complete
dependency and feature context, and verify every introduced commit's writer.
It must refuse unsafe tree modes and histories it cannot represent exactly.

Four runner regressions fail before implementation: a supported pinned stack
is rejected; explicit owner pins are not enforced; a clean result survives a
base change during review; and base/ancestor finding locations cannot link to
the right revision. Evidence: `/tmp/pr-claude-stack-runner-red.log` in the
isolated engineering environment. Exporter tests independently cover raw blob
fidelity, untrusted file modes/configuration, resource limits and history.

No model run or secret provisioning is part of these tests. Missing OAuth
access and independent review remain separate acceptance gates.

## Implemented route and validation

The owner dispatches the workflow from main with PR number and full head/base
SHAs for stacks. Main remains the only checkout and supplies the executable
runner, pinned CLI lockfile and policy. The runner reads existing Git objects,
checks blob hashes and emits head/base/ancestor trees plus feature/dependency/
aggregate patches. Symlinks, gitlinks, unsafe paths, ambiguous ancestry, missing
objects and over-limit input stop before the model. Export filters, external
diff/textconv commands and lazy fetch cannot run through the exporter.

Configuration names are absent from the exported trees. Complete text appears
only in inert `context/configuration.json`, with its digest in the manifest;
NUL/invalid UTF-8 configuration fails closed. An audit reproduced Git's binary
patch suppression for omitted configuration before this fix; all three new
configuration cases failed before and pass after the correction. Review input
remains untrusted data. The model receives only Read/Glob within the existing
read fence, and credential-filtered output remains the only posted result.

Dispatch-only is deliberate. At the pinned upstream action,
[run.ts](https://raw.githubusercontent.com/anthropics/claude-code-action/756cc22e19660d20e8cc9496b4f242475a7f7790/src/entrypoints/run.ts)
calls configuration restoration for PR entity events, including issue comments.
[restore-config.ts](https://raw.githubusercontent.com/anthropics/claude-code-action/756cc22e19660d20e8cc9496b4f242475a7f7790/src/github/operations/restore-config.ts)
then fetches a mutable base. Disabling the comment entry avoids that hidden
refresh after pin validation. The action, CLI, owner/main/environment guards
and tool restrictions retain their pins and constraints.

Preparation checks writer metadata across all H-minus-M introduced commits,
including dependencies. Head/base/ref/repository/main identity and Claude
writer claims are checked again before the model and before posting. A moved
context or a raced GitHub 422 cannot become a clean fallback comment. Findings
retain historical pins and link to the correct head/base/ancestor revision.
Receipts contain all four SHAs and the manifest SHA256, for owner inspection.

Exact local builds after the configuration fix:

| Candidate | Head | Base | Ancestor | Introduced commits | Manifest SHA256 |
| --- | --- | --- | --- | --- | --- |
| PR163 | `96ab8cec36321bff49f91d28b04dde317ba56e81` | `4e8fc6c1791264ad9803daba42652e1f77c2cfb7` | `baff7e8d85827872ede63ada2297d92c03adf37d` | 6 | `b5faae65fb9cabf4983b3e755ec2d4aa5fdbc67405619d137aab7c3b04148df5` |
| PR164 | `b3c2dc0d43ef0036cb5840d2180340617d0b5c99` | `96ab8cec36321bff49f91d28b04dde317ba56e81` | `baff7e8d85827872ede63ada2297d92c03adf37d` | 13 | `a7c3ea9242222312742f88e0948bc0308423414510118356e4316c26b58f5755` |

These builds used trusted M=`33f16b8d82382954cd33605a0847f3c8933644bd`,
proving the dependency ancestor remains correct after main advances independently
of the stacks. Future M/context changes naturally produce new manifest digests.
The final build receipt is `/tmp/pr-claude-final-stack-proof.json` in the task
environment. This is local object/export proof, not a hosted model run.

Validation:

- Application suite: **1,988 passed, 2 existing skipped**; Node scripts:
  **131 passed**. The default `/tmp` attempt failed 50 private-capture tests
  because this environment places a read-only `.git` marker there. Rerunning
  with `TMPDIR=/var/tmp/proper-respect-review-tests-20261009` passed without
  changing application guards. Log: `/tmp/pr-claude-stack-full-tests-isolated.log`.
- After the dispatch-only correction, all **41 reviewer tests** passed;
  full ESLint and workflow YAML parsing passed. Git whitespace checks passed.
- Exporter negative controls fail if external-diff protection or configuration
  stripping is removed. Boundary tests cover exact limits and missing objects.
- A separate engineering lane audited the final runner/workflow and found no
  remaining P0/P1; it also authored the exporter, so this is engineering
  review, not the independent Claude acceptance required for landing.

Bootstrap: owner credential setup, independent review of this main-based PR,
explicit owner landing approval, then dispatch exact stacked reviews. See
[owner setup](2026-10-09-claude-owner-setup.md). No credential provisioning,
external settings, PR retarget, merge, production write, model call or #123
verification dispatch was performed for this change.

Rollback: revert the stacked-runner commit while retaining the preceding Claude
policy/Copilot-dispatch retirement commit. That restores the main-base-only
review route without reactivating Copilot or automatic landing. Fresh CI and
independent review remain required for any rollback candidate.

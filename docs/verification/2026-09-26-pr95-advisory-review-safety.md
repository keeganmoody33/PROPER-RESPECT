# PR95 advisory review safety — 2026-09-26 UTC

Inspected PR95 head: `0d3fae5061987e07a27f293bacd3a0b41b4ba747`.
Inspected main: `6d6964187aef61a9accb0d304ad621a7aac2efe8`.
PR89 dependency: external final head `45405b213268e2ad448a63e5193e57b222c43362`, merge `58b8cd7541466618da428fbf0d75b25cc07bda94`.

## Source behavior

Claude remains an optional advisory first reviewer. Its findings, including
older-head findings and the issue-comment fallback after a rejected review,
block merging. A clean Claude marker cannot authorize a merge: the marker and
run lookup did not bind the emitted review to an exact PR, head and base.
Copilot's existing strict clearance and bounded dispatch rules remain.

The controller uses the shared Claude writer-evidence check before requesting
Claude. Missing writer evidence is not affirmative provenance. Automatic Claude
clearance remains unavailable pending a trusted provenance protocol and
independent validation; this change does not claim to deliver it.

The proposed CI-completion trigger is removed. The existing job requires
`AUTOPILOT_ENABLED` before entering its environment. The disabled script exits
before reading repository/credential configuration or making requests.

## Review dispositions

- PR95 comments4111564647 and4111568313: supplied head already collected
  fallback findings. Retained and tested through actual `post()`422 fallback
  into the controller with a different head and clean Copilot review.
- PR95 comment4111568332: supplied grammar correction retained.
- Independent A/B/C: unbound Claude run provenance and reviewed base,
  unconditional new recurrence, and known Claude writer dispatch are fixed by
  removing clearance, removing the new trigger, gating disabled execution,
  and reusing writer evidence. No run artifact protocol is claimed.
- PR89 comment4110738307: Claude clearance remains unavailable; model prompt
  instructions alone are not a security boundary.
- PR89 base/omitted-deletion concerns4111436499,4111464678,4111509194:
  exact base content remains an advisory review coverage limitation. It can
  no longer support Claude merge authorization.
- Other inherited PR89 comments retain individual dispositions and raw text
  in the private local receipt. Source-level fixes and runtime claims remain
  distinct; no provider permission fence was exercised live.

## Verification and limits

Five new regressions failed on the supplied head before source changes.
Corrected source passes 81 tests across both controller/reviewer suites, with
unmocked network denied. The independent initial reviews required changes;
all three corrected-source reviews passed bounded source safety. Reviewer C's
stale clearance comments were corrected before commit. Targeted ESLint and
YAML parsing passed. Hosted checks must pass before source merge.

Local evidence: `/tmp/proper-respect-pr95-review-20260926/receipt.md`, raw
comments, frozen sources, RED/GREEN transcripts and independent reviews.

Repository and autopilot environment variables were empty at inspection;
reviewers environment variable lookup returned404, not an empty-list proof.
No enable flag, secret/token, provider call, bot trigger, manual workflow
run, live remediation, collection or deployment is authorized by this receipt.

Inherited task/dependency authority, reliable writer identity, expired-runner
cleanup, protected preflight scope and Copilot reviewed-base binding remain
activation blockers. Source merge is not operational activation.

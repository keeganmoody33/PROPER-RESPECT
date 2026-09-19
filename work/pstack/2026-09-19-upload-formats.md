# Upload format correction

Date: 2026-09-19. Base: f808fc834c7900681d10b043a6bb09d4f8e76314. Existing Ref: https://plan.ref.tools/oUl8LCIQb32SAicK.

### Bug fix

**You own this task. Plan, review, verify.** Delegate investigation and the fix to subagents, stay in the lead.

Be scientific. Every shipped line traces to runtime evidence. Belt-and-suspenders that "might help" is a hypothesis, not a fix. It does not ship. When evidence refutes a hypothesis, revert what it motivated. The smallest change the evidence justifies ships, nothing more.

1. Reproduce it yourself on the matching surface via the control skill (Non-negotiables). Don't hand the repro to the user. A debug or instrumentation protocol that says to ask the user does not override this. You drive the instrumented runtime. Ask the user only with a stated, specific reason the control surface cannot reach the target, and only after driving it as far as it goes. Won't reproduce directly, force it: synthesize the trigger, tighten conditions, or instrument until it fires.
2. Binary-search the cause. Form the candidate hypotheses, then rule them out until one survives. Seed them with `how` over the affected subsystem and the **why** skill for regression history. Each pass, take the split that cuts the most remaining problem space, get runtime evidence, eliminate. When program state is unclear, add instrumentation or logging and read it as the code runs. Don't guess. Drive a long or stubborn hunt with the runtime contract’s bounded active-session loop or explicitly requested heartbeat. Confirm the surviving *mechanism* with runtime evidence before the step-3 architect/interrogate fan-out.
3. Plan the fix. If it crosses a function boundary, `architect` first. Delegate implementation to a subagent using your configured bug-fix model (default inherit-parent) with a specific scope. Review the diff.
4. Verify on the same surface. The original repro now passes. "Inconclusive" or wrong-surface is not a pass. Flag it. Unit tests show branch behavior, not bug absence.
5. Stage the commits so the failing repro lands before the fix in git history. See the **tdd** skill for the failing-test-first cadence when the bug has a cheap local test path. Skip it when the test would be expensive, integration-heavy, or unclear.
   This is the canonical **sequence-verifiable-units** principle skill, the failing test first and the fix on top.
6. Run **Opening a PR**.

Investigation fans out `how` + `why` as parallel subagents.

**Reply:** what was broken, root cause, fix, how you verified. Paste failing-then-passing repro output verbatim.

## Execution status

- Reproduction: previous read-only verification confirmed the actual classifier maps JSON to SCREENSHOT. Backend regression reproduced all three defects.
- Cause: explicit two-way filename branch; backend trusts caller category. Git blame points to ea073706. No provider failure involved.
- Architecture fan-out: skipped to honor the owner instruction against reopening architecture. Extend existing source/proof model with FILE_UPLOAD and reuse private review.
- Implementation: scoped worker and parent integration complete. Independent review found no blocking introduced defect. One redundant test comment removed; two external convex-test metadata comments retained.
- Same-surface verification: actual retainUpload mutation tests pass for JSON classification, private proof linkage and finalization replay. Authenticated local form inspected at desktop and mobile widths. Live storage HTTP upload remains gated on development synchronization.
- Test-first commit: d428ba5. Original three tests failed before the fix and pass after it.
- Shipping: local checkpoint only; backend synchronization, push and deployment remain gated. 443 Vitest tests and six Node tests pass; one optional private-file test skipped. Lint, typecheck and production build pass.

## Scope

Retain common vendor exports honestly with metadata, private supporting records and idempotent finalization. No automatic usage extraction, provider access, relationship confirmation or publication.

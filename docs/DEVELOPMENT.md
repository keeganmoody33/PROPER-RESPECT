# Developing PROPER-RESPECT

Updated: 2026-09-23. Start with [AGENTS.md](../AGENTS.md), the
[Cursor handoff](CURSOR_HANDOFF.md), [deployment runbook](DEPLOYMENT.md), and
[canonical Ref](https://plan.ref.tools/oUl8LCIQb32SAicK).

## Latest deployed state

Production runs on `https://proper-respect.com` with separate accepted backend
and frontend sources. The September 23 release includes the empty-collection
first-tool flow and private-save confirmation. Existing-owner access was verified;
fresh hosted signup, second-user isolation, and provider lifecycle acceptance
remain open. The published example is `/keegan`; the owner's desired
`/lecturesfrom` migration is pending.

Main includes PRs #25–64. Production still excludes #52, #58, #60, and #64.
Do not deploy main as a shortcut to release those changes. Use the
[dated release reconciliation](verification/2026-09-23-release-documentation-reconciliation.md) for exact
source and deployment identities, retained evidence, and acceptance limits.

## Current product

The product represents tools a person has used or tested, what they are testing
now, their explicitly selected go-to stack, and their changing relationship
history. Evidence supports that story; activity does not rank importance.
Private save and explicit publication remain separate.

## Existing Tasks 1–4

- Task 1: source/account identity and immutable retention are implemented.
- Task 2: owner-bound Gmail OAuth, encrypted generation-bound credentials,
  bounded discovery, provenance, private review and maintenance controls are
  implemented. The authorized live capture/candidate gate passed. Further
  mailbox reads are paused; recurring collection remains off. Historical depth,
  live recovery and authorized hosted maintenance remain follow-up work.
- Task 3: both prototypes are preserved. A/B remains unselected and nonblocking.
- Task 4: private intake, manual product entry, owner relationships/go-to/history,
  compact cards, retained branding, exact sharing preview and source controls
  are integrated. Existing-owner access is verified; fresh-user and full release acceptance remain.

The existing direct GitHub connector is retained. The Composio evaluation is
complete; production replacement is unaccepted and nonblocking. Reuse the current
evidence model and read [source roles](003-evidence-surfaces.md). Email discovers
possible relationships; product APIs/exports supply actual activity when exposed.
Generic uploads retain originals but do not authenticate images or extract
Screen Time automatically.

## Work and verification

Use pstack-codex as the primary workflow for scoped implementation, focused tests,
browser verification and review, per the September 19 owner direction. Compound
Engineering remains available for focused supporting work. Preserve the existing
Ref, Tasks 1–4, unrelated work and accepted checkpoints. Source, capture,
observation, review and relationship remain distinct.

The [September 18 source verification](verification/2026-09-18-main-consolidation.md)
and the September 19 release receipts retain their original dated results.
They do not describe the current production source. Detailed real-account
operator receipts and originals remain private.

The native `proper-respect.com` cutover is complete. Do not restart the former
apex-to-`props.lecturesfrom.com` transition. Git-triggered deployments remain
disabled, and the repository's Vercel build command still deploys Convex.
Follow the deployment runbook for a separately reviewed selective release.
Additional provider reads, recurrence, data transfer, and publication retain
their separate authorization boundaries.

## Supporting a relationship

Use provider telemetry when available. Where it is unavailable, retain an
export/screenshot or ask for owner-described history, dates and context. Label
the basis and coverage; never manufacture numbers or require telemetry to save
a relationship. A screenshot hash preserves bytes, not authenticity. Brand
metadata never strengthens evidence. A parent-company logo is not a verified
subproduct logo, even when the requested domain matches.

# ADR-059: Error Handling and Import Safety

## Status
Accepted - revised 2026-06-06

## Context

The MVP includes manual editing and import helpers. Failures should never publish bad data, lose user work, or make the linker distrust the profile.

## Decision

Use safe failure modes:

- Save drafts frequently.
- Imports can fail without blocking manual entry.
- Parser errors produce reviewable partial results when possible.
- Upload failures keep text/link data intact.
- Public pages should degrade gracefully if proof media fails to load.

## Consequences

### Positive

- Users can continue manually even when automation fails.
- Trust is preserved because imports never auto-publish.

### Negative

- Requires careful draft state handling.

## Related

- ADR-024 - Manual-first onboarding
- ADR-037 - Imports

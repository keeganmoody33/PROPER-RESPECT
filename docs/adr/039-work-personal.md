# ADR-039: Work vs. Personal Visibility

## Status
Accepted - revised 2026-06-06

## Context

Linkers may use products at work that they do not want to disclose publicly. The product needs safe defaults without blocking people from showing legitimate work tools when they want to.

## Decision

Every prop has visibility:

- `DRAFT` - not published yet
- `PUBLIC` - visible on the profile
- `PRIVATE` - visible only to the linker in their dashboard

Work/team products should default to draft/private when imported or created through a work context. The linker can publish them intentionally.

## Work Indicators

A prop may be marked:

- Personal
- Work
- Team/shared
- Public/no-account

These are context labels, not separate product types.

## Consequences

### Positive

- Safer default for sensitive work stacks.
- Linkers can still show work tools when they want to.
- Keeps profile curation user-owned.

### Negative

- More fields in the editor.
- Some imported products may require review to classify.

## Related

- ADR-004 - Public/private draft boundaries
- ADR-015 - Shared accounts

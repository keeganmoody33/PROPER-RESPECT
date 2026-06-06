# ADR-016: Seasonal Products and Intermittent Usage

## Status
Accepted - revised 2026-06-06

## Context

Some products are not used every week but still belong on a stack: tax software, conference tools, seasonal travel tools, annual planning tools, or event-specific products.

## Decision

Do not force seasonal products into Active or Archived if that would be misleading. For MVP, the linker can explain seasonality in the note. A future status such as Seasonal can be added if real profiles need it.

## Consequences

### Positive

- Avoids false inactivity.
- Keeps the MVP status model simple.

### Negative

- Seasonal status is not first-class at launch.

## Related

- ADR-002 - No opaque score in MVP

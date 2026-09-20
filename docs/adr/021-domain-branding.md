# ADR-021: Naming and Domain Are Not Blocking

> **Status correction — 2026-09-20:** Domain interchangeability below is intent only. Auth/callback origin remains explicitly configured; net-new verified Domain routing is separate milestone #13. See [release gaps #24](https://github.com/keeganmoody33/PROPER-RESPECT/issues/24) and the [Phase 0/Devin receipt](../verification/2026-09-20-devin-triage-and-phase0-closure.md).

## Status
Accepted - revised 2026-06-06

## Context

Earlier docs mixed placeholder names, domain candidates, and PROPER-RESPECT. That created false urgency around domain availability. The product is still being shaped, so the name and domain should not block architecture or MVP work.

## Decision

Use PROPER-RESPECT as the working product name in documentation. Treat final name and domain as interchangeable until the product shape is stable.

Do not design core architecture around a specific domain.

## Consequences

### Positive

- Removes a fake blocker.
- Documentation uses one working name.
- Product work can continue while naming evolves.

### Negative

- Some screenshots/copy will need final brand pass later.

## Related

- README - Current naming
- CONTEXT - Product identity

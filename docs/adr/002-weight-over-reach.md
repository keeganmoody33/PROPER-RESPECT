# ADR-002: Credibility Is Proof-First, Not Tenure-First

## Status
Accepted - revised 2026-06-06

## Context

The earlier model used a numeric credibility formula with tenure, verification tiers, activity status, content count, and lineage count. That made the product feel like it was trying to score people. The current product direction is simpler: help visitors understand why a linker's product card is credible.

The value is not predicting exactly how long someone has used a product. The value is consolidating links, proof, and lineage in one clear product card.

## Decision

For MVP, credibility is represented by visible proof and status, not an opaque score.

A prop can display:

- Status: Active, Testing, Archived
- Link type: affiliate, referral, invite, canonical
- Proof badges: Loom, YouTube, screenshot, article, GitHub, receipt, API
- Lineage: person, content, community, event

No required numeric credibility score in MVP.

## Future Reward Logic

Company reward rules and usage-weighted affiliate economics are future scope. They are parked in `docs/future/007-company-reward-config.md` and should not shape the MVP data model beyond leaving room for links and proof.

## Consequences

### Positive

- Easier for users and visitors to understand.
- Avoids false precision.
- Keeps the MVP focused on profiles and product cards.
- Prevents company economics from distorting the profile.

### Negative

- No single ranking number for sorting.
- Sorting must be manual or status-based at launch.
- Companies may eventually want structured scores.

## Related

- ADR-001 - Proof source ladder
- ADR-014 - Free products and content proof
- `docs/future/007-company-reward-config.md` - Parked reward configuration

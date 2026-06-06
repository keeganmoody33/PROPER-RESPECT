# ADR-020: Cold Start - Keegan's Real Stack First

## Status
Accepted - revised 2026-06-06

## Context

The product needs an initial surface that proves the profile concept. The earlier plan framed this as demand validation through a static page. The current goal is more direct: build the first useful profile and use it as the reference product.

## Decision

Start with Keegan's real product stack.

The first profile should include:

- Active products
- Testing products
- Archived products where the history matters
- Affiliate/referral/canonical links
- Proof attachments where available
- Put-on-by lineage where remembered

The first version can be hardcoded or backed by the real database, but it must express the final product shape: product cards, proof, links, lineage, and status.

## Consequences

### Positive

- The product has an immediate reference profile.
- Design decisions are grounded in real data.
- The profile can reveal which import/automation helpers matter most.

### Negative

- Manual data entry is unavoidable at the start.
- The first profile may expose missing fields in the data model.

## Related

- PRD - Current MVP app flow
- ADR-037 - Import tools

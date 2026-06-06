# ADR-061: Differentiation - Product Stack, Not Generic Link List

## Status
Accepted - revised 2026-06-06

## Context

PROPER-RESPECT overlaps with link-in-bio tools, but it should not become a generic list of links. The difference is product-specific structure: status, proof, lineage, and the best outbound link for each product.

## Decision

Position PROPER-RESPECT as a product-stack profile, not a general-purpose link page.

| Feature | PROPER-RESPECT | Generic Link-in-Bio |
| --- | --- | --- |
| Product-specific cards | Yes | No |
| Active/testing/archived status | Yes | No |
| Affiliate/referral/canonical link slots | Yes | Sometimes |
| Proof attachments | Yes | No |
| Put-on-by lineage | Yes | No |
| Imports from existing public surfaces | Yes | Sometimes |
| Company dashboards | Future | No |

## Switching Pitch

"Linktree shows links. PROPER-RESPECT shows the products you actually use, the links people should click, the proof that you know them, and who put you on."

## Consequences

### Positive

- Clearer than "credibility protocol" for MVP.
- Keeps the product linker-first.
- Makes affiliate aggregation concrete.

### Negative

- Less grand than the earlier B2B framing.
- Company-side value must wait until the profile network exists.

## Related

- README - Product overview
- ADR-037 - Import surfaces

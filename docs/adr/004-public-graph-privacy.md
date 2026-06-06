# ADR-004: Public Profile With Private Draft Boundaries

## Status
Accepted - revised 2026-06-06

## Context

A product-stack profile is public by design, but a linker needs control over what gets published. Imports, proof captures, and draft props must never leak private data by default.

## Decision

Everything starts private or draft. The linker explicitly publishes props and proof.

## Public Data

A published prop may show:

- Product name and logo
- Status: Active, Testing, Archived
- Linker's note/headline
- Affiliate/referral/invite/canonical link
- Proof items the linker chose to attach
- Put-on-by lineage the linker chose to show
- Approximate dates only if the linker enters them

## Private / Draft Data

Private by default:

- Imported links before review
- Claim-on-visit captures before confirmation
- Uploaded screenshots before publish
- Receipts or source artifacts before the linker selects what to show
- Work products marked private
- API/OAuth connector data unless explicitly converted into proof

## User Control Model

| Action | User Control |
| --- | --- |
| Publish a prop | Explicit action |
| Keep a prop draft/private | Always allowed |
| Delete a prop | Always allowed |
| Remove proof | Always allowed |
| Remove lineage | Always allowed |
| Export profile data | Always allowed |
| Publish imported data automatically | Never allowed |

## Consequences

### Positive

- Imports can be useful without being scary.
- The privacy model is simple: drafts are private, published props are public.
- The linker remains source of truth.

### Negative

- More review steps before publish.
- Some users may expect auto-generated profiles.

## Related

- ADR-001 - Proof source ladder
- ADR-009 - Manual put-on-by
- ADR-024 - Manual-first onboarding

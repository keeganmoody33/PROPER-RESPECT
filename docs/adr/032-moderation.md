# ADR-032: Content Moderation and Community Guidelines

> **Status correction — 2026-09-20:** Unimplemented public reporting/moderation proposal; do not present proposed controls as shipped capabilities. See [release gaps #24](https://github.com/keeganmoody33/PROPER-RESPECT/issues/24) and the [Phase 0/Devin receipt](../verification/2026-09-20-devin-triage-and-phase0-closure.md).

## Status
Accepted - revised 2026-06-06

## Context

Public profiles can include notes, screenshots, videos, links, and lineage. The product needs a simple moderation posture without pretending to fact-check every usage claim.

## Decision

MVP moderation is post-publication reporting plus basic safety checks for uploads and URLs.

## Allowed

- Product usage screenshots
- Looms or videos showing workflows
- Notes about how the linker uses a product
- Affiliate/referral/canonical links
- Self-attested lineage
- Honest opinions and context

## Not Allowed

- Spam, scams, phishing, malware links
- Harassment, hate speech, doxxing, threats
- Adult or illegal content
- Copyright-infringing uploads
- Impersonation
- Clearly fraudulent claims presented as fact

## Report Flow

Every public profile, prop, and proof item should have a report path. Admin review can remove content, warn users, or suspend accounts.

## False Usage Claims

PROPER-RESPECT does not fact-check every product usage claim. Instead:

- Proof is visible so visitors can judge credibility.
- Self-attested claims are allowed.
- Clearly fraudulent or harmful claims can be reported.
- Stronger proof sources can be attached when the linker has them.

## Consequences

### Positive

- Keeps moderation realistic for MVP.
- Avoids building a fake verification police force.
- Gives visitors context instead of opaque scores.

### Negative

- Some false claims may remain until reported.
- Admin review eventually becomes operational work.

## Related

- ADR-004 - Public/private draft boundaries
- ADR-001 - Proof source ladder

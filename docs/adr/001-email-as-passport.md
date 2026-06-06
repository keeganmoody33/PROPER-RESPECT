# ADR-001: Usage Proof Sources - Manual First, Automation Additive

## Status
Accepted - revised 2026-06-06

## Context

The first version treated email metadata scanning as the primary onboarding mechanism. That was too narrow and too confident. Email can discover signups, receipts, and product notifications, but it does not reliably prove current usage. Some important products send no useful email. Some dead trials send lots of email.

PROPER-RESPECT needs a broader model: the linker owns the profile, and automation creates drafts or proof suggestions.

## Decision

Manual curation is the source of truth. The product supports a ladder of proof sources, each with different coverage and confidence.

| Source | Role | Confidence | MVP? |
| --- | --- | --- | --- |
| Manual entry | User creates the prop directly | Baseline | Yes |
| Content proof | Loom, YouTube, screenshot, article, repo, note | High when concrete | Yes |
| Public link import | Linktree, Beacons, GitHub README, Twitter bio | Medium | Yes |
| Receipt forward/upload | User provides a receipt or subscription proof | High for paid products | Next |
| Claim-on-visit extension | User captures URL/screenshot while using a product | High for web apps | Next |
| Public profile scan | Public repos, posts, videos, descriptions | Medium | Next |
| Product API/OAuth | Product-specific verified activity | High but fragmented | Later |
| Email metadata scan | Signup/receipt/notification discovery | Broad but noisy | Later, optional |

## API Key / OAuth Reality

API pulls are useful for specific products but cannot be the foundation:

- Every product has a different API and auth model.
- Many products do not expose personal usage stats.
- Asking a user for ten API keys is not onboarding.
- Storing API keys creates security and support overhead.
- API evidence should verify or enrich a prop, not be required to create one.

## Consequences

### Positive

- The product is no longer blocked by email OAuth or provider review.
- Free, open-source, and no-account tools still belong.
- Linkers can create value immediately.
- Automation can be added source by source without changing the core model.

### Negative

- Manual curation requires good UX.
- Proof quality will vary by user.
- There is no single universal usage oracle.

## Related

- ADR-014 - Free products and content proof
- ADR-028 - Claim-on-visit extension
- ADR-037 - Import tools

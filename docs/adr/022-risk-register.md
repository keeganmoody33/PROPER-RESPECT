# ADR-022: MVP Risk Register

## Status
Accepted - revised 2026-06-06

## Context

The current MVP is a linker-owned product-stack profile. The biggest risks are not B2B pricing or company dashboards. The biggest risks are profile usefulness, proof clarity, import quality, and privacy trust.

## Decision

Track risks against the current MVP only.

## Existential Risks

| Risk | Why It Matters | Mitigation |
| --- | --- | --- |
| Profile feels like a generic Linktree | The product loses differentiation | Product cards must include status, proof, link slots, and lineage |
| Manual entry is too slow | Users never finish a profile | Add imports, templates, and claim-on-visit capture |
| Proof feels fake or cluttered | Visitors do not trust the page | Make proof explicit, inspectable, and user-controlled |
| Imports create noisy drafts | Users lose confidence | Never publish imports automatically; require review |
| Privacy story feels creepy | Users will not connect/import anything | Avoid background tracking; use user-triggered capture and public/user-approved sources |
| Affiliate links dominate the page | Profile feels like an ad board | Keep non-affiliate products valid and show proof/lineage beside links |

## Managed Risks

| Risk | Mitigation |
| --- | --- |
| Duplicate products | Fuzzy matching, aliases, merge tools |
| Dead affiliate links | Let linker edit and flag stale links later |
| Inappropriate public content | Report flow and post-moderation |
| Product naming/domain drift | Use PROPER-RESPECT as working name until stable |
| Connector scope creep | Keep APIs/OAuth in the proof-source ladder, not MVP foundation |

## Kill / Pivot Signals

- A linker cannot build a credible 10-product profile in one focused session.
- Product cards do not make visitors understand what to click and why.
- Imports save less time than manual entry.
- Proof attachment UX feels harder than making a normal link page.

## Related

- ADR-020 - Keegan's real stack first
- ADR-024 - Manual-first onboarding with draft imports
- ADR-028 - Claim-on-visit extension

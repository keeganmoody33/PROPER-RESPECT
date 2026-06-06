# GRILL-SESSION.md - PROPER-RESPECT

> Updated: 2026-06-06  
> Method: grill-with-docs  
> Current result: manual-first product-stack profile with proof, links, and lineage. Automation is additive.

## What Changed

The earlier documentation over-weighted email scanning, screen-time tracking, B2B dashboards, pricing, analytics, and company reward configuration. Those ideas were useful exploration, but they are not the current product core.

The current product is simpler:

```text
One public product-stack profile
  -> each product has the right outbound link
  -> each product can have proof
  -> each product can credit who put the linker on
  -> imports and connectors help create drafts
```

## Current Decision Tree

```text
Build MVP profile builder
  -> create Keegan's stack manually
  -> add affiliate/referral/canonical links
  -> attach proof sources
  -> add lineage
  -> publish profile
  -> then add import helpers that create draft props
```

The product does not depend on predicting all usage automatically. It depends on making the linker's stack credible, useful, and easy to maintain.

## Resolved Decisions

| Decision | Current Answer |
| --- | --- |
| Product name | Use PROPER-RESPECT as the working name. Domain/name is interchangeable for now. |
| Source of truth | The linker is the source of truth. Automation only drafts. |
| Core value | Consolidated product links plus proof plus lineage. |
| Affiliate links | First-class, but not required for a product to appear. |
| Usage proof | Multiple proof sources, not one universal tracker. |
| Email scan | Optional future import source. Not primary. |
| Screen time | Future-only. Not launch. |
| API pulls | Useful for specific products, but too fragmented for onboarding. Later connector layer. |
| B2B/pricing/analytics | Parked in `docs/future/`. Not current scope. |
| Chrome extension | Reframed as claim-on-visit: user-triggered URL/screenshot capture. |

## Key Insight

The Wispr Flow screenshots are important because they show that shareable usage cards are compelling. The launch product does not need to reproduce Wispr Flow's first-party telemetry for every product. It needs to let linkers assemble credible product cards from the proof sources they already have: links, videos, screenshots, repos, receipts, articles, and eventually APIs.

## Active Questions

1. What is the minimum proof needed for a product card to feel credible?
2. Which import gets a new linker more than halfway fastest: Linktree/GitHub/public profile scan, receipt forward, or claim-on-visit extension?
3. What is the card layout that makes affiliate links, proof, and lineage all obvious without feeling crowded?
4. Should proof be shown as a feed/timeline under each product or as a single highlighted artifact?
5. What should the first profile include: active products only, or active/testing/archived from day one?

## Parked Questions

- Company dashboards
- Pricing
- B2B reward configuration
- Public API access
- Screen-time integrations
- Mobile app
- Analytics dashboard

Parked means not killed. It means not allowed to distort the MVP.

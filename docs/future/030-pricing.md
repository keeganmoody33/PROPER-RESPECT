# ADR-030: Pricing Strategy — Pro Tier and Company Tier

> Parked: not active MVP scope. Revisit only after the core product-stack profile works.


## Status
Accepted — 2026-06-05

## Context
What do we charge? For what? When? The pricing must align value with cost.

## Decision

### The Pricing Tiers

| Tier | Price | Who | What's Included |
|------|-------|-----|-----------------|
| **Free** | $0 | Everyone | Up to 10 props, basic profile, public graph, manual logging |
| **Pro** | $12/month or $99/year | Power users | Unlimited props, analytics dashboard, custom domain, embed widget, API access, priority support |
| **Company** | $99/month or $999/year | Companies | Advocate discovery dashboard, in-app messaging, reward configuration, API access, analytics, dedicated support |
| **Enterprise** | Custom | Large companies | Everything in Company + SSO, custom integrations, SLA, dedicated account manager |

### Why $12/month for Pro?

**Comparison:**
- Linktree Pro: $5/month (but no credibility, no analytics)
- Beacons: $10/month (creator monetization, not product credibility)
- Notion: $8/month (productivity tool)
- GitHub Pro: $4/month (developer tool)

**Our value:** We combine Linktree (profile) + analytics (insights) + credibility (verification). $12 is justified.

**The annual discount:** $99/year = $8.25/month (17% discount). Incentivizes annual commitment.

### Why $99/month for Company?

**Comparison:**
- PartnerStack: $500+/month (affiliate management)
- Impact: Custom pricing (enterprise)
- Rewardful: $49/month (affiliate tracking)

**Our value:** We provide advocate intelligence + messaging + configuration. Not just tracking. $99 is mid-market.

**The annual discount:** $999/year = $83.25/month (17% discount).

### The Free Tier Limitations

| Feature | Free | Pro |
|---------|------|-----|
| Props | 10 | Unlimited |
| Profile | Basic | Custom domain |
| Analytics | None | Full dashboard |
| Embed | None | All types |
| API | None | Read-only |
| Support | Community | Priority |
| Email scan | 1 provider | All providers |
| Screen time | None | Phase 3+ |

### The Conversion Strategy

| Trigger | Action | Target |
|---------|--------|--------|
| User hits 10 props | "Upgrade to add more" | Free → Pro |
| User gets 100 profile views | "See who's viewing" | Free → Pro |
| Company sees 50 advocates | "Configure your rewards" | Free → Company |
| User wants custom domain | "Pro includes custom domain" | Free → Pro |
| User wants embed widget | "Pro includes embeds" | Free → Pro |

### The Trial

- Pro: 14-day free trial (no credit card required)
- Company: 30-day free trial (credit card required, cancel anytime)
- Enterprise: Custom demo + pilot program

### The Refund Policy

- Pro: 30-day money-back guarantee
- Company: 30-day money-back guarantee
- Enterprise: Custom SLA terms

## Consequences

### Positive
- Clear value proposition at each tier
- Annual discount incentivizes commitment
- Free tier is generous (10 PROPER-RESPECT is enough for casual users)
- Trial reduces friction
- Refund policy builds trust

### Negative
- $12/month may be too high for some users
- Company tier at $99 may be too low (underpricing)
- Free tier at 10 props may be too generous (reduces conversion)
- Annual discount is modest (17% vs. industry standard 20%)

## Mitigations
- A/B test pricing ($8 vs. $12 vs. $15 for Pro)
- Monitor conversion rates at each tier
- Adjust free tier limits based on usage data
- Offer lifetime deal for early adopters (Founding Linker badge + lifetime Pro)

## Related
- PRD (Phase 3) — pricing is part of the B2B launch
- ADR-020 (Cold Start) — pricing affects cold start conversion

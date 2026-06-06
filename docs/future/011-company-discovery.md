# ADR-011: Company Discovery — How Companies Find Their Advocates

> Parked: not active MVP scope. Revisit only after the core product-stack profile works.


## Status
Accepted — Future (Phase 4) — 2026-06-05

## Context
Companies don't know they have advocates on PROPER-RESPECT until someone tells them. We need a discovery mechanism that is organic, non-spammy, and valuable.

## Decision
Three paths to company discovery, in order of implementation:

### Path 1: Organic Discovery (Phase 3)
- Auto-generated company page: `props.to/products/{domain}`
- Shows: product info, advocate count, top advocates by credibility weight
- Publicly accessible. No login required.
- Company discovers it via:
  - Advocate shares their prop card
  - Employee googles "[Product] advocates"
  - Social media mention

### Path 2: User Invitation (Phase 3)
- Advocate messages company directly: "I'm a top advocate on PROPER-RESPECT. Want to configure your reward rules?"
- Company visits their page and configures
- This is user-driven, not platform-driven

### Path 3: Threshold Notification (Phase 4)
- When a product reaches **50 verified advocates** on PROPER-RESPECT
- We send a single, non-spammy notification to the company's public contact email
- Subject: "50 verified advocates are recommending [Product] on PROPER-RESPECT"
- Body: "Visit your advocate page: props.to/products/{domain}. Configure your reward rules."
- **One email per product. Ever.** Not a drip campaign. Not a sequence.

## The Threshold Notification Rules

| Rule | Detail |
|------|--------|
| **Trigger** | 50 verified advocates (credibility weight > 50) |
| **Recipient** | Public contact email from domain (e.g., hello@, support@, growth@) |
| **Frequency** | Once per product. Ever. |
| **Content** | Service notification, not marketing. "Your product has advocates. Here's the data." |
| **Unsubscribe** | Clear unsubscribe link. Respected immediately. |
| **Legal basis** | Legitimate interest — notifying a company about organic activity on our platform. |

## Why 50 Advocates?

| Threshold | Rationale |
|-----------|-----------|
| 10 | Too low. Most products would trigger immediately. Spammy. |
| 50 | Sweet spot. Meaningful social proof. Not spammy. |
| 100 | Too high. Many niche products never reach it. Companies miss out. |
| 250 | Only mega-products. Defeats the purpose for indie tools. |

**The threshold is configurable per product category (future):**
- SaaS: 50
- Mobile apps: 100 (broader audience, lower engagement)
- Physical products: 25 (smaller market, higher intent)

## Consequences

### Positive
- Companies discover organic advocacy they never knew existed
- No cold outreach required from our sales team
- Threshold ensures quality — only products with real traction get notified
- Single email = not spammy

### Negative
- Could still be perceived as spam
- Public contact emails may not reach the right person (growth/BD)
- Companies may ignore it
- If threshold is too low, we become a spam platform

## Mitigations
- Clear unsubscribe
- Single email only
- Threshold is high enough to be meaningful
- Email is factual, not salesy: "Here is your data. Here is your page."
- If company responds negatively, we blacklist that domain forever

## Related
- ADR-003 (No Money Holding) — we don't sell leads, we show public data
- ADR-004 (Public Graph Privacy) — advocate data is public anyway
- ADR-007 (Company Reward Config) — notification drives them to configure rewards

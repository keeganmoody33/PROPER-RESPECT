# ADR-003: We Do Not Hold, Process, or Touch Money

## Status
Accepted — 2026-06-05

## Context
Early versions of this concept included a "credit slider" where companies could configure rev-share, discounts, or perks, and users would receive payouts through our platform. This introduces financial, legal, and fraud complexity that would kill the product before it ships.

## Decision
PROPER-RESPECT will never hold, process, or route money. We are a **link router and credibility layer**, not a payment platform.

## How Money Actually Flows

| Scenario | What props Does | What Happens |
|----------|----------------|--------------|
| User has Amazon affiliate link | Stores the link. Routes clicks through it. | Amazon pays user directly via Associates program |
| User has Notion referral code | Stores the code. Appends it to URL. | Notion credits user directly via their referral system |
| Product has no affiliate program | Stores the raw URL. No tracking. | Nothing. User gets credibility, not cash. |
| Company wants to reward advocates | Shows them the advocate graph. In-app messaging. | Company pays user directly, off-platform. |

## What We Explicitly Do NOT Do
- Hold funds in escrow
- Process payouts
- Calculate commission splits
- Take a percentage of transactions
- Issue 1099s or tax documents
- Act as a money transmitter
- Maintain a wallet or balance system

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| Stripe Connect for payouts | Makes us a money transmitter. Requires state licenses. Fraud liability. |
| Virtual currency / points | Creates a closed economy we must manage. Dilutes the core value. |
| Take rate on affiliate clicks | Requires tracking conversions across domains. Technically hard. Legally gray. |
| Company-paid "tips" through us | Same as payouts. Financial intermediary status. |
| Crypto / token rewards | Regulatory nightmare. Distracts from core product. |

## Consequences

### Positive
- Zero financial regulatory burden
- Zero fraud liability for synthetic transactions
- Zero accounting complexity
- Companies trust us because we don't touch their money
- Users trust us because we don't hold their earnings
- We can focus on the core: credibility and discovery

### Negative
- No direct revenue from transaction volume
- Users may want "one place to see all my earnings" — we can't provide this natively
- Companies may want us to handle payouts — we must say no and point them to PartnerStack/Rewardful
- The "credit slider" concept is dead (for now)

## Revenue Model Instead
- Pro tier: Analytics, custom domain, API access ($8-12/month)
- Company tier: Advocate discovery, in-app messaging, sponsored placement ($49/month)
- Data intelligence: Aggregated, anonymized trend reports (future)

## Related
- ADR-001 (Email Passport) — no financial data in email scan
- ADR-004 (Public Graph Privacy) — no financial data in public profiles

# ADR-007: Company-Configurable Reward System

> Parked: not active MVP scope. Revisit only after the core product-stack profile works.


## Status
Accepted — 2026-06-05

## Context
Every company has different economics, different growth strategies, and different relationships with their users. Some want to reward all advocates equally. Some want to reward power users more. Some want to give new adopters a boost. We do not dictate their strategy. We expose it.

## Decision
Each company configures their own **reward rules** for their product. props displays these rules but does not enforce, process, or intermediate them.

## The Configuration Model

```typescript
interface RewardConfig {
  productId: string;

  // Base reward type
  rewardType: 'FLAT' | 'USAGE_BASED' | 'TIERED' | 'CUSTOM';

  // Flat rate: everyone gets the same
  flatRate?: {
    amount: number;
    currency: string;
    period: 'ONCE' | 'MONTHLY' | 'ANNUAL';
  };

  // Usage-based: scales with credibility weight
  usageBased?: {
    minWeight: number;      // minimum credibility to qualify
    baseAmount: number;
    weightMultiplier: number; // e.g., $1 per 10 weight points
  };

  // Tiered: predefined buckets
  tiers?: {
    name: string;           // "Explorer", "Advocate", "Champion"
    minWeight: number;
    reward: string;         // "10% off", "$50 credit", "Swag box"
  }[];

  // New adopter boost
  newAdopterBoost?: {
    enabled: boolean;
    durationDays: number;   // e.g., 30 days
    multiplier: number;     // e.g., 2x reward
  };

  // Servant leader bonus (high credibility, low social reach)
  servantLeaderBonus?: {
    enabled: boolean;
    minWeight: number;
    maxFollowers: number;   // social reach cap
    bonus: string;
  };

  // Public display
  isPublic: boolean;        // show reward rules on product page?
}
```

## Example Configurations

### Company A: "The Equalizer" (Flat Rate)
```
rewardType: FLAT
flatRate: { amount: 25, currency: 'USD', period: 'ONCE' }
newAdopterBoost: { enabled: false }
```
> "Every advocate gets $25 per referral. Usage doesn't matter."

### Company B: "The Meritocrat" (Usage-Based)
```
rewardType: USAGE_BASED
usageBased: { minWeight: 50, baseAmount: 10, weightMultiplier: 0.5 }
newAdopterBoost: { enabled: true, durationDays: 30, multiplier: 2 }
```
> "Base reward is $10. You get an extra $0.50 per credibility point. New adopters get 2x for 30 days."

### Company C: "The Tiered" (Status Levels)
```
rewardType: TIERED
tiers: [
  { name: "Explorer", minWeight: 0, reward: "10% off" },
  { name: "Advocate", minWeight: 50, reward: "$50 credit + swag" },
  { name: "Champion", minWeight: 100, reward: "Lifetime Pro + revenue share" }
]
```
> "Three tiers. Earn your way up."

### Company D: "The Minimalist" (No Rewards)
```
rewardType: FLAT
flatRate: { amount: 0, currency: 'USD', period: 'ONCE' }
```
> "We don't pay affiliates. But we verify and thank our advocates."

## How It's Displayed

On the user's prop card:
```
┌─────────────────────────────────────┐
│ [Logo] Linear                       │
│                                     │
│ 🔥 Active · 2.1 yrs · Weight: 114   │
│                                     │
│ Company Reward: Usage-Based         │
│ Your estimated tier: $62/ref        │
│                                     │
│ [Visit →]                           │
└─────────────────────────────────────┘
```

On the company page:
```
┌─────────────────────────────────────┐
│ Linear's Advocate Program             │
│                                     │
│ Reward Type: Usage-Based              │
│ Base: $10 + $0.50 per weight point   │
│ New Adopter Boost: 2x for 30 days     │
│                                     │
│ [View Full Rules →]                 │
└─────────────────────────────────────┘
```

## The "props" Platform Role

We do NOT:
- Process payments
- Calculate payouts
- Hold funds
- Verify conversions
- Issue tax documents

We DO:
- Display the company's configured rules
- Show the user their estimated tier/reward
- Track clicks (for analytics, not for payment)
- Provide the company with advocate data to execute rewards off-platform

## Consequences

### Positive
- Companies control their own economics
- No financial intermediation liability
- Flexible enough for any business model
- Users see transparency: "This is what the company offers"

### Negative
- Users may be disappointed by low or no rewards
- Companies may configure confusing or unfair rules
- We have no way to verify companies actually pay what they promise
- "Estimated reward" is just math, not a guarantee

## Mitigations
- Clear disclaimer: "Reward rules are set by [Company]. PROPER-RESPECT does not process payments."
- Company reputation score (future): track which companies actually pay advocates
- User reviews: "I got my reward" / "They never paid" (future)
- Default nudge: Usage-based tiered rewards (encourages fair compensation)

## Related
- ADR-002 (Two Weight Systems) — credibility vs. reward separation
- ADR-003 (No Money Holding) — we don't process the rewards

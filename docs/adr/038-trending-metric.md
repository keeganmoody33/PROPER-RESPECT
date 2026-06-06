# ADR-038: The Trending Metric — How We Calculate Product Adoption

## Status
Accepted — 2026-06-05

## Context
"Trending" is a product-level metric showing which products are being adopted rapidly. It's not a user-level metric. How do we calculate it fairly?

## Decision

### The Trending Formula

```
Trending Score = 
  (newAdoptersThisWeek * 0.5) +
  (newAdoptersThisMonth * 0.3) +
  (totalAdvocatesGrowthRate * 0.2)
```

**Where:**
- `newAdoptersThisWeek` = users who added this product in the last 7 days
- `newAdoptersThisMonth` = users who added this product in the last 30 days
- `totalAdvocatesGrowthRate` = (advocates this month / advocates last month) - 1

### The Trending Categories

| Category | Timeframe | Threshold | Example |
|----------|-----------|-----------|---------|
| **🔥 Hot** | Last 7 days | 20+ new adopters | "Cursor is hot: 45 new adopters this week" |
| **📈 Trending** | Last 30 days | 50+ new adopters | "Notion is trending: 89 new adopters this month" |
| **🌱 Rising** | Last 90 days | 100+ new adopters | "Raycast is rising: 120 new adopters this quarter" |
| **⭐ Classic** | All time | 500+ total advocates | "Linear is a classic: 500+ advocates" |

### The Trending Display

**On the product page:**
```
┌─────────────────────────────────────┐
│ [Logo] Cursor                         │
│                                     │
│ 🔥 Hot — 45 new adopters this week  │
│ 234 total advocates · +23% growth   │
│                                     │
│ [View Trending Advocates →]         │
└─────────────────────────────────────┘
```

**On the discovery page:**
```
┌─────────────────────────────────────┐
│ 🔥 Hot Right Now                      │
│                                     │
│ 1. Cursor — 45 new this week        │
│ 2. Warp — 34 new this week          │
│ 3. Claude — 28 new this week        │
│                                     │
│ [View All Hot →]                      │
└─────────────────────────────────────┘
```

### The Anti-Gaming Measures

**Problem:** A company could create 100 fake accounts to boost their trending score.

**Mitigations:**
- **Minimum credibility weight:** New adopters must have credibility weight > 10 (not brand new accounts)
- **Email verification:** New adopters must have verified email
- **Deduplication:** Multiple props from same user don't count
- **Time decay:** Older adoptions weighted less (prevents one-time spikes)
- **Manual review:** Admin can flag suspicious trending patterns

### The Trending vs. Credibility Distinction

| | Trending | Credibility |
|--|----------|-------------|
| **Level** | Product | User |
| **Measures** | Adoption rate | Usage depth |
| **Timeframe** | Short-term (weeks) | Long-term (months/years) |
| **Boosts** | New users | Tenure, content, verification |
| **Gaming risk** | High (fake accounts) | Low (hard to fake tenure) |

**The rule:** Trending is a product discovery tool. Credibility is a user trust tool. They are independent.

## Consequences

### Positive
- Trending helps users discover new tools
- Companies get visibility for rapid growth
- Anti-gaming measures protect integrity
- Time decay prevents outdated trends

### Negative
- Trending favors new products over established ones
- Anti-gaming measures may exclude legitimate new users
- Time decay is arbitrary (why 7 days? why 30 days?)
- Trending can be manipulated by coordinated campaigns

## Mitigations
- Trending is one of many discovery signals (not the only one)
- Established products get "Classic" badge (equal visibility)
- Admin oversight for suspicious patterns
- Community reporting for fake adoptions

## Related
- ADR-019 (Search Discovery) — trending is part of discovery
- ADR-002 (Weight Over Reach) — credibility is separate from trending

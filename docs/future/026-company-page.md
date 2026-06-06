# ADR-026: The Company Page — Auto-Generated Advocate Dashboard

> Parked: not active MVP scope. Revisit only after the core product-stack profile works.


## Status
Accepted — 2026-06-05

## Context
Every product on PROPER-RESPECT gets an auto-generated company page. This is the primary B2B surface. What does it look like? What data does it show?

## Decision

### The Company Page URL

`props.to/products/{slug}` or `props.to/{domain}`

Examples:
- `props.to/products/linear`
- `props.to/linear.app`

### The Page Layout

```
┌─────────────────────────────────────────────────────────┐
│ [Logo] Linear                                           │
│ A project management tool for modern teams.             │
│                                                         │
│ 📊 Advocate Stats                                       │
│ • 247 advocates on PROPER-RESPECT                                │
│ • 89 verified users                                     │
│ • 12 top-tier advocates (Credibility > 100)             │
│ • 34 new adopters this month                            │
│                                                         │
│ 🏆 Top Advocates                                        │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 1. Keegan Moody — Cred: 114 — 2.1 yrs — 3 Looms     │ │
│ │ 2. Sarah Chen — Cred: 89 — 1.5 yrs — 1 Loom         │ │
│ │ 3. Austin Rief — Cred: 76 — 8 mos — 2 Looms         │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 📈 Trending                                             │
│ Advocate count: +23% this month                         │
│ Top growth driver: Content creators (Looms)             │
│                                                         │
│ ⚙️ Company Configuration (if configured)                │
│ Reward Type: Usage-Based                                │
│ Base: $10 + $0.50 per credibility point               │
│ New Adopter Boost: 2x for 30 days                       │
│                                                         │
│ [Configure Rewards →] (for company owners)              │
│                                                         │
│ 🔍 Filter Advocates                                     │
│ [All] [Verified] [Content Creators] [New Adopters]     │
│ [Servant Leaders] [Top 10%]                             │
│                                                         │
│ [View All 247 Advocates →]                              │
└─────────────────────────────────────────────────────────┘
```

### The Advocate Card

```
┌─────────────────────────────────────┐
│ [Avatar] Keegan Moody                 │
│ @keegan · GTM Engineer                │
│                                     │
│ 🔥 Active · 2.1 yrs · Cred: 114     │
│ 3 Looms · 5 people put on           │
│                                     │
│ "Switched from Jira. Never looked    │
│  back. Linear is the operating       │
│  system for our GTM team."            │
│                                     │
│ [▶ Watch Loom →]                    │
│                                     │
│ [Message Advocate →] (if configured)  │
└─────────────────────────────────────┘
```

### The Filter Options

| Filter | Description |
|--------|-------------|
| **All** | Every advocate |
| **Verified** | OAuth or company-confirmed |
| **Content Creators** | Has Looms/screenshots attached |
| **New Adopters** | Joined in last 30 days |
| **Servant Leaders** | High credibility, low social reach |
| **Top 10%** | Credibility weight in top decile |
| **By Tenure** | 1+ year, 2+ year, 3+ year |
| **By Location** | Country/city (if user shared) |

### The Data Shown (Public)

| Data | Source | Public? |
|------|--------|---------|
| Advocate count | Aggregated from public props | Yes |
| Top advocates | Public profiles, ranked by credibility | Yes |
| Advocate growth | Month-over-month change | Yes |
| Content count | Public Looms/screenshots | Yes |
| Credibility scores | Public weight | Yes |
| Tenure | Public firstTriedAt | Yes |
| Location | User-shared (optional) | If shared |

### The Data NOT Shown (Private)

| Data | Why Private |
|------|-------------|
| Individual email addresses | PII |
| Affiliate earnings | Financial data |
| Private props | User choice |
| Email scan metadata | Privacy |
| Screen time data | Privacy |

### The Company Configuration CTA

If the company has NOT configured their page:
```
┌─────────────────────────────────────┐
│ 🎉 You have 247 advocates!          │
│                                     │
│ Configure your reward rules to      │
│ thank them and attract more.        │
│                                     │
│ [Configure Now →]                   │
│                                     │
│ It's free to set up.                │
└─────────────────────────────────────┘
```

### The "Message Advocate" Feature (Company Tier)

```
┌─────────────────────────────────────┐
│ Message Keegan Moody                  │
│                                     │
│ From: Linear Team                     │
│                                     │
│ Subject: [Thank you for being a      │
│          top advocate!       ]       │
│                                     │
│ Body:                                 │
│ [Hi Keegan, we noticed you're one    │
│  of our top advocates on PROPER-RESPECT.     │
│  We'd love to send you some swag     │
│  and invite you to our advisor       │
│  program. Interested?                │
│                                     │
│  — The Linear Team                   │
│                                     │
│ [Send Message]                      │
└─────────────────────────────────────┘
```

**Rules:**
- Company can send 1 message per advocate per month (rate limit)
- Advocate can reply (in-app messaging)
- Advocate can block a company (no more messages)
- All messages are logged for moderation

## Consequences

### Positive
- Auto-generated page requires zero company effort
- Public data is already public (no privacy violation)
- Filter options make advocate discovery easy
- Messaging feature is gated behind Company tier (revenue)

### Negative
- Company page may be empty if no advocates (embarrassing)
- Public advocate data may feel exposing to users
- Messaging feature could be spammy if not rate-limited
- Companies may not want their advocate data public

## Mitigations
- Company page is public by default (data is already public)
- Users can opt out of company page inclusion (make prop private)
- Messaging rate limits prevent spam
- Block feature for advocates
- "Claim" page allows company to configure but not remove public data

## Related
- ADR-007 (Company Reward Config) — configuration on company page
- ADR-011 (Company Discovery) — how companies find their page
- ADR-019 (Search Discovery) — company page is searchable

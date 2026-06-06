# ADR-063: Churn Analysis — Why Users Leave and How We Prevent It

## Status
Accepted — 2026-06-05

## Context
Users will leave. They'll stop using props. They'll cancel their Pro subscription. Understanding why they leave is critical to retention.

## Decision

### The Churn Survey

When a user cancels Pro or deletes their account:
```
┌─────────────────────────────────────┐
│ We're sorry to see you go             │
│                                     │
│ Why are you leaving? (Optional)     │
│                                     │
│ [❌] Too expensive                    │
│ [❌] Didn't find value                │
│ [❌] Found a better alternative       │
│ [❌] Too complicated                  │
│ [❌] Privacy concerns                 │
│ [❌] Just taking a break              │
│ [❌] Other: [______________]        │
│                                     │
│ What could we have done better?     │
│ [Your feedback...              ]      │
│                                     │
│ [Submit & Close Account]            │
│ [Skip & Close Account]              │
└─────────────────────────────────────┘
```

### The Churn Categories

| Category | % of Churn | Prevention |
|----------|-----------|------------|
| **No value found** | 30% | Better onboarding, template profiles, "aha moment" earlier |
| **Too expensive** | 25% | Annual discount, lifetime deal, free tier generosity |
| **Found alternative** | 20% | Competitive differentiation, unique features |
| **Too complicated** | 10% | Simpler UI, better guidance, reduced feature scope |
| **Privacy concerns** | 10% | Clearer privacy messaging, local-first options, data deletion |
| **Just taking a break** | 5% | Easy reactivation, data retention, "pause" option |

### The "Aha Moment" — When Users See Value

**The aha moment for PROPER-RESPECT:** When a user gets their first "Put on by" notification or sees their first profile view milestone.

**How we get users to the aha moment faster:**
1. **Onboarding:** Guide them to add 3 products and 1 lineage within 5 minutes
2. **Share prompt:** "Add this link to your bio" (immediate distribution)
3. **Notification:** When someone views their profile (within 24 hours)
4. **Milestone:** "1 profile view!" (even if it's just them testing)

### The Retention Hooks

| Hook | When | How |
|------|------|-----|
| **Weekly digest** | Every Monday | "You had 12 views this week" |
| **Lineage notification** | When tagged | "Someone gave you props!" |
| **Milestone** | 100 views, 10 props | "You hit a milestone!" |
| **Product rebrand alert** | When detected | "Twitter is now X. Update your prop?" |
| **Trending product** | Weekly | "Cursor is trending. Are you using it?" |
| **Props anniversary** | 1 year | "You've been with us for a year!" |
| **Streak reminder** | Weekly | "You're on a 3-week props streak!" |

### The "Pause" Option (Instead of Cancel)

Instead of canceling Pro, users can "pause":
```
┌─────────────────────────────────────┐
│ Pause Your Pro Subscription         │
│                                     │
│ Instead of canceling, you can pause │
│ for up to 3 months.                 │
│                                     │
│ During pause:                       │
│ • Your profile stays public         │
│ • Your data is preserved            │
│ • Analytics are paused              │
│ • You won't be charged              │
│                                     │
│ [Pause for 1 Month]                   │
│ [Pause for 3 Months]                  │
│ [Cancel Anyway →]                     │
└─────────────────────────────────────┘
```

### The Win-Back Campaign

For users who deleted their account or canceled Pro:
```
Subject: We miss you — and we built something you might like

Body:
Hi Keegan,

You left props a few months ago. We understand — it wasn't the right
fit at the time.

Since then, we've added:
• Screen time integration (auto-detect mobile apps)
• Template profiles ("I'm a designer" → instant stack)
• Import from Linktree (one-click migration)

If you want to give it another try, we'd love to have you back.
Your data is still here if you want it.

[Reactivate My Account →]

No pressure. Just wanted you to know.

— The props team
```

**Win-back rules:**
- Sent 30 days after cancellation
- Only sent once (no spam)
- Includes what's new since they left
- Easy reactivation (one click)
- No guilt or pressure

### The Churn Metrics

| Metric | Target | Calculation |
|--------|--------|-------------|
| **Monthly churn rate (Pro)** | < 5% | Canceled Pro / Total Pro users |
| **Monthly churn rate (Free)** | < 10% | DAU drop / Total users |
| **Reactivation rate** | > 10% | Reactivated / Churned |
| **Time to churn** | > 90 days | Avg. days from signup to cancel |
| **Reason distribution** | Track monthly | Churn survey results |

## Consequences

### Positive
- Churn surveys provide actionable feedback
- Retention hooks keep users engaged
- Pause option reduces cancellation
- Win-back campaigns recover lost users

### Negative
- Churn surveys may annoy departing users
- Retention hooks may feel spammy
- Win-back campaigns have low response rates
- Analyzing churn is depressing

## Mitigations
- Churn survey is optional (not required to cancel)
- Retention hooks respect notification settings
- Win-back is single-email (no drip campaign)
- Focus on product improvement over retention tactics

## Related
- ADR-020 (Cold Start) — churn affects growth metrics
- ADR-025 (Notifications) — retention hooks are notifications
- ADR-030 (Pricing) — pricing affects churn

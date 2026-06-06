# ADR-025: The Notification System — What Users Get Notified About

## Status

Accepted — 2026-06-05

## Context

Notifications drive engagement and viral growth. But too many notifications = spam. We need a clear notification strategy.

## Decision

### The Notification Types

| Type | Trigger | Frequency | Channel | Default |
|------|---------|-----------|---------|---------|
| **Lineage Hardening** | Someone tagged you as "put on by" | Once per tag | Email + In-app | On |
| **Profile View Milestone** | 100, 500, 1000 profile views | Per milestone | In-app | On |
| **New Follower** | Someone follows your profile | Real-time | In-app | On |
| **Company Message** | Company messages you as advocate | Real-time | Email + In-app | On |
| **Prop Click Milestone** | 100 clicks on a single prop | Per milestone | In-app | On |
| **Product Rebrand** | A product you use rebranded | Once | Email + In-app | On |
| **Weekly Digest** | Summary of your week | Weekly | Email | On |
| **Trending Product** | A product you use is trending | Once | In-app | Off |
| **New Feature** | PROPER-RESPECT launches new feature | Per feature | Email | On |
| **Security Alert** | New login, password change | Real-time | Email | On |

### The Lineage Hardening Notification (Most Important)

```
Subject: Keegan Moody gave you respect for putting him on Claude

Body:
Hi Jordan,

Keegan Moody says you put him on Claude. He's now listed you as the 
person who introduced him to the product on his PROPER-RESPECT profile.

View your impact: props.to/jordan

If this is correct, no action needed. If not, you can reject this 
attribution in your dashboard.

— The PROPER-RESPECT team
```

**Why this matters:** This is the primary viral mechanism. It drives signups from tagged people.

### The Weekly Digest

```
Subject: Your respect week in review

Body:
Hi Keegan,

Here's what happened this week:

📊 Profile views: 247 (+12% from last week)
🖱️ Prop clicks: 89 (Linear: 45, Cursor: 32, Claude: 12)
🏷️ New lineage: 3 people gave you respect for putting them on
💰 Estimated affiliate earnings: $23 (from your Amazon links)

Top performing prop: Linear (45 clicks)

View your dashboard: props.to/keegan/dashboard

— The PROPER-RESPECT team
```

### The Notification Settings

```
┌─────────────────────────────────────┐
│ Notification Settings                 │
│                                     │
│ Email Notifications:                  │
│ [✅] Lineage hardening                │
│ [✅] Company messages                 │
│ [✅] Weekly digest                    │
│ [✅] Product rebrands                 │
│ [❌] Trending products                │
│ [✅] New features                     │
│ [✅] Security alerts                  │
│                                     │
│ In-App Notifications:                 │
│ [✅] Profile view milestones          │
│ [✅] New followers                    │
│ [✅] Prop click milestones            │
│ [✅] Company messages                 │
│ [❌] Trending products                │
│                                     │
│ [Save Settings]                     │
└─────────────────────────────────────┘
```

### The Notification Limits

- **Max 1 email per day** (except security alerts)
- **Max 3 in-app notifications per day**
- **Weekly digest: 1 per week, max**
- **Lineage hardening: 1 per tag, no bulk**

### The DND (Do Not Disturb) Mode

Users can enable DND:

- Pauses all non-essential notifications
- Security alerts still come through
- Weekly digest is batched
- Duration: 1 day, 1 week, or custom

## Consequences

### Positive

- Clear notification strategy reduces spam
- Lineage hardening is the primary viral driver
- Weekly digest keeps users engaged
- Granular settings respect user preferences

### Negative

- Too many notification types = settings fatigue
- Email notifications may be ignored (low open rates)
- In-app notifications require mobile app (Phase 3)
- Lineage hardening may feel like spam to some

## Mitigations

- Default settings are conservative (most are off by default)
- One-click "Unsubscribe from all" option
- Lineage hardening has clear opt-out
- Weekly digest is the only email that can't be disabled (but can be set to monthly)

## Related

- ADR-013 (Floating Lineage) — lineage hardening triggers notifications
- ADR-018 (Viral Loop) — notifications drive viral growth

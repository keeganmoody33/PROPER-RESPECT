# ADR-062: Customer Support — Channels, Response Times, and Self-Service

> Parked: not active MVP scope. Revisit only after the core product-stack profile works.


## Status
Accepted — 2026-06-05

## Context
Users will have questions. They'll encounter bugs. They'll need help. How do we support them without a massive team?

## Decision

### The Support Channels

| Channel | Availability | Response Time | Cost |
|---------|-------------|---------------|------|
| **Help Center (docs)** | 24/7 | Immediate | Low |
| **AI Chatbot** | 24/7 | Immediate | Low |
| **Community Discord/Slack** | 24/7 | Community-driven | Low |
| **Email Support** | Business hours | 24 hours | Medium |
| **In-App Messaging** | Business hours | 24 hours | Medium |
| **Phone Support** | Enterprise only | 4 hours | High |

### The Help Center

**Structure:**
```
Getting Started
├── What is props?
├── Creating Your First Profile
├── Connecting Your Email
├── Adding Products Manually
├── Giving Respect (Lineage)
├── Publishing Your Profile

Account & Billing
├── Upgrading to Pro
├── Managing Your Subscription
├── Canceling Your Account
├── Refund Policy

Privacy & Security
├── What Data Do We Collect?
├── How We Protect Your Privacy
├── Deleting Your Account
├── Exporting Your Data

For Companies
├── Finding Your Advocates
├── Configuring Reward Rules
├── Messaging Advocates
├── Understanding Advocate Analytics

Troubleshooting
├── Email Scan Not Finding Products
├── OAuth Connection Issues
├── Profile Not Loading
├── Affiliate Links Not Working
```

### The AI Chatbot

**Capabilities:**
- Answers common questions (from help center)
- Guides users through onboarding
- Troubleshoots basic issues
- Escalates to human support if needed

**Limitations:**
- Cannot handle account-specific issues (privacy)
- Cannot process refunds (human required)
- Cannot access user data (privacy)

### The Community Support

**Discord/Slack community:**
- Users help each other
- Founding Linkers get "Community Helper" role
- Weekly AMA with founders
- Feature requests channel
- Bug reports channel

**Why community:**
- Scales without hiring
- Builds brand loyalty
- Users become advocates
- Real-time feedback

### The Email Support Tiers

| Tier | Response Time | Channels |
|------|---------------|----------|
| **Free** | 48 hours | Help center + community |
| **Pro** | 24 hours | Help center + community + email |
| **Company** | 12 hours | All above + in-app messaging |
| **Enterprise** | 4 hours | All above + phone + dedicated Slack |

### The Support Quality Metrics

| Metric | Target | How Measured |
|--------|--------|-------------|
| **First response time** | < 24h (Pro), < 4h (Enterprise) | Support ticket system |
| **Resolution time** | < 48h (Pro), < 24h (Enterprise) | Support ticket system |
| **Customer satisfaction (CSAT)** | > 90% | Post-resolution survey |
| **Help center article helpfulness** | > 80% | Thumbs up/down on articles |
| **Chatbot resolution rate** | > 70% | Escalation rate |
| **Community response time** | < 2 hours | Discord/Slack monitoring |

### The Self-Service First Principle

**Rule:** 80% of support requests should be resolved without human intervention.

**How:**
- Comprehensive help center
- Smart AI chatbot
- In-app tooltips and guides
- Community FAQ
- Proactive notifications ("Having trouble? Here's a guide")

## Consequences

### Positive
- Self-service scales without hiring
- Community support builds loyalty
- Tiered support aligns cost with revenue
- Metrics ensure quality

### Negative
- AI chatbot may frustrate users with complex issues
- Community support is inconsistent (quality varies)
- Email support requires staffing
- Enterprise phone support is expensive

## Mitigations
- AI chatbot has clear "Talk to human" escape hatch
- Community moderators are trained (Founding Linkers)
- Support team is small initially (founders handle it)
- Enterprise support is priced to cover cost

## Related
- ADR-020 (Cold Start) — support affects early user experience
- ADR-030 (Pricing) — support tiers align with pricing tiers

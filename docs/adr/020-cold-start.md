# ADR-020: The Cold Start Problem — Bootstrapping the Graph

## Status
Accepted — 2026-06-05

## Context
PROPER-RESPECT is a two-sided marketplace: users create profiles, companies discover advocates. But with zero users, there is no graph. With zero graph, there is no value. How do we bootstrap from zero?

## Decision

### The Cold Start Strategy

**Phase 0: The Founder Profile (Week 1)**
- Keegan builds `props.to/keegan` manually
- 10 products, real copy, real lineage
- Shares on Twitter, LinkedIn, Slack
- Goal: 3+ people ask "how do I make one?"

**Phase 0.5: The First 10 (Week 2)**
- If signal from Phase 0, invite 10 friends to create profiles manually
- These are the "Founding Linkers"
- Each gets a "Founding Linker" badge on their profile
- Goal: 10 profiles with 5+ props each

**Phase 1: The Tool Drop (Week 3-4)**
- Launch on Product Hunt, Hacker News, Twitter
- The pitch: "The credibility layer the internet forgot"
- Target: Tech professionals who use 10+ tools
- Goal: 50 signups in first week

**Phase 1.5: The Company Seed (Week 5-6)**
- Manually reach out to 10 companies that have advocates in the graph
- "You have 12 verified advocates on PROPER-RESPECT. Want to configure your reward rules?"
- Not automated. Personal outreach. One by one.
- Goal: 3 companies configure their reward rules

**Phase 2: The Network Effect (Week 7+)**
- "Put on by" notifications start driving signups
- Bio links start driving organic traffic
- Company pages start driving discovery
- The graph grows organically

### The Anti-Cold-Start Tactics

| Tactic | Why It Works |
|--------|-------------|
| **Founder profile** | Keegan's credibility is the first social proof. If Keegan uses it, others will try it. |
| **Founding Linker badge** | Status incentive for early adopters. Exclusive. |
| **Manual company outreach** | No automation. Personal. High touch. Builds relationships. |
| **Product Hunt launch** | Concentrated burst of tech-forward users. Perfect demographic. |
| **Template profiles** | "I'm a designer" → auto-suggest Figma, Sketch. Reduces friction. |
| **Import from Linktree** | One-click import of existing links. Instant profile. |

### The Metric for Cold Start Success

| Week | Metric | Target |
|------|--------|--------|
| 1 | Manual profiles | 1 (Keegan) |
| 2 | Founding Linkers | 10 |
| 3 | Product Hunt signups | 50 |
| 4 | Active profiles (5+ props) | 25 |
| 5 | Companies configured | 3 |
| 6 | "Put on by" lineage links | 20 |
| 8 | Organic signups (non-PH) | 20 |
| 12 | Total profiles | 200 |

### The Kill Criteria for Cold Start

If by Week 4 we have:
- < 25 active profiles → The framing is wrong. Pivot or kill.
- < 5 "Put on by" lineage links → The social graph isn't forming. The "give respect" concept isn't resonating.
- < 3 companies interested → The B2B angle is dead. Focus on consumer only.

## Consequences

### Positive
- Clear bootstrapping path from zero to 200 profiles
- Founder-led growth (Keegan's network is the seed)
- Personal company outreach builds real relationships
- Product Hunt is the perfect launchpad for this demographic

### Negative
- Cold start is slow. 12 weeks to 200 profiles is not viral.
- Requires Keegan's personal network and credibility
- Personal company outreach doesn't scale
- Product Hunt launch is a one-time event

## Mitigations
- If cold start fails, the product is wrong. No amount of engineering fixes bad framing.
- The 12-week timeline is aggressive but realistic for a side project.
- If B2B angle fails, consumer-only is still viable (PROPER-RESPECT as a Linktree replacement with credibility).

## Related
- ADR-018 (Viral Loop) — how the graph grows after cold start
- PRD (Phase 0) — dogfood testing

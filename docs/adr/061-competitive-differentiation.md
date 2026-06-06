# ADR-061: Competitive Differentiation — PROPER-RESPECT vs.. Linktree, Beacons, Stan Store

## Status
Accepted — 2026-06-05

## Context
PROPER-RESPECT is not the first "link in bio" product. Linktree, Beacons, Stan Store, and others exist. How are we different? Why would someone switch?

## Decision

### The Competitive Landscape

| Product | What They Do | What They Don't Do | Their Weakness |
|---------|-------------|-------------------|----------------|
| **Linktree** | Flat list of links | No credibility, no usage proof, no timeline | Anyone can add any link. No verification. |
| **Beacons** | Link list + monetization | No product focus, no usage depth, no social graph | Generic creator tool. Not product-specific. |
| **Stan Store** | Link list + store | No credibility, no verification, no timeline | E-commerce focused. Not for product discovery. |
| **Carrd** | Simple landing pages | No dynamic content, no usage data, no graph | Static. No interactivity. |
| **Polywork** | Professional timeline | No product focus, no affiliate links, no verification | Career-focused. Not product-focused. |
| **Read.cv** | Professional profile | No product stack, no usage proof, no social graph | Resume-focused. Not tool-focused. |
| **GitHub README** | Code + tools list | No verification, no timeline, no social graph | Developer-only. Manual. |
| **Twitter bio** | 160 characters | No links, no structure, no proof | Too limited. |

### The props Differentiation

| Feature | props | Linktree | Beacons | Stan Store |
|---------|-------|----------|---------|-----------|
| **Product focus** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Usage proof** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Timeline (archive)** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Credibility weight** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Social graph (who put who on)** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Affiliate links** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Verification tiers** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Company advocate data** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Email auto-discovery** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Screen time integration** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Free tier** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Custom domain** | ✅ Pro | ✅ Pro | ✅ Pro | ✅ Pro |

### The Positioning Statement

**For:** Tech-forward professionals who use 10+ SaaS tools

**Who:** Want to monetize and verify their product recommendations

**PROPER-RESPECT is:** A credibility protocol

**That:** Proves you actually use the products you recommend, with a timeline of everything you've ever used

**Unlike:** Linktree, which is just a flat list of links with no proof

**We:** Make organic advocacy visible and verifiable, so companies can find their true advocates and visitors can trust recommendations

### The Switching Pitch

**To a Linktree user:**
> "Linktree shows your links. props shows your credibility. With props, visitors know you actually use the products you recommend — not just that you have affiliate links."

**To a Beacons user:**
> "Beacons is for creators. PROPER-RESPECT is for product people. If you want to show what you actually use — with proof — PROPER-RESPECT is the tool."

**To someone with no link aggregator:**
> "You probably get asked 'What tools do you use?' all the time. PROPER-RESPECT is one link that answers that question — with proof that you actually use them."

### The Migration Path

```
┌─────────────────────────────────────┐
│ Switching from Linktree?            │
│                                     │
│ We can import your links:            │
│ [🔗 Import from Linktree →]         │
│                                     │
│ What you'll get:                      │
│ • Product discovery from your links │
│ • Credibility badges for verified   │
│   usage                               │
│ • A timeline of everything you use    │
│ • The social graph of who put you on │
│                                     │
│ [Start Fresh →]                       │
└─────────────────────────────────────┘
```

### The "Why Now?" Answer

**Why does props need to exist now?**
1. **The affiliate economy is broken.** It rewards reach over relevance. props fixes that.
2. **Dark social is invisible.** 90% of product discovery happens in DMs, calls, and conversations. PROPER-RESPECT makes it visible.
3. **Companies are desperate for organic growth.** They can't track word-of-mouth. props gives them the data.
4. **Users are tired of giving free marketing.** They want credit for the advocacy they already do.

## Consequences

### Positive
- Clear differentiation from competitors
- Switching pitch is ready for sales/marketing
- Migration path reduces friction for switchers
- "Why now?" answer is compelling

### Negative
- Competitors may copy features (credibility weight, timeline)
- Linktree has massive brand recognition (hard to compete)
- Beacons has creator monetization (different market)
- Differentiation is subtle (requires education)

## Mitigations
- Focus on the "credibility protocol" angle (hard to copy)
- Build the social graph moat (network effects)
- Target tech professionals first (niche before mass)
- Emphasize the "product journey" story (emotional hook)

## Related
- ADR-020 (Cold Start) — differentiation affects acquisition
- ADR-018 (Viral Loop) — unique features drive viral growth

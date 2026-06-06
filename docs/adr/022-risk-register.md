# ADR-022: The Risk Register — What Could Kill props

## Status
Accepted — 2026-06-05

## Context
Every product has risks. PROPER-RESPECT has more than most because it touches privacy, attribution, money, and social graphs. What are the existential risks?

## Decision

### The Existential Risks (Could Kill the Product)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **No one wants a public product timeline** | Medium | Existential | Phase 0 dogfood test. If 3+ people ask "how do I make one?", risk is mitigated. |
| **Apple/Google ban screen time usage** | Low | High | Screen time is Phase 3+. If banned, fallback to email + manual. |
| **Gmail OAuth scope rejected by users** | Medium | High | Make OAuth optional. Manual logging is always available. |
| **Linktree/Beacons copies the feature** | High | Medium | Archive layer + credibility weight + lineage graph are hard to replicate. |
| **Companies don't care about organic advocates** | Medium | High | Free advocate page first. If no interest, deprioritize B2B. |
| **Privacy backlash ("You're reading my email!")** | Medium | High | Clear messaging: "metadata only." Never read bodies. Ephemeral processing. |
| **Fraud/gaming destroys credibility** | Low | High | Reputation system. Community flagging. No money holding reduces fraud incentive. |
| **Regulatory shutdown (GDPR/CCPA violation)** | Low | Existential | Metadata-only scanning. User consent. Deletion rights. Legal review. |
| **No viral loop materializes** | Medium | High | If bio link + "Put on by" don't drive signups, pivot to SEO/content marketing. |
| **Team can't build it** | Low | High | Phase 0 is static HTML. Phase 1 is Next.js + Prisma. Standard stack. |

### The Non-Existential Risks (Can Be Managed)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Slow growth** | High | Medium | 12-week timeline to 200 profiles. If slower, adjust expectations. |
| **Low Pro tier conversion** | Medium | Medium | Free tier is generous. Pro is for power users. Low conversion is expected. |
| **Company tier pricing resistance** | Medium | Medium | Start with free advocate page. Charge for configuration + analytics. |
| **Duplicate products** | High | Low | Merge tool. Community curation. Fuzzy matching. |
| **Moderation burden** | Medium | Low | Post-moderation. Community flagging. Admin review. |
| **Server costs** | Medium | Low | Start with Vercel + Neon. Scale costs are predictable. |

### The Risk-Adjusted Timeline

| Scenario | Probability | Action |
|----------|------------|--------|
| **Best case** | 20% | Viral loop works. 1,000 profiles by Week 12. Companies line up. |
| **Base case** | 50% | 200 profiles by Week 12. 5 companies configured. Pro tier launches. |
| **Worst case** | 30% | < 50 profiles by Week 4. Pivot framing or kill. |

### The Kill Switch

If any of these happen, we kill or pivot:
1. Phase 0: 0 people ask "how do I make one?" after sharing to 100+ followers
2. Week 4: < 25 active profiles
3. Week 8: < 5 "Put on by" lineage links (social graph isn't forming)
4. Month 3: < 10 companies interested in advocate data (B2B is dead)
5. Regulatory: Cease and desist from any major email provider (Gmail, Outlook)

## Consequences

### Positive
- Clear risk register with mitigations
- Kill criteria are explicit (no ambiguity)
- Risk-adjusted timeline sets realistic expectations
- Worst case is survivable (pivot or kill early)

### Negative
- Risk register is pessimistic (may discourage building)
- Some risks are outside our control (Apple/Google bans)
- Kill criteria are arbitrary (25 profiles by Week 4 may be too aggressive)

## Mitigations
- Review risk register monthly
- Adjust kill criteria based on learnings
- Celebrate small wins (10 profiles is a win, not a failure)
- If B2B is dead, consumer-only is still viable

## Related
- ADR-020 (Cold Start) — bootstrapping strategy
- PRD (Kill Criteria) — specific metrics for go/no-go

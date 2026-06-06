# ADR-013: Floating Lineage Hardening — When Tagged Person Joins

## Status
Accepted — 2026-06-05

## Context
When Keegan tags "Jordan Crawford" as the person who put him on Claude, but Jordan is not on PROPER-RESPECT, the lineage is "floating" — stored as text, not linked to a user. What happens when Jordan joins props later?

## Decision

### The Hardening Flow

1. **Jordan joins props** (creates account with email or OAuth)
2. **System scans for floating lineage** mentioning "Jordan Crawford" or matching email/domain
3. **Potential matches found:**
   - Keegan's prop: "Put on by Jordan Crawford"
   - Sarah's prop: "Put on by Jordan Crawford"
   - Daniel's prop: "Put on by Jordan Crawford"
4. **Jordan receives a notification:** "3 people say you put them on products. Confirm?"
5. **Jordan reviews each lineage:**
   - [Confirm] "Yes, I put Keegan on Claude"
   - [Reject] "No, I didn't put Sarah on Notion"
   - [Ignore] "I don't remember putting Daniel on Linear"
6. **Confirmed lineages are "hardened":**
   - `fromUserId` is populated with Jordan's user ID
   - Status changes from `FLOATING` to `CONFIRMED`
   - Jordan's profile shows the credit
   - Keegan's profile shows the confirmed link

### The Matching Algorithm

How do we match "Jordan Crawford" (free text) to Jordan's actual account?

| Signal | Confidence | Action |
|--------|-----------|--------|
| Exact name match + email domain match | High | Auto-suggest, user confirms |
| Exact name match only | Medium | Show to user, ask to confirm |
| Partial name match | Low | Show as "maybe you?" |
| No match | None | Ignore |

**Example:**
- Keegan logged: "Jordan Crawford" (name) + "jordan@cannonball.com" (email, if known)
- Jordan signs up with email: "jordan@cannonball.com"
- Match: High confidence → auto-suggest to Jordan

### The Notification

```
┌─────────────────────────────────────┐
│ You have 3 pending lineage links    │
│                                     │
│ Keegan Moody says you put him on:   │
│ • Claude                            │
│                                     │
│ Sarah Chen says you put her on:     │
│ • Notion                            │
│                                     │
│ Daniel Park says you put him on:    │
│ • Linear                            │
│                                     │
│ [Review All →]                      │
└─────────────────────────────────────┘
```

### The Time Limit

Floating lineages have a **2-year expiration**:
- After 2 years, if the tagged person hasn't joined, the lineage remains as text but is no longer eligible for hardening
- This prevents old, stale attributions from surfacing years later
- User can manually re-activate (re-log the lineage)

## Consequences

### Positive
- Social graph grows organically as people join
- No friction for the original logger (Keegan doesn't need Jordan to join first)
- Jordan gets a "welcome" experience with immediate social proof
- Confirmed lineages boost credibility weight for both parties

### Negative
- Matching algorithm can be wrong (false positives)
- Users may be annoyed by "someone said you put them on" notifications
- Privacy concern: "I didn't know Keegan was logging that I put him on"
- 2-year expiration is arbitrary

## Mitigations
- User can disable lineage notifications in settings
- Rejecting a lineage is permanent (can't be re-suggested)
- Clear explanation: "This is public data that [User] chose to share. You can confirm or reject."
- Grace period: 30 days to review before expiration starts

## Related
- ADR-009 (Manual Put On By) — floating lineage is the default
- ADR-004 (Public Graph Privacy) — lineage is public, but user controls what they log

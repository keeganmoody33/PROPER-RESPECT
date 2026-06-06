# ADR-016: Seasonal and Intermittent Usage

## Status
Accepted — 2026-06-05

## Context
Some products are not used daily or weekly. They are used seasonally, intermittently, or on-demand. Examples: tax software (used once a year), travel booking tools (used twice a year), event platforms (used monthly).

## Decision

### The Status Model for Intermittent Usage

The current status model (`ACTIVE`, `TESTING`, `ARCHIVED`, `DORMANT`) assumes regular usage. We need a new status for intermittent:

| Status | Definition | Use Case |
|--------|-----------|----------|
| **ACTIVE** | Used in the last 30 days | Daily/weekly tools |
| **SEASONAL** | Used periodically (e.g., quarterly, annually) | Tax software, travel tools |
| **INTERMITTENT** | Used on-demand (e.g., when needed) | Design tools, event platforms |
| **TESTING** | Trial or new adopter | New products |
| **ARCHIVED** | Used to use, now switched | Outgrown products |
| **DORMANT** | No usage in 90+ days | Churned products |

### The Credibility Weight for Seasonal Products

**Problem:** A seasonal product used once a year would show as `DORMANT` for 11 months, losing credibility weight.

**Solution:**
- Seasonal products get a **tenure boost** regardless of recency
- If user has used the product for 3+ years (even annually), they get tenure points
- The `SEASONAL` status prevents the dormancy penalty
- Content proof (e.g., "I use this every tax season") provides context

**The algorithm adjustment:**
```
if (prop.status === 'SEASONAL') {
  score += Math.min(tenure_months, 24); // Full tenure credit
  score += 15; // Seasonal bonus (less than Active but more than Dormant)
}
```

### The UI for Seasonal Products

```
┌─────────────────────────────────────┐
│ [Logo] TurboTax                     │
│                                     │
│ 🗓️ Seasonal · 4 yrs · Cred: 62     │
│ "Use every tax season. Reliable."   │
│                                     │
│ Last used: Mar 2026                 │
│ Usage pattern: Annually             │
│                                     │
│ [Visit →]                           │
└─────────────────────────────────────┘
```

**The display:**
- Status badge: `🗓️ Seasonal` (calendar icon)
- Last used date is shown (even if months ago)
- Usage pattern: "Annually", "Quarterly", "Monthly", "On-demand"
- No dormancy penalty

### How We Detect Seasonal Usage

| Signal | Detection |
|--------|-----------|
| **Email scan** | Receipts at regular intervals (e.g., every April) |
| **Screen time** | Spikes at predictable intervals |
| **Manual logging** | User marks as "Seasonal" and sets pattern |
| **Content** | User attaches a note: "Use every tax season" |

**Default:** If email scan shows usage at 12-month intervals, auto-suggest `SEASONAL` status.

## Consequences

### Positive
- Seasonal products don't get unfairly penalized
- User's true product journey is preserved
- Tax software, travel tools, event platforms get proper representation
- Visitors understand: "This person uses it seasonally, not daily"

### Negative
- More complex status model
- Harder to auto-detect seasonal patterns
- "Seasonal" could be gamed (user marks everything as seasonal to avoid dormancy)
- UI clutter with more status badges

## Mitigations
- Seasonal status requires either:
  - 2+ years of usage history (email scan proof)
  - User explicitly marks it with a usage pattern
  - Content proof explaining the seasonality
- Seasonal bonus is lower than Active bonus (15 vs. 25)
- Annual review: if a "seasonal" product hasn't been used in 2+ cycles, flag for review

## Related
- ADR-002 (Weight Over Reach) — seasonal adjustment to credibility weight
- ADR-001 (Email Passport) — email patterns detect seasonality

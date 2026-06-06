# ADR-009: Manual "Put On By" Logging — The Social Graph

## Status
Accepted — 2026-06-05

## Context
Most product introductions happen outside of trackable digital channels. A friend mentions a tool over coffee. A colleague drops a recommendation in a Zoom call. A mentor sends a Loom with no referral link. The "dark social" of product discovery is 90% of how people find tools — and it has zero attribution.

## Decision
Users manually log who put them on a product. **No link required. No confirmation required. No digital trace required.** The user is the source of truth.

## The Core User Story

> **Jordan Crawford** of Cannonball Go-To-Market tells Keegan about Claude in a conversation. There's no link. No referral code. No tweet. Just: "You should check out Claude."
>
> Keegan tries Claude. Loves it. Adds it to his PROPER-RESPECT profile.
>
> In the "Put on by" field, Keegan types: **"Jordan Crawford"** or **"@jordan"**
>
> Jordan gets credit. The lineage is recorded. No confirmation needed.

## The Flow

### Step 1: User Logs Lineage (Manual)
When adding or editing a prop, the user sees:
```
┌─────────────────────────────────────┐
│ Who put you on this?                │
│                                     │
│ [Jordan Crawford        ] [+ Add]   │
│                                     │
│ Or tag someone on PROPER-RESPECT:            │
│ [@jordan, @sarah, @austin]          │
└─────────────────────────────────────┘
```

### Step 2: System Resolves the Tag

| Scenario | Resolution |
|----------|------------|
| User types a **props username** (`@jordan`) | Link to Jordan's profile. Jordan gets notified. Jordan can confirm (optional) or ignore. |
| User types a **name** ("Jordan Crawford") | Stored as free text. "Floating" attribution. Searchable but not linked. |
| User types **multiple people** | Each gets a separate lineage entry. Multiple people can get credit for the same introduction. |
| User leaves it **blank** | No lineage. The prop stands alone. |

### Step 3: Status Tracking

| Status | Meaning |
|--------|---------|
| `SELF_ATTESTED` | User logged it manually. No external confirmation. This is the default and it's valid. |
| `CONFIRMED` | Tagged person confirmed the lineage (optional). "Yes, I put Keegan on this." |
| `FLOATING` | Tagged person not on PROPER-RESPECT. Stored as text. Can be linked later if they join. |
| `REJECTED` | Tagged person explicitly denied the lineage (rare). |

**The default is `SELF_ATTESTED`.** No confirmation is required for lineage to be valid. The user's word is enough.

## Why No Mandatory Confirmation?

1. **Most introductions are offline.** There's no digital mechanism to confirm a coffee-shop conversation.
2. **Confirmation creates friction.** If Jordan has to click an email to confirm he put Keegan on Claude, 80% of lineages will never complete.
3. **The user is the source of truth.** Keegan knows who influenced him. We don't need Jordan's permission for Keegan to express gratitude.
4. **The graph grows organically.** If Jordan joins props later, the floating attribution can be hardened into a confirmed link.

## The Public Display

On Keegan's profile:
```
┌─────────────────────────────────────┐
│ [Logo] Claude                       │
│                                     │
│ 🔥 Active · 6 mos · Weight: 67      │
│                                     │
│ "Jordan Crawford put me on this.      │
│  Changed how I work."                 │
│                                     │
│ [▶ Loom: My Claude Workflow]        │
│                                     │
│ Put on by: Jordan Crawford          │
│                                     │
│ [Visit →]                           │
└─────────────────────────────────────┘
```

On Jordan's profile (if he's on PROPER-RESPECT):
```
┌─────────────────────────────────────┐
│ Jordan's Impact                     │
│                                     │
│ Products Jordan put people on:      │
│ • Claude (3 people)                 │
│ • Linear (1 person)                 │
│ • Cannonball (12 people)            │
│                                     │
│ Total impact: 16 people influenced  │
└─────────────────────────────────────┘
```

## The Network Effect

Over time, the lineage graph becomes a **map of influence**:
- "Who is the most influential person in my network for SaaS tools?"
- "What products spread through which communities?"
- "Who is the 'patient zero' for Cursor adoption in the GTM world?"

This is **market intelligence** that no affiliate platform can provide because it captures the 90% of introductions that happen without links.

## Consequences

### Positive
- Captures dark social — the real way people discover products
- No friction — users log lineage in seconds
- Social gratitude — people get credit even without affiliate links
- Network effects — the graph becomes more valuable as it grows

### Negative
- No verification — users could falsely claim lineage (e.g., "Elon Musk put me on this")
- Tagged people may not want to be associated with a product
- Floating attributions create orphaned data
- No digital proof — it's just the user's word

## Mitigations
- Reputation system (future): Users with consistent, high-quality lineage get higher trust scores
- Report false lineage: Tagged person can flag "I didn't put this person on"
- Community norms: Public social graph creates social pressure to be honest
- Floating attributions can be claimed later if the person joins

## Related
- ADR-004 (Public Graph Privacy) — lineage is public, but user controls what they log
- ADR-002 (Two Weight Systems) — confirmed lineage adds to credibility weight

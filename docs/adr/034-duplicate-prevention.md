# ADR-034: Duplicate Product Prevention and Merge Tool

## Status
Accepted — 2026-06-05

## Context
With user-driven product creation, duplicates are inevitable. "Claude" vs "Anthropic Claude" vs "Claude AI." How do we prevent and fix duplicates?

## Decision

### The Prevention Layer

**Layer 1: Fuzzy Matching at Creation**

When a user types a product name:
```
User types: "Claude"
    ↓
System suggests:
┌─────────────────────────────────────┐
│ Did you mean one of these?          │
│                                     │
│ • Claude (anthropic.com) — 45 users│
│ • Claude AI (claude.ai) — 12 users │
│ • Claude Code (code.claude.ai) — 3 │
│                                     │
│ [Select Existing] [Create New]      │
└─────────────────────────────────────┘
```

**Matching signals:**
- Name similarity (Levenshtein distance < 3)
- Domain match (user types domain that exists)
- Alias match ("Anthropic Claude" matches "Claude")

**Layer 2: Domain Collision**

If user tries to create a product with a domain that already exists:
```
┌─────────────────────────────────────┐
│ ⚠️ This domain already exists       │
│                                     │
│ linear.app is already used by:      │
│ • Linear (project management)       │
│                                     │
│ [Use Existing] [Use Different Domain]│
└─────────────────────────────────────┘
```

**Layer 3: Community Flagging**

Users can flag duplicates:
```
[Flag as Duplicate →]
┌─────────────────────────────────────┐
│ Flag as Duplicate                     │
│                                     │
│ This product is a duplicate of:     │
│ [Search existing products...    ]   │
│                                     │
│ Reason: [Same product, different name]│
│                                     │
│ [Submit Flag]                       │
└─────────────────────────────────────┘
```

### The Merge Tool

**Admin-only merge:**
```
┌─────────────────────────────────────┐
│ Merge Products                        │
│                                     │
│ Source: Claude AI (12 users)          │
│ Target: Claude (45 users)             │
│                                     │
│ This will:                            │
│ • Move 12 users from "Claude AI" to "Claude"│
│ • Archive "Claude AI" as an alias    │
│ • Update all links and references     │
│                                     │
│ [Preview Merge] [Execute Merge]       │
└─────────────────────────────────────┘
```

**Merge rules:**
- Source product is archived (becomes alias of target)
- All PROPER-RESPECT are moved to target product
- User gets notification: "Your prop for 'Claude AI' was merged into 'Claude'"
- Credibility weight is preserved
- Content is preserved

### The Alias System

When a product is merged, the old name becomes an alias:
```
Product: Claude
Aliases: ["Claude AI", "Anthropic Claude", "claude"]
Domains: ["anthropic.com", "claude.ai"]
```

Search for any alias → returns the canonical product.

### The Duplicate Score

System calculates a "duplicate risk" score for each product:
```
duplicateRisk = 
  nameSimilarity * 0.4 +
  domainSimilarity * 0.3 +
  userOverlap * 0.2 +
  descriptionSimilarity * 0.1
```

If score > 0.8, flag for admin review.

## Consequences

### Positive
- Fuzzy matching prevents most duplicates at creation
- Merge tool fixes duplicates without data loss
- Alias system preserves searchability
- Community flagging scales detection

### Negative
- Fuzzy matching has false positives ("Claude" vs "Claude Shannon" — different things)
- Merge tool is admin-only (bottleneck)
- User notifications about merges may be confusing
- Alias system can create infinite loops if not careful

## Mitigations
- Fuzzy match threshold is conservative (only high-confidence matches)
- User can override suggestions ("No, this is different")
- Merge preview shows exactly what will happen
- Admin batch merge for known duplicates (e.g., after a rebrand)

## Related
- ADR-005 (Manual Product Database) — user-driven creation causes duplicates
- ADR-008 (Product Rebrand) — rebrands may create temporary duplicates

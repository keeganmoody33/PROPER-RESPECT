# ADR-008: Product Rebrand Handling

## Status
Accepted — 2026-06-05

## Context
Products change names. Twitter became X. Facebook became Meta (the app stayed Facebook, but the company rebranded). Google Workspace was G Suite. Users need their historical usage to remain coherent even when the product's identity changes.

## Decision
A product rebrand is treated as a **continuation of the same entity**, not a new product. The timeline remains unbroken.

## The Rebrand Model

```typescript
interface Product {
  id: string;
  name: string;              // Current name: "X"
  slug: string;              // Current slug: "x"
  domains: string[];         // Current + old domains: ["x.com", "twitter.com"]
  aliases: string[];         // Historical names: ["Twitter", "twitter"]

  // Rebrand lineage
  predecessorId: string | null;  // Previous incarnation (if any)
  successorId: string | null;    // Next incarnation (if any)
  rebrandDate: Date | null;      // When the name changed

  // History
  createdAt: Date;           // Original creation date
  updatedAt: Date;           // Last update (including rebrand)
}
```

## How Rebrands Work

### Scenario 1: Simple Rebrand (Twitter → X)
1. Product exists as "Twitter" (domains: ["twitter.com"])
2. Company declares rebrand to "X"
3. Product entity updated:
   - name: "X"
   - slug: "x"
   - domains: ["x.com", "twitter.com"] (both valid)
   - aliases: ["Twitter", "twitter"]
   - rebrandDate: 2023-07-24
4. All existing user props remain attached to the same entity
5. User profile shows: "Twitter → X (2023)" or just "X" with alias

### Scenario 2: Company Rebrand (Facebook app vs. Meta company)
- The app "Facebook" stays "Facebook" (no change)
- The company "Facebook" becomes "Meta" (company entity, not product entity)
- Products are independent of company rebrands unless explicitly changed

### Scenario 3: Product Split (Google → Google Workspace + Gmail + Docs)
- If a product splits into distinct offerings, each becomes a separate product entity
- Pre-split usage stays on the original entity
- Post-split usage is logged on the new specific entity
- Predecessor link: "Google Docs" → predecessor: "Google Workspace" (or "Google")

### Scenario 4: Merger (Product A + Product B → Product C)
- New product entity created for Product C
- Product A and B marked as archived with successor link to Product C
- User props on A/B stay on A/B (historical truth)
- Users can add new prop for Product C

## Retroactive Usage

**Question:** Can we backfill usage data after a rebrand?

**Answer:** Depends on what the company allows.

| Scenario | What We Can Do |
|----------|---------------|
| Company provides historical API | Backfill usage data to the original entity |
| Company does not provide API | User's email history and manual logs provide the timeline |
| No data available | The prop exists with manual dates. Usage verification is limited to what the user logged. |

**The principle:** The user's manual logs and email history are the **source of truth** for retroactive usage. Company API data is **enrichment** when available.

## Display Rules

On a user's profile:
- **Current name is primary:** "X"
- **Alias shown on hover:** "formerly Twitter"
- **Timeline shows continuity:** "2019 → Present (Twitter → X, 2023)"
- **Archived props show historical name:** "Twitter (archived 2023)"

On search:
- Search "Twitter" → returns "X" (with alias match)
- Search "X" → returns "X"
- Search "twttr" → returns "X" (if alias includes it)

## Consequences

### Positive
- User timelines remain coherent through rebrands
- No duplicate products for the same service
- Historical usage is preserved
- Search works across old and new names

### Negative
- Requires manual curation when rebrands happen (who updates the entity?)
- Domain changes may break email resolution temporarily
- Users may be confused by name changes on their profile
- Legal/trademark issues if we display old names

## Mitigations
- Community reporting: "This product rebranded" → admin review → update
- Auto-detection: Monitor domain redirects (twitter.com → x.com) → flag for review
- Clear UI: "formerly Twitter" is explicit, not hidden
- Company-initiated updates: If company claims product, they can update their own name

## Related
- ADR-005 (Manual Product Database) — products are community-managed

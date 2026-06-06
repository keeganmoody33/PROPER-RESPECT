# ADR-005: Manual Product Database — No Canonical Source

## Status
Accepted — 2026-06-05

## Context
Products are being created faster than any database can track them. A new SaaS launches every day. A developer ships a new tool on Product Hunt every hour. Relying on Clearbit, Crunchbase, or any canonical product database means we will miss 80% of the long tail.

## Decision
We do NOT maintain a canonical product database. Products are created and managed through **user-driven discovery** and **manual curation**.

## How It Works

### Product Creation (User-Driven)
1. User adds a product to their profile
2. If the product exists in our DB: Link to it
3. If the product does NOT exist: User creates it on the fly
   - Name: "Claude" or "Cannonball" or "SomeNewStartup"
   - Domain: "anthropic.com" or "cannonball.com"
   - Logo: Auto-fetched from favicon or user-uploaded
   - Description: User-written or auto-generated from meta tags
4. The product is now in the database, available for other users

### Product Resolution (Best-Effort)
- Email scan extracts sender domain → matches existing product by domain
- If no match: Creates a new product entry with the domain as the key
- User can merge duplicates later (e.g., "linear.app" and "linear.so")

### No Canonical Enforcement
- We do not require products to be "registered" or "verified" before appearing
- We do not curate which products are "legitimate"
- We do not maintain a taxonomy or category tree
- Categories are user-tagged or auto-detected (loose, not strict)

## The Product Entity (Flexible)

```typescript
interface Product {
  id: string;
  name: string;              // "Claude" — user-defined or auto-extracted
  slug: string;              // "claude" — URL-safe
  domains: string[];         // ["anthropic.com", "claude.ai"] — multiple allowed
  logoUrl: string | null;    // favicon or user-uploaded
  description: string | null; // user-written or meta-tag extracted

  // Company configuration (optional, if company claims it)
  claimedBy: string | null; // user/company account ID
  rewardConfig: RewardConfig | null; // company-defined rules

  // Aggregates (auto-calculated)
  propCount: number;         // how many users list this
  verifiedCount: number;     // how many verified props

  // History tracking
  createdAt: Date;
  updatedAt: Date;
  aliases: string[];         // ["Claude AI", "Anthropic Claude"] — for search
  predecessorId: string | null; // if rebranded from another product
  successorId: string | null;   // if rebranded to another product
}
```

## Handling Rebrands

When a product changes its name (e.g., Twitter → X):
- The product entity keeps its history
- Name is updated to the new declaration ("X")
- Aliases include the old name ("Twitter")
- Predecessor/successor links maintain the timeline
- User props remain attached to the same entity
- Usage history is continuous: "Used Twitter 2019-2023, continued as X 2023-present"

**Retroactive usage:** Depends on what the company allows us to see. If they provide historical data via API, we can backfill. If not, the user's manual logs and email history provide the timeline.

## Multi-Domain Products

**Same product, multiple domains:**
- Linear: `linear.app`, `linear.so` → Same product, multiple domains
- All domains resolve to the same product entity

**Same company, different products:**
- Google: Gmail, Google Docs, Google Drive → Different products, each with their own card
- Each product has its own affiliate link (if applicable)
- Each product is independently tracked for usage

**Divergent properties (same company, distinct offerings):**
- Notion: Notion (personal) vs. Notion Enterprise → Could be same product or split
- Decision: Split only if the user treats them differently. Default to one product per distinct URL/app experience.

## Consequences

### Positive
- No dependency on external databases
- Supports the long tail of new products immediately
- Community-driven curation (users define the product graph)
- Flexible handling of rebrands, aliases, and edge cases

### Negative
- Duplicate products will exist (user-created "Claude" vs. auto-created "anthropic.com")
- Inconsistent naming and descriptions
- No standardized categories or taxonomy
- Search quality may suffer without canonical data

## Mitigations
- "Merge product" tool for users/admins to deduplicate
- Suggest existing products during creation (fuzzy match on domain/name)
- Community voting on product names/descriptions (future)
- Auto-extract metadata from domain (favicon, title, meta description) to pre-populate

## Related
- ADR-008 (Product Rebrand Handling) — detailed rebrand timeline logic
- ADR-001 (Email Passport) — domain extraction feeds product creation

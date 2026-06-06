# ADR-037: Import from Linktree, Beacons, and Other Link Aggregators

## Status
Accepted — 2026-06-05

## Context
Many users already have a Linktree, Beacons, or similar link aggregator. Importing from these tools provides instant value and reduces switching friction.

## Decision

### The Supported Imports

| Source | What We Import | How |
|--------|---------------|-----|
| **Linktree** | Links, titles, categories | URL parsing + meta tag extraction |
| **Beacons** | Links, titles, images | URL parsing + meta tag extraction |
| **Stan Store** | Links, products | URL parsing + meta tag extraction |
| **Carrd** | Links, sections | URL scraping (with user permission) |
| **Twitter bio** | Links in bio | Twitter API (if connected) |
| **Browser bookmarks** | Bookmarks | Browser extension export |
| **Notion** | Pages, databases | Notion API (if connected) |
| **GitHub README** | Links in README | GitHub API (if connected) |

### The Import Flow

```
┌─────────────────────────────────────┐
│ Import from existing tools            │
│                                     │
│ [🔗 Linktree]  [🔥 Beacons]          │
│ [🛒 Stan Store]  [📄 Carrd]           │
│ [🐦 Twitter]   [🔖 Bookmarks]        │
│ [📓 Notion]    [🐙 GitHub]           │
│                                     │
│ [Skip →]                              │
└─────────────────────────────────────┘
```

### The Linktree Import Example

1. User clicks "Linktree"
2. System asks for Linktree URL: `https://linktr.ee/keegan`
3. System scrapes the page (read-only, no auth needed)
4. Extracts links and titles:
   - "My Newsletter" → `https://keegan.substack.com`
   - "My Course" → `https://keegan.teachable.com`
   - "My Tools" → `https://notion.so`
   - "My Gear" → `https://amazon.com/...`
5. Maps links to Product entities:
   - `notion.so` → Notion (product)
   - `amazon.com/...` → Amazon product (manual review needed)
   - `substack.com` → Substack (product)
   - `teachable.com` → Teachable (product)
6. Creates draft props for each mapped product
7. User reviews and confirms

### The Mapping Challenge

Not all links map cleanly to products:

| Link | Maps To? | Action |
|------|----------|--------|
| `https://linear.app` | Linear | Auto-create prop |
| `https://notion.so` | Notion | Auto-create prop |
| `https://amazon.com/dp/B08N5WRWNW` | Kindle Paperwhite | Manual review (physical product) |
| `https://keegan.substack.com` | Substack | Auto-create prop (category: CONTENT) |
| `https://calendly.com/keegan` | Calendly | Auto-create prop |
| `https://personal-website.com` | None (personal site) | Skip |

### The Import Results

```
┌─────────────────────────────────────┐
│ Import Results from Linktree          │
│                                     │
│ Found 8 links:                        │
│                                     │
│ ✅ Mapped to products (5):              │
│ • Notion                              │
│ • Linear                              │
│ • Calendly                            │
│ • Substack                            │
│ • Teachable                           │
│                                     │
│ ❓ Needs review (2):                  │
│ • Amazon product (Kindle?)            │
│ • Personal website (skip?)            │
│                                     │
│ ❌ Could not map (1):                 │
│ • Custom URL shortener                │
│                                     │
│ [Add Mapped Products →]               │
│ [Review All →]                        │
└─────────────────────────────────────┘
```

### The Privacy Note

- Import is read-only scraping
- No authentication with the source platform needed (for public pages)
- For private pages (Notion, GitHub), OAuth is required
- Imported data is treated as draft (user must confirm before publishing)

## Consequences

### Positive
- Instant value for users switching from Linktree/Beacons
- Reduces manual data entry
- Captures products user forgot about
- Lower switching friction

### Negative
- Scraping may break if source site changes layout
- Not all links map to products (manual review needed)
- Users may import spam or irrelevant links
- Privacy concern: scraping user's existing profile

## Mitigations
- Scraping is resilient (tries multiple selectors)
- Unmapped links are flagged for manual review
- User must confirm all imports before publishing
- Import is optional (not required)

## Related
- ADR-024 (Onboarding Flow) — import is part of onboarding
- ADR-005 (Manual Product Database) — imported links feed product creation

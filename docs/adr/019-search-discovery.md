# ADR-019: Search and Discovery — How People Find Props

## Status
Accepted — 2026-06-05

## Context
How do visitors find profiles? How do companies find advocates? How do users discover new products? Search is critical for the graph to be useful.

## Decision

### The Three Search Surfaces

| Surface | User | What They Search For |
|---------|------|---------------------|
| **Profile Search** | Visitors | "Find people who use Linear and Cursor" |
| **Product Search** | Companies | "Find advocates for my product" |
| **People Search** | Users | "Find Keegan's profile" |

### Profile Search (Visitor-Facing)

**Query examples:**
- "Users who use Linear AND Cursor"
- "Users with credibility weight > 100 for Figma"
- "Users who switched from Notion to Obsidian"
- "Users who put people on Claude"

**Filters:**
- Product (single or multiple)
- Credibility weight range
- Verification tier
- Status (Active, Testing, Archived)
- Content count
- Location (future)
- Industry (future)

### Product Search (Company-Facing)

**Query examples:**
- "Advocates for linear.app"
- "Top 10% of Linear advocates"
- "Advocates who also use Cursor"
- "New adopters of Linear (joined in last 30 days)"

**Filters:**
- Credibility weight
- Tenure
- Verification tier
- Content richness
- "Put on" count
- Reward tier (if company configured)

### People Search (Direct Navigation)

**Query examples:**
- "keegan" → `props.to/keegan`
- "keegan moody" → fuzzy match
- "@keegan" → exact match

**Search ranking:**
1. Exact username match
2. Exact display name match
3. Fuzzy name match
4. Bio text match
5. Product match ("users who have Linear in their profile")

### The Search Index

**What is indexed:**
- Usernames
- Display names
- Bio text
- Product names (in user's profile)
- Context notes (in PROPER-RESPECT)
- "Put on by" names

**What is NOT indexed:**
- Private props
- Email metadata
- OAuth data
- Screen time data
- Deleted content

### The Discovery Feed (Future)

A "Explore" page showing:
- Trending products (most added in last 30 days)
- Top advocates (highest credibility weight)
- Recent switches ("Keegan switched from Jira to Linear")
- New products (recently created by users)

## Consequences

### Positive
- Search makes the graph discoverable
- Companies can find advocates without knowing names
- Visitors can find trusted recommenders
- Discovery feed creates engagement

### Negative
- Search requires indexing infrastructure (Algolia, Elasticsearch)
- Privacy risk: indexing bio text and context notes
- Spam risk: users gaming search with keyword stuffing
- Performance: searching across 100K+ profiles is expensive

## Mitigations
- Index only public data
- Rate limit search API
- No full-text search of private notes
- Discovery feed is curated, not algorithmic (to avoid spam)

## Related
- ADR-005 (Manual Product Database) — product names are indexed
- ADR-002 (Weight Over Reach) — credibility weight is a search filter

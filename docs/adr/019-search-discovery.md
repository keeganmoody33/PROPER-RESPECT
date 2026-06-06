# ADR-019: Search and Discovery - Simple Public Search First

## Status
Accepted - revised 2026-06-06

## Context

Search is useful, but the MVP does not need company advocate search, trend rankings, or scoring filters. The first need is simple: users and visitors should find profiles and products that are already public.

## Decision

Start with simple database-backed search over public data.

## MVP Search Surfaces

| Surface | Query Examples |
| --- | --- |
| People search | "keegan", "keegan moody" |
| Product search | "Linear", "Wispr Flow", "Claude" |
| Profile product filter | "show Keegan's active products" |

## Indexed Data

- Username
- Display name
- Bio
- Public product names
- Public prop notes/headlines
- Public lineage names

## Not Indexed

- Draft props
- Private props
- Import artifacts before approval
- Raw receipts or screenshots not published
- API/OAuth data not converted into public proof

## Future

Advanced discovery, trending products, company advocate search, and scoring filters are parked until there are enough public profiles to make them useful.

## Consequences

### Positive

- Keeps implementation simple.
- Uses only public data.
- Avoids premature analytics/search infrastructure.

### Negative

- No advanced discovery at launch.
- Manual curation and direct profile sharing matter more early.

## Related

- ADR-004 - Public/private draft boundaries
- ADR-037 - Imports

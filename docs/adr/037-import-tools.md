# ADR-037: Import From Existing Public Surfaces

## Status
Accepted - revised 2026-06-06

## Context

Many linkers already have public traces of their product stack: Linktree, Beacons, GitHub README, YouTube descriptions, Twitter/X bios, newsletters, personal websites, or docs pages. Importing these sources can get a user partway to a profile without email scanning or invasive tracking.

## Decision

Support importers that create draft props from user-provided or public URLs.

| Source | What We Extract | MVP Priority |
| --- | --- | --- |
| Linktree/Beacons/Stan/Carrd | Links, titles, sections, images where available | High |
| Personal website | Links and headings | High |
| GitHub README/profile | Links, repo evidence, package/tool mentions | High |
| Twitter/X bio | Links in profile | Medium |
| YouTube descriptions | Product links and affiliate links | Medium |
| Newsletter/article URL | Product mentions and links | Medium |
| Pasted URL list | URLs, domains, titles | High |

All imported items are drafts until the linker approves them.

## Mapping Rule

Imports should map domains to product candidates, not pretend they know the user's intent. When uncertain, show the candidate in review.

## Consequences

### Positive

- Reduces blank-page friction.
- Uses public/user-approved surfaces.
- Helps consolidate affiliate links already scattered across the internet.

### Negative

- Scrapers can break.
- Links do not always equal usage.
- Manual review is required.

## Related

- ADR-001 - Proof sources
- ADR-024 - Onboarding
- ADR-005 - User-driven product creation

# ADR-005: User-Driven Product Database

## Status
Accepted - revised 2026-06-06

## Context

PROPER-RESPECT needs product entities for cards, imports, search, logos, aliases, and duplicate prevention. A complete canonical product database is not realistic at launch.

## Decision

Products are created and refined through user-driven creation plus lightweight enrichment.

## Product Creation Flow

1. Linker adds or imports a product.
2. System searches existing products by name, domain, and alias.
3. If a match exists, linker can attach their prop to it.
4. If no match exists, linker creates a product with name and URL/domain.
5. Metadata enrichment can suggest logo, title, and description.
6. Admin/community tools can merge duplicates later.

## Product Entity

```typescript
interface Product {
  id: string;
  name: string;
  slug: string;
  domains: string[];
  aliases: string[];
  logoUrl: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

## Rules

- Products do not need company approval to exist.
- Products can be free, paid, open-source, physical, services, courses, or communities.
- The linker decides whether a product belongs on their stack.
- Product records support aliases and multiple domains.
- Duplicate products are expected early and handled through merge tools.

## Consequences

### Positive

- Supports long-tail products immediately.
- Does not depend on external databases.
- Keeps launch focused on linker curation.

### Negative

- Duplicates will happen.
- Logos/descriptions may be inconsistent.
- Search quality depends on merge and alias hygiene.

## Related

- ADR-034 - Duplicate prevention
- ADR-037 - Imports
- ADR-008 - Product rebrands

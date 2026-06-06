# ADR-055: Empty States

## Status
Accepted - revised 2026-06-06

## Context

The MVP has profile, search, import, proof, and lineage empty states. Empty states should guide the linker toward a complete product-stack profile.

## Decision

Every empty state should explain what is missing and give the next useful action.

## Core Empty States

### Empty Profile

```text
This profile is just getting started.
Add the first product to the stack.
[Add Product]
```

### Empty Product Stack

```text
No products yet.
Start manually or import existing public links.
[Add Product] [Import Links]
```

### Empty Proof

```text
No proof attached yet.
Add a Loom, YouTube video, screenshot, article, GitHub repo, receipt, or note.
[Add Proof]
```

### Empty Lineage

```text
No put-on-by story yet.
Credit the person, content, community, or event that introduced this product.
[Add Lineage]
```

### Empty Import Results

```text
No usable products found.
Paste another URL, upload a list, or add products manually.
[Try Another Source] [Add Manually]
```

## Principles

1. Never shame the linker.
2. Always show a next step.
3. Keep copy specific to product-stack creation.
4. Do not mention parked surfaces like company dashboards or analytics.

## Related

- ADR-024 - Manual-first onboarding
- ADR-037 - Imports

# ADR-008: Product Rebrand Handling

## Status
Accepted - revised 2026-06-06

## Context

Products change names, domains, and positioning. A linker's product history should remain coherent when this happens.

## Decision

A rebrand is usually a continuation of the same product entity, not a new product.

## Rules

- Current product name is primary.
- Old names are stored as aliases.
- Old domains can stay attached for matching/imports.
- The linker's existing props remain attached to the same product unless the user intentionally moves them.
- Product splits and mergers can create separate entities when the user experience really changes.

## Examples

| Scenario | Handling |
| --- | --- |
| Twitter becomes X | Same product entity, alias "Twitter" |
| Google Workspace contains Gmail and Docs | Separate products if users treat them as separate tools |
| Product A and Product B merge | Keep historical props on A/B; allow new prop for merged product |

## Consequences

### Positive

- Historical stacks remain understandable.
- Search can find old and new names.
- Linkers do not lose their product history.

### Negative

- Requires merge/admin tooling over time.
- Some rebrands are ambiguous.

## Related

- ADR-005 - User-driven product database
- ADR-034 - Duplicate prevention

# ADR-036: Template Profiles

## Status
Accepted - revised 2026-06-06

## Context

Manual-first onboarding can feel blank. Templates can suggest likely products without claiming the user uses them.

## Decision

Templates create starter prompts, not published props.

Examples:

- "I'm a founder" -> CRM, calendar, email, docs, payments, analytics prompts
- "I'm a designer" -> design, prototype, asset, whiteboard prompts
- "I'm a developer" -> editor, hosting, database, CI, AI coding prompts
- "I'm a salesperson" -> CRM, outbound, enrichment, calendar, call recording prompts

The user confirms every product.

## Consequences

### Positive

- Speeds manual curation.
- Helps users remember products.
- Avoids invasive discovery.

### Negative

- Templates can feel generic if not well-written.
- Suggestions can bias users toward popular tools.

## Related

- ADR-024 - Manual-first onboarding

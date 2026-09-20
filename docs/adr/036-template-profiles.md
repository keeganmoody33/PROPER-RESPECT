# ADR-036: Template Profiles

> **Status correction — 2026-09-20:** Historical manual-first rationale is superseded; templates are not delivered. Current private discovery/review flow and #24 acceptance take precedence. See [release gaps #24](https://github.com/keeganmoody33/PROPER-RESPECT/issues/24) and the [Phase 0/Devin receipt](../verification/2026-09-20-devin-triage-and-phase0-closure.md).

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

# ADR-024: Onboarding - Manual-First With Draft Imports

## Status
Accepted - revised 2026-06-06

## Context

The previous onboarding goal assumed most products would be auto-discovered through email and screen-time data. That is not the current direction. The MVP should help a linker build a strong profile quickly, but user curation remains the source of truth.

## Decision

Onboarding starts with profile creation and either manual entry or import-assisted draft creation.

```text
Create profile
  -> choose Start Manually or Import Existing Links
  -> add/edit products
  -> add link slots
  -> add proof
  -> add lineage
  -> publish
```

Supported MVP import candidates:

- Linktree/Beacons/Stan/Carrd/public website URL
- GitHub README/public profile links
- Twitter/X bio links
- Manual pasted list of URLs

All imports create drafts. The user must confirm before anything becomes public.

## Consequences

### Positive

- Launch does not depend on email OAuth.
- Import still reduces blank-page friction.
- Draft review protects trust.

### Negative

- Import coverage is incomplete.
- Users still need to curate.

## Related

- ADR-037 - Import tools
- ADR-001 - Proof source ladder

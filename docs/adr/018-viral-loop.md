# ADR-018: Viral Loop - Product Stack as Share Surface

## Status
Accepted - revised 2026-06-06

## Context

Every public profile can become distribution. The viral loop should come from a profile being more useful than a generic link page: it shows products, proof, links, and lineage.

## Decision

The primary viral mechanism is the public product-stack profile.

```text
Linker publishes profile
  -> uses it as their product-stack link
  -> visitor sees credible product cards
  -> visitor clicks links or asks for their own profile
  -> new linker creates profile
```

## Viral Triggers

| Trigger | How It Works | MVP? |
| --- | --- | --- |
| Public profile link | One link for the linker's product stack | Yes |
| Product proof cards | Shareable cards around a product and proof item | Yes |
| Put-on-by credit | Tagging a person/content/community creates a reason to share | Yes |
| Imports | User can consolidate existing product links into one profile | Yes |
| Embeds | External profile/card embeds | Future |
| Company pages | Companies discover advocates | Future |
| Trending products | Public discovery from aggregate usage | Future |

## Consequences

### Positive

- Keeps distribution linker-first.
- Does not require company-side features.
- Reinforces product differentiation.

### Negative

- Network effects take time.
- Put-on-by notifications and embeds need careful moderation later.

## Related

- ADR-009 - Manual put-on-by
- ADR-037 - Imports
- `docs/future/027-embed-widget.md` - Parked embeds

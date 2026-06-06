# ADR-056: SEO and Social Sharing

## Status
Accepted - revised 2026-06-06

## Context

Public profiles and product cards need to look good when shared. The final domain/name is not fixed, so examples should use placeholders rather than a specific brand domain.

## Decision

Each public profile should generate strong metadata and share images.

## Profile Metadata

```html
<meta property="og:title" content="Keegan's Product Stack" />
<meta property="og:description" content="Products Keegan uses, tests, and has archived - with links, proof, and lineage." />
<meta property="og:image" content="https://proper-respect.example/api/og/keegan.png" />
<meta property="og:url" content="https://proper-respect.example/keegan" />
<meta property="og:type" content="profile" />
```

## Dynamic OG Image

The share image should include:

- Linker's name/avatar
- Top active products
- Count of active/testing/archived products
- A short proof/lineage tagline
- Working brand mark

Avoid credibility scores in MVP. Show visible proof categories instead.

## SEO Targets

- product stack
- tools I use
- affiliate links for tools I use
- what tools does [person] use
- [person] product stack

## Consequences

### Positive

- Profiles share cleanly in Slack, iMessage, LinkedIn, and X.
- Public product stacks can become organic acquisition.
- Does not depend on final domain.

### Negative

- Dynamic image generation adds implementation work.
- SEO should not distract from the profile builder.

## Related

- ADR-018 - Public profile as share surface
- ADR-021 - Naming/domain not blocking

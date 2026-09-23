# ADR-056: SEO and Social Sharing

> Status checked 2026-09-23: canonical OpenGraph/Twitter metadata and the generic
> branded `/share-image.png` are implemented and present in the accepted frontend.
> The sitemap includes the homepage and three trust pages with last-modified dates.
> Per-profile share-image customization below remains unimplemented intent.
> Owner-specific custom-domain routing remains #13. See the
> [release reconciliation](../verification/2026-09-23-release-documentation-reconciliation.md).

## Status
Accepted - revised 2026-06-06

## Context

Public profiles and product cards need to look good when shared. The production origin is `https://proper-respect.com`. The example below uses the implemented image and current public URL. Its title and description are illustrative; actual values come from the published display name and bio.

## Decision

Published profiles have canonical metadata and use the generic branded share image. A future profile-specific image would require a separate implementation.

## Profile metadata

```html
<meta property="og:title" content="Keegan's Product Stack" />
<meta property="og:description" content="Products Keegan uses, tests, and has archived - with links, proof, and lineage." />
<meta property="og:image" content="https://proper-respect.com/share-image.png?v=20260922" />
<meta property="og:url" content="https://proper-respect.com/keegan" />
<meta property="og:type" content="website" />
```

## Deferred profile-specific image

The current generated image contains the brand mark and tagline, without owner
data. This proposed customization remains unimplemented:

- Linker's name/avatar
- Top active products
- Count of active/testing/archived products
- A short proof/lineage tagline
- Working brand mark

Avoid credibility scores in MVP. Show visible proof categories instead.

## SEO targets

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

- Profile-specific image content adds implementation and publication review work.
- SEO should not distract from the profile builder.

## Related

- ADR-018 - Public profile as share surface
- ADR-021 - Naming/domain not blocking

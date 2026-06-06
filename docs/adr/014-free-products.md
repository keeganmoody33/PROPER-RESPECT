# ADR-014: Free Products, Open Source, and No-Account Tools

## Status
Accepted - revised 2026-06-06

## Context

Many products people use have no affiliate program, no paid subscription, and sometimes no account. They still belong on a product-stack profile because the value is not only monetization. The value is showing taste, workflow, proof, and lineage.

## Decision

All products belong if the linker wants them on their stack.

| Type | Examples | Best Proof |
| --- | --- | --- |
| Free SaaS | Google Docs, Canva free, Figma free | Content proof, public profile, optional account/API evidence |
| Open source | VS Code, Git, Homebrew, Next.js | GitHub repos, screenshots, articles, notes |
| No-account tools | Terminal, Calculator, public APIs | Screenshot, note, article, Loom |
| Freemium | Spotify, Dropbox, Notion | Content proof, receipt if paid, public profile |

## Rule

No affiliate link required. If no monetized link exists, the prop uses the canonical URL and proof/lineage carry the value.

## Consequences

### Positive

- The profile represents the real stack, not only monetized links.
- Open-source and free tools can still show credibility.
- Visitors get a fuller picture of the linker's workflow.

### Negative

- Some products will not produce revenue.
- Proof may be more manual.

## Related

- ADR-001 - Proof source ladder
- ADR-028 - Claim-on-visit extension
- ADR-037 - Imports

# ADR-015: Shared Accounts, Team Usage, and Multi-User Access

## Status
Accepted - revised 2026-06-06

## Context

A linker may use a product through a family plan, team account, employer account, friend's account, or public/no-account access. Ownership is not the same as usage.

## Decision

A prop may include a usage context.

| Usage Context | Example | Notes |
| --- | --- | --- |
| Personal | My own Notion account | Default |
| Family/shared | Spotify Family, Netflix household | Linker should describe context honestly |
| Team/work | Figma team, Linear workspace, Slack | Defaults private if sensitive |
| Friend/borrowed | Roommate's streaming account | Self-attested only |
| Public/no-account | Public API, docs, calculator | Proof is content/context based |

Shared usage is valid if the linker genuinely uses the product. The UI should make the context transparent when relevant.

## Proof

Good proof for shared/team tools includes:

- Loom/screenshot of workflow with sensitive data hidden
- Public artifact or repo
- Note explaining usage context
- Optional API/OAuth proof if available and safe

## Consequences

### Positive

- Captures real usage that would be missed by ownership-based systems.
- Avoids pretending every product belongs to the linker personally.
- Keeps work/team privacy explicit.

### Negative

- Harder to prove than personal paid accounts.
- Work/team products can be sensitive.

## Related

- ADR-004 - Public/private draft boundaries
- ADR-039 - Work vs. personal visibility
- ADR-001 - Proof source ladder

# ADR-004: Public Graph with Private Data Boundaries + Data Retention

## Status
Accepted — Updated 2026-06-05

## Context
props creates a public profile showing what products a user uses, when they started, and who put them on. This is inherently exposing. We must draw a hard line between what is public and what remains private. Additionally, we need a clear policy on how long we keep data.

## Decision

### Public (Visible on `props.to/{username}`)
- Product name and logo
- Status badge (Active / Testing / Archived)
- Tenure range (e.g., "2022 → Present")
- Context note (user-written, optional)
- Content attachments (Looms, screenshots — user chooses what to attach)
- "Put on by" lineage (public social graph)
- Credibility weight score (the number, not the raw inputs)
- Affiliate/referral link (if user chooses to include it)
- Company-configured reward tier (if company participates)

### Private (Never Public, User-Controlled)
- Email scan raw data (sender domains, dates, subject keywords)
- OAuth-verified usage metrics (hours, features used, team size)
- Browser extension signals (login state, time on site)
- Exact dates of first use, last use, payment events
- The credibility weight algorithm's raw inputs (only the score is public)
- Inbox metadata patterns

### Data Retention Policy

| Data Type | Retention | Rationale |
|-----------|-----------|-----------|
| **User-generated props** | Forever | This is the product. The timeline is the value. |
| **Public profile content** | Forever | User-published content. Their choice to keep public. |
| **Email scan metadata** | Processed immediately, raw data discarded | We only need to extract product signals. No reason to keep email metadata. |
| **OAuth tokens** | Until user revokes | Encrypted at rest. Revocable anytime. |
| **Deleted props** | Soft delete (30 days), then hard delete | Grace period for accidental deletion. |
| **Account data** | Until deletion request | User can export and delete everything. |

**The principle:** User-generated product history is retained forever because that's the core product value. Raw ingestion data (email metadata, scan logs) is ephemeral — processed and discarded.

### The User Control Model

| Action | User Can |
|--------|----------|
| Make a prop public | Yes (default after review) |
| Keep a prop private/draft | Yes (default after email scan) |
| Delete a prop entirely | Yes, anytime (30-day grace) |
| Export all data | Yes, JSON/CSV |
| Disconnect email scan | Yes, stops future ingestion |
| Remove "put on by" tag | Yes, breaks that lineage link |
| Hide credibility weight score | No — score is public if prop is public |
| Hide verification tier | No — badge is public if prop is public |
| Request full account deletion | Yes, all data removed within 30 days |

## The "Put On By" Flow (Manual Logging)

**The user logs lineage manually.** There is no mandatory confirmation flow.

**Example:** Keegan wants to give respect to Jordan Crawford for putting him on Claude.

1. Keegan adds "Claude" to his profile
2. In the "Put on by" field, Keegan types "Jordan Crawford" or `@jordan`
3. If Jordan is on PROPER-RESPECT: Link to his profile. Jordan gets notified. Jordan can confirm or ignore.
4. If Jordan is NOT on PROPER-RESPECT: Keegan types his name as free text. It's a "floating" attribution. If Jordan joins later, Keegan can link it.
5. **No link required.** No referral code. No digital trace. Just: "Jordan put me on this."

**Why manual?**
- Most introductions happen offline, in DMs, in conversations. There's no digital receipt.
- Forcing a confirmation flow kills the social graph before it starts.
- The user is the source of truth for who influenced them.
- If the tagged person joins later, the lineage can be "hardened" into a confirmed link.

**Status states:**
- `SELF_ATTESTED`: User logged it manually. No confirmation.
- `CONFIRMED`: Tagged person confirmed the lineage.
- `FLOATING`: Tagged person not on platform. Stored as text.

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| Everything public by default | Too exposing. Users won't connect email. |
| Everything private by default | Defeats the purpose. No social graph, no discovery. |
| Granular privacy per field | Too complex. Users won't configure it. |
| Anonymous profiles only | No credibility. "Verified anonymous user" is an oxymoron. |
| Mandatory confirmation for lineage | Kills the graph. Most introductions have no digital trace. |
| 30-day retention for all data | Destroys the product value. The timeline IS the product. |

## Consequences

### Positive
- Clear boundary: users know exactly what's exposed
- Email scan data is safe — ephemeral, processed and discarded
- Companies see aggregated intelligence, not individual surveillance
- Lineage graph grows organically through manual logging
- User-generated history is preserved forever (the product's core value)

### Negative
- Users may be uncomfortable with any public product usage data
- "Put on by" lineage creates social pressure — some users may not want to reveal who influenced them
- Public weight scores may be reverse-engineered to infer private data
- Retaining data forever increases storage costs and breach surface area
- If breached, public profiles are already public — no "un-ringing" the bell

## Mitigations
- All props start as drafts after email scan. User must explicitly publish.
- "Put on by" is opt-in per prop. User can leave it blank.
- Weight algorithm is public, so reverse-engineering reveals nothing secret
- Regular security audits of the boundary between private data and public profiles
- Encryption at rest for all stored data
- Annual privacy policy review

## Related
- ADR-001 (Email Passport) — ephemeral raw data, processed and discarded
- ADR-009 (Manual Put On By) — detailed lineage logging flow
- ADR-006 (Data Retention Forever) — user-generated data retention policy

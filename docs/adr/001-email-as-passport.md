# ADR-001: Email as the Universal Passport for Onboarding

## Status
Accepted — Updated 2026-06-05

## Context
Users will not manually type 40 products into their profile. The onboarding friction must be near-zero. We need a way to auto-populate a user's product history without surveillance, cross-site tracking, or reading private content.

## Decision
We will use email metadata scanning as the primary onboarding mechanism. **Any email provider** — not just Google. Gmail, Outlook, Yahoo, Proton, Fastmail, corporate email — whatever the user uses.

## What We Scan (Metadata Only)
- Sender domain (`linear.app`, `stripe.com`, `notion.so`)
- Subject line keywords: "Welcome to", "Receipt", "Verify", "Password reset", "Weekly digest"
- Date received
- **Never:** message body, attachments, personal content
- **Never:** write, edit, delete, or send email on behalf of the user
- **Scope:** Read-only. Period.

## What This Gives Us
- Complete product discovery list (every SaaS ever signed up for)
- Tenure data (first welcome email = start date)
- Activity signal (recent notification emails = still using)
- Spend signal (receipt emails = paid tier)

## What It Does NOT Give Us (And That's OK)
- Products that don't send email (rare for SaaS)
- Products the user signed up for with a different email
- Products the user uses but never created an account for

**Mitigation:** Manual logging is the most thorough method and always available. Email scan is a starting point, not the complete inventory.

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| Browser history import | Too invasive. Requires full browsing history. Feels like spyware. |
| Manual entry only | Too high friction for onboarding. But manual is the most thorough long-term method. |
| Credit card statement scanning | Too sensitive. Financial data is a liability we don't want. |
| OAuth with every product | Too high friction per-product. User would need to auth 20+ times. |
| Browser extension first | Chicken-and-egg. Extension requires install before any value. |
| Gmail-only | Too narrow. Users have Outlook, Proton, Fastmail, corporate email. |

## The Multi-Provider Strategy

We support email ingestion from any provider that exposes an API:

| Provider | API | Scope |
|----------|-----|-------|
| Gmail | Google Gmail API | `gmail.readonly` or `gmail.metadata` — read-only, no write |
| Outlook/Office 365 | Microsoft Graph API | `Mail.Read` — read-only |
| Yahoo | Yahoo Mail API | Read-only metadata |
| Proton | Proton Mail Bridge (IMAP) | Read-only |
| Generic IMAP | Any IMAP server | Read-only, metadata extraction |

## The Onboarding Flow

1. User connects email (any provider)
2. System scans metadata (60 seconds)
3. Draft props created for each discovered product
4. User reviews drafts: **Keep** → Active | **Archive** → Historical | **Delete** → Ignore
5. User manually adds anything the scan missed
6. User manually adds "Put on by" lineage (who introduced them)

## Consequences

### Positive
- One-click onboarding → 60 seconds → 30+ products auto-populated
- Passive ongoing signal: inbox becomes a usage oracle without active tracking
- User can review and curate before anything goes public
- Supports any email provider, not just Big Tech

### Negative
- Requires OAuth/IMAP scope approval (potential trust barrier)
- Only captures products that send email
- Users may have hundreds of products; curation UI must be excellent
- Multi-provider OAuth is more complex than single-provider

## Mitigations
- OAuth scope is read-only, metadata-only, no write permissions
- User can toggle off per-product or globally
- All scanning happens server-side with encryption; raw email content never stored
- Clear "We scan receipts, not secrets" messaging
- Manual logging is always available as the thorough alternative

## Related
- ADR-003 (No Money Holding) — email scan does not touch financial flows
- ADR-004 (Public Graph Privacy) — email data feeds private drafts, not public profile
- ADR-009 (Manual Put On By) — email scan doesn't capture lineage; user logs that manually

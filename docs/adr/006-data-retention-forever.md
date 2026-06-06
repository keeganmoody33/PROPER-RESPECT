# ADR-006: User-Generated Data Retained Forever

## Status
Accepted — 2026-06-05

## Context
The core value of PROPER-RESPECT is the **timeline** — a user's complete product journey from first try to archive. This history is only valuable if it's preserved. Deleting old props destroys the narrative.

## Decision
User-generated product data (props, content, lineage, profile information) is retained **forever** unless the user explicitly requests deletion.

## What Is Retained Forever

| Data Type | Retention | Why |
|-----------|-----------|-----|
| **Props** (product cards) | Forever | The timeline is the product. |
| **Content** (Looms, screenshots, notes) | Forever | Proof of usage. User-published. |
| **Lineage** (who put who on) | Forever | Social graph. Historical record. |
| **Public profile data** | Forever | User chose to publish this. |
| **Product entities** | Forever | Community-created reference. |

## What Is NOT Retained (Ephemeral)

| Data Type | Retention | Why |
|-----------|-----------|-----|
| **Email scan raw metadata** | Processed immediately, discarded | We only need to extract product signals. No value in keeping email headers. |
| **OAuth token refresh logs** | 90 days | Debugging only. Then purged. |
| **Failed login attempts** | 30 days | Security monitoring. Then purged. |
| **Analytics events** | 1 year | Product improvement. Then anonymized or purged. |

## The Deletion Right

Users can request full account deletion at any time:
- All props deleted (hard delete, not soft)
- All content removed from storage
- All lineage links removed
- Profile page returns 404
- Product entities created by the user remain (community property) but are orphaned

**Process:** 30-day grace period after request. User can cancel during this window. After 30 days: irreversible deletion.

## Why Forever?

1. **The product IS the history.** A prop from 2021 that was archived in 2024 tells a story. That story is valuable to the user, to visitors, and to companies.
2. **Retroactive analysis.** Companies want to see advocate trends over years, not months.
3. **Personal value.** Users treat their PROPER-RESPECT profile as a resume or portfolio. Resumes don't expire.
4. **Network effects.** Lineage graphs become more valuable as they grow older. "Who put who on" is a historical record.

## Risks

| Risk | Mitigation |
|------|------------|
| Storage costs grow indefinitely | Props are small (text + metadata). Content (images/videos) is the bulk. Compression + CDN. |
| Data breach exposes old data | Encryption at rest. Regular audits. Principle: if it's public already, breach doesn't change exposure. |
| User regrets old public props | User can change visibility to private or delete. Not our decision. |
| Regulatory pressure (GDPR "right to erasure") | We comply with deletion requests. But default is retention. User must actively choose deletion. |

## Related
- ADR-004 (Public Graph Privacy) — what is public vs. private
- ADR-001 (Email Passport) — raw email data is ephemeral, not retained

# ADR-001: Authorized Evidence Discovery

## Status
Accepted — revised 2026-09-16. Supersedes the June manual-first sequencing.

## Decision
Evidence proposes; the person confirms. Source authorization should enable broad discovery and preparation of private drafts with minimal entry. Email is one broad discovery source alongside project records, receipts, public profiles, usage exports, and product APIs. Manual entry remains available for gaps.

Email can establish signups, dated observations, and payments. It cannot alone establish continuous or current use. Marketing email does not establish adoption. A source's permissions and a claim's evidentiary strength are separate concepts.

Mailbox access must be separately authorized and read-only. Never request send/compose/modify/delete capabilities for evidence discovery or send email on a person's behalf. Google sign-in is not Gmail authorization. A future connector must implement source selection, revocation, and minimum necessary evidence retention before release.

The product prepares suggestions and excerpts. Users mark claims Correct, Incorrect, Incomplete, or Unknown and optionally correct them. Original evidence and proposals remain intact; review appends history. Publishing is a separate explicit decision.

## Implementation status
As of 2026-09-18, Google identity authentication and separately consented Gmail OAuth, encrypted credentials, bounded header discovery/extraction, and capture provenance are implemented; the authorized live capture/candidate gate passed. Structured evidence observations, source labels, draft creation, and private claim review are implemented as foundations. The approved read budget is exhausted; additional mailbox reads are paused and recurring collection remains off. Historical expansion, live failure/recovery proof, and hosted release acceptance remain gated. These foundations establish neither complete mailbox coverage nor current or continuous product use; Google sign-in does not grant Gmail consent, and publication remains a separate explicit decision.

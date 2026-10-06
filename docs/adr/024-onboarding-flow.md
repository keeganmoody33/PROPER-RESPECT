# ADR-024: One private result, review before publication

## Status
Accepted. Revised 2026-10-06 for the owner-directed R27 first-result path.

## Decision

```text
Choose one supported source or manual entry
  → sign in while retaining that choice
  → authorize the chosen source or import a sanitized capture
  → open the exact private result with units, scope, period and limitations
  → review measurements and confirm relationship context
  → optionally choose cards and public measurement projections
  → approve the exact visitor preview before publishing
```

User approval is mandatory; user transcription is not. Propose supported facts before asking questions. Ask “Have you used this product?” when the evidence establishes only signup or payment. Keep signup, first observed use, recent observed use, and paid periods distinct. Never derive “using since” from account creation or a receipt.

Manual entry remains a supported fallback. Email discovery is optional; multiple
mailboxes and a public profile are not prerequisites for one useful result. No imported claim or raw evidence becomes public merely because a connection succeeded. New scopes require authorization; future refresh behavior must be explicit.

## Historical source boundary
The following records the 2026-09-18 acquisition state. For current implementation
and release status, use [measurement](../usage-measurement.md) and
[development](../DEVELOPMENT.md).

As of 2026-09-18, GitHub/Devin connection paths and uploads exist. Google login is not Gmail consent. Separately consented Gmail OAuth, bounded header discovery/extraction, capture provenance, and private dated-claim review are implemented; the authorized live capture/candidate gate passed. Email evidence does not establish current or continuous use. The approved read budget is exhausted; additional mailbox reads are paused and recurring collection remains off. Historical expansion, live failure/recovery proof, and hosted release acceptance remain gated. Private dated-claim review also accepts structured observations supplied to the internal intake; publication requires explicit approval.

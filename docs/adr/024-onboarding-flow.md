# ADR-024: Discovery First, Review Before Publication

## Status
Accepted — revised 2026-09-16. Replaces manual-entry-first onboarding.

## Decision

```text
Sign in
  → authorize selected evidence sources
  → discover products and prepare private claims
  → show source excerpts, dates, scope, and uncertainties
  → user confirms / corrects / rejects / leaves unknown
  → choose links and cost visibility
  → publish reviewed cards
```

User approval is mandatory; user transcription is not. Propose supported facts before asking questions. Ask “Have you used this product?” when the evidence establishes only signup or payment. Keep signup, first observed use, recent observed use, and paid periods distinct. Never derive “using since” from account creation or a receipt.

Manual cards and uploads remain fallbacks. No imported claim or raw evidence becomes public merely because a connection succeeded. New scopes require authorization; future refresh behavior must be explicit.

## Current boundary
GitHub/Devin connection paths and uploads exist. Google login is not mailbox access. Gmail discovery and automatic email extraction still need implementation. Private dated-claim review is available for structured observations supplied to the internal intake.

# ADR-028: Chrome Extension - Claim on Visit

## Status
Accepted - revised 2026-06-06

## Context

The earlier extension design focused on detecting login state with cookies. That is brittle, privacy-sensitive, and not the proof users actually need.

A better extension is user-triggered: when the linker is on a product page, they click the extension to claim the product and capture proof.

## Decision

The extension is a claim-on-visit tool.

```text
User visits product page
  -> clicks PROPER-RESPECT extension
  -> extension captures current URL and optional screenshot
  -> user adds status, note, link, and lineage
  -> item becomes draft prop or proof item
```

## What It Does

- Captures the active tab URL.
- Optionally captures a screenshot with user consent.
- Lets the user add note/status/lineage.
- Saves locally first or sends to PROPER-RESPECT only when the user confirms.

## What It Does Not Do

- Does not track browsing history.
- Does not run as a background usage monitor.
- Does not read cookies to infer login state.
- Does not send data without user action.
- Does not try to measure time-on-site.

## Consequences

### Positive

- Strong proof for web products.
- Much clearer privacy story.
- Avoids brittle login heuristics.
- Makes product capture feel like bookmarking with proof.

### Negative

- Requires extension install.
- Only works for web surfaces.
- Still depends on user action.

## Related

- ADR-001 - Proof source ladder
- ADR-037 - Import tools

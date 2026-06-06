# ADR-003: We Do Not Hold, Process, or Touch Money

## Status
Accepted - revised 2026-06-06

## Context

PROPER-RESPECT stores and routes links. Some links may be affiliate links, referral codes, or invite links. The product should not become a payment processor, wallet, payout platform, affiliate network, or commission ledger.

## Decision

PROPER-RESPECT will never hold, process, or route money. It stores outbound links and lets the product's existing affiliate/referral system handle credit.

## How Money Flows

| Scenario | What PROPER-RESPECT Does | What Happens |
| --- | --- | --- |
| Linker has an affiliate link | Stores and routes visitors through that link | Product/affiliate platform credits the linker directly |
| Linker has a referral code | Displays or copies the code | Product credits the linker directly |
| Product has no referral system | Stores canonical product URL | No payout; the prop still carries proof and credibility |
| Company wants to reward users | Future conversation, off-platform by default | No money touches PROPER-RESPECT |

## Explicit Non-Goals

- Hold funds in escrow
- Process payouts
- Calculate commission splits
- Take a percentage of transactions
- Issue tax documents
- Maintain wallets or balances
- Promise that a click creates earnings

## Consequences

### Positive

- Avoids financial regulation and payout complexity.
- Keeps launch focused on profiles, links, proof, and lineage.
- Lets linkers use affiliate programs that already exist.

### Negative

- No built-in earnings dashboard.
- No unified payout experience.
- Some visitors may expect affiliate-network behavior that we do not provide.

## Related

- ADR-002 - Credibility is proof-first, not reward-first
- `docs/future/007-company-reward-config.md` - Parked company reward ideas
- `docs/future/030-pricing.md` - Parked pricing ideas

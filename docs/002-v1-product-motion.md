# 002 - V1 Product Motion

> How a Linker actually moves through V1, and the order we build it in.
> Updated: 2026-06-08.

## The Core Loop

```text
Create profile
  -> add a product card (Prop)
  -> set status (Active / Testing / Archived)
  -> add the best link (affiliate / referral / invite / canonical)
  -> attach proof (note, screenshot, Loom, receipt, repo, ...)
  -> add "put on by" lineage
  -> publish the card
```

Everything in V1 exists to make this loop fast, credible, and fully under the Linker's control. Imports are additive: they pre-fill draft cards, but the loop above still has to be completable entirely by hand.

## Two Actors

| Actor | Wants | V1 surface |
| --- | --- | --- |
| Linker | One place for the products they use, the links they want clicked, and the story/proof behind them | Dashboard: profile editor, card editor, proof manager, lineage manager, import review queue |
| Visitor | To know what a Linker actually uses, and where to click | Public profile: cards grouped by status, proof + lineage visible, primary link obvious |

## V1 Capability Sequencing

Build in this order. Each step is shippable and testable on Keegan's real stack before the next begins.

1. **Profile + manual product card.** Create a profile, add a card, set status. No links/proof/lineage required to save a draft.
2. **Links.** Add affiliate / referral / invite / canonical link slots to a card. Profile prioritizes the link the Linker wants clicked.
3. **Proof.** Attach proof artifacts to a card. At least one proof type (a note) always works offline.
4. **Lineage.** Record "put on by" with a source type (person / content / community / event) and confidence.
5. **Publish.** Flip a card from draft/private to public. Public profile renders cards by status.
6. **Additive imports.** Only after manual flow is solid: imports that create *draft* cards the user must approve. See `003-evidence-surfaces.md`.

## Draft-And-Approve Is The Spine

Every path that is not pure manual entry funnels through the same review gate:

```text
Source (import / capture)  ->  RawEvidence  ->  DraftProp (in review queue)
   ->  user edits / merges / rejects  ->  CuratedProp  ->  publish
```

The Import Review queue is where a Linker confirms, edits, merges into an existing card, or rejects a draft. Nothing in this queue is public. This is the manual-first rule made operational.

## Cold Start

V1's first and only required user is Keegan. The cold-start plan (`../docs/adr/020-cold-start.md`) is to build Keegan's real product stack by hand: the products he uses, the affiliate/referral links he has, the proof he already owns (Looms, screenshots, repos, receipts), and the real lineage of who put him on. That single credible profile is the V1 acceptance test. We generalize only after it feels honored and useful.

## What "Done" Looks Like For V1

- Keegan can build a complete, credible profile with zero engineering help.
- Each card can carry a useful outbound link plus at least one proof item.
- Lineage is visible and legible to a Visitor.
- Imports save time but never create something public without approval.
- It reads like a curated product stack, not a generic link-in-bio list.

## Explicitly Out Of The V1 Motion

No expense tracking, no cancellation/ops dashboard, no background usage tracking, no opaque score, no Gmail OAuth onboarding, no automated Screen Time capture. See `000-current-product-thesis.md`.

## Related

- `000-current-product-thesis.md`
- `003-evidence-surfaces.md`
- `004-v1-technical-contract.md`
- `../PRD.md`

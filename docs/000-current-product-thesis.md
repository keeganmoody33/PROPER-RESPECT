# 000 - Current Product Thesis (V1)

> The source-of-truth statement for what PROPER-RESPECT is in V1.
> Updated: 2026-06-08. If another doc contradicts this one, this one wins.

## One Sentence

PROPER-RESPECT is a **manual-first product attribution profile**: a place where a person shows the products they use, respect, recommend, or were put onto, with proof and lineage attached.

## The Thesis

People adopt products constantly, but the *authorship* of that adoption is lost. Who put you on? What proof do you have that you actually use it? Where is the link you want clicked? Today that story is scattered across DMs, YouTube descriptions, receipts, repos, and bios.

PROPER-RESPECT tracks **authorship of product adoption** the way Git tracks authorship of code. A product card is a committed record of a person's relationship to a product. See `001-git-for-product-attribution.md` for the full mental model.

## What A User Can Do In V1

The MVP is manual-first. A user (a Linker) can:

1. Create a profile.
2. Add a product card.
3. Set product status: **Active / Testing / Archived**.
4. Add the best link: **affiliate URL, referral URL, invite URL, canonical URL**.
5. Add proof: **manual note, screenshot, Loom, receipt, GitHub repo, Screen Time screenshot, browser history export, email evidence**.
6. Add **"put on by"** lineage (who or what introduced them).
7. Publish the product card on their profile.

## Manual-First Rule

The Linker is the source of truth. **Automation only ever creates drafts.**

Imports from Gmail, billing, browser history, Screen Time, GitHub, or social messages may only produce **draft product cards**. The user must manually approve a draft before it is published. Nothing imported appears publicly without an explicit approval.

This is the single most important constraint in the product. It is encoded in the data model as a hard boundary between raw/staged data and curated/published data (see `004-v1-technical-contract.md`).

## What We Are NOT Building (Yet)

These are explicitly out of scope for V1. They are parked, not killed.

| Not building | Why |
| --- | --- |
| Expense tracker | We track adoption and advocacy, not spend. |
| SaaS cancellation dashboard | Not a cost-cutting/ops tool. |
| Surveillance or automatic usage tracking | No background tracking. Capture is user-triggered only. |
| Opaque scoring | No black-box credibility score in V1. Proof is shown, not scored. |
| Gmail OAuth automation | Email evidence is manual/optional, not an OAuth onboarding flow yet. |
| Screen Time automation | Screen Time enters only as a user-supplied screenshot, never automated capture. |

If a feature does not make a Linker's profile more useful or more credible to a Visitor, it waits.

## Cold Start: Build It For Keegan First

V1 has exactly one user to satisfy first: Keegan. We build the product so that Keegan is the first person to *earn* and *use* PROPER-RESPECT, honored well, with a real, credible product stack. We learn from that single real profile before generalizing. Every V1 decision should be testable against "does this make Keegan's profile better?"

## Related

- `001-git-for-product-attribution.md` - the Git mental model
- `002-v1-product-motion.md` - the V1 user motion and sequencing
- `003-evidence-surfaces.md` - proof and evidence sources in detail
- `004-v1-technical-contract.md` - entities, types, and the data pipeline
- `../CONTEXT.md` - shared domain language
- `../PRD.md` - MVP requirements

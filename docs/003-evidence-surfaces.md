# 003 - Evidence Surfaces

> The proof and evidence surfaces V1 supports, and how raw evidence becomes a published card.
> Updated: 2026-06-08.

## Two Distinct Concepts

Keep these separate. They map to two different entity families in `004-v1-technical-contract.md`.

- **Proof** is a curated artifact the Linker chose to attach to a published card (`ProofType`).
- **Evidence Source** is where raw, un-curated signal comes from before it is shaped into anything (`EvidenceSourceType`). Evidence sources only ever produce **draft** cards.

A proof item is something the Linker stands behind publicly. An evidence source is an inbox of candidates the Linker still has to approve.

## Proof Surfaces (curated, public-eligible)

| Proof type (`ProofType`) | What it shows | Capture in V1 | Confidence |
| --- | --- | --- | --- |
| `NOTE` | The Linker explains the relationship in their words | Manual text | Baseline (self-attested) |
| `SCREENSHOT` | The product in use | Manual upload | Medium |
| `LOOM` | A walkthrough / demo | Manual URL embed | Strong |
| `YOUTUBE` | Public video showing usage | Manual URL embed | Strong |
| `ARTICLE` | Written account of using the product | Manual URL | Medium |
| `RECEIPT` | The Linker paid for / subscribed to it | Manual upload/forward | Strong for paid, blind to free tiers |
| `GITHUB_REPO` | Code / config that uses the product | Manual URL | Strong for dev tools |
| `SCREEN_TIME_SCREENSHOT` | Time spent in an app (mobile) | **User-supplied screenshot only** | Medium; never automated |
| `BROWSER_HISTORY_EXPORT` | Visited the product repeatedly | User-supplied export | Medium; noisy |
| `EMAIL_EVIDENCE` | Signup / receipt / product email | **Manual forward/upload only** | Medium; noisy |
| `API_OAUTH` | Product API confirms activity/ownership | Later connector layer | Strong, high friction |

Notes:

- `SCREEN_TIME_SCREENSHOT`, `BROWSER_HISTORY_EXPORT`, and `EMAIL_EVIDENCE` are **manual, user-supplied** in V1. There is no background capture, no Screen Time automation, and no Gmail OAuth scan. This is a hard line from `000-current-product-thesis.md`.
- A card is always allowed to publish with only a `NOTE`. Proof is a ladder, not a gate.

## Evidence Sources (raw, draft-only)

These can populate `RawEvidence` and propose `DraftProp`s. None of them can publish.

| Source (`EvidenceSourceType`) | Produces | V1 status | Risk |
| --- | --- | --- | --- |
| `MANUAL` | Direct user entry | Now | None |
| `PUBLIC_PROFILE` | Linktree / Beacons / bio / personal site links | Now (low friction) | Stale links |
| `GITHUB` | Repos / dependencies / starred tools | Next | Noise from transitive deps |
| `BILLING` | Stripe / Apple / Google receipts (user-supplied) | Next | Merchant-name resolution (see tests) |
| `BROWSER_HISTORY` | User-exported history | Later | Very noisy, privacy-sensitive |
| `SCREEN_TIME` | User-supplied screenshot only | Later | OCR + manual only |
| `SOCIAL_MESSAGES` | DMs / threads referencing a product | Later | Hard to attribute, consent-sensitive |
| `GMAIL` | Email metadata scan | Later, optional | Noisy; manual-first, never the spine |

## The Path From Evidence To Published Card

```text
EvidenceSource (authorized/supplied by user)
  -> RawEvidence (immutable, append-only, private)
  -> DraftProp (staged candidate in the Import Review queue)
  -> user reviews: edit / merge into existing card / reject
  -> CuratedProp (user-owned source of truth)
  -> publish -> PublishedProfile
```

The only actor that can advance a candidate past the review queue is the user. Automation fills the left side; the user owns the right side.

## Privacy Boundaries

- Raw evidence is private and is never rendered on a public profile.
- Drafts are private until explicitly published.
- A user can reject evidence; rejected evidence does not silently come back (it is marked, not re-proposed).
- Data export and deletion respect these boundaries (`../docs/adr/060-data-export.md`, `../docs/adr/012-account-deletion.md`).

## Related

- `000-current-product-thesis.md`
- `002-v1-product-motion.md`
- `004-v1-technical-contract.md`
- `../CONTEXT.md` (Proof Model, Lineage Model)

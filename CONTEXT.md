# CONTEXT.md - PROPER-RESPECT

> Shared domain language for PROPER-RESPECT.  
> Last updated: 2026-06-06.

## Product Identity

PROPER-RESPECT is a product-stack profile: one place for the products a person uses, the links they want people to click, the proof that they actually know the product, and the story of who put them on.

The product is not an affiliate network, a payment processor, a review site, a company analytics dashboard, or a surveillance product. It is a user-owned profile and proof surface for product advocacy.

## Core Terms

| Term | Definition | Do Not Call It |
| --- | --- | --- |
| Linker | The person creating a public product-stack profile | Affiliate, influencer |
| Visitor | Someone browsing a linker's profile | Lead |
| Product Stack | The set of products a linker uses, tests, or has archived | Link list |
| Prop | A linker's relationship with one product | Link entry |
| Product | The tool, app, service, course, community, or physical item being logged | Company page |
| Link Slot | The URL area on a prop: affiliate link, referral code, invite link, or canonical URL | Ad placement |
| Affiliate Link | A product-provided link that can credit the linker | Tracking link |
| Referral Code | A code the visitor can use to give the linker credit | Coupon |
| Canonical Link | The normal product link used when no affiliate/referral link exists | Fallback ad |
| Proof | Evidence attached to a prop showing the linker knows or uses the product | Verification theater |
| Proof Source | The origin of proof: content, screenshot, receipt, public profile, extension capture, OAuth/API | Data source |
| Content Proof | A Loom, YouTube video, article, screenshot, GitHub repo, or note that demonstrates usage | Marketing asset |
| Usage Claim | The linker's claim that a product belongs on their stack | Verified usage |
| Status | The linker's current relationship to a product: Active, Testing, Archived | Rank |
| Lineage | The story of who or what put the linker on to a product | Referral chain |
| Put On By | The field where the linker records lineage | Attribution form |
| Floating Lineage | Lineage pointing to a person/content/community/event not on PROPER-RESPECT | Orphan link |
| Import | Bringing in public or user-approved data to create draft props | Scraping |
| Claim-on-Visit | Browser extension flow where the linker clicks while on a product page to create proof | Browser tracking |
| Draft Prop | A prop that has been imported or created but not published | Auto-discovered product |

## Status Model

| Status | Meaning |
| --- | --- |
| Active | The linker currently uses and recommends the product |
| Testing | The linker is trying the product and has not fully adopted it |
| Archived | The linker used the product before but no longer actively uses it |

Status is user-curated. Automation may suggest a status, but the linker decides what appears publicly.

## Proof Model

PROPER-RESPECT does not rely on one universal usage oracle. Proof is a ladder of signals, and different products support different proof.

| Proof Source | What It Shows | Notes |
| --- | --- | --- |
| Self-attested | The linker says it belongs on their stack | Baseline; valid but lowest confidence |
| Content proof | The linker can show or explain the product in context | Strong launch signal |
| Public profile proof | Public repos, articles, videos, or bios mention the product | Useful for import and enrichment |
| Receipt proof | The linker paid for or subscribed to the product | Strong for paid tools, misses free tiers |
| Claim-on-visit proof | The linker captured a URL/screenshot while using the product | Good for web products, user-triggered only |
| OAuth/API proof | Product-specific API confirms activity or ownership | Strong but high friction |
| Company-confirmed proof | The product company confirms the relationship | Future only |

## Lineage Model

"Put on by" accepts four source types:

| Source Type | Example |
| --- | --- |
| Person | "Jordan Crawford showed me Wispr Flow" |
| Content | "A YouTube workflow video" |
| Community | "A GTM operator Slack group" |
| Event | "SaaStr hallway conversation" |

Lineage is allowed to be self-attested. The point is to preserve the story of influence, including dark social that normal affiliate systems miss.

## Link Model

A prop can have more than one link type:

| Link Type | Purpose |
| --- | --- |
| Affiliate URL | The best monetized destination when the product provides one |
| Referral code | A code the visitor can copy or apply |
| Invite link | A product-specific invite URL |
| Canonical URL | The normal product URL when no monetized option exists |
| Proof URL | A Loom, YouTube video, article, repo, or screenshot source |

The profile should prioritize the link the linker wants clicked, while still being transparent about proof and lineage.

## Product Principles

1. Manual curation is the source of truth.
2. Automation creates drafts; it does not publish on behalf of the linker.
3. The launch product is a profile builder, not a company dashboard.
4. Affiliate links are important, but non-affiliate products still belong.
5. Proof should be user-controlled and legible to visitors.
6. The product should avoid surveillance. No background tracking as a default.
7. Imports should get users more than halfway when possible, but never pretend to be complete.
8. API/OAuth connectors are optional proof sources, not the foundation.
9. Companies and monetization come later, after the linker profile works.
10. If a feature does not improve the linker's profile or the visitor's trust, it waits.

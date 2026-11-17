# CONTEXT.md - PROPER-RESPECT

> Shared domain language for PROPER-RESPECT.  
> Last updated: 2026-11-17.
>
> **Status (2026-09-28):** the product definition follows the owner decisions
> of 2026-09-25 in `docs/remediation/CODEX-BRIEF.md`, Section 3. Terms and
> models marked **Later** below are kept as language for a future phase. They
> are not built, and the schema is not shaped for them.

## Product Identity

PROPER-RESPECT is your tooling page: one link, `proper-respect.com/{handle}`, that shows every tool you use, test and used before, with the usage behind it. You earn respect for what you actually run, and you give props to whoever put you on. A tool you stopped using still counts.

The collection is private first: nothing is published without the person's explicit preview and approval. Sign-up mode is an open decision, with a waitlist recommended. Today's behaviour is that sign-up is public (owner, 2026-11-17).

The product is not an affiliate network, a payment processor, a review site, a company analytics dashboard, or a surveillance product. It is a user-owned profile and proof surface for product advocacy.

## Core Terms

| Term | Definition | Do Not Call It |
| --- | --- | --- |
| Linker | The person keeping a private collection of their tools and choosing which cards to publish on their page | Affiliate, influencer |
| Page | The public tooling page at `proper-respect.com/{handle}`: the cards a person approved | Collection, profile site |
| Collection | The private list of a person's tools, seen only by them | Page |
| Respect | What usage earns. A card backed by real usage earns it; nothing else in the product uses the word | Verified, score, rating |
| Visitor | Someone browsing a linker's profile | Lead |
| Product Stack | The set of products a linker uses, tests, or used before | Link list |
| Prop | Code name only, for the stored relationship between a linker and one product (`props` table, `propId`). People see it as a card. Never shown as "prop" in the product, because props means credit | Link entry |
| Product | The tool, app, service, course, community, or physical item being logged | Company page |
| Link Slot | A card's optional primary link, at most one. Its type is canonical, affiliate, referral or invite, and affiliate and referral links are disclosed on the card. Several slots per card are **Later** | Ad placement |
| Affiliate Link | A product-provided link that can credit the linker, used as a card's primary link and labeled "Affiliate link" | Tracking link |
| Referral Code | **Later.** A code the visitor can use to give the linker credit | Coupon |
| Canonical Link | The normal product link used when no affiliate/referral link exists | Fallback ad |
| Proof | Evidence attached to a prop showing the linker knows or uses the product | Verification theater |
| Proof Source | The origin of proof: content, screenshot, receipt, public profile, extension capture, OAuth/API | Data source |
| Content Proof | A Loom, YouTube video, article, screenshot, GitHub repo, or note that demonstrates usage | Marketing asset |
| Usage Claim | The linker's claim that a product belongs on their stack | Verified usage |
| Usage level | How often the linker says they use a product, one of seven from Tried, didn't adopt to Daily | Rank, score |
| Status | The stored compatibility field each usage level implies: ACTIVE, TESTING or ARCHIVED. Shown as Using, Testing or Used before only on a card with no level | Rank |
| Lineage | **Later.** The story of who or what put the linker on to a product | Referral chain |
| Props | Credit to whoever put you on a tool. The one credit a card gives that person: a handle on one platform, set by the owner (ADR-062, decided 2026-11-15). Nothing else is called props | Score, endorsement count, praise for a tool |
| Put On By | Built as Props for v1 (ADR-062). The fuller lineage field below is **Later** | Attribution form |
| Floating Lineage | **Later.** Lineage pointing to a person/content/community/event not on PROPER-RESPECT | Orphan link |
| Import | Bringing in public or user-approved data to create draft props | Scraping |
| Claim-on-Visit | Browser extension flow where the linker clicks while on a product page to create proof | Browser tracking |
| Draft Prop | Code name for a relationship that has been imported or created but not published. People see it as a draft card | Auto-discovered product |

## Usage Levels

The linker picks one level per product, cold to hot. `src/domain/relationship-level.ts` is the only source of these labels, definitions and implied statuses.

| Level | Definition shown to the linker | Stored status |
| --- | --- | --- |
| Tried, didn't adopt | I tried it and decided not to use it. | ARCHIVED |
| Stopped using | I used it for real work and no longer do. | ARCHIVED |
| Paused | I'm not using it now and may come back. | ARCHIVED |
| Occasionally | I reach for it less than once a week, when a job needs it. | ACTIVE |
| Testing | I'm evaluating it and haven't decided. | TESTING |
| Weekly | I use it most weeks. | ACTIVE |
| Daily | I use it on most working days. | ACTIVE |

A card saved before levels has a status and no level. It reads Using (ACTIVE), Testing (TESTING) or Used before (ARCHIVED) until the linker picks a level.

Levels are user-curated. Nothing derives a level from usage data, counts or dates. The order is for display and filtering, not a score, and no level is compared between people. Go-to is a separate mark the linker sets; a level never sets or clears it.

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

## Lineage Model (Later)

**Decided 2026-11-15, in part.** The owner decided "put on by" for v1 as
props: each card can credit one person by their handle on one platform,
set privately by the owner and published with the card
([ADR-062](docs/adr/062-props-credit.md)). `@mentions`, the four source
types below and a count of props received are still later. A props count is
a public number, and `docs/002-v2-product-motion.md` forbids universal
scores and rankings, so whether a count can exist is still undecided. The
model below is kept as the intended language.

"Put on by" accepts four source types:

| Source Type | Example |
| --- | --- |
| Person | "Jordan Crawford showed me Wispr Flow" |
| Content | "A YouTube workflow video" |
| Community | "A GTM operator Slack group" |
| Event | "SaaStr hallway conversation" |

Lineage is allowed to be self-attested. The point is to preserve the story of influence, including dark social that normal affiliate systems miss.

## Link Model

**Now:** the profile is one link, `proper-respect.com/{handle}`. Each
published card has at most one primary link, whose type is canonical,
affiliate, referral or invite. A card for a product without a website can
have none. Affiliate and referral links carry a visible disclosure.
A card may also have a usage link to the evidence behind it. Member
subdomains and custom domains (issue #13) are **Later**.

**Later, not built:** a prop with several link types at once, including a
copyable referral code:

| Link Type | Purpose |
| --- | --- |
| Affiliate URL | The best monetized destination when the product provides one |
| Referral code | A code the visitor can copy or apply |
| Invite link | A product-specific invite URL |
| Canonical URL | The normal product URL when no monetized option exists |
| Proof URL | A Loom, YouTube video, article, repo, or screenshot source |

When built, the profile should prioritize the link the linker wants clicked, while still being transparent about proof and lineage.

## Product Principles

1. Manual curation is the source of truth.
2. Automation creates drafts; it does not publish on behalf of the linker.
3. The launch product is a profile builder, not a company dashboard.
4. Affiliate links are welcome and always disclosed, but every tool a person uses belongs, whether or not it offers one.
5. Proof should be user-controlled and legible to visitors.
6. The product should avoid surveillance. No background tracking as a default.
7. Imports should get users more than halfway when possible, but never pretend to be complete.
8. API/OAuth connectors are optional proof sources, not the foundation.
9. Companies and monetization come later, after the linker profile works.
10. If a feature does not improve the linker's profile or the visitor's trust, it waits.

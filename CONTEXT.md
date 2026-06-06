# CONTEXT.md — PROPER-RESPECT

> Shared domain language for the [TBD] product.  
> Last updated: 2026-06-05 (Round 3)

## Product Identity

**[TBD]** is a public timeline of everything a person uses, with the receipts to prove it.  
One link in your bio. Every recommendation, credited. Every product journey, visible.

We are NOT an affiliate network. We are NOT a link tracker. We are NOT a financial intermediary.  
We are a **credibility protocol** — a presentation layer that makes organic advocacy visible and verifiable.

## Core Terms

| Term | Definition | Never Call It |
|------|-----------|-------------|
| **Prop** | A user's relationship with a single product (the card) | "link entry" |
| **Linker** | The user who creates props and shares their profile | "affiliate" |
| **Discoverer** | The visitor who browses a linker's profile | "lead" |
| **Credibility Weight** | The display score of a prop based on proof of usage (universal algorithm) | "rank" |
| **Reward Weight** | The company's configured payout rules for advocates (company-specific) | "commission" |
| **Lineage** | The social graph of who put who on | "referral chain" |
| **Surface** | The public profile page where props live | "landing page" |
| **Ingestion** | The email-scanning process that finds products | "scraping" |
| **Verification** | The proof tier of a prop (self → email → OAuth → company) | "validation" |
| **Servant Leader** | A user with high credibility weight but low social reach | "micro-influencer" |
| **Archive** | A prop for a product no longer actively used | "dormant link" |
| **Give Respect** | The act of tagging who put you on | "referral attribution" |
| **Get Respect** | The credit a linker receives for putting someone on | "commission" |
| **Floating Lineage** | A "put on by" entry for someone not yet on [TBD] | "orphan link" |
| **Self-Attested** | A lineage logged by the user without external confirmation | "unverified" |
| **Product Entity** | The canonical representation of a product in our database | "company page" |
| **Company Configuration** | When a company sets reward rules for their product | "claim" |
| **Rebrand** | When a product changes its name but remains the same entity | "rename" |
| **Predecessor** | The previous incarnation of a rebranded product | "old version" |
| **Screen Time** | Device-level usage data (iOS/Android) as passive signal | "tracking" |
| **Bundle ID** | The unique identifier for a mobile app (e.g., com.notion.id) | "app ID" |
| **Polymorphic Lineage** | "Put on by" can be a person, content, community, or event | "source" |
| **Product Category** | The type of product: SAAS, MOBILE_APP, PHYSICAL, SERVICE, COURSE, COMMUNITY, TOOL | "type" |
| **Multi-Email** | Connecting multiple email addresses (personal + work) | "secondary email" |
| **Threshold Notification** | Single email to company when they reach 50 advocates | "outreach" |
| **90% Auto-Discovered** | The onboarding goal: 90% of products found automatically | "100% coverage" |
| **Manual Curation** | The remaining 10% of products added by hand | "data entry" |

## Two Weight Systems (Critical Distinction)

### Credibility Weight (Universal)

- **Purpose:** How [TBD] are sorted on a user's profile
- **Owner:** PROPER-RESPECT platform
- **Based on:** Tenure, verification, activity, content, lineage
- **Philosophy:** Depth over reach
- **Public:** Yes — the score is visible

### Reward Weight (Company-Configurable)

- **Purpose:** How much a company pays/rewards an advocate
- **Owner:** Each individual company
- **Based on:** Company's own rules (flat, usage-based, tiered, custom)
- **Philosophy:** Company autonomy
- **Public:** Yes — the rules are displayed

**Example:**

- Keegan has a Credibility Weight of 114 for Linear (displayed prominently)
- Linear's Reward Weight is "Flat $25 per referral" (company's choice)
- These are independent. Keegan's high credibility doesn't force Linear to pay more.

## Status Badges (The Credibility Surface)

| Badge | Meaning | Visual |
|-------|---------|--------|
| 🔥 **Active** | Daily/weekly usage, verified | Full color, top rank |
| 🌱 **Testing** | Trial or new adopter | Soft color, mid rank |
| ⚪️ **Archived** | Used to use, now switched | Muted, chronological |
| ✅ **Verified** | Company-confirmed via API | Checkmark overlay |
| 💰 **Monetized** | Affiliate link active | Subtle currency indicator |
| 🏷️ **Self-Attested** | "Put on by" logged manually | Tag icon |
| ✓ **Confirmed** | "Put on by" confirmed by tagged person | Double checkmark |
| 📱 **Screen Time** | Usage verified via device data | Phone icon |

## Verification Tiers (Progressive Trust)

| Tier | Method | Trust Level |
|------|--------|-------------|
| **Self-Attested** | Manual entry by user | Baseline |
| **Email-Confirmed** | Inbox metadata match | Low |
| **Screen-Time-Confirmed** | Device usage data | Medium-High |
| **OAuth-Verified** | Product API confirmation | Medium |
| **Company-Confirmed** | Partner API or direct claim | High |

## The Weight Philosophy

**Credibility Weight rewards depth over reach.** A linker with 200 hours in Linear and 100 followers scores higher than a linker with 100K followers who opened Linear once.

**Reward Weight is the company's choice.** If they want to pay everyone equally, that's their business. We display it. We don't judge it.

## Domain Fallback Options

Primary: `[TBD].to`  
If unavailable:

- `props.link` — semantic, short, clear
- `props.page` — modern, clean
- `get[TBD].to` — action-oriented
- `propped.to` — past tense (less ideal)
- `give[TBD].to` — verb form (longer)

Decision: Check availability of `[TBD].to`. If taken, evaluate `props.link` and `props.page`. Purchase primary + one fallback for protection.

## The 90% Onboarding Vision

**Goal:** A user connects their email + enables screen time. Within 5 minutes, they have a draft profile with 90% of their products.

**The flow:**

1. User signs up
2. Connects email (Gmail first, others later) → discovers 30+ SaaS products
3. Enables screen time (optional) → discovers 15+ mobile apps
4. Reviews drafts → keeps, archives, deletes
5. Manually adds anything missed → the last 10%
6. Attaches "Put on by" lineage → the social graph
7. Publishes profile → done

**Result:** 90% coverage in under 10 minutes. The user didn't type anything. They just reviewed and curated.

**The honest framing:** "We get you to 90% in 5 minutes. The last 10% is manual curation — and that's where the real value lives."

## Product Categories

| Category | Examples | Discovery Method |
|----------|----------|-----------------|
| **SAAS** | Linear, Notion, Figma | Email scan, OAuth |
| **MOBILE_APP** | Instagram, Spotify, Notion mobile | Screen time, manual |
| **PHYSICAL** | Books, hardware, gear | Manual only |
| **SERVICE** | Accountant, lawyer, consultant | Manual only |
| **COURSE** | MasterClass, Reforge, OnDeck | Manual, email |
| **COMMUNITY** | Discord server, Slack group, forum | Manual only |
| **TOOL** | CLI tools, open source, scripts | Manual, GitHub OAuth |

## Privacy Promise

- We scan email **metadata only** (sender domain, subject keywords, date).
- We **never read message bodies**.
- We **never store personal correspondence**.
- Screen time data is **local-first**. Only aggregated summaries sent to server.
- All data is **user-owned**. Export or delete anytime.
- Extension is **local-first**. No background tracking.
- We are **not a data company**. We are a presentation layer.
- **User-generated data is retained forever** (it's the product). Raw ingestion data is ephemeral.

## The Three Product Tiers

| Tier | Affiliate Link? | What Linker Gets | What Company Gets |
|------|----------------|------------------|-------------------|
| **Monetized** | Yes | Direct commission via their existing link | Tracked attribution |
| **Verified** | No | Verified badge, reputation, discovery | Public proof of real usage |
| **Curated** | No | Nothing (yet) | Listed in a real user's stack |

## The Non-Affiliate Unlock

80% of products people love have no referral program. PROPER-RESPECT makes those products visible anyway. The linker gets credibility. The company gets advocate intelligence. The visitor gets the full picture. Eventually, the company sees the demand and builds the program.

## The Manual-First Philosophy

**Manual logging is the core value.** Email scan is a starting point. Screen time is a bonus. The user is always in control of what appears on their profile.

**"Put on by" is always manual.** No confirmation required. The user is the source of truth for who influenced them.

**Product creation is user-driven.** No canonical database. If a product doesn't exist, the user creates it.

## The Polymorphic Lineage

"Put on by" accepts four types of sources:

| Type | Example | UI |
|------|---------|-----|
| **Person** | "Jordan Crawford" | Name or @username |
| **Content** | "The Tim Ferriss Podcast, Ep 612" | Title + URL |
| **Community** | "r/SaaS on Reddit" | Community name |
| **Event** | "SaaStr Annual 2024" | Event name + date |

Default is Person. But content, community, and event are valid sources of influence.

## Decision Principles

1. **User owns their graph.** They can export, delete, or disconnect anytime.
2. **Privacy is the feature, not the bug.** We collect less than we could, by design.
3. **Credibility weight is transparent.** The algorithm is public and explainable.
4. **Reward weight is company autonomy.** We don't dictate economics.
5. **Companies come second.** We build for linkers first. Companies follow the graph.
6. **No money holding.** We route links. We do not process payments.
7. **Manual is the MVP.** Automation is additive, not required.
8. **History is the product.** Data is retained forever because the timeline is the value.
9. **English only at launch.** i18n is a future consideration.
10. **90% auto-discovered.** The last 10% is manual curation — and that's where the value lives.
11. **Screen time is optional.** Local-first. Aggregated only. Never raw timestamps.
12. **Polymorphic lineage.** Influence comes from people, content, communities, and events.

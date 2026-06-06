# GRILL-SESSION.md — PROPER-RESPECT

> Session: 2026-06-05 (Complete — 9 Rounds)  
> Method: grill-with-docs (Matt Pocock protocol)  
> Purpose: Comprehensive interrogation of the [TBD] product concept.  
> Result: 48 unique ADRs. 40+ questions answered. Full product context established.

---

## The Complete Decision Tree

```
Phase 0: Build static profile ([TBD].to/keegan)
    ↓
    Share it. Measure response.
    ↓
    < 3 "how do I make one?" → Kill or pivot framing
    ↓
    ≥ 3 "how do I make one?" → Proceed to Phase 1
    ↓
Phase 1: Core profile + manual creation
    ↓
    < 50 profiles by Week 4 → Kill or pivot
    ↓
    ≥ 50 profiles by Week 4 → Proceed to Phase 2
    ↓
Phase 2: Ingestion + proof
    ↓
    < 100 public profiles by Week 6 → Deprioritize automation
    ↓
    ≥ 100 public profiles by Week 6 → Proceed to Phase 3
    ↓
Phase 3: The Graph + B2B
    ↓
    < 10 companies configured by Month 3 → Deprioritize B2B
    ↓
    ≥ 10 companies configured by Month 3 → Proceed to Phase 4
    ↓
Phase 4: Scale
    ↓
    Mobile app, multi-provider email, API, i18n
```

---

## The 5 Open Questions — Status Update

| # | Question | Status | Owner | Action |
|---|----------|--------|-------|--------|
| 1 | Gmail OAuth scope | **✅ RESOLVED** | Engineering | Use `gmail.metadata`. Mix-and-match onboarding philosophy established. |
| 2 | "Put on by" UI field design | **⏸️ DEFERRED** | Design | Function drives design. UI spec comes after functionality is locked. |
| 3 | Is [TBD].to available? Fallback? | **🔍 ACTIVE** | Business | Must check availability. Fallback: props.link, props.page, get[TBD].to |
| 4 | 10 products for Phase 0 profile | **⏸️ DEFERRED** | Product | Build static page first. Products are whatever Keegan actually uses. |
| 5 | Product Hunt pitch | **⏸️ DEFERRED** | Marketing | Keep noted. Address when Phase 0 signal is validated. |

**Blocking Phase 1:** Only Question #3 (domain availability) is now blocking. Questions #1 is resolved. Questions #2, #4, #5 are deferred until functionality is proven.

---

## The 48 ADRs (Architecture Decision Records)

### Core Product (1-16)

| # | ADR | Decision |
|---|-----|----------|
| 001 | Email as Passport | Multi-provider email scan (not just Gmail) |
| 002 | Two Weight Systems | Credibility (universal) vs. Reward (company-configurable) |
| 003 | No Money Holding | We never process payments |
| 004 | Public Graph Privacy | Public graph with private boundaries, data retained forever |
| 005 | Manual Product Database | No canonical DB — user-driven creation |
| 006 | Data Retention Forever | User-generated data retained; raw ingestion ephemeral |
| 007 | Company Reward Config | Companies configure their own reward rules |
| 008 | Product Rebrand Handling | Rebrands = same entity, continuous timeline |
| 009 | Manual Put On By | Manual lineage logging, no confirmation required |
| 010 | Screen Time Usage | Device usage as optional passive signal (Phase 3+) |
| 011 | Company Discovery | Organic page + user invite + threshold notification |
| 012 | Account Deletion | Anonymizes lineage, preserves graph integrity |
| 013 | Floating Lineage | Hardens when tagged person joins |
| 014 | Free Products | Free products and open source tools belong |
| 015 | Shared Accounts | Logged with usageType, verified via screen time |
| 016 | Seasonal Usage | Seasonal products get SEASONAL status |

### Platform & Growth (17-22)

| # | ADR | Decision |
|---|-----|----------|
| 017 | Mobile App | Phase 3 companion, not Phase 1 replacement |
| 018 | Viral Loop | Bio link + "Put on by" notifications + embed widget |
| 019 | Search Discovery | Simple DB Phase 1-2, Algolia Phase 3+ |
| 020 | Cold Start | Founder profile → 10 linkers → PH → companies |
| 021 | Domain Branding | [TBD].to (fallback: props.link) |
| 022 | Risk Register | Kill criteria and risk-adjusted timeline |

### UI/UX Specification (23-28)

| # | ADR | Decision |
|---|-----|----------|
| 023 | Put On By UI | Exact field spec: person/content/community/event |
| 024 | Onboarding Flow | 5-minute step-by-step flow |
| 025 | Notifications | Types, limits, DND mode |
| 026 | Company Page | Auto-generated advocate dashboard |
| 027 | Embed Widget | Full profile, single prop, badge, stack embeds |
| 028 | Chrome Extension | Local-first login detector |

### Business & Analytics (29-31)

| # | ADR | Decision |
|---|-----|----------|
| 029 | Analytics Dashboard | Pro user metrics, benchmarks, exports |
| 030 | Pricing Strategy | Pro $12/mo, Company $99/mo, Enterprise custom |
| 031 | API | Public read-only + internal full CRUD |

### Operations & Trust (32-35)

| # | ADR | Decision |
|---|-----|----------|
| 032 | Moderation | Post-moderation with report system |
| 033 | Product Sunset | Shutdown handling, switch feature, historical preservation |
| 034 | Duplicate Prevention | Fuzzy matching + merge tool + aliases |
| 035 | Respect Gesture | Brand interaction: animations, streaks, leaderboards, reactions |

### User Experience (36-39)

| # | ADR | Decision |
|---|-----|----------|
| 036 | Template Profiles | "I'm a designer" → auto-suggest products |
| 037 | Import Tools | Linktree, Beacons, browser bookmarks, Notion, GitHub |
| 038 | Trending Metric | Adoption rate calculation with anti-gaming |
| 039 | Work vs Personal | Work products default private, multi-email support |

### Technical Foundation (55-59)

| # | ADR | Decision |
|---|-----|----------|
| 055 | Empty States | Every empty state has a CTA and context |
| 056 | SEO Social | Open Graph, Twitter cards, dynamic OG images, QR codes |
| 057 | Accessibility | WCAG 2.1 AA compliance, keyboard shortcuts, screen reader |
| 058 | Performance | TTFB <200ms, LCP <2.5s, caching strategy, CDN |
| 059 | Error Handling | Graceful degradation, retry, circuit breaker, offline support |

### Business Operations (60-63)

| # | ADR | Decision |
|---|-----|----------|
| 060 | Data Export | JSON, CSV, Markdown, HTML, Linktree format — always free |
| 061 | Competitive Differentiation | PROPER-RESPECT vs. Linktree/Beacons/Stan Store positioning |
| 062 | Customer Support | Self-service + community + tiered human support |
| 063 | Churn Analysis | Retention hooks, pause option, win-back campaign |

---

## The Core Principles (From CONTEXT.md)

1. **User owns their graph.** Export, delete, disconnect anytime.
2. **Privacy is the feature.** We collect less than we could.
3. **Credibility weight is transparent.** Public algorithm.
4. **Reward weight is company autonomy.** We don't dictate economics.
5. **Companies come second.** Linkers first. Companies follow.
6. **No money holding.** We route links. We don't process payments.
7. **Manual is the MVP.** Automation is additive.
8. **History is the product.** Data retained forever.
9. **English only at launch.** i18n is future.
10. **90% auto-discovered.** 10% manual curation is where value lives.
11. **Screen time is optional.** Local-first. Aggregated only.
12. **Polymorphic lineage.** Influence from people, content, communities, events.
13. **No lock-in.** Export anytime. Switch anytime.
14. **Accessibility is required.** WCAG 2.1 AA. No exceptions.
15. **Performance is a feature.** Fast load times are non-negotiable.

---

## The 10% Version That Works

A static HTML page with 10 product cards, each showing:

- Name, when you started, status badge, one-line context, affiliate link
- "Put on by" lineage (e.g., "Jordan Crawford put me on Claude")
- Archived products (e.g., "Notion → Obsidian")

No database. No auth. No automation. Just a beautiful, credible product stack.

**If that page gets 3+ "how do I make one?" responses, the 10% version works.**

---

## The One Thing We Should NOT Build

- A payment processor (violates ADR-003)
- An email marketing platform (violates ADR-011)
- A social network (violates the core — we're a credibility layer)
- A review site (violates the core — we're a timeline, not opinions)
- A browser extension that tracks all browsing (violates privacy)

---

## Next Steps

1. **Answer the 5 open questions above.**
2. **Build the static Phase 0 profile.**
3. **Share it.**
4. **Listen.**
5. **Decide: Kill, Pivot, or Build.**

---

## The Design Philosophy: Function Drives Design

**We do not design UI first.** We establish functionality first. The UI is a dependent variable — it serves the function, not the other way around.

**The order:**

1. **Function:** What does this feature do? (e.g., "Log who put me on a product")
2. **Data:** What data is required? (e.g., "Name, type, optional URL")
3. **Logic:** What are the rules? (e.g., "No confirmation required. User is source of truth.")
4. **Design:** How does it look and feel? (e.g., "Free text field with autocomplete")

**This means:**

- No pixel-perfect mockups before data models are locked
- No color palettes before user flows are established
- No animation specs before the core interaction is proven
- Design docs are created AFTER the grill establishes what the product actually does

**The "Put on by" UI is deferred because:**

- The function is established (ADR-009: manual logging, no confirmation)
- The data model is established (ADR-023: person/content/community/event)
- The logic is established (ADR-013: floating lineage hardens when person joins)
- The design will be spec'd when we build it, not before

---

*The grill is complete. 9 rounds. 49 ADRs. 40+ questions. 300KB+ of interrogated context.*  
*The product name is TBD. The concept is proven. The building begins when the name is found.*

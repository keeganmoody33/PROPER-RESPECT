# PROPER-RESPECT — Documentation Index

> Complete documentation package for the **PROPER-RESPECT** product.  
> Generated via grill-with-docs (Matt Pocock protocol).  
> 9 rounds of interrogation. 48 unique ADRs. 40+ questions answered.  
> All decisions are interrogated, recorded, and reversible.

## Core Documents

| File | Purpose | Read This If... |
|------|---------|-----------------|
| [`README.md`](./README.md) | Product overview, value prop, stack, roadmap | You want the 5-minute pitch |
| [`CONTEXT.md`](./CONTEXT.md) | Shared domain language, terminology, 15 principles | You need to understand what words mean |
| [`GRILL-SESSION.md`](./GRILL-SESSION.md) | Complete interrogation record — all 9 rounds | You want to know why we decided what we decided |
| [`PRD.md`](./PRD.md) | Product Requirements — user stories, data model, API, UI, phases | You're building the thing |

## Architecture Decision Records (ADRs) — 48 Total

### Core Product (ADR-001 to ADR-016)

| # | File | Decision |
|---|------|----------|
| 001 | [`docs/adr/001-email-as-passport.md`](./docs/adr/001-email-as-passport.md) | Multi-provider email scan (not just Gmail) |
| 002 | [`docs/adr/002-weight-over-reach.md`](./docs/adr/002-weight-over-reach.md) | Two weight systems: Credibility vs. Reward |
| 003 | [`docs/adr/003-no-money-holding.md`](./docs/adr/003-no-money-holding.md) | Never hold, process, or touch money |
| 004 | [`docs/adr/004-public-graph-privacy.md`](./docs/adr/004-public-graph-privacy.md) | Public graph with private boundaries |
| 005 | [`docs/adr/005-manual-product-database.md`](./docs/adr/005-manual-product-database.md) | No canonical DB — user-driven creation |
| 006 | [`docs/adr/006-data-retention-forever.md`](./docs/adr/006-data-retention-forever.md) | User data retained forever; raw ingestion ephemeral |
| 007 | [`docs/adr/007-company-reward-config.md`](./docs/adr/007-company-reward-config.md) | Companies configure their own reward rules |
| 008 | [`docs/adr/008-product-rebrand-handling.md`](./docs/adr/008-product-rebrand-handling.md) | Rebrands = same entity, continuous timeline |
| 009 | [`docs/adr/009-manual-put-on-by.md`](./docs/adr/009-manual-put-on-by.md) | Manual lineage logging, no confirmation required |
| 010 | [`docs/adr/010-screen-time-usage.md`](./docs/adr/010-screen-time-usage.md) | Screen time as optional passive signal (Phase 3+) |
| 011 | [`docs/adr/011-company-discovery.md`](./docs/adr/011-company-discovery.md) | Organic page + user invite + threshold notification |
| 012 | [`docs/adr/012-account-deletion.md`](./docs/adr/012-account-deletion.md) | Account deletion anonymizes lineage |
| 013 | [`docs/adr/013-floating-lineage.md`](./docs/adr/013-floating-lineage.md) | Floating lineage hardens when tagged person joins |
| 014 | [`docs/adr/014-free-products.md`](./docs/adr/014-free-products.md) | Free products and open source tools belong |
| 015 | [`docs/adr/015-shared-accounts.md`](./docs/adr/015-shared-accounts.md) | Shared accounts logged with usageType |
| 016 | [`docs/adr/016-seasonal-usage.md`](./docs/adr/016-seasonal-usage.md) | Seasonal products get SEASONAL status |

### Platform & Growth (ADR-017 to ADR-022)

| # | File | Decision |
|---|------|----------|
| 017 | [`docs/adr/017-mobile-app.md`](./docs/adr/017-mobile-app.md) | Mobile app is Phase 3 companion |
| 018 | [`docs/adr/018-viral-loop.md`](./docs/adr/018-viral-loop.md) | Viral loop: bio link + notifications + embed |
| 019 | [`docs/adr/019-search-discovery.md`](./docs/adr/019-search-discovery.md) | Simple DB Phase 1-2, Algolia Phase 3+ |
| 020 | [`docs/adr/020-cold-start.md`](./docs/adr/020-cold-start.md) | Founder profile → 10 linkers → PH → companies |
| 021 | [`docs/adr/021-domain-branding.md`](./docs/adr/021-domain-branding.md) | Domain: props.to |
| 022 | [`docs/adr/022-risk-register.md`](./docs/adr/022-risk-register.md) | Risk register with kill criteria |

### UI/UX Specification (ADR-023 to ADR-028)

| # | File | Decision |
|---|------|----------|
| 023 | [`docs/adr/023-put-on-by-ui.md`](./docs/adr/023-put-on-by-ui.md) | Exact "Put on by" field spec |
| 024 | [`docs/adr/024-onboarding-flow.md`](./docs/adr/024-onboarding-flow.md) | 5-minute step-by-step onboarding |
| 025 | [`docs/adr/025-notifications.md`](./docs/adr/025-notifications.md) | Notification types, limits, DND mode |
| 026 | [`docs/adr/026-company-page.md`](./docs/adr/026-company-page.md) | Auto-generated advocate dashboard |
| 027 | [`docs/adr/027-embed-widget.md`](./docs/adr/027-embed-widget.md) | Profile, prop, badge, stack embeds |
| 028 | [`docs/adr/028-chrome-extension.md`](./docs/adr/028-chrome-extension.md) | Local-first login detector |

### Business & Analytics (ADR-029 to ADR-031)

| # | File | Decision |
|---|------|----------|
| 029 | [`docs/adr/029-analytics-dashboard.md`](./docs/adr/029-analytics-dashboard.md) | Pro user analytics, benchmarks, exports |
| 030 | [`docs/adr/030-pricing.md`](./docs/adr/030-pricing.md) | Pro $12/mo, Company $99/mo, Enterprise custom |
| 031 | [`docs/adr/031-api.md`](./docs/adr/031-api.md) | Public read-only + internal full CRUD |

### Operations & Trust (ADR-032 to ADR-035)

| # | File | Decision |
|---|------|----------|
| 032 | [`docs/adr/032-moderation.md`](./docs/adr/032-moderation.md) | Post-moderation with report system |
| 033 | [`docs/adr/033-product-sunset.md`](./docs/adr/033-product-sunset.md) | Shutdown handling, switch feature |
| 034 | [`docs/adr/034-duplicate-prevention.md`](./docs/adr/034-duplicate-prevention.md) | Fuzzy matching + merge tool + aliases |
| 035 | [`docs/adr/035-props-gesture.md`](./docs/adr/035-props-gesture.md) | Animations, streaks, leaderboards, reactions |

### User Experience (ADR-036 to ADR-039)

| # | File | Decision |
|---|------|----------|
| 036 | [`docs/adr/036-template-profiles.md`](./docs/adr/036-template-profiles.md) | "I'm a designer" → auto-suggest products |
| 037 | [`docs/adr/037-import-tools.md`](./docs/adr/037-import-tools.md) | Import from Linktree, Beacons, bookmarks, Notion |
| 038 | [`docs/adr/038-trending-metric.md`](./docs/adr/038-trending-metric.md) | Adoption rate calculation with anti-gaming |
| 039 | [`docs/adr/039-work-personal.md`](./docs/adr/039-work-personal.md) | Work products default private, multi-email |

### Technical Foundation (ADR-055 to ADR-059)

| # | File | Decision |
|---|------|----------|
| 055 | [`docs/adr/055-empty-states.md`](./docs/adr/055-empty-states.md) | Every empty state has a CTA and context |
| 056 | [`docs/adr/056-seo-social.md`](./docs/adr/056-seo-social.md) | Open Graph, Twitter cards, dynamic OG images |
| 057 | [`docs/adr/057-accessibility.md`](./docs/adr/057-accessibility.md) | WCAG 2.1 AA compliance, keyboard shortcuts |
| 058 | [`docs/adr/058-performance.md`](./docs/adr/058-performance.md) | TTFB <200ms, LCP <2.5s, caching strategy |
| 059 | [`docs/adr/059-error-handling.md`](./docs/adr/059-error-handling.md) | Graceful degradation, retry, circuit breaker |

### Business Operations (ADR-060 to ADR-063)

| # | File | Decision |
|---|------|----------|
| 060 | [`docs/adr/060-data-export.md`](./docs/adr/060-data-export.md) | JSON, CSV, Markdown, HTML, Linktree — always free |
| 061 | [`docs/adr/061-competitive-differentiation.md`](./docs/adr/061-competitive-differentiation.md) | PROPER-RESPECT vs. Linktree/Beacons/Stan Store |
| 062 | [`docs/adr/062-customer-support.md`](./docs/adr/062-customer-support.md) | Self-service + community + tiered human support |
| 063 | [`docs/adr/063-churn-analysis.md`](./docs/adr/063-churn-analysis.md) | Retention hooks, pause option, win-back |

## The grill-with-docs Protocol

1. **Interrogate** — Ask forcing questions one at a time. No hand-waving. No jargon.
2. **Align** — Resolve every branch of the decision tree before writing code.
3. **Record** — Write decisions into ADRs and context docs inline.
4. **Build** — Only after the domain language is shared and the hard questions are answered.

## The 15 Principles

1. User owns their graph.
2. Privacy is the feature, not the bug.
3. Credibility weight is transparent.
4. Reward weight is company autonomy.
5. Companies come second.
6. No money holding.
7. Manual is the MVP.
8. History is the product.
9. English only at launch.
10. 90% auto-discovered.
11. Screen time is optional.
12. Polymorphic lineage.
13. No lock-in.
14. Accessibility is required.
15. Performance is a feature.

## Next Steps

1. **Answer the 5 open questions in GRILL-SESSION.md**
2. **Build the static Phase 0 profile (props.to/keegan)**
3. **Share it. Measure "how do I make one?" responses**
4. **Decide: Kill, Pivot, or Build**

---

*Package: 53 files, 288KB, 48 unique ADRs, 9 grill rounds*  
*Repository: <https://github.com/keeganmoody33/PROPER-RESPECT>*  
*Generated: 2026-06-05*

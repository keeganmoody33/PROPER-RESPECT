# PROPER-RESPECT - Documentation Index

> Updated: 2026-06-06  
> Current scope: manual-first product-stack profile with affiliate/referral links, proof, and lineage.

## Core Documents

| File | Purpose |
| --- | --- |
| `README.md` | Product overview and current build target |
| `CONTEXT.md` | Domain language and product principles |
| `PRD.md` | MVP requirements and architecture |
| `GRILL-SESSION.md` | Latest decision record and active questions |

## V1 Product Direction

These docs are the current source of truth for the V1 build. If an ADR conflicts with `docs/000-current-product-thesis.md`, the thesis wins.

| # | File | Purpose |
| --- | --- | --- |
| 000 | `docs/000-current-product-thesis.md` | What V1 is and is not; manual-first rule |
| 001 | `docs/001-git-for-product-attribution.md` | The Git-for-adoption mental model |
| 002 | `docs/002-v1-product-motion.md` | V1 user motion and capability sequencing |
| 003 | `docs/003-evidence-surfaces.md` | Proof types and evidence sources |
| 004 | `docs/004-v1-technical-contract.md` | Entities, types, pipeline, and owed tests |

## Active ADRs

These decisions are relevant to the current MVP.

| # | File | Decision |
| --- | --- | --- |
| 001 | `docs/adr/001-email-as-passport.md` | Usage proof sources; email is optional, not primary |
| 002 | `docs/adr/002-weight-over-reach.md` | Credibility is proof-first; reward logic is future |
| 003 | `docs/adr/003-no-money-holding.md` | Do not hold, process, or touch money |
| 004 | `docs/adr/004-public-graph-privacy.md` | Public profile with private draft boundaries |
| 005 | `docs/adr/005-manual-product-database.md` | User-driven product creation |
| 006 | `docs/adr/006-data-retention-forever.md` | Preserve user-owned product history |
| 008 | `docs/adr/008-product-rebrand-handling.md` | Rebrands keep product history continuous |
| 009 | `docs/adr/009-manual-put-on-by.md` | Manual lineage is valid and important |
| 012 | `docs/adr/012-account-deletion.md` | Account deletion preserves graph integrity without exposing user identity |
| 013 | `docs/adr/013-floating-lineage.md` | Lineage can point to people/content not on the platform |
| 014 | `docs/adr/014-free-products.md` | Free/open-source/no-account products belong |
| 015 | `docs/adr/015-shared-accounts.md` | Shared accounts can still be logged as user relationships |
| 016 | `docs/adr/016-seasonal-usage.md` | Seasonal tools can be represented without false activity |
| 018 | `docs/adr/018-viral-loop.md` | Viral loop comes from profiles and put-on-by credit |
| 019 | `docs/adr/019-search-discovery.md` | Simple DB search first |
| 020 | `docs/adr/020-cold-start.md` | Cold start begins with Keegan's real stack |
| 021 | `docs/adr/021-domain-branding.md` | Name/domain is not blocking; PROPER-RESPECT is working name |
| 022 | `docs/adr/022-risk-register.md` | MVP risks and constraints |
| 023 | `docs/adr/023-put-on-by-ui.md` | Put-on-by field model |
| 024 | `docs/adr/024-onboarding-flow.md` | Manual-first onboarding with imports |
| 028 | `docs/adr/028-chrome-extension.md` | Claim-on-visit extension, not background tracking |
| 032 | `docs/adr/032-moderation.md` | Public content needs report/moderation paths |
| 033 | `docs/adr/033-product-sunset.md` | Archived/sunset products remain part of history |
| 034 | `docs/adr/034-duplicate-prevention.md` | Product matching and duplicate prevention |
| 036 | `docs/adr/036-template-profiles.md` | Templates can speed manual curation |
| 037 | `docs/adr/037-import-tools.md` | Import from existing public link surfaces |
| 039 | `docs/adr/039-work-personal.md` | Work/personal boundaries |
| 055 | `docs/adr/055-empty-states.md` | Empty states should guide profile completion |
| 056 | `docs/adr/056-seo-social.md` | Public profiles need strong social sharing |
| 057 | `docs/adr/057-accessibility.md` | Accessibility is required |
| 058 | `docs/adr/058-performance.md` | Public profiles should be fast |
| 059 | `docs/adr/059-error-handling.md` | Graceful failures and import review safety |
| 060 | `docs/adr/060-data-export.md` | User data export should remain free |
| 061 | `docs/adr/061-competitive-differentiation.md` | Differentiation vs. generic link-in-bio tools |

## Future / Parked ADRs

These were moved out of active scope because they are not part of the current MVP.

| File | Parked Because |
| --- | --- |
| `docs/future/007-company-reward-config.md` | Company reward rules are B2B/future |
| `docs/future/010-screen-time-usage.md` | Screen-time tracking is too heavy for launch |
| `docs/future/011-company-discovery.md` | Company discovery follows user profiles |
| `docs/future/017-mobile-app.md` | Mobile app is not required for MVP |
| `docs/future/025-notifications.md` | Notifications can wait |
| `docs/future/026-company-page.md` | B2B dashboard can wait |
| `docs/future/027-embed-widget.md` | Embeds can wait until profiles work |
| `docs/future/029-analytics-dashboard.md` | Analytics is future/pro tier exploration |
| `docs/future/030-pricing.md` | Pricing is not set |
| `docs/future/031-api.md` | Public API is not an MVP dependency |
| `docs/future/035-props-gesture.md` | Reactions/streaks/leaderboards are polish |
| `docs/future/038-trending-metric.md` | Trending metrics require scale |
| `docs/future/062-customer-support.md` | Support model follows product shape |
| `docs/future/063-churn-analysis.md` | Churn analysis follows monetization |

## Documentation Rule

If a document assumes B2B dashboards, pricing, analytics, screen-time tracking, or email scan as the primary source of truth, it is outdated unless it explicitly marks those as future/optional.

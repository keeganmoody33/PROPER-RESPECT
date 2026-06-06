# ADR-010: Screen Time and Device Usage as Passive Usage Signal

## Status
Accepted — 2026-06-05

## Context
Email scan catches SaaS products that send email. Browser extension catches web apps. But a huge category of products is missing: mobile apps, desktop apps, and tools that don't send email or have web interfaces. Screen time / device usage data provides another passive signal for breadth of coverage.

## Decision
We will use **device-level usage data** (Screen Time API on iOS, UsageStatsManager on Android) as an **optional, opt-in** signal for passive usage logging. This is additive to email scan and manual logging — not a replacement.

## What It Gives Us

| Signal | What We Learn | Use Case |
|--------|--------------|----------|
| **App open duration** | How long user spends in an app daily | "Active" vs "Dormant" status |
| **App open frequency** | How often user opens an app | Tenure and engagement depth |
| **Pickups / notifications** | How often user interacts | Activity signal for push-heavy apps |
| **Category data** | Social, productivity, entertainment | Auto-categorization of PROPER-RESPECT |
| **Cross-device usage** | iPhone + iPad + Mac | Unified usage profile |

## The Platform Strategy

### iOS (Screen Time API — iOS 16+)
- Uses `DeviceActivity` framework
- Requires user to grant Screen Time access (similar to parental controls)
- Returns app usage by bundle ID (e.g., `com.notion.id`)
- **Challenge:** App Store review may reject non-parental-control apps using Screen Time API

### Android (UsageStatsManager)
- Requires `PACKAGE_USAGE_STATS` permission
- User must manually enable in Settings → Security → Usage Access
- Returns app usage by package name (e.g., `com.notion.id`)
- **Challenge:** Permission is buried in settings; low adoption rate

### Desktop (macOS / Windows)
- macOS: No native screen time API for third-party apps (Apple only)
- Windows: No native API for app usage tracking
- **Workaround:** Browser extension + manual logging for desktop

## The Integration Model

```
User opts in to Screen Time / Device Usage
    ↓
Mobile app (iOS/Android) reads device usage data
    ↓
Maps bundle IDs to Product entities (e.g., com.notion.id → Notion)
    ↓
Creates/updates Prop drafts with usage signals:
    - Daily active minutes
    - Weekly open count
    - Last opened date
    ↓
User reviews drafts in dashboard
    ↓
User publishes or archives
```

## The Privacy Model

| Aspect | Policy |
|--------|--------|
| **Opt-in** | User must explicitly enable. Not on by default. |
| **Local-first** | Raw usage data stays on device. Only aggregated signals sent to server. |
| **Aggregated only** | We send "120 min/week in Notion" not "Opened Notion at 9:03 AM for 14 minutes" |
| **No content** | We don't know what you did in the app. Just that you used it. |
| **Revocable** | User can disable anytime. Historical props remain. Future sync stops. |
| **Transparency** | Clear explanation: "We use screen time to auto-log your app usage. We never see what you do inside apps." |

## The Product Mapping Challenge

Bundle IDs don't always match product names cleanly:

| Bundle ID | Product | Notes |
|-----------|---------|-------|
| `com.notion.id` | Notion | Clean match |
| `com.linear.app` | Linear | Clean match |
| `com.apple.mobilesafari` | Safari | Browser — not a specific product |
| `com.google.chrome` | Chrome | Browser — not a specific product |
| `com.spotify.client` | Spotify | Clean match |
| `com.figma.mirror` | Figma | Mirror app, not main app |
| `com.slack.Slack` | Slack | Clean match |
| `com.microsoft.teams` | Microsoft Teams | Clean match |
| `com.apple.mail` | Apple Mail | Native app — no product entity |

**Solution:** Maintain a bundle ID → Product mapping table. Community-contributed. For browsers and native apps, we skip or flag for manual review.

## The Breadth vs. Depth Tradeoff

| Method | Breadth | Depth | Friction | Privacy |
|--------|---------|-------|----------|---------|
| **Email scan** | High (catches most SaaS) | Low (just signup/activity) | Low | Medium |
| **Screen time** | Medium (mobile apps only) | High (daily minutes) | Medium | High (device-level) |
| **Browser extension** | Low (web only) | Medium (login state) | Low | Low |
| **Manual logging** | Low (user decides) | Very High (full context) | High | Zero |
| **OAuth APIs** | Very Low (per-product) | Very High (full usage) | High | Medium |

**The stack:** Email scan for breadth. Screen time for mobile app depth. Manual logging for precision. OAuth for verification. Together they get to 100% coverage.

## The 100% Onboarding Vision

**Goal:** A user connects their email + enables screen time. Within 5 minutes, they have a draft profile with 90%+ of their products.

**The flow:**
1. User signs up
2. Connects email (Gmail first, others later) → discovers 30+ SaaS products
3. Enables screen time (optional) → discovers 15+ mobile apps
4. Reviews drafts → keeps, archives, deletes
5. Manually adds anything missed → the last 5-10%
6. Attaches "Put on by" lineage → the social graph
7. Publishes profile → done

**Result:** 100% coverage in under 10 minutes. The user didn't type anything. They just reviewed and curated.

## Consequences

### Positive
- Captures mobile apps that email scan misses (Instagram, TikTok, mobile games, native tools)
- Provides daily usage depth (minutes per day) that email can't provide
- Creates a moat: no competitor combines email + screen time + manual
- Strong "wow" factor: "It knew I use Notion 2 hours a day without me telling it"

### Negative
- iOS App Store review risk (Screen Time API is for parental controls)
- Android permission is buried in Settings; low adoption
- Bundle ID mapping is manual work (community-driven)
- Privacy concerns are massive ("you're reading my screen time?!")
- Desktop coverage is weak (no macOS/Windows APIs)
- Requires building a mobile app (not just web)

## Mitigations
- **iOS:** Frame as "Digital Wellbeing" / "Product Awareness" not "Tracking"
- **Android:** Deep-link to Settings page for Usage Access permission
- **Privacy:** Local-first aggregation. Never send raw timestamps. Only weekly summaries.
- **Mapping:** Community contributions + fuzzy matching on bundle ID names
- **Fallback:** If screen time is rejected or disabled, email scan + manual still work

## Related
- ADR-001 (Email Passport) — primary onboarding mechanism
- ADR-004 (Public Graph Privacy) — screen time data is private, only aggregated signals public
- ADR-009 (Manual Put On By) — manual logging fills the gaps screen time misses

# ADR-017: Mobile App — When and Why

> Parked: not active MVP scope. Revisit only after the core product-stack profile works.


## Status
Accepted — 2026-06-05

## Context
Do we need a mobile app? If so, when? What does it do that the web app can't?

## Decision

### Phase 1-2: Web-Only
- The product is a web app (Next.js)
- Responsive design works on mobile browsers
- No native app needed for core functionality

### Phase 3: Mobile App (iOS + Android)
- Triggered by: Screen time integration (ADR-010)
- Screen time API requires native app context (iOS Screen Time API, Android UsageStatsManager)
- The mobile app is primarily a **data collector**, not a full profile viewer

### What the Mobile App Does

| Feature | Web App | Mobile App |
|---------|---------|-----------|
| View profile | ✅ | ✅ (read-only, optimized) |
| Edit props | ✅ | ❌ (Phase 3) |
| Add "Put on by" | ✅ | ✅ (quick add) |
| Screen time sync | ❌ | ✅ (core feature) |
| Push notifications | ❌ | ✅ (lineage hardening alerts) |
| Quick share | ❌ | ✅ (share profile via native share sheet) |
| Offline viewing | ❌ | ✅ (cached profile) |

### The Mobile App as a "Companion"

The mobile app is not a replacement for the web app. It's a companion:
- **Web app:** Full profile management, dashboard, analytics
- **Mobile app:** Screen time sync, quick actions, notifications, offline viewing

**The pitch to users:** "Download the props app to auto-sync your mobile app usage. Your profile stays on the web."

### The Build Decision

| Option | Pros | Cons |
|--------|------|------|
| **Native iOS + Android** | Best performance. Full API access. | Two codebases. High cost. |
| **React Native** | One codebase. Near-native. | Screen time API may be limited. |
| **Flutter** | One codebase. Good performance. | Screen time API uncertain. |
| **PWA (Progressive Web App)** | Web-based. No app store. | No screen time access. Limited push. |

**Decision:** Start with PWA for web. When screen time is needed (Phase 3), evaluate React Native vs. native. Native iOS is likely required for Screen Time API.

## Consequences

### Positive
- Web-first keeps costs low in Phase 1-2
- Mobile app adds real value (screen time, notifications)
- Companion model means users don't need to manage profile on mobile
- PWA provides app-like experience without app store

### Negative
- iOS Screen Time API may require native app (not PWA)
- Two platforms to maintain (web + mobile)
- App store review risk (Screen Time API usage)
- Users may expect full profile editing on mobile

## Related
- ADR-010 (Screen Time) — mobile app is required for screen time integration
- PRD (Phase 3) — mobile app is Phase 3 deliverable

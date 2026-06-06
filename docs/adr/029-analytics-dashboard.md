# ADR-029: Pro User Analytics Dashboard

## Status
Accepted — 2026-06-05

## Context
Pro users pay for analytics. What exactly do they see? What metrics matter? How is the data presented?

## Decision

### The Dashboard Layout

```
┌─────────────────────────────────────────────────────────┐
│ Analytics Dashboard — props.to/keegan                   │
│                                                         │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│ │ Profile     │ │ Total Prop  │ │ Avg. Cred   │       │
│ │ Views       │ │ Clicks      │ │ Weight      │       │
│ │ 1,247       │ │ 892         │ │ 67.4        │       │
│ │ ↑ 12%       │ │ ↑ 23%       │ │ —           │       │
│ └─────────────┘ └─────────────┘ └─────────────┘       │
│                                                         │
│ 📈 Views Over Time                                      │
│ [Line chart: daily views for last 30 days]            │
│                                                         │
│ 🖱️ Top Props by Clicks                                  │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 1. Linear — 445 clicks (49.9%)                      │ │
│ │ 2. Cursor — 312 clicks (35.0%)                      │ │
│ │ 3. Claude — 89 clicks (10.0%)                       │ │
│ │ 4. Obsidian — 46 clicks (5.2%)                      │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 🌐 Traffic Sources                                      │
│ [Pie chart: Twitter 45%, LinkedIn 23%, Direct 18%,     │
│  Newsletter 10%, Other 4%]                             │
│                                                         │
│ 🗺️ Geography                                            │
│ [Map: US 45%, UK 12%, Germany 8%, Canada 7%, ...]     │
│                                                         │
│ 📱 Device Breakdown                                     │
│ [Bar chart: Desktop 67%, Mobile 28%, Tablet 5%]       │
│                                                         │
│ 🏷️ Lineage Impact                                       │
│ • 12 people gave you props for putting them on        │
│ • Your network: 3 degrees of separation                │
│ • Top influenced: Linear (5 people), Cursor (4)         │
│                                                         │
│ 💰 Affiliate Performance (if connected)                │
│ • Amazon Associates: $23 this month                     │
│ • Notion Referral: $15 this month                       │
│ • Total: $38 this month                                │
│                                                         │
│ [Export Data →] [Download CSV] [Download PDF]          │
└─────────────────────────────────────────────────────────┘
```

### The Metrics

| Metric | Definition | Calculation | Update Frequency |
|--------|-----------|-------------|-------------------|
| **Profile Views** | Unique visitors to props.to/{username} | Cookie-based, 24h deduplication | Real-time |
| **Prop Clicks** | Clicks on any product link | Click event tracking | Real-time |
| **Click-Through Rate** | Clicks / Views per prop | (Prop clicks / Profile views) × 100 | Daily |
| **Traffic Sources** | Where visitors came from | Referrer header | Daily |
| **Geography** | Visitor country/city | IP geolocation (approximate) | Daily |
| **Device** | Desktop/mobile/tablet | User agent parsing | Daily |
| **Lineage Impact** | How many people you put on | Count of lineage entries where you are the giver | Real-time |
| **Network Depth** | Degrees of separation | Graph traversal from your node | Weekly |
| **Affiliate Performance** | Earnings from affiliate links | Pulled from affiliate dashboard APIs (Amazon, etc.) | Weekly |

### The Time Ranges

- **Last 24 hours:** Real-time pulse
- **Last 7 days:** Weekly trend
- **Last 30 days:** Monthly summary
- **Last 90 days:** Quarterly view
- **All time:** Lifetime stats

### The Comparison Feature

Pro users can compare their stats to:
- Their own previous period ("vs. last month")
- Similar users ("Users with 10-20 props average 500 views/month")
- Top 10% ("Top 10% of users get 2,000+ views/month")

### The Export Options

| Format | Data Included | Use Case |
|--------|--------------|----------|
| **CSV** | Raw metrics table | Spreadsheet analysis |
| **PDF** | Formatted dashboard | Reporting to clients/employers |
| **JSON** | All raw data | API integration |
| **Image** | Charts only | Social sharing |

### The Privacy of Analytics

- Analytics data is private to the user (not public)
- User can share analytics publicly (optional toggle)
- Aggregated benchmarks use anonymized data only
- No individual user data is exposed in comparisons

## Consequences

### Positive
- Clear value proposition for Pro tier
- Actionable insights ("Linear is your top performer")
- Benchmarking motivates improvement
- Export options make data portable

### Negative
- Analytics require tracking (privacy concern)
- IP geolocation is approximate (not accurate)
- Affiliate performance requires API integrations (complex)
- Comparison data may discourage low-performing users

## Mitigations
- Tracking is first-party only (no third-party cookies)
- IP geolocation is coarse (country level, not street address)
- Affiliate APIs are optional (user connects them manually)
- Comparisons are anonymized and opt-in

## Related
- PRD (Pro Tier) — analytics is the core Pro feature
- ADR-004 (Public Graph Privacy) — analytics data is private

# ADR-039: Work vs. Personal — Visibility and Separation

## Status
Accepted — 2026-06-05

## Context
Users have products they use for work and products they use personally. Some work products are sensitive (internal tools, proprietary software). How do we handle this?

## Decision

### The Visibility Model

Every prop has a `visibility` field:
- `PUBLIC` — Visible to everyone
- `PRIVATE` — Visible only to the user (in their dashboard)
- `DRAFT` — Not yet published (default after email scan)

### The Work Product Default

**Default for work products:** `PRIVATE`

**Why:** Work products may be sensitive. Users may not want to publicly disclose what internal tools their company uses.

**The flow:**
1. Email scan discovers work products (via work email)
2. Props are created as `DRAFT`
3. User reviews them
4. User can choose: `PUBLIC` ("I use this at work and I'm proud of it") or `PRIVATE` ("This is internal, keep it private")
5. Default suggestion: `PRIVATE` for work products

### The Work vs. Personal Indicators

| Signal | Likely Work? | Likely Personal? |
|--------|-------------|------------------|
| Domain contains company name | Yes | No |
| Email is work email | Yes | No |
| Product is internal tool (e.g., Jira with company domain) | Yes | No |
| Product is consumer app (e.g., Spotify) | No | Yes |
| Product is productivity tool (e.g., Notion) | Maybe | Maybe |
| User manually marks as work | Yes | No |

### The "Work Mode" Toggle

Users can enable "Work Mode":
```
┌─────────────────────────────────────┐
│ Work Mode                             │
│                                     │
│ [✅] Enabled                          │
│                                     │
│ When enabled:                         │
│ • Work products default to PRIVATE  │
│ • Work email is scanned separately  │
│ • Work products are tagged with 💼   │
│ • Work products don't count toward  │
│   public credibility (but do count  │
│   for private analytics)              │
│                                     │
│ Work email: keegan@company.com        │
│                                     │
│ [Disconnect Work Email]               │
└─────────────────────────────────────┘
```

### The Public Profile Without Work Products

```
┌─────────────────────────────────────┐
│ props.to/keegan                       │
│                                     │
│ Public Stack (8 products):            │
│ • Linear, Cursor, Claude, Obsidian  │
│ • Spotify, Kindle, Notion, Raycast  │
│                                     │
│ 💼 Work Stack (5 products, private): │
│ • [Visible only to Keegan]          │
│                                     │
│ [View Public Stack →]               │
└─────────────────────────────────────┘
```

**Note:** The work stack is not visible to visitors. But the user can see it in their dashboard.

### The Credibility Weight for Private Props

| Visibility | Credibility Weight | Counts Toward Public Rank? |
|------------|-------------------|---------------------------|
| `PUBLIC` | Full weight | Yes |
| `PRIVATE` | Full weight | No (only for private analytics) |
| `DRAFT` | No weight | No |

**The rule:** Private props still have credibility weight (for the user's own analytics), but they don't contribute to public rankings or company advocate counts.

### The Multi-Email Support

```
┌─────────────────────────────────────┐
│ Connected Emails                      │
│                                     │
│ 📧 keegan@gmail.com (Personal)        │
│   Status: Active · Last scan: 2h ago│
│                                     │
│ 💼 keegan@company.com (Work)          │
│   Status: Active · Last scan: 2h ago│
│                                     │
│ [+ Add Another Email]                 │
│                                     │
│ Email scan settings:                  │
│ [✅] Scan personal email              │
│ [✅] Scan work email                  │
│ [✅] Auto-mark work products as private│
└─────────────────────────────────────┘
```

## Consequences

### Positive
- Work products are protected by default
- Users can choose to make work products public
- Multi-email support captures complete product usage
- Private props still count for personal analytics

### Negative
- Work products hidden = less data for companies
- Multi-email is complex (OAuth for each provider)
- Work email may contain sensitive corporate data
- Users may forget to review work products (they stay as draft)

## Mitigations
- Work products default to private (safe default)
- Clear visual indicator (💼) for work products
- User can bulk-change visibility ("Make all work products public")
- Work email scan is opt-in (not automatic)

## Related
- ADR-004 (Public Graph Privacy) — visibility is core privacy mechanism
- ADR-001 (Email Passport) — multi-email scanning
- ADR-015 (Shared Accounts) — work products are often shared/team accounts

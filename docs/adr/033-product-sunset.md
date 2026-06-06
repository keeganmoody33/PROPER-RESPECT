# ADR-033: Product Sunset and Shutdown — What Happens When a Product Dies

## Status

Accepted — 2026-06-05

## Context

Products shut down. Startups fail. Companies pivot. What happens to PROPER-RESPECT for a product that no longer exists?

## Decision

### The Product Lifecycle States

| State | Description | Example |
|-------|-------------|---------|
| **Active** | Product is live and growing | Linear, Cursor |
| **Acquired** | Product was bought by another company | Figma (by Adobe) |
| **Sunset** | Product is being phased out | Google Reader |
| **Shutdown** | Product is dead | Quibi, Sidecar |
| **Rebranded** | Product changed name | Twitter → X |
| **Merged** | Product merged into another | Sunrise → Outlook |

### The Sunset Flow

**Step 1: Detection**

- Community reports: "This product shut down"
- Automated detection: Domain no longer resolves, website returns 404
- Company announcement: "We're shutting down on [date]"

**Step 2: Verification**

- Admin verifies the shutdown (checks website, news, company announcement)
- If verified, product status changes to `SUNSET` or `SHUTDOWN`

**Step 3: User Notification**

```
Subject: [Product Name] has shut down

Body:
Hi Keegan,

We noticed that [Product Name] has shut down or been discontinued.

Your prop for this product has been automatically archived.

You can:
• Keep it as an archive (shows your product history)
• Switch it to a replacement product
• Delete it entirely

View your prop: proper-respect.example/keegan/[product]

— The PROPER-RESPECT team
```

**Step 4: Prop Handling**

| User Action | Result |
|-------------|--------|
| **Do nothing** | Prop stays archived. Product marked as `SHUTDOWN`. |
| **Archive** | Prop moved to archive. Historical record preserved. |
| **Switch** | User selects replacement product. New prop created. Old prop archived with "Switched to [New Product]" note. |
| **Delete** | Prop deleted. No historical record. |

**Step 5: Product Page Update**

```
┌─────────────────────────────────────┐
│ [Logo] Quibi                          │
│                                     │
│ ⚠️ This product has shut down       │
│ Shutdown date: December 2020          │
│                                     │
│ 12 users had this in their stack    │
│                                     │
│ [View Archived Props →]             │
│                                     │
│ Looking for alternatives?             │
│ • Netflix (similar users switched)  │
│ • YouTube (similar users switched)  │
└─────────────────────────────────────┘
```

### The "Switch" Feature

When a product shuts down, users can "switch" their prop to a replacement:

```
┌─────────────────────────────────────┐
│ Switch from Quibi                     │
│                                     │
│ What did you switch to?               │
│                                     │
│ [Netflix     ] [YouTube    ]         │
│ [Hulu        ] [Disney+    ]         │
│ [Other...    ]                       │
│                                     │
│ [Switch] [Keep Archived] [Delete]     │
└─────────────────────────────────────┘
```

**The switch creates a historical link:**

- Old prop: "Quibi (archived) → Switched to Netflix"
- New prop: "Netflix (active) → Switched from Quibi"

### The Acquisition Case

When a product is acquired (e.g., Figma by Adobe):

- Product stays active
- Product page shows acquisition info
- Users can choose to archive if they don't want to support the new owner
- No automatic action (acquisition ≠ shutdown)

### The Data Retention

- Shutdown product entities are retained forever (historical record)
- User props for shutdown products are retained (user choice to archive or delete)
- Company configuration for shutdown products is archived (no new advocates)

## Consequences

### Positive

- Historical product journey is preserved
- "Switch" feature captures product evolution
- Shutdown products become a "museum" of tech history
- Users don't lose their historical data

### Negative

- Shutdown products clutter search results
- "Switch" feature is complex to implement
- Users may be sad to see products they loved shut down
- Admin verification of shutdowns is manual work

## Mitigations

- Shutdown products are deprioritized in search
- "Switch" is optional (user can just archive)
- Community reporting automates shutdown detection
- Admin batch-processing for known shutdowns (e.g., Google Reader, Quibi)

## Related

- ADR-008 (Product Rebrand) — acquisition and rebranding
- ADR-006 (Data Retention) — shutdown data is retained

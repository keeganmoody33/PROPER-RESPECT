# ADR-024: The Onboarding Flow — Step by Step

## Status
Accepted — 2026-06-05

## Context
The onboarding must get a user from signup to a published profile in under 5 minutes. Every step must be justified. Every friction point must be identified.

## Decision

### The 5-Minute Onboarding Flow

#### Step 1: Signup (30 seconds)
```
┌─────────────────────────────────────┐
│ Welcome to PROPER-RESPECT                      │
│                                     │
│ Get respect. Give respect.              │
│                                     │
│ [Continue with Google]              │
│ [Continue with Apple]               │
│ [Continue with Email]               │
│                                     │
│ Already have an account? [Sign In]  │
└─────────────────────────────────────┘
```

**Why Google/Apple first:** Reduces friction. No password to remember. One tap signup.

#### Step 2: Choose Username (15 seconds)
```
┌─────────────────────────────────────┐
│ Choose your props link              │
│                                     │
│ props.to/ [keegan              ]    │
│                                     │
│ ✅ Available!                       │
│                                     │
│ This is your public profile link.   │
│ Put it in your bio. Share it.       │
│                                     │
│ [Continue]                          │
└─────────────────────────────────────┘
```

**Why username now:** The username is the core product. They need to know their link immediately.

#### Step 3: Connect Email (Optional) (30 seconds)
```
┌─────────────────────────────────────┐
│ Find your products automatically      │
│                                     │
│ We'll scan your email for product   │
│ receipts (metadata only).           │
│                                     │
│ [Connect Gmail]                     │
│ [Connect Outlook]                   │
│ [Skip for now →]                    │
│                                     │
│ 🔒 We never read your emails.       │
│    Only sender domains and dates.   │
└─────────────────────────────────────┘
```

**Why optional:** If they skip, they go straight to manual creation. No forced friction.

#### Step 4: Email Scan Results (2 minutes)
```
┌─────────────────────────────────────┐
│ We found 23 products in your inbox   │
│                                     │
│ Review your products:               │
│                                     │
│ [✅] Linear — Active (receipts)     │
│ [✅] Notion — Active (receipts)     │
│ [✅] Cursor — Testing (welcome)     │
│ [⚪️] Jira — Archived (old receipts)│
│ [❓] SomeNewsletter — Not sure      │
│                                     │
│ [Keep Selected] [Archive Selected]  │
│ [Review All →]                      │
│                                     │
│ 5 selected · 18 to review           │
└─────────────────────────────────────┘
```

**Why bulk actions:** Users have 20+ products. Reviewing one by one is too slow. Smart defaults (Active vs. Archived) reduce decisions.

#### Step 5: Add Missing Products (1 minute)
```
┌─────────────────────────────────────┐
│ Add products the scan missed        │
│                                     │
│ Popular products you might use:     │
│ [+] Figma    [+] GitHub   [+] Vercel│
│ [+] Slack    [+] Zoom     [+] Loom  │
│ [+] Raycast  [+] Arc      [+] Warp  │
│                                     │
│ Or search for a product:            │
│ [Search...                    ]     │
│                                     │
│ [Add Manually →]                    │
│                                     │
│ [Skip →]                            │
└─────────────────────────────────────┘
```

**Why suggestions:** Reduces typing. One-click add.

#### Step 6: Add "Put On By" Lineage (1 minute)
```
┌─────────────────────────────────────┐
│ Give respect to who put you on        │
│                                     │
│ Linear:                               │
│ [Who put you on?              ]     │
│                                     │
│ Cursor:                               │
│ [Who put you on?              ]     │
│                                     │
│ [Skip for now →]                    │
│                                     │
│ 💡 You can add this later anytime.  │
└─────────────────────────────────────┘
```

**Why optional:** Lineage is valuable but not required. Users can add it later.

#### Step 7: Publish (15 seconds)
```
┌─────────────────────────────────────┐
│ Your profile is ready!                │
│                                     │
│ props.to/keegan                     │
│                                     │
│ 8 products · 3 active · 2 archived  │
│                                     │
│ [🎉 Publish Profile]                │
│                                     │
│ [Preview First →]                   │
│                                     │
│ 💡 Pro tip: Add this link to your   │
│    Twitter/LinkedIn bio.            │
└─────────────────────────────────────┘
```

**Why preview option:** Some users want to see it before it goes live.

### The Total Time
- Signup: 30s
- Username: 15s
- Email connect: 30s
- Review: 2min
- Add missing: 1min
- Lineage: 1min
- Publish: 15s
- **Total: ~5.5 minutes**

### The Skip Path
If user skips email scan:
- Step 3: Skip
- Step 4: Manual add products (3-5 products, 2 minutes)
- Step 5: Lineage (1 minute)
- Step 6: Publish
- **Total: ~4 minutes**

### The Friction Points

| Step | Friction | Mitigation |
|------|----------|------------|
| Email connect | OAuth trust barrier | "Skip" option. Clear privacy promise. |
| Review 20+ products | Decision fatigue | Smart defaults. Bulk actions. |
| Add missing products | Don't know what to add | Popular suggestions. Search. |
| Lineage | Don't remember who put me on | Optional. Can add later. |
| Publish | Fear of public exposure | Preview option. Draft mode. |

## Consequences

### Positive
- Under 5 minutes to published profile
- Optional steps reduce friction
- Smart defaults reduce decisions
- Preview option reduces anxiety

### Negative
- 5 minutes is still long for some users
- Email scan may find too many products (overwhelming)
- "Put on by" is often skipped (reduces graph growth)
- Users may publish with empty profile (low quality)

## Mitigations
- Progress bar: "Step 3 of 5" reduces abandonment
- Save draft: User can exit and resume later
- Email scan limit: Show top 10 first, "show more" for rest
- Minimum quality gate: "Add at least 3 products to publish"

## Related
- ADR-001 (Email Passport) — email scan is Step 3-4
- ADR-009 (Manual Put On By) — lineage is Step 6
- ADR-020 (Cold Start) — onboarding is the conversion funnel

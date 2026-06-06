# ADR-036: Template Profiles — Quick Start for Non-Technical Users

## Status
Accepted — 2026-06-05

## Context
Not every user knows what products to add. A designer may not think of "Figma" immediately. A marketer may not know what tools other marketers use. Templates reduce the blank-page problem.

## Decision

### The Template Categories

| Template | Suggested Products | Target User |
|----------|-------------------|-------------|
| **Designer** | Figma, Sketch, Framer, Webflow, Photoshop, Illustrator, Notion, Loom | UX/UI designer |
| **Developer** | VS Code, GitHub, Vercel, Linear, Cursor, Warp, Raycast, Postman | Software engineer |
| **Marketer** | HubSpot, Mailchimp, Notion, Google Analytics, Canva, Loom, Buffer, Figma | Growth marketer |
| **Founder** | Notion, Linear, Slack, Stripe, Figma, Loom, Calendly, Google Workspace | Startup founder |
| **Writer** | Notion, Obsidian, Grammarly, Substack, Twitter, Loom, Readwise | Content creator |
| **Product Manager** | Linear, Notion, Figma, Amplitude, Slack, Loom, Miro, Confluence | PM |
| **Sales** | Salesforce, HubSpot, LinkedIn, Calendly, Loom, Notion, Gong, Outreach | Sales rep |
| **Data Analyst** | Tableau, Looker, SQL, Python, Jupyter, Notion, Google Sheets, dbt | Data analyst |
| **Freelancer** | Notion, QuickBooks, Calendly, Loom, Canva, Stripe, Trello, Slack | Independent contractor |
| **Student** | Notion, Google Docs, Canvas, Slack, GitHub, Figma, Coursera, Spotify | Student |

### The Template Flow

```
┌─────────────────────────────────────┐
│ What best describes you?              │
│ (Select all that apply)               │
│                                     │
│ [👨‍💻 Developer]  [🎨 Designer]       │
│ [📈 Marketer]    [🚀 Founder]        │
│ [✍️ Writer]      [📊 Product Manager]│
│ [💼 Sales]       [📉 Data Analyst]    │
│ [🎒 Freelancer]  [🎓 Student]         │
│                                     │
│ [🎯 Something else →]                 │
│                                     │
│ [Continue]                          │
└─────────────────────────────────────┘
```

### The Product Suggestions

After selecting "Designer":
```
┌─────────────────────────────────────┐
│ Popular tools for Designers           │
│                                     │
│ Based on 2,400 designers on PROPER-RESPECT:    │
│                                     │
│ [✅] Figma — 89% of designers use this│
│ [✅] Notion — 67% of designers       │
│ [✅] Loom — 45% of designers         │
│ [❌] Sketch — 23% of designers       │
│ [❌] Webflow — 34% of designers      │
│ [❌] Photoshop — 56% of designers    │
│ [❌] Illustrator — 34% of designers│
│ [❌] Framer — 12% of designers       │
│                                     │
│ [✅ = Auto-selected] [❌ = Optional]   │
│                                     │
│ [Add Selected (3)] [Customize →]    │
└─────────────────────────────────────┘
```

**Auto-selected:** Top 3 most popular products for the category.
**Optional:** User can check/uncheck any.

### The "Something Else" Flow

If user selects "Something else":
```
┌─────────────────────────────────────┐
│ What do you do?                       │
│                                     │
│ [Describe your role...        ]     │
│                                     │
│ Examples: "I'm a lawyer who uses     │
│ Notion for case management"           │
│                                     │
│ [Find My Tools →]                   │
│                                     │
│ (System searches for similar users   │
│  and suggests their tools)            │
└─────────────────────────────────────┘
```

### The Template Data Source

**Where do templates come from?**
- Phase 1: Manually curated (based on common tech stacks)
- Phase 2: Data-driven ("67% of designers use Notion" from actual user data)
- Phase 3: AI-suggested ("Based on your email scan, you seem to be a designer. Here are popular designer tools.")

### The Template Limitations

- Templates are suggestions, not requirements
- User can skip templates entirely
- Templates don't create props automatically (user must confirm each)
- Templates are anonymized (no individual user data exposed)

## Consequences

### Positive
- Reduces blank-page anxiety
- Helps non-technical users get started
- Data-driven suggestions feel personalized
- Templates improve onboarding completion rate

### Negative
- Templates may pigeonhole users ("I'm not just a designer")
- Data-driven templates require scale (not useful in Phase 1)
- Popular tools may overshadow niche tools
- Users may feel pressured to conform

## Mitigations
- "Select all that apply" (users can be multiple things)
- "Something else" option for edge cases
- User can always skip and add products manually
- Templates are clearly labeled as "suggestions"

## Related
- ADR-024 (Onboarding Flow) — templates are part of Step 5
- ADR-020 (Cold Start) — templates improve conversion

# ADR-014: Free Products, Open Source, and No-Account Tools

## Status
Accepted — 2026-06-05

## Context
Not every product has a signup flow, a referral program, or an email notification. Many tools people use are free, open source, or require no account at all. How do these fit into PROPER-RESPECT?

## Decision

### The Three Types of "Free" Products

| Type | Examples | How to Log | Verification |
|------|----------|-----------|-------------|
| **Free SaaS** | Google Docs (free tier), Canva (free tier), Figma (free tier) | Email scan (if they send emails) or manual | Email or manual |
| **Open Source** | VS Code, Git, Homebrew, Obsidian | Manual only | GitHub OAuth (if applicable) |
| **No-Account Tools** | Calculator, Notes app, Terminal, Public APIs | Manual only | Self-attested only |
| **Freemium** | Spotify (free tier), Dropbox (free tier) | Email scan or manual | Email or manual |

### The Rule

**All products belong in PROPER-RESPECT, regardless of cost or account requirement.** The only requirement is that the user **uses** them.

### The Prop Card for Free Products

```
┌─────────────────────────────────────┐
│ [Logo] VS Code                      │
│                                     │
│ 🔥 Active · 3 yrs · Cred: 89        │
│ "My daily driver. Can't code        │
│  without it."                       │
│                                     │
│ Category: Tool (Open Source)        │
│ No affiliate link available           │
│                                     │
│ [View on GitHub →]                  │
└─────────────────────────────────────┘
```

**Key differences from monetized props:**
- No affiliate link section
- Category badge shows "Open Source" or "Free Tool"
- No reward tier displayed
- Credibility weight is based on manual attestation + content (Looms, screenshots)

### The Verification Challenge

Free products have no email notifications, no OAuth APIs, no company confirmation. How do we verify usage?

| Signal | Applicability |
|--------|--------------|
| **Email scan** | Only if the free product sends emails (rare) |
| **Screen time** | Yes! Mobile apps and desktop tools show up in screen time |
| **Browser extension** | Yes, if it's a web tool |
| **GitHub OAuth** | For open source dev tools, GitHub activity is proof |
| **Manual attestation** | The default for free products |
| **Content proof** | Looms and screenshots are the strongest signal |

**The principle:** For free products, **content is king.** A 5-minute Loom of your VS Code workflow is more credible than an email receipt.

### The Open Source Special Case

Open source tools have a unique property: **GitHub is the usage oracle.**

- GitHub OAuth can show: repos using the tool, commit frequency, PRs
- Example: "Keegan has 12 repos using Vercel. 47 commits this month."
- This is **OAuth-verified** credibility weight for open source tools

**The integration:**
1. User connects GitHub OAuth
2. System scans public repos for tool references (package.json, Gemfile, etc.)
3. Maps package names to Product entities (e.g., `next` → Next.js, `vercel` → Vercel)
4. Creates/updates props with OAuth verification

## Consequences

### Positive
- PROPER-RESPECT is not just for SaaS. It's for everything.
- Open source tools get credibility via GitHub activity
- Free products are still valuable to companies (they show taste, influence)
- No account required = lower barrier to entry for some products

### Negative
- Harder to verify usage (no email, no API)
- No monetization = no affiliate link = no revenue for linker
- Companies of free products may not care about advocates
- GitHub scanning is complex (package name → product mapping)

## Mitigations
- Content-first approach for free products: encourage Looms and screenshots
- GitHub OAuth as the verification layer for dev tools
- Screen time as the verification layer for mobile/desktop apps
- Manual attestation is valid and respected

## Related
- ADR-010 (Screen Time) — provides usage data for free mobile apps
- ADR-001 (Email Passport) — doesn't help for free products without email
- ADR-009 (Manual Put On By) — manual logging is the default for free tools

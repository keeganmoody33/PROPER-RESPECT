# ADR-015: Shared Accounts, Team Usage, and Multi-User Access

## Status
Accepted — 2026-06-05

## Context
Many products are not used via a personal account. Netflix is shared with family. Figma is on a team plan. The user's company pays for Linear. How do we handle products the user uses but doesn't "own"?

## Decision

### The Three Shared Usage Patterns

| Pattern | Example | How to Log | Verification |
|---------|---------|-----------|-------------|
| **Family/Shared** | Netflix, Spotify Family, Apple One | Manual + screen time | Screen time or manual |
| **Team/Company** | Figma (team), Linear (company), Slack (work) | Manual + email (if on company email) | Email or manual |
| **Friend's Account** | "I use my roommate's Netflix" | Manual only | Self-attested |

### The Prop Card for Shared Products

```
┌─────────────────────────────────────┐
│ [Logo] Netflix                        │
│                                     │
│ 🔥 Active · 2 yrs · Cred: 45        │
│ "Family plan. Watch daily."           │
│                                     │
│ Usage Type: Shared (family plan)    │
│ No affiliate link (not my account)    │
│                                     │
│ [Visit →]                             │
└─────────────────────────────────────┘
```

**The `usageType` field:**
- `PERSONAL` — My own account (default)
- `SHARED_FAMILY` — Family/shared plan
- `SHARED_TEAM` — Work/team account
- `SHARED_FRIEND` — Using someone else's account
- `PUBLIC` — No account needed (e.g., public API)

### The Verification Challenge

If the user doesn't own the account, they can't verify via email or OAuth.

**Solution:**
- **Screen time** is the primary verification for shared accounts (shows they actually open the app)
- **Manual attestation** is valid: "I use this daily via my team's account"
- **Content proof** is strong: Loom showing their workflow in the team Figma

**The credibility weight adjustment:**
- Shared accounts get full credibility weight for screen time and content
- Shared accounts get reduced weight for email verification (no personal email)
- The `usageType` is displayed transparently so visitors know it's not a personal account

### The Team Email Problem

If a user connects their personal Gmail, they won't see work products (Linear, Figma, Slack) that send email to their work address.

**Solution:** Multi-email support (see PRD).
- User connects `keegan@gmail.com` (personal) + `keegan@company.com` (work)
- Email scan runs on both
- Work products discovered via work email
- Personal products discovered via personal email
- All props live in one profile

**The privacy consideration:**
- Work email may contain sensitive corporate data
- User must explicitly consent to scanning work email
- Work email scan is opt-in, not default
- Work PROPER-RESPECT can be marked as `visibility: PRIVATE` if user doesn't want them public

## Consequences

### Positive
- Captures real usage even without personal accounts
- Transparent about shared usage (builds trust)
- Multi-email support captures work + personal life
- Screen time provides verification where email can't

### Negative
- Harder to verify (no personal email, no OAuth)
- "Shared" badge may reduce credibility for visitors
- Companies may not value advocates who don't pay
- Work email scanning raises corporate privacy concerns

## Mitigations
- Clear UI: "Shared account" badge is prominent, not hidden
- User can choose to not log shared products
- Work email is opt-in with clear consent
- Private visibility option for work products

## Related
- ADR-010 (Screen Time) — primary verification for shared accounts
- ADR-001 (Email Passport) — multi-email support for work + personal
- ADR-004 (Public Graph Privacy) — work products can be private

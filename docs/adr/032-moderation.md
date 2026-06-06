# ADR-032: Content Moderation and Community Guidelines

## Status
Accepted — 2026-06-05

## Context
Users can attach Looms, screenshots, notes, and context to props. They can write bios and product descriptions. What content is allowed? What is not? How do we moderate?

## Decision

### The Community Guidelines

**Allowed:**
- Product usage screenshots (workflows, dashboards, code)
- Looms showing actual product usage
- Honest opinions and reviews (positive or negative)
- Personal context ("I use this for GTM sprints")
- Professional language

**Not Allowed:**
- Adult content, nudity, sexual content
- Hate speech, harassment, discrimination
- Violence, threats, self-harm
- Illegal content (drugs, weapons, fraud)
- Spam, scams, phishing
- Misinformation about products (false claims)
- Copyright infringement (stolen content)
- Doxxing (personal information of others)
- Impersonation (pretending to be someone else)

### The Moderation Strategy

**Layer 1: Automated (Pre-Publish)**
- Image moderation: AWS Rekognition or Google Vision API
  - Detects adult content, violence, text in images
- Text moderation: Perspective API or similar
  - Detects toxicity, harassment, spam
- URL scanning: Check links for malware/phishing

**Layer 2: Post-Publication (Community)**
- Report button on every prop, content, and profile
- Report categories: Spam, Inappropriate, False Information, Harassment, Other
- Reporter can add notes

**Layer 3: Admin Review**
- Daily review queue for reported content
- Admin can: Approve, Remove, Warn User, Ban User
- Response time: 24 hours for reported content

**Layer 4: Appeals**
- User can appeal a moderation decision
- Appeal reviewed by different admin
- Final decision within 48 hours

### The Moderation Actions

| Action | Trigger | Effect |
|--------|---------|--------|
| **Content Removed** | Violates guidelines | Content hidden. User notified. |
| **Warning** | First offense | Email warning. No other penalty. |
| **Temporary Ban** | Repeat offense (2-3x) | 7-day suspension. Profile hidden. |
| **Permanent Ban** | Severe or repeated | Account deleted. Email blacklisted. |
| **Product Blacklisted** | Scam/illegal product | Product removed. All props hidden. |

### The Report Flow

```
User clicks "Report" on a prop
    ↓
Selects category: [Spam] [Inappropriate] [False Info] [Harassment] [Other]
    ↓
Optional notes: [This user is falsely claiming they use...]
    ↓
Submit
    ↓
System: "Thank you. We'll review within 24 hours."
    ↓
Admin reviews in queue
    ↓
Action taken → User notified (if content removed)
    ↓
Reporter notified of outcome (optional)
```

### The False Information Policy

**Problem:** User claims they use a product but they don't. Or they make false claims about a product's capabilities.

**Policy:**
- We do not fact-check product claims (that's the company's job)
- We remove claims that are clearly fraudulent (e.g., "This product cures cancer")
- We allow opinions ("I think this product is overpriced")
- We flag reports of false usage for review

**The "Verified" badge:**
- If a company confirms a user is a real advocate, the prop gets a ✅ badge
- This is the best defense against false claims
- But most PROPER-RESPECT won't have this badge (company hasn't configured yet)

### The Copyright Policy

- DMCA takedown process
- Copyright holder submits takedown request
- Content removed within 48 hours
- User can file counter-notification
- Repeat infringers banned

## Consequences

### Positive
- Clear guidelines set expectations
- Automated moderation catches most issues
- Community reporting scales moderation
- Appeals process is fair

### Negative
- Moderation requires ongoing effort
- Automated moderation has false positives
- Community reporting can be weaponized (false reports)
- Admin review is a bottleneck
- Legal liability for user-generated content

## Mitigations
- Start with light moderation (Phase 1-2: mostly automated)
- Scale moderation team as user base grows
- Clear, simple guidelines (not a 50-page TOS)
- Transparent moderation log (users can see why content was removed)
- Insurance for platform liability

## Related
- ADR-022 (Risk Register) — moderation is a key risk
- ADR-004 (Public Graph Privacy) — public content is moderated

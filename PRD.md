# PRD — PROPER-RESPECT

> Product Requirements Document  
> Derived from GRILL-SESSION.md (Round 2)  
> Status: Draft — pending Phase 0 validation

## 1. Overview

### 1.1 Product Name

**PROPER-RESPECT** — Get respect. Give respect.

### 1.2 One-Line Description

A public timeline of everything a person uses, with the receipts to prove it.

### 1.3 Target Users

- **Primary:** Tech-forward professionals who use 10+ SaaS tools and want to monetize/verify their recommendations.
- **Secondary:** Companies seeking organic advocate intelligence.
- **Tertiary:** Visitors looking for trusted product recommendations from people they follow.

### 1.4 Success Metrics

| Phase | Metric | Target |
|-------|--------|--------|
| Phase 0 | Manual profiles created | 1 (dogfood) |
| Phase 0 | "How do I make one?" responses | 3+ |
| Phase 1 | User signups | 50+ |
| Phase 1 | Avg props per user | 5+ |
| Phase 2 | Public profiles | 100+ |
| Phase 2 | "Put on by" lineage links | 50+ |
| Phase 3 | Company accounts configured | 10+ |
| Phase 3 | Pro tier conversions | 5+ |

### 1.5 Kill Criteria

- Fewer than 50 manually created profiles by Week 4 → pivot framing
- Fewer than 10 companies requesting advocate data by Month 3 → deprioritize B2B
- Average profile has fewer than 3 props after 2 weeks → onboarding is broken

---

## 2. User Stories

### Linker (Primary User)

**US-001: Onboarding (Email Scan)**
> As a new user, I want to connect my email (any provider) and see a draft list of products I've used, so that I don't have to manually enter everything from scratch.

**US-002: Onboarding (Manual Entry)**
> As a user, I want to manually add a product to my profile, so that I can log products the email scan missed or that I use offline.

**US-003: Curation**
> As a user, I want to review auto-discovered products and choose to keep, archive, or delete them, so that my public profile is accurate.

**US-004: Profile Sharing**
> As a user, I want one link (`props.to/{username}`) that shows everything I use, so that I can put it in my bio and share it.

**US-005: Adding Proof**
> As a user, I want to attach a Loom or screenshot to a product card, so that visitors can see my actual workflow.

**US-006: Giving Respect (Lineage)**
> As a user, I want to tag who put me on a product (even if they have no link and aren't on PROPER-RESPECT), so that they get credit in the public graph.

**US-007: Monetization**
> As a user, I want to add my affiliate/referral link to a product card, so that I earn when people click through.

**US-008: Analytics (Pro)**
> As a Pro user, I want to see who clicked my props and from where, so that I understand my influence.

### Discoverer (Visitor)

**US-009: Discovery**
> As a visitor, I want to browse a user's product stack and see what's active vs. archived, so that I understand their real usage.

**US-010: Trust**
> As a visitor, I want to see credibility badges and Looms, so that I know this recommendation is real.

**US-011: Action**
> As a visitor, I want to click a product and go directly to it (with the user's affiliate link if available), so that the user gets credit.

### Company (B2B)

**US-012: Advocate Discovery**
> As a company, I want to search my domain and see ranked advocates by credibility weight, so that I can identify organic growth drivers.

**US-013: Configuration**
> As a company, I want to configure my reward rules (flat, usage-based, tiered), so that advocates know what to expect.

**US-014: Outreach**
> As a company, I want to message advocates in-app, so that I can thank or reward them without cold email.

**US-015: Trend Intelligence**
> As a company, I want to see how my advocate count changes over time, so that I can measure organic growth.

---

## 3. Data Model

### 3.1 Entities

```prisma
// User (Linker)
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  username      String    @unique // props.to/{username}
  displayName   String?
  avatarUrl     String?
  bio           String?

  // Tiers
  tier          String    @default("FREE") // FREE | PRO | COMPANY

  // Relations
  props         Prop[]
  contents      Content[]
  givenRespect    Lineage[] @relation("GivenRespect")
  receivedRespect Lineage[] @relation("ReceivedRespect")

  // OAuth connections (multi-provider, multi-email)
  connections   Connection[]

  // Multiple email addresses (personal + work)
  emails        UserEmail[]

  // Timestamps
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

// Product (Community-Managed, No Canonical DB)
model Product {
  id              String    @id @default(cuid())
  name            String    // Current name (e.g., "X")
  slug            String    @unique // URL-safe
  category        String    @default("SAAS") // SAAS | MOBILE_APP | PHYSICAL | SERVICE | COURSE | COMMUNITY | TOOL
  domains         String[]  // All known domains ["x.com", "twitter.com"]
  aliases         String[]  // Historical names ["Twitter"]
  logoUrl         String?   // Favicon or user-uploaded
  description     String?   // User-written or meta-extracted

  // Rebrand lineage
  predecessorId   String?   // Previous incarnation
  successorId     String?   // Next incarnation
  rebrandDate     DateTime? // When name changed

  // Company configuration (optional)
  claimedBy       String?   // user/company account ID
  rewardConfig    Json?     // Company-configurable reward rules (ADR-007)

  // Relations
  props           Prop[]

  // Aggregates (auto-calculated)
  propCount       Int       @default(0)
  verifiedCount   Int       @default(0)

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

// Prop (User-Product Relationship)
model Prop {
  id              String    @id @default(cuid())

  // Relations
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  productId       String
  product         Product   @relation(fields: [productId], references: [id])

  // Timeline
  firstTriedAt    DateTime
  becameActiveAt  DateTime?
  archivedAt      DateTime?

  // Credibility Weight (universal algorithm, public)
  status          String    @default("DRAFT") // DRAFT | ACTIVE | TESTING | ARCHIVED | DORMANT
  verification    String    @default("SELF_ATTESTED") // SELF_ATTESTED | EMAIL_CONFIRMED | OAUTH_VERIFIED | COMPANY_CONFIRMED
  credibilityWeight Int     @default(0) // Calculated by platform algorithm

  // Reward Weight (company-configurable, displayed)
  rewardTier      String?   // "Explorer" | "Advocate" | "Champion" — from company config
  estimatedReward String?   // Display text: "$25/ref" or "10% off"

  // Links
  affiliateUrl    String?   // User's actual affiliate link
  referralCode    String?   // User's referral code
  rawUrl          String    // Fallback / canonical URL

  // Context
  note            String?   // "Switched from Jira. Never looked back."
  switchedFromId  String?
  switchedFrom    Product?  @relation("SwitchedFrom", fields: [switchedFromId], references: [id])

  // Privacy
  visibility      String    @default("DRAFT") // DRAFT | PUBLIC | PRIVATE

  // Relations
  contents        Content[]
  lineageGiven    Lineage[] @relation("PropGiven")

  // Timestamps
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@unique([userId, productId])
}

// Content (Proof attached to Prop)
model Content {
  id          String    @id @default(cuid())
  propId      String
  prop        Prop      @relation(fields: [propId], references: [id])

  type        String    // LOOM | SCREENSHOT | NOTE | TWEET
  url         String?   // external URL (Loom, tweet)
  fileUrl     String?   // uploaded file (screenshot)
  text        String?   // note text

  createdAt   DateTime  @default(now())
}

// Lineage (Who Put Who On — Manual Logging, Polymorphic)
model Lineage {
  id              String    @id @default(cuid())

  // The source of the props (polymorphic)
  sourceType      String    @default("PERSON") // PERSON | CONTENT | COMMUNITY | EVENT

  // For PERSON: who gave props
  fromUserId      String?   // Nullable for floating lineage
  fromUser        User?     @relation("GivenProps", fields: [fromUserId], references: [id])
  fromName        String    // Display name (e.g., "Jordan Crawford") — always stored

  // For CONTENT: what content (podcast, book, tweet)
  contentTitle    String?   // "The Tim Ferriss Podcast, Episode 612"
  contentUrl      String?   // Link to content (optional)

  // For COMMUNITY: what community
  communityName   String?   // "r/SaaS on Reddit"

  // For EVENT: what event
  eventName       String?   // "SaaStr Annual 2024"
  eventDate       DateTime? // Event date

  // The person who received props
  toUserId        String
  toUser          User      @relation("ReceivedProps", fields: [toUserId], references: [id])

  // The product they were put on
  propId          String
  prop            Prop      @relation("PropGiven", fields: [propId], references: [id])

  // Status
  status          String    @default("SELF_ATTESTED") // SELF_ATTESTED | CONFIRMED | FLOATING | REJECTED

  // Context
  note            String?   // "Met Jordan at a coffee shop. He swore by it."

  createdAt       DateTime  @default(now())

  @@unique([fromName, toUserId, propId])
}

// Connection (Multi-Provider OAuth)
model Connection {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])

  provider    String    // GOOGLE | OUTLOOK | YAHOO | PROTON | IMAP
  accessToken String    // encrypted
  refreshToken String?  // encrypted
  expiresAt   DateTime?

  // Metadata
  scope       String    // what permissions were granted

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

// UserEmail (Multiple emails per user)
model UserEmail {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])

  email       String    @unique
  type        String    @default("PERSONAL") // PERSONAL | WORK | OTHER
  isPrimary   Boolean   @default(false)

  // Connection for ingestion
  connectionId String?  // Links to Connection for scanning

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

### 3.2 Credibility Weight Calculation (Universal Algorithm)

```typescript
function calculateCredibilityWeight(prop: Prop): number {
  let score = 0;

  // Tenure (1 point per month, max 24)
  const months = Math.min(
    differenceInMonths(new Date(), prop.firstTriedAt),
    24
  );
  score += months;

  // Verification tier
  const verificationScores = {
    SELF_ATTESTED: 0,
    EMAIL_CONFIRMED: 15,
    OAUTH_VERIFIED: 30,
    COMPANY_CONFIRMED: 50,
  };
  score += verificationScores[prop.verification] || 0;

  // Activity status
  const statusScores = {
    ACTIVE: 25,
    TESTING: 5,
    ARCHIVED: -10,
    DORMANT: 0,
    DRAFT: 0,
  };
  score += statusScores[prop.status] || 0;

  // Content richness (max 50 points)
  score += Math.min(prop.contents.length * 10, 50);

  // Network effect (confirmed lineage only)
  score += prop.lineageGiven.filter(l => l.status === 'CONFIRMED').length * 5;

  return Math.max(0, score); // No negative weights
}
```

**Recalculation triggers:**

- New content added
- Status changed
- New OAuth data received
- New lineage confirmed
- Manual recalculation request

### 3.3 Reward Weight (Company-Configurable)

See ADR-007 for full reward configuration schema. The prop stores the **result** of the company's rules:

```typescript
interface RewardDisplay {
  rewardType: 'FLAT' | 'USAGE_BASED' | 'TIERED' | 'CUSTOM';
  tierName?: string;        // "Champion"
  estimatedValue?: string;  // "$62 per referral"
  rulesUrl?: string;        // Link to company rules
}
```

This is **display-only**. PROPER-RESPECT does not calculate or process payouts.

---

## 4. API Specification

### 4.1 Authentication

- Clerk JWT tokens
- OAuth providers: Google, GitHub (for auth and product verification)
- Multi-provider email: Gmail, Outlook, Yahoo, Proton, IMAP

### 4.2 Endpoints

#### User Profile

```
GET /api/users/{username}
Response: User + public Props (with Product, Content, Lineage, RewardDisplay)
```

#### Prop Management

```
POST /api/props
Body: { productId, firstTriedAt, note, affiliateUrl, rawUrl, visibility, switchedFromId }

PATCH /api/props/{id}
Body: { status, verification, note, affiliateUrl, visibility, switchedFromId }

DELETE /api/props/{id}
```

#### Email Ingestion (Multi-Provider)

```
POST /api/ingest/email
Body: { connectionId, provider } // GOOGLE | OUTLOOK | YAHOO | PROTON | IMAP

GET /api/ingest/results
Response: { drafts: PropDraft[] }

POST /api/ingest/approve
Body: { draftIds: string[], action: 'KEEP' | 'ARCHIVE' | 'DELETE' }
```

#### Content

```
POST /api/props/{propId}/content
Body: { type, url?, file?, text? }

DELETE /api/content/{id}
```

#### Lineage (Manual Logging)

```
POST /api/lineage
Body: { toUserId, propId, fromName, fromUserId? }
// fromName is required (e.g., "Jordan Crawford")
// fromUserId is optional (if person is on props)

PATCH /api/lineage/{id}
Body: { status: 'CONFIRMED' | 'REJECTED' } // optional confirmation
```

#### Product (Community-Managed)

```
POST /api/products
Body: { name, domain, description? } // Create new product

GET /api/products/search?q={query}
Response: { products: Product[] } // Fuzzy match on name, domain, alias

PATCH /api/products/{id}
Body: { name, domains[], aliases[], description? } // Update (if user created it)
```

#### Company Configuration (B2B)

```
GET /api/products/{domain}/advocates
Query: { minCredibilityWeight?, verification?, status?, limit?, offset? }
Response: { advocates: User[], total, aggregates }

POST /api/products/{id}/configure
Body: { rewardConfig: RewardConfig } // Set company reward rules
```

---

## 5. UI/UX Specification

### 5.1 Public Profile Page (`props.to/{username}`)

**Layout:**

- Header: Avatar, display name, bio, "Follow" button (future)
- Stats: Total props, Active count, Archive count, "Put on" count, "Got props" count
- Filter tabs: All | Active | Testing | Archived
- Card grid: Responsive, 1-3 columns. **Sorted by credibility weight (highest first).**

**Prop Card (Active):**

```
┌─────────────────────────────────────┐
│ [Logo] Product Name          [💰] │
│                                     │
│ 🔥 Active · 2.1 yrs · Cred: 114   │
│ "Switched from Jira.                │
│  Never looked back."                │
│                                     │
│ [▶ Loom: Sprint Planning]           │
│                                     │
│ Put on by: Jordan Crawford          │
│                                     │
│ Company Reward: Usage-Based         │
│ Est. tier: $62/ref                  │
│                                     │
│ [Visit →]                           │
└─────────────────────────────────────┘
```

**Prop Card (Archived):**

```
┌─────────────────────────────────────┐
│ [Logo] Product Name                 │
│                                     │
│ ⚪️ Archived · 2021 → 2024         │
│ Credibility: 34                     │
│ Switched to: Obsidian               │
│                                     │
│ "Used for 3 years. Outgrew it."     │
│                                     │
│ [View History →]                    │
└─────────────────────────────────────┘
```

### 5.2 Dashboard (Authenticated)

**Ingestion Review Screen:**

- List of draft props from email scan (any provider)
- Each row: Product | Detected Date | Confidence | Actions [Keep] [Archive] [Delete]
- Bulk actions: "Keep All", "Archive All", "Review Later"

**Prop Editor:**

- Product selector (search existing or create new)
- Date picker: First tried
- Status selector
- Note textarea
- Link inputs: Affiliate URL, Referral code, Raw URL
- Content upload: Loom URL, Screenshot file, Note
- **"Put on by" field:** Free text (name or @username). No confirmation required.
- Visibility toggle: Draft / Public / Private

### 5.3 Company Dashboard (B2B)

**Advocate Search:**

- Search bar: domain input
- Filters: Min credibility weight, Verification tier, Status, Content count
- Results: Ranked list by credibility weight
- Each row: User | Cred Weight | Tenure | Content | Reward Tier | Actions [Message]

**Company Configuration:**

- Reward type selector: Flat | Usage-Based | Tiered | Custom
- Rule builder: Amounts, tiers, new adopter boost, servant leader bonus
- Preview: "Your top advocate would earn: $X"

---

## 6. Technical Architecture

### 6.1 Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Auth:** Clerk
- **Database:** PostgreSQL (Neon)
- **ORM:** Prisma
- **Storage:** Vercel Blob (images), external embeds (Loom)
- **Email API:** Google Gmail API, Microsoft Graph API, generic IMAP
- **Payments:** Stripe
- **Hosting:** Vercel
- **Language:** English only (Phase 1-3)

### 6.2 Background Jobs

- **Email Ingestion:** Triggered by user request. Scans metadata (any provider). Creates drafts. Runs in serverless function.
- **Weight Recalculation:** Triggered by data changes. Updates `prop.credibilityWeight`.
- **Product Resolution:** Maps email domains to Product entities. Creates new products if no match.

### 6.3 Security

- All OAuth tokens encrypted at rest (AES-256)
- Email metadata processed immediately, raw data discarded (ephemeral)
- Public profiles only show data user explicitly published
- Rate limiting on all API endpoints
- CSRF protection via Clerk

---

## 7. Implementation Phases

### Phase 0: Dogfood (Week 1)

**Goal:** Validate that people want this before building.

**Deliverables:**

- Static HTML page: `props.to/keegan`
- 10 manually written product cards
- Real copy, real links, real context
- Include "Put on by" lineage (e.g., "Jordan Crawford put me on Claude")
- Share on Twitter, LinkedIn, Slack

**Exit Criteria:**

- 3+ people ask "how do I make one?"
- If not met: iterate on framing, not engineering

### Phase 1: Core Profile + Manual Creation (Weeks 2-3)

**Goal:** Build the minimal product for manual creation.

**Deliverables:**

- Next.js app with auth (Clerk)
- Database schema (Prisma + Neon)
- Public profile pages (`props.to/{username}`)
- Dashboard: create/edit/delete props (manual only)
- Card UI with credibility weight badges
- **"Put on by" manual logging** (free text, no confirmation)
- Product creation (user-driven, no canonical DB)

**Exit Criteria:**

- 50+ user signups
- 5+ props per active user

### Phase 2: Ingestion + Proof (Weeks 4-5)

**Goal:** Automate discovery and add credibility layers.

**Deliverables:**

- Gmail OAuth + metadata scanner (first provider)
- Draft review UI
- Credibility weight calculation + badges
- Content attachments (Loom embed, screenshot upload)
- Browser extension (local login detection)
- Per-product OAuth (GitHub, Linear)

**Exit Criteria:**

- 100+ public profiles
- 50+ email scans completed
- 20+ OAuth-verified props

### Phase 3: The Graph + B2B (Weeks 6-8)

**Goal:** Make the social graph visible and monetize company intelligence.

**Deliverables:**

- Company pages (auto-generated from user data)
- Advocate search + ranking by credibility weight
- **Company configuration** (reward rules, not "claim")
- In-app messaging (company → advocate)
- Pro tier (Stripe)
- Company tier (Stripe)
- Analytics dashboard (Pro users)

**Exit Criteria:**

- 10+ company configurations
- 5+ Pro conversions
- 1+ company paying for advocate data

### Phase 4: Scale (Weeks 9-12)

**Goal:** Add providers, polish, and expand.

**Deliverables:**

- Multi-provider email (Outlook, Yahoo, Proton, IMAP)
- Product merge tool (deduplication)
- Floating lineage hardening (when tagged person joins)
- Company reputation score (do they actually pay?)
- API for third-party integrations
- i18n consideration (future)

---

## 8. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Users don't want public product usage | Medium | High | Start private by default. Public is opt-in per prop. |
| Email scan finds too many false positives | Medium | Medium | User curation is mandatory. Draft state by default. |
| Companies don't care about organic advocates | Medium | High | Free advocate page first. Pay for configuration + analytics. |
| OAuth scopes rejected by users | Medium | Medium | Explain value clearly. Make optional, not required. |
| Weight algorithm gamed | Low | High | Mutual consent for lineage optional. Content quality thresholds. |
| Regulatory issues (GDPR) | Medium | High | Metadata-only scanning. Ephemeral raw data. Clear consent. |
| Linktree/Beacons copy the feature | High | Medium | Archive layer + credibility weight + lineage graph are hard to replicate. |
| Duplicate products at scale | High | Medium | Fuzzy matching + merge tool + community curation. |
| Multi-provider OAuth complexity | Medium | Medium | Phased rollout. Start with Gmail + IMAP. |

---

## 9. Open Questions (Blocking Phase 1)

1. **Gmail OAuth scope:** `gmail.readonly` vs `gmail.metadata` — which gives us enough without asking for too much?
2. **"Put on by" UI:** What is the exact field design for manual lineage logging? (free text + @mention autocomplete?)
3. **Company configuration flow:** How does a company discover they have advocates on PROPER-RESPECT and start configuring?
4. **Product creation UX:** How do we prevent 47 "Claude" entries? (fuzzy match + suggest existing)
5. **Pricing:** Pro tier at $8/month or $12/month? Company tier at $49/month or $99/month?
6. **Floating lineage:** When Jordan (not on PROPER-RESPECT) is tagged, how do we notify him if he joins later?
7. **Chrome extension policy:** What are the Web Store requirements for a local-first login detector?
8. **Import from existing tools:** Should we allow Linktree/Beacons import as a starting point?

---

## 10. Appendix

### A. Email Scan Keywords (Multi-Provider)

```javascript
const EMAIL_PATTERNS = {
  WELCOME: ['welcome to', 'thanks for signing up', 'your account is ready', 'getting started', 'verify your email'],
  RECEIPT: ['receipt', 'invoice', 'payment confirmed', 'you paid', 'charged', 'billing'],
  ACTIVITY: ['weekly digest', 'your summary', 'what you missed', 'new features', 'updates', 'activity'],
  TRIAL: ['trial expires', 'your trial ends', 'upgrade now', 'trial ending', 'free trial'],
  PASSWORD: ['reset your password', 'password changed', 'security alert'],
};
```

### B. Product Domain Resolution (Manual DB)

```javascript
// Products are matched by root domain
// Multiple domains can map to the same product
const DOMAIN_MAP = {
  'linear.app': 'linear',
  'linear.so': 'linear',
  'notifications.linear.app': 'linear',
  'notion.so': 'notion',
  'notion.site': 'notion',
};

function resolveProduct(domain: string): Product | null {
  const root = extractRootDomain(domain);
  return productDB.findByDomain(root);
}

// If no match: create new product with root domain as primary domain
```

### C. Credibility Weight Score Examples

| User | Product | Tenure | Verification | Status | Content | Network | **Credibility Weight** |
|------|---------|--------|--------------|--------|---------|---------|------------------------|
| Keegan | Linear | 24 mo | OAuth (30) | Active (25) | 2 Looms (20) | 3 put-ons (15) | **114** |
| Sarah | Linear | 6 mo | Email (15) | Active (25) | 0 (0) | 1 put-on (5) | **51** |
| Influencer | Linear | 1 mo | Self (0) | Testing (5) | 1 Loom (10) | 0 (0) | **16** |

### D. Reward Weight Examples (Company-Configured)

| Company | Config | Keegan's Credibility | Keegan's Reward Tier |
|---------|--------|----------------------|---------------------|
| Linear | Flat $25 | 114 | $25 (flat) |
| Notion | Usage-based | 114 | $62 (base + weight multiplier) |
| Figma | No program | 114 | $0 (but verified badge) |
| Cursor | Tiered | 114 | "Champion" (lifetime Pro) |

---

*Document owner: Product + Engineering  
Last updated: 2026-06-05 (Round 2)  
Next review: After Phase 0 exit criteria evaluation*

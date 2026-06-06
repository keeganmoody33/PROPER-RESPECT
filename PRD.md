# PRD - PROPER-RESPECT MVP

> Status: Current MVP direction  
> Updated: 2026-06-06

## 1. Overview

PROPER-RESPECT is a product-stack profile builder. A linker creates one public page containing the products they actively use, products they are testing, and products they have archived. Each product card can include an affiliate/referral/canonical link, proof that the linker knows the product, and lineage for who or what put them on.

## 2. Goals

### MVP Goals

1. Let a linker create and publish a credible product-stack profile.
2. Let each product card route visitors through the best available link.
3. Let the linker attach proof: Loom, YouTube, screenshot, article, GitHub repo, receipt, or note.
4. Let the linker record lineage: person, content, community, or event.
5. Create draft props from low-friction imports where possible.

### Non-Goals For MVP

- Company dashboards
- Pricing tiers
- Company reward configuration
- Public API monetization
- Analytics dashboard
- Mobile app
- Screen-time tracking
- Full email metadata scanning as primary onboarding
- Holding or processing money

## 3. Users

### Linker

The person building the product-stack profile. They want one place for the products they use, the links they want visitors to click, and the story/proof behind those products.

### Visitor

The person browsing a linker's profile. They want to know what products the linker actually uses and where to click.

## 4. Core User Stories

| ID | Story |
| --- | --- |
| US-001 | As a linker, I can create a public profile. |
| US-002 | As a linker, I can add a product to my stack. |
| US-003 | As a linker, I can mark a product Active, Testing, or Archived. |
| US-004 | As a linker, I can add an affiliate URL, referral code, invite link, or canonical URL. |
| US-005 | As a linker, I can attach proof to a product. |
| US-006 | As a linker, I can record who or what put me on to a product. |
| US-007 | As a linker, I can import public links to create draft props. |
| US-008 | As a visitor, I can browse a linker's stack by status. |
| US-009 | As a visitor, I can see proof and lineage before clicking. |
| US-010 | As a visitor, I can click through to the linker's preferred destination. |

## 5. App Flow

### Linker Flow

```text
Sign up
  -> create username/profile
  -> start from blank or import links
  -> add/edit draft props
  -> add links, proof, lineage, status
  -> preview profile
  -> publish
```

### Visitor Flow

```text
Open profile
  -> scan product cards
  -> filter Active / Testing / Archived
  -> inspect proof and lineage
  -> click affiliate/referral/canonical link
```

### Import Flow

```text
Provide public URL or supported source
  -> parser extracts links and metadata
  -> system suggests product matches
  -> user confirms, edits, or rejects
  -> accepted items become draft props
```

## 6. Data Model

This is the conceptual MVP model. Implementation can use Prisma, Drizzle, or another ORM.

```prisma
model User {
  id          String   @id @default(cuid())
  email       String   @unique
  username    String   @unique
  displayName String?
  avatarUrl   String?
  bio         String?
  props       Prop[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Product {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  domains     String[]
  aliases     String[]
  logoUrl     String?
  description String?
  props       Prop[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Prop {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  productId     String
  product       Product  @relation(fields: [productId], references: [id])
  status        String   @default("TESTING") // ACTIVE | TESTING | ARCHIVED
  visibility    String   @default("DRAFT") // DRAFT | PUBLIC | PRIVATE
  startedAt     DateTime?
  archivedAt    DateTime?
  headline      String?
  note          String?
  affiliateUrl  String?
  referralCode  String?
  inviteUrl      String?
  canonicalUrl  String?
  proofItems    Proof[]
  lineageItems  Lineage[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([userId, productId])
}

model Proof {
  id        String   @id @default(cuid())
  propId    String
  prop      Prop     @relation(fields: [propId], references: [id])
  type      String   // LOOM | YOUTUBE | SCREENSHOT | ARTICLE | GITHUB | RECEIPT | NOTE | API
  url       String?
  fileUrl   String?
  text      String?
  label     String?
  createdAt DateTime @default(now())
}

model Lineage {
  id          String   @id @default(cuid())
  propId      String
  prop        Prop     @relation(fields: [propId], references: [id])
  sourceType  String   // PERSON | CONTENT | COMMUNITY | EVENT
  name        String
  url         String?
  context     String?
  createdAt   DateTime @default(now())
}
```

## 7. Frontend Surfaces

### Public Profile

- Header: avatar, name, bio, profile URL
- Status filters: Active, Testing, Archived, All
- Product cards sorted manually first; no opaque ranking required
- Product card shows: product name, status, short note, primary link, proof preview, lineage

### Dashboard

- Profile editor
- Product stack manager
- Prop editor
- Proof manager
- Lineage manager
- Import review queue

### Import Review

- Shows extracted links/products
- Requires user confirmation before publishing
- Allows edit, skip, merge, or create product

## 8. Backend Responsibilities

- Authenticate users
- Store profiles, products, props, proof, and lineage
- Parse/import public URLs into draft props
- Generate public profile pages
- Store uploaded screenshots when needed
- Never publish imported data without user approval

## 9. Automation Roadmap

Automation is ordered by usefulness and trust, not by how impressive it sounds.

1. Public link import: Linktree, Beacons, GitHub README, Twitter/X bio, personal website.
2. Receipt forward: user forwards or uploads a receipt to create a draft prop.
3. Claim-on-visit extension: user clicks extension on a product page to capture URL/screenshot.
4. Public proof scan: GitHub repos, YouTube descriptions, articles, public profiles.
5. Product API/OAuth connectors: GitHub, Linear, Vercel, Notion, Figma, etc.
6. Email metadata scan: optional broad discovery, treated as noisy draft generation.

## 10. Success Criteria

The MVP is working when:

- A linker can create a complete profile without engineering help.
- A product card can carry a useful outbound link and at least one proof item.
- Lineage is visible and understandable to visitors.
- Imports save time but do not create trust problems.
- The product feels like a better product-focused Linktree, not a generic link list.

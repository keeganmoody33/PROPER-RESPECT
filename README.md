# PROPER-RESPECT

**Continue development here:** [Working guide and next deliverable](docs/DEVELOPMENT.md) · [September 17 browser dogfood](docs/dogfood-reports/2026-09-17-codex-proper-respect-self-test-20260916-dogfood.md) · [Canonical Ref](https://plan.ref.tools/oUl8LCIQb32SAicK). These dated records govern the current owner checkout; the initial bootstrap commands below are not continuation steps for its existing development data.

PROPER-RESPECT prepares evidence-backed product profiles: evidence proposes, the person confirms. The first
runnable slice serves Keegan's seeded public Product Usage Identity from
Next.js and Convex while keeping draft and private source records out of the
public read model. The current slice also includes Clerk-backed multi-user
onboarding, retained private evidence uploads, bulk approval/publication,
GitHub and Devin connectors, and daily refreshes limited to explicitly
approved metrics.

## Run the first slice

```bash
npm install
npx convex dev
npm run convex:seed
npm run dev
```

Convex writes `NEXT_PUBLIC_CONVEX_URL` to `.env.local`. Visit
`http://localhost:3000/keegan`.

## Configure accounts and connectors

1. Copy `.env.example` to `.env.local` and add the Clerk publishable and secret
   keys.
2. Activate Clerk's Convex integration.
3. Set `CLERK_FRONTEND_API_URL` and a long random
   `CONNECTOR_ENCRYPTION_KEY` in the Convex dashboard.
4. Enable GitHub as a Clerk social connection if the GitHub connector should be
   available.
5. Run `npx convex dev`, then visit `http://localhost:3000/onboarding`.

Connector tokens are encrypted before persistence and are never returned by
public or owner-facing queries. Screenshot and CSV originals remain private
until their owner deletes them.

For variable ownership, production commands, deployment order, smoke tests, and
rollback guidance, see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). Before a
deployment, run:

```bash
npm run deploy:check
```

## Verify

```bash
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

> One place for the products you actually use: affiliate links, proof, and the story of who put you on.

PROPER-RESPECT is a product-stack profile. It is not trying to predict a person's whole software life from surveillance data. It helps a linker collect the products they use, attach the best available proof, add their affiliate/referral links where they exist, and credit the people, content, communities, or events that introduced them.

## Current Direction

The default motion is authorize sources → discover products and dated claims → review the evidence → publish. Manual entry is a fallback. The person controls source access and publication; the app should do the preparation.

See [the current thesis](docs/000-current-product-thesis.md) for permission boundaries and claim semantics. Google sign-in is implemented; mailbox access and automatic email extraction are not. Structured dated observations can enter the internal evidence intake and be reviewed privately with original source excerpts and append-only corrections.

## What Problem This Solves

Affiliate and referral links are fragmented across product dashboards, YouTube descriptions, notes apps, old tweets, newsletters, and link-in-bio tools. Most products either have no referral program or make it hard for actual users to present their advocacy in one place.

PROPER-RESPECT gives linkers a single surface for:

- Products they actively use
- Products they are testing
- Products they used and archived
- Affiliate/referral links when available
- Proof that they know the product
- Lineage for who put them on

## What We Are Not Building Right Now

These ideas are parked in `docs/future/` until the core profile works:

- B2B dashboards
- Pricing and paid tiers
- Company reward configuration
- Public API monetization
- Analytics dashboards
- Mobile screen-time tracking
- Company outreach workflows

## Proof Sources

The product should support multiple proof sources because no single source covers every product.

| Source | Best For | Signal | Launch Priority |
| --- | --- | --- | --- |
| Manual curation | Everything | User says this belongs on their stack | Now |
| Content proof | Loom, YouTube, screenshots, articles | Shows the product in use | Now |
| Link imports | Linktree, Beacons, GitHub README, Twitter bio | Existing public curation | Now |
| Receipt forward | Paid products | User chooses a receipt to convert into a draft prop | Next |
| Claim-on-visit extension | Web products | User clicks while on a product page and captures URL/screenshot | Next |
| Public profile scan | GitHub repos, public articles, YouTube descriptions | Public evidence of usage or mention | Next |
| Product API/OAuth | GitHub, Linear, Vercel, Notion, Figma | Product-specific verification | Later |
| Read-only email discovery | Signup, receipt, and dated evidence proposals | Broad but noisy | Planned; separate authorization required |

## MVP App Flow

```text
Linker signs up
  -> creates profile
  -> imports existing links or starts manually
  -> adds product cards
  -> adds affiliate/referral/canonical links
  -> attaches proof
  -> adds "put on by" lineage
  -> publishes profile
```

Visitor flow:

```text
Visitor opens profile
  -> browses Active / Testing / Archived products
  -> sees proof and lineage
  -> clicks affiliate/referral/canonical link
```

## Suggested Technical Stack

This remains a small web app until the profile builder proves itself.

- Frontend: Next.js + TypeScript
- Styling: Tailwind or plain CSS modules; design should feel like a polished product stack, not a generic SaaS dashboard
- Auth: Clerk or a simple auth provider
- Database: Postgres (Neon is fine)
- ORM: Prisma or Drizzle
- Storage: Vercel Blob/S3 for screenshots; external embeds for Loom/YouTube
- Hosting: Vercel

## Documentation

- `CONTEXT.md` - domain language and product principles
- `PRD.md` - current MVP requirements and architecture
- `docs/DEPLOYMENT.md` - Clerk, Convex, connector, and Vercel deployment runbook
- `GRILL-SESSION.md` - latest grilling decisions and unresolved questions
- `INDEX.md` - active and future documentation map
- `docs/adr/` - accepted active decisions
- `docs/future/` - parked ideas that are not part of the current build

## Current Build Target

Build the smallest useful product:

- A public profile for one linker
- Product cards with status: Active, Testing, Archived
- Link slots: affiliate URL, referral code, canonical URL
- Proof attachments: Loom, YouTube, screenshot, article, GitHub repo
- Put-on-by lineage: person, content, community, event
- Import from existing public surfaces where easy

If a feature does not make the profile more useful for the linker or more credible for the visitor, it waits.

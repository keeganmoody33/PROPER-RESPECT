# PROPER-RESPECT

PROPER-RESPECT is a manual-first product attribution profile. The first
runnable slice serves Keegan's seeded public Product Usage Identity from
Next.js and Convex while keeping draft and private source records out of the
public read model.

## Run the first slice

```bash
npm install
npx convex dev
npm run convex:seed
npm run dev
```

Convex writes `NEXT_PUBLIC_CONVEX_URL` to `.env.local`. Visit
`http://localhost:3000/keegan`.

`NEXT_PUBLIC_SITE_URL` defaults to `http://localhost:3000` outside production.
Set it explicitly when testing a different local origin.

## Canonical profile host

Production metadata treats `NEXT_PUBLIC_SITE_URL` as a trusted deployment
origin. Configure the Vercel production environment with:

```text
NEXT_PUBLIC_SITE_URL=https://props.lecturesfrom.com
```

To associate the hostname without guessing at DNS:

1. Add the exact domain `props.lecturesfrom.com` to the production Vercel
   project.
2. At the DNS provider, create the exact CNAME target Vercel displays for that
   domain. Do not substitute a generic Vercel target.
3. Wait until Vercel reports the domain and TLS certificate as verified, then
   redeploy with `NEXT_PUBLIC_SITE_URL` set.
4. Verify `/keegan` on both the existing Vercel production origin and
   `https://props.lecturesfrom.com/keegan` before changing or removing any
   fallback DNS.

Before cutover, record and test the existing Vercel production profile URL as
the rollback check. If custom-domain verification or health fails, restore the
previous DNS, set `NEXT_PUBLIC_SITE_URL` back to that verified production
origin, and redeploy. Never use a preview deployment as the canonical origin.

This slice intentionally does not redirect the hosted profile. A safe redirect
depends on the remaining issue #13 Domain model: normalized request hosts,
verified ownership and health, Site isolation, and a hosted-origin fallback.
Until those checks exist, middleware must not infer trust from a raw `Host`
header. Sitemap, robots, Open Graph image, verified/unverified host browser
tests, and separation of app-only auth and callback routes also remain issue
#13 work.

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

The product starts as a manual-first profile builder:

1. Add a product you use or have tested.
2. Add your affiliate link, referral code, or canonical link.
3. Attach proof: Loom, YouTube, screenshot, article, GitHub repo, receipt, or API/OAuth evidence when available.
4. Add lineage: who or what put you on.
5. Publish a public product-stack page.

Automation is additive. It should get a user more than halfway toward a useful profile, but it should not become the product's source of truth.

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
| Email metadata scan | SaaS signup and receipt discovery | Broad but noisy | Later, optional |

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

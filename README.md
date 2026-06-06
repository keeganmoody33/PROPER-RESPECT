# PROPER-RESPECT

> Get credit. Give credit.  
> A living timeline of everything you use, with the receipts to prove it.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## The Problem

Every product you love has someone who put you on.  
Every product you put someone on, you did the marketing for free.  

Affiliate links are scattered. Referral codes expire. Your actual usage — the proof that you know this product — is invisible. No one knows who really drives adoption. Only who has the biggest audience.

## The Solution

**[TBD]** is your product journey, public and verified.

- **One profile:** `[TBD].to/keegan`
- **Every product you use**, ranked by real usage — not clicks or followers
- **Every product you archived**, because taste evolves and that's credibility too
- **Looms, screenshots, and notes** attached to the things you actually know
- **Affiliate links** where they exist. **Verified badges** where they don't.
- **Who put you on** — and who you put on. The social graph of real influence.

## How It Works

### For Linkers (Users)

1. **Connect your email** (any provider — Gmail, Outlook, Proton, IMAP) — we find every product you've ever signed up for
2. **Review your timeline** — keep active, archive dormant, delete mistakes. Or add products manually.
3. **Give respect** — tag who put you on, even if they have no link and aren't on the platform
4. **Attach proof** — Looms, screenshots, notes
5. **Share your respect** — one link in your bio. Every recommendation, credited.

### For Discoverers (Visitors)

- Visit `[TBD].to/{username}`
- See their stack: what's active, what's archived, what's being tested
- Click through with confidence — you know this person actually uses it
- Filter by category, see what friends use, follow "stacks"

### For Companies

- Search your domain — see every verified user who lists you
- Filter by **Credibility Weight** — tenure, activity, content, network
- Find your **Servant Leaders** — the users who drive adoption without asking for money
- **Configure your reward rules** — flat, usage-based, tiered. Your economics, your choice.
- Reach out in-app — no cold email. Just: "We see you. We want to thank you."

## The Two Weight Systems

### Credibility Weight (Display)

How props are sorted on your profile. Based on actual usage. Universal algorithm. Public and explainable.

| Badge | Meaning |
|-------|---------|
| 🔥 **Active** | Daily/weekly usage, verified |
| 🌱 **Testing** | Trial or new adopter |
| ⚪️ **Archived** | Used to use, now switched |
| ✅ **Verified** | Company-confirmed via API |
| 💰 **Monetized** | Affiliate link active |

### Reward Weight (Company-Configurable)

How much a company pays for a referral. Their choice. Their rules. We display it, we don't process it.

## The Stack

- **Frontend:** Next.js 14 + Tailwind + shadcn/ui
- **Auth:** Clerk (OAuth + email)
- **Database:** PostgreSQL (Neon) + Prisma
- **Email Scan:** Gmail, Outlook, Yahoo, Proton, IMAP (metadata only)
- **Extension:** Chrome Extension (local-first, optional)
- **Storage:** Vercel Blob / AWS S3 for Looms/screenshots
- **Payments:** Stripe (for Pro tier)
- **Language:** English only (Phase 1-3)

## Roadmap

### Phase 0: Dogfood (Week 1)

- [ ] Build `[TBD].to/keegan` manually
- [ ] 10 products, real copy, real links, real lineage
- [ ] Share it. See if anyone asks "how do I make one?"

### Phase 1: Core Profile (Weeks 2-3)

- [ ] Next.js app with auth (Clerk)
- [ ] Database schema (Prisma + Neon)
- [ ] Public profile pages (`[TBD].to/{username}`)
- [ ] Dashboard: create/edit/delete props (manual)
- [ ] Card UI with credibility weight badges
- [ ] "Put on by" manual logging (no confirmation required)
- [ ] Product creation (user-driven, no canonical DB)

### Phase 2: Ingestion & Proof (Weeks 4-5)

- [ ] Gmail OAuth + metadata scanner (first provider)
- [ ] Draft review UI
- [ ] Credibility weight calculation + badges
- [ ] Content attachments (Loom embed, screenshot upload)
- [ ] Browser extension (local login detection)
- [ ] Per-product OAuth (GitHub, Linear)

### Phase 3: The Graph & B2B (Weeks 6-8)

- [ ] Company pages (auto-generated from user data)
- [ ] Advocate search + ranking by credibility weight
- [ ] Company configuration (reward rules)
- [ ] In-app messaging (company → advocate)
- [ ] Pro tier (Stripe)
- [ ] Company tier (Stripe)
- [ ] Analytics dashboard (Pro users)

### Phase 4: Scale (Weeks 9-12)

- [ ] Multi-provider email (Outlook, Yahoo, Proton, IMAP)
- [ ] Product merge tool (deduplication)
- [ ] Floating lineage hardening
- [ ] Company reputation score
- [ ] API for third-party integrations

## Documentation

- [`CONTEXT.md`](./CONTEXT.md) — Shared domain language (15 principles)
- [`GRILL-SESSION.md`](./GRILL-SESSION.md) — The complete interrogation (9 rounds, 48 ADRs)
- [`PRD.md`](./PRD.md) — The build spec
- [`docs/adr/`](./docs/adr/) — 48 architecture decisions

## License

MIT

---

> *"We built this because we were tired of giving free marketing to companies that never said thank you."*

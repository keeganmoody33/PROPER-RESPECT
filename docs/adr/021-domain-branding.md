# ADR-021: Domain and Branding — props.to

## Status
Accepted — 2026-06-05

## Context
The domain is `props.to`. The product name is "props." Is this the right domain? What about alternatives?

## Decision

### The Domain: props.to

**Why this domain:**
- **Short:** 8 characters (including TLD)
- **Memorable:** "props.to/keegan" is easy to say and type
- **Semantic:** "to" implies direction. "Give respect to Keegan."
- **Available:** (Assumed — needs verification)
- **Social:** Works well in bio links. "Find me at props.to/keegan"

**Alternatives considered:**

| Domain | Why Rejected |
|--------|-------------|
| props.com | Likely taken. Expensive. |
| props.io | Taken or expensive. Less memorable than .to |
| getprops.com | Longer. Less catchy. |
| giveprops.com | Longer. Verb form is less clean. |
| propped.com | Past tense. Weird. |
| props.link | Generic. No personality. |
| propz.co | Misspelling. Unprofessional. |

### The Branding

**Product name:** props
**Tagline:** "Get respect. Give respect."
**Sub-tagline:** "A living timeline of everything you use, with the receipts to prove it."

**The voice:**
- Casual but credible
- Not corporate
- Not overly playful
- Direct. Honest. No bullshit.

**The color palette (suggestion):**
- Primary: Deep purple (credibility, creativity)
- Secondary: Warm orange (energy, action)
- Neutral: Slate gray (professional, clean)
- Accent: Mint green (growth, verification)

**The logo:**
- Simple wordmark: "props" in lowercase
- Optional icon: Two hands giving/receiving (the "props" gesture)
- Must work at 16x16 (favicon) and 512x512 (app icon)

### The Username Format

`props.to/{username}`

**Username rules:**
- 3-30 characters
- Letters, numbers, underscores, hyphens
- No spaces
- Case-insensitive (keegan = Keegan = KEEGAN)
- Unique globally
- Can be changed (once per year, to prevent abuse)

**Reserved usernames:**
- admin, support, help, api, www, app, mobile, blog, docs, legal, privacy, terms, about, contact, products, companies, explore, search, trending, login, signup, auth, settings, profile, dashboard, pro, premium, free, test, demo, beta, alpha, dev, staging, production, root, user, guest, anonymous, null, undefined, true, false, nan, infinity

## Consequences

### Positive
- Short, memorable domain
- Clear semantic meaning
- Easy to say in conversation
- Works for bio links

### Negative
- .to is a less common TLD (some users may not trust it)
- "props" is a common word (may be hard to SEO)
- Could be confused with "props" in React (developer term)
- Domain may be taken (needs verification)

## Mitigations
- If props.to is taken, consider props.link or props.page
- SEO strategy: target "product timeline," "credibility protocol," "who put me on"
- Brand clarity: "props.to is not React props. It's giving credit."

## Related
- ADR-018 (Viral Loop) — domain is the bio link mechanism

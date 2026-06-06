# ADR-056: SEO and Social Sharing — Open Graph, Twitter Cards, Discoverability

## Status
Accepted — 2026-06-05

## Context
Profiles need to look good when shared on Twitter, LinkedIn, Slack, and iMessage. They also need to rank on Google. How do we optimize for sharing and search?

## Decision

### The Open Graph Tags (Per Profile)

```html
<meta property="og:title" content="Keegan's Stack — 12 products, 847 days of usage" />
<meta property="og:description" content="Everything I use. Everything I used to use. With proof." />
<meta property="og:image" content="https://props.to/api/og/keegan.png" />
<meta property="og:url" content="https://props.to/keegan" />
<meta property="og:type" content="profile" />
<meta property="profile:username" content="keegan" />
```

### The Twitter Card Tags

```html
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@props" />
<meta name="twitter:creator" content="@keeganmoody" />
<meta name="twitter:title" content="Keegan's Stack — props.to/keegan" />
<meta name="twitter:description" content="Linear, Cursor, Claude, Obsidian, and 8 more. With proof of usage." />
<meta name="twitter:image" content="https://props.to/api/og/keegan.png" />
```

### The Dynamic OG Image

The OG image is auto-generated and includes:
- User's avatar
- Username and bio
- Top 4 products (with logos)
- Credibility score
- "props.to" branding

```
┌─────────────────────────────────────┐
│ [Avatar] Keegan Moody               │
│ @keegan · GTM Engineer                │
│                                     │
│ 12 products · 847 days of usage       │
│                                     │
│ [Linear] [Cursor] [Claude] [Obsidian]│
│                                     │
│ props.to/keegan                       │
│ Get respect. Give respect.              │
└─────────────────────────────────────┘
```

**Technical:** Generated via `@vercel/og` (Edge Function). Cached for 24 hours. Updated when profile changes.

### The SEO Strategy

**Page-level SEO:**
- Title: `Keegan's Stack — 12 products | props`
- Description: `Everything Keegan uses. Linear, Cursor, Claude, and more. With proof of usage and affiliate links.`
- Canonical URL: `https://props.to/keegan`
- Structured data: `Person` schema + `ItemList` of products

**Site-level SEO:**
- Sitemap: All public profiles + all product pages
- Robots.txt: Allow all public pages, disallow private/draft pages
- Internal linking: Product pages link to advocates, advocates link to products
- Breadcrumbs: Home > Products > Linear > Advocates

**Keyword targets:**
- Primary: "product stack", "tech stack", "tools I use"
- Long-tail: "what does [person] use", "[product] advocates", "who uses [product]"
- Branded: "props.to", "get respect give respect"

### The iMessage / Slack Preview

When someone shares `props.to/keegan` in Slack:
```
props.to/keegan
Keegan's Stack — 12 products, 847 days of usage
Linear, Cursor, Claude, Obsidian, and 8 more.
[Image: OG card]
```

### The QR Code

Every profile has a QR code for in-person sharing:
```
┌─────────────────────────────────────┐
│ [QR Code]                             │
│                                     │
│ Scan to see my stack                  │
│ props.to/keegan                       │
│                                     │
│ [Download PNG] [Copy Link]          │
└─────────────────────────────────────┘
```

### The Share Sheet (Mobile)

When user taps "Share" on mobile:
```
┌─────────────────────────────────────┐
│ Share Keegan's Stack                  │
│                                     │
│ [📋 Copy Link]                        │
│ [🐦 Share on Twitter]               │
│ [💼 Share on LinkedIn]                │
│ [📧 Share via Email]                  │
│ [💬 Share on Slack]                   │
│ [📱 Share via iMessage]               │
│                                     │
│ [Download QR Code]                    │
│ [Embed on Website →]                  │
└─────────────────────────────────────┘
```

## Consequences

### Positive
- Profiles look professional when shared
- OG images drive click-through rates
- SEO brings organic traffic
- QR codes enable in-person sharing
- Share sheet reduces friction

### Negative
- OG image generation is compute-intensive
- SEO requires ongoing content strategy
- Social platform algorithms change (OG tags may break)
- QR codes are rarely used (but nice to have)

## Mitigations
- OG images generated on-demand, cached for 24h
- SEO is secondary to product-market fit (Phase 3+)
- Monitor OG tag validation with Facebook/Twitter debuggers
- QR codes are low-priority (Phase 4)

## Related
- ADR-018 (Viral Loop) — social sharing is the viral mechanism
- ADR-021 (Domain Branding) — props.to is the shareable URL

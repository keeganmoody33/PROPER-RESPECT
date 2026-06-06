# ADR-058: Performance and Speed — Load Times, Caching, Optimization

## Status
Accepted — 2026-06-05

## Context
A profile page must load fast. Slow load times kill engagement. What are our performance targets? How do we achieve them?

## Decision

### The Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Time to First Byte (TTFB)** | < 200ms | Vercel Edge Network |
| **First Contentful Paint (FCP)** | < 1.0s | Lighthouse |
| **Largest Contentful Paint (LCP)** | < 2.5s | Lighthouse |
| **Time to Interactive (TTI)** | < 3.5s | Lighthouse |
| **Cumulative Layout Shift (CLS)** | < 0.1 | Lighthouse |
| **Total Blocking Time (TBT)** | < 200ms | Lighthouse |

### The Caching Strategy

| Layer | Cache Duration | Invalidation |
|-------|---------------|--------------|
| **CDN (Vercel Edge)** | 1 hour | Profile update, new prop |
| **Database query** | 5 minutes | Data change |
| **OG image** | 24 hours | Profile change |
| **Product logos** | 1 week | Logo update |
| **User avatars** | 24 hours | Avatar change |
| **Static assets** | 1 year | Hash in filename |

### The Optimization Techniques

**Images:**
- Product logos: WebP format, 64x64px (small), lazy loaded
- User avatars: WebP, 128x128px, lazy loaded
- OG images: Generated on-demand, cached
- Screenshots/Looms: Lazy loaded, placeholder blur

**Fonts:**
- System font stack (no custom fonts to download)
- `font-display: swap` for any custom fonts

**JavaScript:**
- Next.js App Router (server components by default)
- Client components only for interactive parts
- Code splitting by route
- `dynamic()` for heavy components (analytics, charts)

**Database:**
- Connection pooling (Prisma + Neon)
- Indexed queries (username, product slug, userId+productId)
- Select only needed fields (no `SELECT *`)

**API:**
- Edge Functions for OG images (Vercel Edge)
- Serverless functions for API routes
- Rate limiting prevents abuse (and reduces load)

### The Loading States

```
┌─────────────────────────────────────┐
│ [Skeleton Avatar]                     │
│ [Skeleton Name]                       │
│ [Skeleton Bio]                        │
│                                     │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│ │Skeleton │ │Skeleton │ │Skeleton │ │
│ │  Card   │ │  Card   │ │  Card   │ │
│ └─────────┘ └─────────┘ └─────────┘ │
│                                     │
│ Loading Keegan's stack...             │
└─────────────────────────────────────┘
```

**Skeleton UI:**
- Matches final layout (reduces layout shift)
- Animated pulse (indicates activity)
- Replaced by real content when loaded

### The Performance Monitoring

| Tool | Purpose |
|------|---------|
| **Lighthouse CI** | Automated performance audits on every PR |
| **Vercel Analytics** | Real user metrics (Core Web Vitals) |
| **Sentry** | Error tracking and performance tracing |
| **LogRocket** | Session replay (for debugging slow loads) |

### The Mobile Performance

- Images served at mobile-appropriate sizes
- Touch targets minimum 44x44px
- No hover-dependent interactions
- Reduced motion for low-end devices

## Consequences

### Positive
- Fast load times improve engagement
- Good Core Web Vitals improve SEO
- Caching reduces server costs
- Performance monitoring catches regressions

### Negative
- Caching adds complexity (invalidation)
- OG image generation is slow (first request)
- Performance optimization is ongoing work
- Mobile optimization requires testing on real devices

## Mitigations
- Stale-while-revalidate caching (serve cached, update in background)
- OG images pre-generated for popular profiles
- Performance budgets in CI (fail build if Lighthouse score drops)
- Regular performance audits (monthly)

## Related
- PRD (Stack) — Next.js + Vercel are chosen for performance
- ADR-056 (SEO) — performance affects SEO rankings

# ADR-027: The Embed Widget — Exact Specification

> Parked: not active MVP scope. Revisit only after the core product-stack profile works.


## Status
Accepted — 2026-06-05

## Context
Pro users can embed their profile or specific props on external sites. This extends the viral loop beyond social platforms.

## Decision

### The Embed Types

#### Type 1: Full Profile Embed
```html
<iframe 
  src="https://props.to/keegan?embed=true&theme=light" 
  width="600" 
  height="800"
  frameborder="0"
></iframe>
```

**Display:** Full profile card grid, scrollable, responsive.

#### Type 2: Single Prop Embed
```html
<iframe 
  src="https://props.to/keegan/linear?embed=true&theme=dark" 
  width="400" 
  height="300"
  frameborder="0"
></iframe>
```

**Display:** Single prop card with all details.

#### Type 3: Badge Embed
```html
<a href="https://props.to/keegan" target="_blank">
  <img src="https://props.to/keegan/badge.svg" alt="props.to/keegan" />
</a>
```

**Display:** Small badge showing prop count and credibility.

#### Type 4: Stack Embed (Top N Products)
```html
<iframe 
  src="https://props.to/keegan?embed=true&view=stack&limit=5" 
  width="600" 
  height="400"
></iframe>
```

**Display:** Horizontal or vertical list of top N products by credibility.

### The Embed Parameters

| Parameter | Values | Description |
|-----------|--------|-------------|
| `embed` | `true` | Required for embed mode |
| `theme` | `light`, `dark`, `auto` | Color scheme |
| `view` | `full`, `stack`, `card` | Layout type |
| `limit` | 1-20 | Max products to show (stack view) |
| `filter` | `active`, `all`, `archived` | Which props to show |
| `showLineage` | `true`, `false` | Show "Put on by" |
| `showContent` | `true`, `false` | Show Looms/screenshots |
| `showWeight` | `true`, `false` | Show credibility score |

### The Embed UI (Light Theme)

```
┌─────────────────────────────────────┐
│ props.to/keegan                       │
│ 12 products · 847 days of usage       │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🔥 Linear · Active · 2.1 yrs    │ │
│ │ [▶ Loom]                          │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 🔥 Cursor · Active · 8 mos      │ │
│ │ [▶ Loom]                          │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ ⚪️ Notion · Archived · 3 yrs    │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [View Full Profile →]               │
│                                     │
│ Powered by props.to                   │
└─────────────────────────────────────┘
```

### The Embed UI (Dark Theme)

Same layout, dark background, light text.

### The Badge Embed

```
┌─────────────────────────────┐
│ props.to/keegan               │
│ 12 tools · 847 days           │
│ 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥       │
│ [View →]                      │
└─────────────────────────────┘
```

### The Security

- Embeds are read-only. No editing via embed.
- Embeds use `sandbox` attribute on iframe.
- No JavaScript execution in embed context.
- Embeds are cached (CDN) for performance.
- Rate limit: 1000 embed loads per domain per hour.

### The Use Cases

| Use Case | Embed Type | Example |
|----------|-----------|---------|
| Blog post "My stack" | Stack embed (top 5) | Newsletter, blog |
| Landing page "Verified user" | Single prop embed | Startup website |
| GitHub README | Badge embed | Open source project |
| Personal website | Full profile embed | Portfolio site |
| Twitter bio | Link only (no embed) | Social bio |

## Consequences

### Positive
- Extends viral loop beyond social platforms
- Pro users get value (embed is a Pro feature)
- SEO benefit: embeds create backlinks to props.to
- Badge embed is lightweight and fast

### Negative
- Embeds can be abused (spam sites embedding profiles)
- iframe performance issues (slow loading)
- Theme mismatch (embed doesn't match host site design)
- Mobile embeds are problematic (small screens)

## Mitigations
- Rate limiting prevents abuse
- `sandbox` attribute prevents security issues
- `auto` theme detects host site preference
- Responsive design adapts to container width
- Block list for spam domains

## Related
- ADR-018 (Viral Loop) — embed widget extends viral reach
- PRD (Pro Tier) — embed is a Pro feature

# ADR-018: The Viral Loop — How Profiles Spread Organically

## Status

Accepted — 2026-06-05

## Context

How does a PROPER-RESPECT profile go viral? What is the mechanism for organic growth? Every user who creates a profile is a distribution channel.

## Decision

### The Primary Viral Mechanism: The Bio Link

`props.to/{username}` is designed to be the **one link in your bio** that replaces:

- Linktree
- Beacons
- Stan Store
- Carrd
- "Links in bio" tweets

**The pitch:** "Instead of a generic link tree, show people what you actually use. With proof."

### The Share Flow

1. User creates profile
2. User puts `props.to/{username}` in their bio (Twitter, LinkedIn, Instagram, TikTok)
3. Visitor clicks → sees credible product stack
4. Visitor thinks: "This is better than Linktree. I want one."
5. Visitor signs up → creates profile → puts in their bio
6. Loop repeats

### The Viral Triggers

| Trigger | How It Works |
|---------|-------------|
| **Bio link** | One link replaces all others. Every visitor is a potential signup. |
| **"Put on by" notification** | When someone tags you, you get an email: "Keegan gave you respect for putting him on Claude. View your impact." → Drives signup. |
| **Company discovery** | Company sees advocate page → shares it → advocates get visibility → more signups. |
| **Content embed** | User embeds their props card in a blog post, newsletter, or tweet. |
| **Trending products** | "Cursor is trending on PROPER-RESPECT" → drives curiosity → signups. |

### The Embed Widget

Pro users can embed their profile or specific props on external sites:

```html
<iframe src="https://props.to/keegan?embed=true" width="600" height="400"></iframe>
```

**Use cases:**

- Blog post: "My current stack" with live, updating props
- Newsletter: "Tools I use" with credibility badges
- Landing page: "Verified user of Linear" with weight score

### The "Props Badge"

Users can add a small badge to their website/GitHub README:

```
[props.to/keegan] — 12 active tools · 847 days of usage
```

Clicking the badge opens their full profile.

## Consequences

### Positive

- Every user is a distribution channel
- Bio link is the natural viral mechanism
- "Put on by" notifications drive signups from tagged people
- Embed widget extends reach beyond social platforms

### Negative

- Viral loops take time to build
- Requires critical mass for network effects
- "Put on by" notifications could be annoying if overused
- Embed widget requires moderation (spam prevention)

## Mitigations

- "Put on by" notifications are limited: max 1 per week per recipient
- Embed widget is read-only (no editing via embed)
- Badge is optional (not forced on users)

## Related

- ADR-009 (Manual Put On By) — notifications drive viral signups
- ADR-011 (Company Discovery) — company pages drive viral discovery

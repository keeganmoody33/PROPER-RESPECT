# ADR-035: The "Props" Gesture — Brand Interaction and Micro-Interactions

## Status
Accepted — 2026-06-05

## Context
The word "props" is a cultural gesture — giving credit, showing respect, acknowledging influence. How do we embody this in the product's interactions?

## Decision

### The Core Gesture: "Give Props"

**The action:** When someone puts you on a product, you "give them props" by tagging them in your prop. This is the core interaction.

**The UI pattern:**
```
┌─────────────────────────────────────┐
│ Give respect to who put you on?       │
│                                     │
│ [👏 Give Props]                     │
│                                     │
│ (opens "Put on by" modal)           │
└─────────────────────────────────────┘
```

**The animation:**
- When you click "Give Props," a small 👏 animation plays
- The button pulses briefly
- A toast appears: "Props given! 🎉"

### The "Props Count" Badge

On every user's profile, show their "Props Received" count:
```
┌─────────────────────────────────────┐
│ Keegan Moody                          │
│ @keegan · GTM Engineer                │
│                                     │
│ 👏 47 props received                  │
│ (12 people gave me props for putting │
│  them on products)                    │
│                                     │
│ [View My Impact →]                  │
└─────────────────────────────────────┘
```

### The "Props Leaderboard"

A public leaderboard of users who have received the most props:
```
┌─────────────────────────────────────┐
│ Top Props Givers This Month           │
│                                     │
│ 1. 🥇 Jordan Crawford — 89 props    │
│ 2. 🥈 Austin Rief — 67 props        │
│ 3. 🥉 Sarah Chen — 54 props         │
│ ...                                   │
│                                     │
│ [View Full Leaderboard →]           │
└─────────────────────────────────────┘
```

**Note:** This is not a "most followers" leaderboard. It's a "most impactful" leaderboard. Quality over quantity.

### The "Props Streak"

If a user gives props consistently:
```
┌─────────────────────────────────────┐
│ 🔥 5-week props streak!             │
│ You've given props to someone who   │
│ put you on every week for 5 weeks.  │
│                                     │
│ [Share My Streak →]                 │
└─────────────────────────────────────┘
```

### The "Props Anniversary"

When a user has been on PROPER-RESPECT for 1 year:
```
┌─────────────────────────────────────┐
│ 🎉 Happy Props-iversary!            │
│ You've been giving props for 1 year.│
│                                     │
│ In that time:                         │
│ • 12 products logged                │
│ • 8 people you put on               │
│ • 23 props received                 │
│                                     │
│ [Share My Journey →]                │
└─────────────────────────────────────┘
```

### The "Props Reaction"

When viewing someone's prop, you can react:
```
┌─────────────────────────────────────┐
│ [Logo] Linear                         │
│                                     │
│ Keegan's prop:                        │
│ "Switched from Jira. Never looked   │
│  back."                               │
│                                     │
│ [👏] [🔥] [💯] [🙌] [❤️]            │
│ 12 reactions                          │
│                                     │
│ [Add Reaction →]                      │
└─────────────────────────────────────┘
```

**Reactions:**
- 👏 Props (default)
- 🔥 Fire (this is hot)
- 💯 Hundred (agree 100%)
- 🙌 Praise (amazing)
- ❤️ Love (favorite)

### The "Props" Logo Animation

The logo animates when:
- User publishes their first prop
- User receives their first prop
- User hits a milestone (10 props, 100 views, etc.)

Animation: Two hands come together in a "props" gesture (like a fist bump or high-five).

## Consequences

### Positive
- "Props" is not just a name, it's an interaction
- Gamification (streaks, leaderboards) drives engagement
- Reactions are lightweight social proof
- Animations make the product feel alive

### Negative
- Gamification can feel gimmicky
- Leaderboards may encourage competition over authenticity
- Reactions add UI clutter
- Animations may be annoying to some users

## Mitigations
- Reactions are optional (can be disabled in settings)
- Leaderboards are monthly (not all-time) to give new users a chance
- Animations respect `prefers-reduced-motion`
- Streaks are private by default (user chooses to share)

## Related
- ADR-009 (Manual Put On By) — "Give Props" is the core action
- ADR-018 (Viral Loop) — gamification drives viral growth

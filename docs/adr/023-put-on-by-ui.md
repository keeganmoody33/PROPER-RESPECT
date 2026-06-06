# ADR-023: The "Put On By" UI — Exact Specification

## Status
Accepted — 2026-06-05

## Context
The "Put on by" field is the core social graph mechanism. It must be simple, fast, and flexible. We need the exact UI specification.

## Decision

### The Field Design

```
┌─────────────────────────────────────────────────────────┐
│ Who put you on this?                                    │
│                                                         │
│ [Search by name, @username, or type...    ] [+ Add]      │
│                                                         │
│ Suggestions:                                            │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 👤 Jordan Crawford (@jordan) — Cannonball GTM       │ │
│ │ 👤 Austin Rief (@austin) — Every.to               │ │
│ │ 👤 Sarah Chen (@sarah) — Linear                   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Or select a source type:                                │
│ [👤 Person] [📺 Content] [👥 Community] [📅 Event]      │
│                                                         │
│ ─────────────────────────────────────────────────────── │
│                                                         │
│ Already added:                                          │
│ • Jordan Crawford (Person) — [✏️] [🗑️]                 │
│ • The Tim Ferriss Podcast, Ep 612 (Content) — [✏️] [🗑️] │
│                                                         │
│ [+ Add another source]                                   │
└─────────────────────────────────────────────────────────┘
```

### The Four Source Types

#### 1. Person (Default)
```
┌─────────────────────────────────────┐
│ 👤 Person                             │
│                                     │
│ Name: [Jordan Crawford        ]     │
│                                     │
│ On props? [@jordan (optional) ]     │
│                                     │
│ How? [In a conversation at SaaStr   │
│       Annual 2024            ]      │
│                                     │
│ [Save] [Cancel]                     │
└─────────────────────────────────────┘
```

**Fields:**
- `name` (required) — free text, any name
- `username` (optional) — @username if person is on PROPER-RESPECT
- `context` (optional) — how they were put on (conversation, tweet, email, etc.)

#### 2. Content
```
┌─────────────────────────────────────┐
│ 📺 Content                            │
│                                     │
│ Title: [The Tim Ferriss Podcast    │
│         Episode 612: Naval Ravikant]│
│                                     │
│ URL: [https://tim.blog/612    ]     │
│                                     │
│ Type: [Podcast ▼]                   │
│                                     │
│ [Save] [Cancel]                     │
└─────────────────────────────────────┘
```

**Fields:**
- `title` (required) — content title
- `url` (optional) — link to content
- `type` (required) — Podcast, Video, Article, Book, Tweet, Newsletter, Loom, Other

#### 3. Community
```
┌─────────────────────────────────────┐
│ 👥 Community                          │
│                                     │
│ Name: [r/SaaS on Reddit       ]     │
│                                     │
│ URL: [https://reddit.com/r/SaaS]    │
│                                     │
│ [Save] [Cancel]                     │
└─────────────────────────────────────┘
```

**Fields:**
- `name` (required) — community name
- `url` (optional) — link to community

#### 4. Event
```
┌─────────────────────────────────────┐
│ 📅 Event                              │
│                                     │
│ Name: [SaaStr Annual 2024     ]     │
│                                     │
│ Date: [May 2024               ]     │
│                                     │
│ URL: [https://saastrannual.com]     │
│                                     │
│ [Save] [Cancel]                     │
└─────────────────────────────────────┘
```

**Fields:**
- `name` (required) — event name
- `date` (optional) — when it happened
- `url` (optional) — link to event

### The Display on the Prop Card

```
┌─────────────────────────────────────┐
│ [Logo] Claude                         │
│                                     │
│ 🔥 Active · 6 mos · Cred: 67        │
│                                     │
│ "Jordan Crawford put me on this     │
│  at SaaStr Annual 2024. Changed    │
│  how I work."                         │
│                                     │
│ Put on by:                            │
│ • 👤 Jordan Crawford                  │
│ • 📺 The Tim Ferriss Podcast, Ep 612│
│ • 👥 r/SaaS on Reddit                 │
│                                     │
│ [▶ Loom: My Claude Workflow]        │
│                                     │
│ [Visit →]                           │
└─────────────────────────────────────┘
```

### The Display on the Giver's Profile (if on PROPER-RESPECT)

```
┌─────────────────────────────────────┐
│ Jordan's Impact                       │
│                                     │
│ Products Jordan put people on:      │
│ • Claude (3 people)                 │
│ • Linear (1 person)                 │
│ • Cannonball (12 people)            │
│                                     │
│ Total impact: 16 people influenced  │
│                                     │
│ [View Impact Graph →]               │
└─────────────────────────────────────┘
```

### The Keyboard Shortcut

**Quick add:** When adding a prop, press `Tab` after the product name to jump to "Put on by" field. Type `@` to search usernames. Type `!` to search content. Type `#` to search communities. Type `*` to search events.

### The Mobile UI

On mobile, the "Put on by" field is a bottom sheet:
```
┌─────────────────────────────────────┐
│ Who put you on this?              ✕ │
│                                     │
│ [Search...                    ]     │
│                                     │
│ Recent:                             │
│ • Jordan Crawford                   │
│ • Tim Ferriss Podcast               │
│ • SaaStr Annual                     │
│                                     │
│ [👤 Person] [📺 Content]            │
│ [👥 Community] [📅 Event]           │
└─────────────────────────────────────┘
```

## Consequences

### Positive
- Simple, fast, flexible
- Four source types cover 99% of influence scenarios
- Keyboard shortcuts for power users
- Mobile-optimized bottom sheet
- Multiple sources per prop (someone was put on by a person AND a podcast)

### Negative
- Four different forms = more UI complexity
- Mobile bottom sheet may be annoying
- "Context" field is free text = inconsistent data
- No confirmation = potential for false attributions

## Mitigations
- Default to Person (80% of cases)
- Autocomplete from user's previous entries
- Context field has placeholder examples: "In a conversation," "Via Twitter DM," "At a conference"
- Mobile: swipe to dismiss bottom sheet

## Related
- ADR-009 (Manual Put On By) — the philosophy behind manual logging
- ADR-013 (Floating Lineage) — what happens when tagged person joins

# ADR-055: Empty States — What Happens When There's No Data

## Status
Accepted — 2026-06-05

## Context
Every product has empty states. What does a profile look like with 0 props? What does search look like with no results? Empty states are UX opportunities, not dead ends.

## Decision

### The Empty Profile State

```
┌─────────────────────────────────────┐
│ props.to/keegan                       │
│                                     │
│ Keegan just joined props.             │
│                                     │
│ 🌱 New Sprout                         │
│                                     │
│ This profile is just getting started. │
│                                     │
│ [View Keegan's Stack →]             │
│ (will show products once added)       │
│                                     │
│ 💡 Want your own profile?             │
│ [Create Yours →]                      │
└─────────────────────────────────────┘
```

**Why this works:**
- Doesn't shame the user for having no products
- "New Sprout" frames it as potential, not emptiness
- CTA to create own profile (viral loop)

### The Empty Search State

```
┌─────────────────────────────────────┐
│ Search: "quantum computing software"  │
│                                     │
│ 🔭 No products found                  │
│                                     │
│ No one has added this product yet.    │
│                                     │
│ Be the first:                         │
│ [Add "Quantum Computing Software" →]  │
│                                     │
│ Or try:                               │
│ • "quantum"                           │
│ • "computing"                         │
│ • "software"                          │
└─────────────────────────────────────┘
```

### The Empty Company Page State

```
┌─────────────────────────────────────┐
│ [Logo] SomeNewStartup.com             │
│                                     │
│ 🌱 No advocates yet                   │
│                                     │
│ No one has listed this product on   │
│ props yet.                            │
│                                     │
│ Are you a user?                       │
│ [Add to My Stack →]                   │
│                                     │
│ Are you the company?                  │
│ [Claim This Page →]                   │
└─────────────────────────────────────┘
```

### The Empty "Put On By" State

```
┌─────────────────────────────────────┐
│ Who put you on Linear?                │
│                                     │
│ 🤷 No one tagged yet                  │
│                                     │
│ You haven't given props to anyone   │
│ for putting you on this product.    │
│                                     │
│ [Give Props →]                        │
│                                     │
│ 💡 Giving props builds the social     │
│    graph and helps others discover   │
│    great products.                    │
└─────────────────────────────────────┘
```

### The Empty Analytics State (Pro User)

```
┌─────────────────────────────────────┐
│ Analytics                             │
│                                     │
│ 📊 No data yet                        │
│                                     │
│ Your profile hasn't been viewed yet.  │
│                                     │
│ Share your profile to get views:      │
│ [Copy Link] [Share on Twitter]      │
│                                     │
│ 💡 Pro tip: Add your props link to   │
│    your bio for maximum visibility.   │
└─────────────────────────────────────┘
```

### The Empty Inbox Scan State

```
┌─────────────────────────────────────┐
│ Email Scan Results                    │
│                                     │
│ 🔍 No products found                  │
│                                     │
│ We couldn't find any product-related  │
│ emails in your inbox.                 │
│                                     │
│ Possible reasons:                     │
│ • You use a different email for      │
│   product signups                     │
│ • Your products don't send emails     │
│ • Your email is very new              │
│                                     │
│ [Add Products Manually →]             │
│ [Connect Another Email →]             │
└─────────────────────────────────────┘
```

### The Empty Lineage Graph State

```
┌─────────────────────────────────────┐
│ Your Impact                           │
│                                     │
│ 🌱 Just getting started               │
│                                     │
│ You haven't put anyone on a product   │
│ yet. When you do, they'll show up    │
│ here.                                 │
│                                     │
│ 💡 Tip: When someone asks "What tool  │
│    do you use?", send them your      │
│    props link. If they sign up, you  │
│    get credit.                        │
└─────────────────────────────────────┘
```

## The Empty State Principles

1. **Never blame the user.** "You haven't..." → "Just getting started"
2. **Always provide a next step.** Every empty state has a CTA.
3. **Explain why it's empty.** Context reduces confusion.
4. **Use illustration/icon.** Visual interest reduces abandonment.
5. **Keep it brief.** Empty states are temporary. Don't over-invest.

## Consequences

### Positive
- Empty states feel intentional, not broken
- Every empty state is a conversion opportunity
- Users understand why something is empty
- Clear next steps reduce drop-off

### Negative
- Empty states require custom design for every screen
- Overly helpful empty states can feel patronizing
- Illustrations add asset maintenance
- Some empty states are edge cases (rarely seen)

## Mitigations
- Reuse empty state components (consistent patterns)
- Use simple icons, not complex illustrations
- A/B test empty state CTAs
- Track which empty states are seen most (prioritize those)

## Related
- ADR-024 (Onboarding Flow) — empty states are part of onboarding
- ADR-020 (Cold Start) — empty states affect first impression

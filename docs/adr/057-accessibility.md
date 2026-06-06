# ADR-057: Accessibility — WCAG 2.1 AA Compliance

## Status
Accepted — 2026-06-05

## Context
props must be accessible to everyone, including users with disabilities. This is both an ethical requirement and a legal one (ADA, EAA).

## Decision

### The Accessibility Standards

**Target:** WCAG 2.1 Level AA

**Key requirements:**
- Perceivable: Content must be presentable in different ways
- Operable: Interface must be navigable by keyboard and screen reader
- Understandable: Content must be readable and predictable
- Robust: Must work with assistive technologies

### The Implementation Checklist

| Requirement | Implementation |
|-------------|---------------|
| **Color contrast** | All text meets 4.5:1 ratio. Badges use patterns + color. |
| **Keyboard navigation** | All interactive elements are tabbable. Enter/Space to activate. |
| **Screen reader** | ARIA labels on all icons. Live regions for dynamic content. |
| **Focus indicators** | Visible focus rings on all interactive elements. |
| **Alt text** | All product logos have alt text. User avatars have alt text. |
| **Form labels** | All inputs have associated labels. Error messages are clear. |
| **Modal trapping** | Focus trapped in modals. Escape to close. |
| **Skip links** | "Skip to content" link at top of page. |
| **Reduced motion** | All animations respect `prefers-reduced-motion`. |
| **Zoom** | Layout works at 200% zoom. No horizontal scroll. |

### The Screen Reader Experience

```
[Screen reader reads:]
"Keegan's Stack. props dot to slash keegan. 
12 products. 3 active. 2 archived.

Active products:
Link. Linear. Active. 2.1 years. Credibility 114.
Button. Give respect. Who put you on?
Link. Visit Linear.

Link. Cursor. Active. 8 months. Credibility 67.
Button. Give respect. Who put you on?
Link. Visit Cursor.

Archived products:
Link. Notion. Archived. 3 years. 
Switched to Obsidian."
```

### The Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Tab` | Navigate to next interactive element |
| `Shift + Tab` | Navigate to previous |
| `Enter` | Activate link or button |
| `Space` | Toggle checkbox or button |
| `Escape` | Close modal or dropdown |
| `?` | Open keyboard shortcut help |
| `j` | Jump to next prop (vim-style) |
| `k` | Jump to previous prop |
| `g` | Focus search |
| `n` | Add new prop |

### The Accessibility Statement

```
┌─────────────────────────────────────┐
│ Accessibility                         │
│                                     │
│ PROPER-RESPECT is committed to making our    │
│ product accessible to everyone.       │
│                                     │
│ We follow WCAG 2.1 Level AA.        │
│                                     │
│ If you encounter any accessibility  │
│ issues, please contact us:            │
│ accessibility@props.to                │
│                                     │
│ [View Full Statement →]             │
└─────────────────────────────────────┘
```

## Consequences

### Positive
- Accessible to all users (ethical and legal compliance)
- Better SEO (semantic HTML helps search engines)
- Better UX for everyone (keyboard shortcuts help power users)
- Reduced legal risk (ADA compliance)

### Negative
- Accessibility testing adds development time
- ARIA labels add code complexity
- Screen reader testing requires specialized knowledge
- Some design choices may conflict with accessibility

## Mitigations
- Use shadcn/ui components (built with accessibility in mind)
- Automated testing: axe-core, Lighthouse accessibility audit
- Manual testing with NVDA (Windows) and VoiceOver (Mac)
- Accessibility is a requirement, not a nice-to-have (no exceptions)

## Related
- PRD (UI Specification) — accessibility is part of all components
- ADR-023 (Put On By UI) — modals must be accessible

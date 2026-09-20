# Catalog identity expansion

Verified: 2026-09-19. Scope: public product identity, not any person's relationship
or usage. The execution owner checked the official pages below before the
catalog implementation. Existing 16 catalog identities remain unchanged.

| Canonical product | Official identity source / canonical host |
| --- | --- |
| Cursor | [cursor.com](https://cursor.com) |
| Cloudflare | [cloudflare.com](https://www.cloudflare.com) |
| Searchable | [searchable.com](https://www.searchable.com) |
| Smartlead | [smartlead.ai](https://www.smartlead.ai) |
| Findymail | [findymail.com](https://www.findymail.com) |
| Hunter | [hunter.io](https://hunter.io) |
| Supabase | [supabase.com](https://supabase.com) |
| Neon | [neon.com](https://neon.com/variable-load); historical [neon.tech](https://neon.tech/pdf/DPA.pdf) |
| Upstash | [upstash.com](https://upstash.com) |
| PostHog | [posthog.com](https://posthog.com) |
| ElevenLabs | [elevenlabs.io](https://elevenlabs.io) |
| Browserbase | [browserbase.com](https://www.browserbase.com) |
| Ref | [ref.tools](https://ref.tools) |
| Context7 | [context7.com](https://context7.com) |
| Figma | [figma.com](https://www.figma.com) |
| Readwise | [readwise.io](https://readwise.io) |
| Firecrawl | [firecrawl.dev](https://www.firecrawl.dev) |
| OpenRouter | [openrouter.ai](https://openrouter.ai) |
| Tailscale | [tailscale.com](https://tailscale.com) |
| Exa | [exa.ai](https://exa.ai) |

Only these official root domains and Neon's verified historical domain are
added. The existing sender matcher accepts dotted subdomains; strict manual
website matching still requires a known root or explicitly cataloged product
URL. Customer hosting domains such as `workers.dev`, `pages.dev`, and
`supabase.co` are not added. Cloudflare does not imply Workers or Pages;
Readwise does not imply Reader. Context7 remains distinct from Context.dev.

Sender metadata is not authenticated-sender proof, nor proof of signup,
payment, product activity, adoption, importance, or recommendation. A catalog
match proposes private review only. Existing pending-draft storage defaults
are not an owner-confirmed relationship. No observation or usage value is
manufactured. This change does not reconcile stored evidence, read a provider,
change a saved relationship, or publish information by itself.

## Focused verification

- RED: `npx vitest run src/domain/discovery.test.ts` — two expected failures:
  Cursor's name-only catalog round trip returned null; its sender subdomain
  remained the proposal destination instead of the canonical product host.
- GREEN: `npx vitest run src/domain/discovery.test.ts src/server/mailbox-gmail.test.ts src/server/mailbox-search.test.ts`
  — 46 tests passed across three files.
- Coverage: all 20 canonical names/root domains/subdomains, Gmail name round
  trips, canonical destinations, Neon historical alias, suffix lookalikes,
  shared hosting exclusions, subproduct ambiguity, pending private proposals,
  unchanged input evidence, and preservation of prior catalog identities.

These are local regressions, not hosted retention or publication proof.
Existing persisted mailbox queries and cursors are not rewritten by this edit.

/**
 * Homepage examples whose look comes from their own public page alone, with no stored provider brand: their listed domains belong
 * to a parent company, so the brand gate refuses a Context.dev brand for them (owner decision 2026-11-15 to brand them anyway).
 * Each page is on the product's listed domain. Read by scripts/pull-homepage-site-traits.mjs and scripts/brand-fidelity.mjs.
 */
export const SITE_ONLY_PAGES = [
  { productSlug: "claude-code", name: "Claude Code", canonicalDomain: "claude.com", url: "https://claude.com/product/claude-code" },
  { productSlug: "grok-bot", name: "Grok Bot", canonicalDomain: "x.ai", url: "https://x.ai/" },
] as const;

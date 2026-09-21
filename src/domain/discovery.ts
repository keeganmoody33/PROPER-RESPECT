import { z } from "zod";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { evidenceObservationSchema } from "./evidence-claims.ts";
import { captureProvenanceSchema } from "./capture-provenance.ts";

export const evidenceSourceTypeSchema = z.enum([
  "MANUAL",
  "PUBLIC_PROFILE",
  "GITHUB",
  "BILLING",
  "BROWSER_HISTORY",
  "SCREEN_TIME",
  "SOCIAL_MESSAGES",
  "GMAIL",
  "MICROSOFT_MAIL",
  "SCREENSHOT",
  "CSV",
  "FILE_UPLOAD",
  "URL_IMPORT",
  "DEVIN",
  "DEVIN_DESKTOP",
  "WINDSURF",
  "WISPR_FLOW",
  "NOTEBOOKLM",
  "GREPTILE",
]);

export type EvidenceSourceType = z.infer<typeof evidenceSourceTypeSchema>;

export const rawSignalSchema = z.object({
  sourceType: evidenceSourceTypeSchema,
  sourceRecordId: z.string().min(1).max(512).refine(value => value.trim().length > 0).optional(),
  vendor: z.string().optional(),
  url: z.string().optional(),
  capturedAt: z.iso.datetime(),
  payload: z.string(),
  observations: z.array(evidenceObservationSchema).max(100).optional(),
  captureProvenance: captureProvenanceSchema.optional(),
});

export type RawSignal = z.infer<typeof rawSignalSchema>;

export type ProductIdentity = {
  slug: string;
  name: string;
  domain: string;
  description: string;
};

export type DraftProposal = {
  product: ProductIdentity;
  canonicalUrl: string;
  signalIndexes: number[];
};

export function prepareImportedProp(
  proposal: DraftProposal,
  sourceType: EvidenceSourceType,
) {
  return {
    visibility: "DRAFT" as const,
    status: "TESTING" as const,
    draftStatus: "PENDING" as const,
    headline: `${proposal.product.name} may be in your stack.`,
    note: `Proposed from ${sourceType.toLowerCase().replace(/_/g, " ")} evidence. Review before publishing.`,
  };
}

type CatalogEntry = ProductIdentity & {
  domains: string[];
  aliases: string[];
  canonicalUrl?: string;
};

const VENDOR_CATALOG: CatalogEntry[] = [
  // Official product identity verified at https://www.clay.com on 2026-09-18.
  {
    slug: "clay", name: "Clay", domain: "clay.com",
    description: "Data enrichment and go-to-market workflows.",
    domains: ["clay.com"], aliases: ["clay"],
  },
  {
    slug: "github",
    name: "GitHub",
    domain: "github.com",
    description: "The home base for code, collaboration, and shipped work.",
    domains: ["github.com", "github.io"],
    aliases: ["github", "github inc"],
  },
  {
    slug: "github-copilot",
    name: "GitHub Copilot",
    domain: "github.com",
    description: "GitHub's AI coding assistant.",
    domains: [],
    aliases: ["github copilot", "github copilot pro", "github copilot pro+", "github copilot pro plus"],
    canonicalUrl: "https://github.com/features/copilot",
  },
  {
    slug: "wisprflow",
    name: "Wispr Flow",
    domain: "wisprflow.ai",
    description: "Voice dictation for writing across apps.",
    domains: ["wisprflow.ai", "flowvoice.ai"],
    aliases: ["wisprflow", "wispr flow", "wispr"],
  },
  {
    slug: "notebooklm",
    name: "NotebookLM",
    domain: "notebooklm.google.com",
    description: "Research and synthesis over supplied sources.",
    domains: ["notebooklm.google.com", "notebooklm.google"],
    aliases: ["notebooklm", "notebook lm", "google notebooklm"],
  },
  {
    slug: "notion",
    name: "Notion",
    domain: "notion.so",
    description: "Docs, wikis, and databases in one connected workspace.",
    domains: ["notion.so", "notion.site", "notion.com"],
    aliases: ["notion", "notion labs", "notion labs inc"],
  },
  {
    slug: "devin",
    name: "Devin",
    domain: "devin.ai",
    description: "Autonomous software engineering activity.",
    domains: ["devin.ai", "app.devin.ai"],
    aliases: ["devin", "devin cloud", "cognition devin"],
  },
  {
    slug: "devin-desktop",
    name: "Devin Desktop",
    domain: "devin.ai",
    description: "Desktop coding activity in the Devin product family.",
    domains: [],
    aliases: ["devin desktop"],
    canonicalUrl: "https://devin.ai/download",
  },
  {
    slug: "windsurf",
    name: "Windsurf",
    domain: "windsurf.com",
    description: "AI-assisted coding activity across editor workflows.",
    domains: ["windsurf.com", "codeium.com"],
    aliases: ["windsurf", "codeium"],
  },
  {
    slug: "greptile",
    name: "Greptile",
    domain: "greptile.com",
    description: "AI code review activity and bugs caught.",
    domains: ["greptile.com"],
    aliases: ["greptile"],
  },
  // Package names and homepages verified against the installed package manifests.
  {
    slug: "clerk", name: "Clerk", domain: "clerk.com",
    description: "Application authentication.",
    domains: ["clerk.com"], aliases: ["clerk", "@clerk/nextjs"],
  },
  {
    slug: "convex", name: "Convex", domain: "convex.dev",
    description: "Application database and backend functions.",
    domains: ["convex.dev"], aliases: ["convex"],
  },
  {
    slug: "nextjs", name: "Next.js", domain: "nextjs.org",
    description: "React application framework.",
    domains: ["nextjs.org"], aliases: ["next", "next.js", "nextjs"],
  },
  {
    slug: "react", name: "React", domain: "react.dev",
    description: "User interface library.",
    domains: ["react.dev"], aliases: ["react", "react-dom"],
  },
  {
    slug: "zod", name: "Zod", domain: "zod.dev",
    description: "Runtime schema parsing and validation.",
    domains: ["zod.dev"], aliases: ["zod"],
  },
  {
    slug: "typescript", name: "TypeScript", domain: "typescriptlang.org",
    description: "Static type checking for JavaScript.",
    domains: ["typescriptlang.org"], aliases: ["typescript"],
  },
  // Public identities verified 2026-09-19; sources and limits are recorded in
  // docs/verification/2026-09-19-catalog-identities.md. These are not usage claims.
  {
    slug: "cursor", name: "Cursor", domain: "cursor.com",
    description: "AI-assisted software development.",
    domains: ["cursor.com"], aliases: ["cursor"],
  },
  {
    slug: "cloudflare", name: "Cloudflare", domain: "cloudflare.com",
    description: "Connectivity, security, and application infrastructure platform.",
    domains: ["cloudflare.com"], aliases: ["cloudflare"],
  },
  {
    slug: "searchable", name: "Searchable", domain: "searchable.com",
    description: "AI search visibility and analytics.",
    domains: ["searchable.com"], aliases: ["searchable"],
  },
  {
    slug: "smartlead", name: "Smartlead", domain: "smartlead.ai",
    description: "Outbound email and sales workflows.",
    domains: ["smartlead.ai"], aliases: ["smartlead"],
  },
  {
    slug: "findymail", name: "Findymail", domain: "findymail.com",
    description: "Business contact finding and email verification.",
    domains: ["findymail.com"], aliases: ["findymail"],
  },
  {
    slug: "hunter", name: "Hunter", domain: "hunter.io",
    description: "Email finding, verification, and outreach.",
    domains: ["hunter.io"], aliases: ["hunter"],
  },
  {
    slug: "supabase", name: "Supabase", domain: "supabase.com",
    description: "Postgres-based application backend platform.",
    domains: ["supabase.com"], aliases: ["supabase"],
  },
  {
    slug: "neon", name: "Neon", domain: "neon.com",
    description: "Managed serverless Postgres.",
    domains: ["neon.com", "neon.tech"], aliases: ["neon"],
  },
  {
    slug: "upstash", name: "Upstash", domain: "upstash.com",
    description: "Serverless data and messaging infrastructure.",
    domains: ["upstash.com"], aliases: ["upstash"],
  },
  {
    slug: "posthog", name: "PostHog", domain: "posthog.com",
    description: "Product analytics and development tools.",
    domains: ["posthog.com"], aliases: ["posthog"],
  },
  {
    slug: "elevenlabs", name: "ElevenLabs", domain: "elevenlabs.io",
    description: "AI voice and audio tools.",
    domains: ["elevenlabs.io"], aliases: ["elevenlabs"],
  },
  {
    slug: "browserbase", name: "Browserbase", domain: "browserbase.com",
    description: "Browser automation infrastructure.",
    domains: ["browserbase.com"], aliases: ["browserbase"],
  },
  {
    slug: "ref", name: "Ref", domain: "ref.tools",
    description: "Documentation tools for software development.",
    domains: ["ref.tools"], aliases: ["ref"],
  },
  {
    slug: "context7", name: "Context7", domain: "context7.com",
    description: "Library documentation for coding assistants.",
    domains: ["context7.com"], aliases: ["context7"],
  },
  {
    slug: "figma", name: "Figma", domain: "figma.com",
    description: "Collaborative product design tools.",
    domains: ["figma.com"], aliases: ["figma"],
  },
  {
    slug: "readwise", name: "Readwise", domain: "readwise.io",
    description: "Highlight collection and review.",
    domains: ["readwise.io"], aliases: ["readwise"],
  },
  {
    slug: "firecrawl", name: "Firecrawl", domain: "firecrawl.dev",
    description: "Web crawling and data extraction.",
    domains: ["firecrawl.dev"], aliases: ["firecrawl"],
  },
  {
    slug: "openrouter", name: "OpenRouter", domain: "openrouter.ai",
    description: "Unified access to AI model APIs.",
    domains: ["openrouter.ai"], aliases: ["openrouter"],
  },
  {
    slug: "tailscale", name: "Tailscale", domain: "tailscale.com",
    description: "Private networking and access control.",
    domains: ["tailscale.com"], aliases: ["tailscale"],
  },
  {
    slug: "exa", name: "Exa", domain: "exa.ai",
    description: "Web search and retrieval for AI applications.",
    domains: ["exa.ai"], aliases: ["exa"],
  },
];

/** Trusted catalog identity, not a match inferred from an owner's evidence. */
export function canonicalCatalogProduct(slug: string): ProductIdentity | null {
  const entry = VENDOR_CATALOG.find((product) => product.slug === slug);
  if (!entry) return null;
  const { name, domain, description } = entry;
  return { slug, name, domain, description };
}

/** Verified catalog domains for bounded email discovery, not evidence of usage. */
export function canonicalCatalogSenderDomains(): string[] {
  return [...new Set(VENDOR_CATALOG.flatMap(product => product.domains))].sort();
}

export function normalizeVendorName(input: string): string {
  return input
    .toLowerCase()
    .replace(/,?\s*\b(inc|llc|ltd|corp|co)\.?$/i, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractDomain(url: string): string | null {
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(url)
      ? url
      : `https://${url}`;
    const parsed = new URL(withScheme);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    // URL accepts single words, credentials, and non-web schemes. They are not
    // evidence of a product domain (e.g. a package named "react").
    if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password ||
        !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(host)) return null;
    return host;
  } catch {
    return null;
  }
}

function matchCatalogUrl(input: string, requireProductWebsite = false): CatalogEntry | null {
  const domain = extractDomain(input);
  if (!domain) return null;
  const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`);
  const path = url.pathname.replace(/\/+$/, "");
  // A verified subproduct destination is more specific than its company host.
  // Query strings, fragments, www, and a trailing slash do not change identity.
  const byCanonicalUrl = VENDOR_CATALOG.find(entry => {
    if (!entry.canonicalUrl) return false;
    const canonical = new URL(entry.canonicalUrl);
    return extractDomain(entry.canonicalUrl) === domain && canonical.pathname.replace(/\/+$/, "") === path;
  });
  if (byCanonicalUrl) return byCanonicalUrl;
  // Manual intake needs a known product website. An arbitrary path or an
  // unlisted subdomain could describe a separate product, so keep it unresolved.
  if (requireProductWebsite && path) return null;
  return VENDOR_CATALOG.find(entry => entry.domains.some(d =>
    domain === d || (!requireProductWebsite && domain.endsWith(`.${d}`)),
  )) ?? null;
}

function matchCatalog(signal: Pick<RawSignal, "vendor" | "url">): CatalogEntry | null {
  // A named product is more specific than its shared company domain.
  if (signal.vendor) {
    const named = VENDOR_CATALOG.find(entry => entry.aliases.some(
      alias => normalizeVendorName(alias) === normalizeVendorName(signal.vendor!),
    ));
    if (named) return named;
  }
  if (signal.url) {
    const byUrl = matchCatalogUrl(signal.url);
    if (byUrl) return byUrl;
  }

  if (signal.vendor) {
    const normalized = normalizeVendorName(signal.vendor);
    const vendorDomain = extractDomain(signal.vendor);
    const byAlias = VENDOR_CATALOG.find(
      (entry) =>
        entry.aliases.some(alias => normalizeVendorName(alias) === normalized) ||
        (vendorDomain !== null &&
          entry.domains.some(
            (d) => vendorDomain === d || vendorDomain.endsWith(`.${d}`),
          )),
    );
    if (byAlias) return byAlias;
  }

  return null;
}

function deriveIdentity(signal: RawSignal): ProductIdentity | null {
  const domain =
    (signal.url ? extractDomain(signal.url) : null) ??
    (signal.vendor ? extractDomain(signal.vendor) : null);
  if (!domain) return null;

  // Keep DNS label boundaries in the identity and fit the 39-character card key.
  const slug = `host-${bytesToHex(sha256(new TextEncoder().encode(domain))).slice(0, 32)}`;

  const label = domain.split(".")[0] ?? domain;
  return {
    slug,
    name: label.charAt(0).toUpperCase() + label.slice(1),
    domain,
    description: `Discovered via ${signal.sourceType.toLowerCase().replace(/_/g, " ")} evidence.`,
  };
}

function catalogProduct(entry: CatalogEntry | null): Pick<DraftProposal, "product" | "canonicalUrl"> | null {
  if (!entry) return null;
  const { slug, name, domain, description } = entry;
  return { product: { slug, name, domain, description }, canonicalUrl: entry.canonicalUrl ?? `https://${domain}` };
}

/** Catalog presentation identity without manufacturing an evidence signal. */
export function resolveCatalogProduct(input: Pick<RawSignal, "vendor" | "url">): Pick<DraftProposal, "product" | "canonicalUrl"> | null {
  return catalogProduct(matchCatalog(input));
}

/** Strict website identity for owner intake; do not infer a parent product. */
export function resolveCatalogProductWebsite(url: string): Pick<DraftProposal, "product" | "canonicalUrl"> | null {
  return catalogProduct(matchCatalogUrl(url, true));
}

export function resolveProduct(signal: RawSignal): ProductIdentity | null {
  return resolveCatalogProduct(signal)?.product ?? deriveIdentity(signal);
}

export function proposeDrafts(signals: RawSignal[]): DraftProposal[] {
  const bySlug = new Map<string, DraftProposal>();

  signals.forEach((signal, index) => {
    const product = resolveProduct(signal);
    if (!product) return;

    const existing = bySlug.get(product.slug);
    if (existing) {
      existing.signalIndexes.push(index);
      return;
    }

    bySlug.set(product.slug, {
      product,
      canonicalUrl: VENDOR_CATALOG.find(entry => entry.slug === product.slug)?.canonicalUrl ?? `https://${product.domain}`,
      signalIndexes: [index],
    });
  });

  return [...bySlug.values()];
}

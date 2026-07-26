import { z } from "zod";

export const evidenceSourceTypeSchema = z.enum([
  "MANUAL",
  "PUBLIC_PROFILE",
  "GITHUB",
  "BILLING",
  "BROWSER_HISTORY",
  "SCREEN_TIME",
  "SOCIAL_MESSAGES",
  "GMAIL",
  "SCREENSHOT",
  "CSV",
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
  vendor: z.string().optional(),
  url: z.string().optional(),
  capturedAt: z.iso.datetime(),
  payload: z.string(),
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
};

const VENDOR_CATALOG: CatalogEntry[] = [
  {
    slug: "github",
    name: "GitHub",
    domain: "github.com",
    description: "The home base for code, collaboration, and shipped work.",
    domains: ["github.com", "github.io"],
    aliases: ["github", "github inc"],
  },
  {
    slug: "wisprflow",
    name: "Wisprflow",
    domain: "wisprflow.ai",
    description: "Voice dictation that keeps up with how I actually think.",
    domains: ["wisprflow.ai", "flowvoice.ai"],
    aliases: ["wisprflow", "wispr flow", "wispr"],
  },
  {
    slug: "notebooklm",
    name: "NotebookLM",
    domain: "notebooklm.google.com",
    description: "Grounded research and synthesis over my own sources.",
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
];

export function normalizeVendorName(input: string): string {
  return input
    .toLowerCase()
    .replace(/,?\s*(inc|llc|ltd|corp|co)\.?$/i, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractDomain(url: string): string | null {
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(url)
      ? url
      : `https://${url}`;
    const host = new URL(withScheme).hostname.toLowerCase();
    return host.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

function matchCatalog(signal: RawSignal): CatalogEntry | null {
  const domain = signal.url ? extractDomain(signal.url) : null;
  if (domain) {
    const byDomain = VENDOR_CATALOG.find((entry) =>
      entry.domains.some((d) => domain === d || domain.endsWith(`.${d}`)),
    );
    if (byDomain) return byDomain;
  }

  if (signal.vendor) {
    const normalized = normalizeVendorName(signal.vendor);
    const vendorDomain = extractDomain(signal.vendor);
    const byAlias = VENDOR_CATALOG.find(
      (entry) =>
        entry.aliases.includes(normalized) ||
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

  const label = domain.split(".")[0];
  const slug = label.replace(/[^a-z0-9-]/g, "");
  if (!slug) return null;

  return {
    slug,
    name: label.charAt(0).toUpperCase() + label.slice(1),
    domain,
    description: `Discovered via ${signal.sourceType.toLowerCase().replace(/_/g, " ")} evidence.`,
  };
}

export function resolveProduct(signal: RawSignal): ProductIdentity | null {
  const catalogMatch = matchCatalog(signal);
  if (catalogMatch) {
    const { slug, name, domain, description } = catalogMatch;
    return { slug, name, domain, description };
  }
  return deriveIdentity(signal);
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
      canonicalUrl: `https://${product.domain}`,
      signalIndexes: [index],
    });
  });

  return [...bySlug.values()];
}

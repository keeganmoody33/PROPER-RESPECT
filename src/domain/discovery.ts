import { z } from "zod";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { evidenceObservationSchema } from "./evidence-claims.ts";
import { captureProvenanceSchema } from "./capture-provenance.ts";
import { evidenceTier, extractDomain, normalizeVendorName } from "./product-directory.ts";

export { extractDomain, normalizeVendorName } from "./product-directory.ts";

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

export const VENDOR_CATALOG: readonly CatalogEntry[] = evidenceTier().map(entry => ({
  slug: entry.slug,
  name: entry.name,
  domain: entry.domain,
  description: entry.description,
  domains: [...entry.evidence.domains],
  aliases: [...entry.aliases],
  ...(entry.evidence.canonicalUrl === undefined ? {} : { canonicalUrl: entry.evidence.canonicalUrl }),
}));

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

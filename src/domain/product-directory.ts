import { parseLooseHttpUrl } from "./http-url.ts";
import { DIRECTORY_ENTRIES, type DirectoryEntry } from "./product-directory-entries.ts";

export type { DirectoryCategory, DirectoryEntry } from "./product-directory-entries.ts";

export type EvidenceEntry = DirectoryEntry & { evidence: NonNullable<DirectoryEntry["evidence"]> };

export function normalizeVendorName(input: string): string {
  return input
    .toLowerCase()
    .replace(/,?\s*\b(inc|llc|ltd|corp|co)\.?$/i, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractDomain(url: string): string | null {
  const parsed = parseLooseHttpUrl(url);
  if (!parsed) return null;
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  // URL accepts single words. They are not evidence of a product domain
  // (e.g. a package named "react").
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(host)) return null;
  return host;
}

const EVIDENCE_TIER = DIRECTORY_ENTRIES.filter((entry): entry is EvidenceEntry => entry.evidence !== undefined);

/** Entries that may classify private evidence, in source order. */
export function evidenceTier(): readonly EvidenceEntry[] {
  return EVIDENCE_TIER;
}

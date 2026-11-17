import { directoryEntry, extractDomain, searchDirectory } from "@/src/domain/product-directory";
import { normalizeWebsite, resolveTypedCatalogProduct } from "@/src/domain/typed-product";
import type { TrayEntry, TypedResolution } from "./stack-tray";
import { errorMessage } from "@/src/domain/user-error";

function trayEntry(entry: TrayEntry): TrayEntry {
  return { slug: entry.slug, name: entry.name, domain: entry.domain };
}

function exactDirectoryName(name: string, domain: string) {
  const hit = searchDirectory(name, 1)[0];
  if (!hit || hit.name.toLowerCase() !== name.toLowerCase()) return null;
  return !domain || domain === hit.domain || domain.endsWith(`.${hit.domain}`) ? hit : null;
}

/**
 * Resolves a typed pick with the server's rules: a catalog name, alias or website
 * becomes that directory product, and a name and website that disagree are refused
 * with the server's message. A name spelled exactly like any directory product joins
 * as that product too, unless its website is off that product's domain: then it
 * stays the owner's own product with that website.
 */
export function resolveTypedPick(name: string, website?: string): TypedResolution {
  const trimmed = name.trim().replace(/\s+/g, " ");
  let normalized: string | undefined;
  let catalogSlug: string | undefined;
  try {
    normalized = normalizeWebsite(website);
    catalogSlug = resolveTypedCatalogProduct(trimmed, normalized)?.product.slug;
  } catch (error) {
    return { kind: "refused", message: errorMessage(error, "Correct the name or website.") };
  }
  const domain = normalized ? extractDomain(normalized) ?? "" : "";
  const entry = catalogSlug ? directoryEntry(catalogSlug) : exactDirectoryName(trimmed, domain);
  return entry ? { kind: "directory", entry: trayEntry(entry) } : { kind: "typed", domain };
}

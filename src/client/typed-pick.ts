import { directoryEntry, searchDirectory } from "@/src/domain/product-directory";
import { normalizeWebsite, resolveTypedCatalogProduct } from "@/src/domain/typed-product";
import type { TrayEntry, TypedResolution } from "./stack-tray";

function trayEntry(entry: TrayEntry): TrayEntry {
  return { slug: entry.slug, name: entry.name, domain: entry.domain };
}

function exactDirectoryName(name: string) {
  const hit = searchDirectory(name, 1)[0];
  return hit && hit.name.toLowerCase() === name.toLowerCase() ? hit : null;
}

/**
 * Resolves a typed pick with the server's rules: a catalog name, alias or website
 * becomes that directory product, and a name and website that disagree are refused
 * with the server's message. A name spelled exactly like any directory product joins
 * as that product too.
 */
export function resolveTypedPick(name: string, website?: string): TypedResolution {
  const trimmed = name.trim().replace(/\s+/g, " ");
  let catalogSlug: string | undefined;
  try {
    catalogSlug = resolveTypedCatalogProduct(trimmed, normalizeWebsite(website))?.product.slug;
  } catch (error) {
    return { kind: "refused", message: error instanceof Error ? error.message : "Correct the name or website." };
  }
  const entry = catalogSlug ? directoryEntry(catalogSlug) : exactDirectoryName(trimmed);
  return entry ? { kind: "directory", entry: trayEntry(entry) } : { kind: "typed" };
}

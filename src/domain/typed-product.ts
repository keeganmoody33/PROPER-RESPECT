import { extractDomain, resolveCatalogProduct, resolveCatalogProductWebsite, type DraftProposal } from "./discovery";
import { allowsWebProtocol } from "./http-url";

// The server applies these rules to a product typed by name, and the stack
// picker applies the same ones before save, so both resolve it alike.

export function normalizeWebsite(input: string | undefined): string | undefined {
  const value = input?.trim();
  if (!value) return undefined;
  if (value.length > 2048) throw new Error("The product website is too long.");
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  let url: URL;
  try { url = new URL(candidate); } catch { throw new Error("Use a public HTTP or HTTPS product website, or leave it blank."); }
  if (!extractDomain(candidate) || !allowsWebProtocol(url) || url.port) {
    throw new Error("Use a public HTTP or HTTPS product website without credentials, or leave it blank.");
  }
  url.hash = "";
  return url.href;
}

/** The catalog product a typed name or its normalized website points to; throws when the two disagree. */
export function resolveTypedCatalogProduct(name: string, website: string | undefined): Pick<DraftProposal, "product" | "canonicalUrl"> | undefined {
  const named = resolveCatalogProduct({ vendor: name });
  const byWebsite = website ? resolveCatalogProductWebsite(website) : undefined;
  if (named && website) {
    const websiteFamily = byWebsite ?? resolveCatalogProduct({ url: website });
    const specificProductConflict = byWebsite && byWebsite.product.slug !== named.product.slug && new URL(website).pathname.replace(/\/+$/, "") !== "";
    // A named subproduct may use its company's root website. An explicitly
    // cataloged destination for a different product must not override the name.
    if (!websiteFamily || websiteFamily.product.domain !== named.product.domain || specificProductConflict) {
      throw new Error("That website does not match the named catalog product. Correct the name or website.");
    }
  }
  return named ?? byWebsite ?? undefined;
}

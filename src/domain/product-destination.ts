import { extractDomain } from "./discovery.ts";

export type DestinationProduct = {
  name: string;
  slug: string;
  domain: string;
};

export type DestinationLink = {
  type: "CANONICAL" | "AFFILIATE" | "REFERRAL" | "INVITE";
  url: string;
  label: string;
  isPrimary?: boolean;
};

export type AssociatedAccountEvidence = {
  relationshipOwnerId: string;
  evidenceOwnerId: string;
  productSlug: string;
  accountId?: string;
  url?: string;
};

const GITHUB_LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const GITHUB_MARKETING_PATHS = new Set([
  "about", "apps", "codespaces", "collections", "copilot", "customer-stories",
  "enterprise", "events", "explore", "features", "issues", "join", "login",
  "marketplace", "new", "notifications", "organizations", "orgs", "pricing",
  "pulls", "readme", "search", "security", "settings", "sponsors", "topics",
]);

function parseHttpUrl(value: string): URL | null {
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
    const parsed = new URL(withScheme);
    if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password) return null;
    return parsed;
  } catch {
    return null;
  }
}

function productHost(product: DestinationProduct): string | null {
  return extractDomain(product.domain.includes("://") ? product.domain : `https://${product.domain}`);
}

function githubLogin(value: string): string | null {
  if (value.includes("@") || value.includes("/") || value.includes(" ")) return null;
  let login = value;
  try {
    login = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (!GITHUB_LOGIN.test(login) || GITHUB_MARKETING_PATHS.has(login.toLowerCase())) return null;
  return login;
}

/** Catalog homepage and www variants, not an owner account or product path. */
export function isProductWebsite(url: string, product: DestinationProduct): boolean {
  const parsed = parseHttpUrl(url);
  const host = extractDomain(url);
  const expected = productHost(product);
  if (!parsed || !host || !expected || host !== expected) return false;
  return parsed.pathname.replace(/\/+$/, "") === "";
}

function githubAccountProfileUrl(login: string): string {
  return `https://github.com/${encodeURIComponent(login)}`;
}

function githubAccountFromUrl(url: string, product: DestinationProduct, expectedLogin?: string): string | undefined {
  if (product.slug !== "github" || productHost(product) !== "github.com") return undefined;
  const parsed = parseHttpUrl(url);
  if (!parsed || extractDomain(url) !== "github.com") return undefined;
  const segments = parsed.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  if (segments.length !== 1) return undefined;
  const login = githubLogin(segments[0]);
  if (!login) return undefined;
  if (expectedLogin && login.toLowerCase() !== expectedLogin.toLowerCase()) return undefined;
  return githubAccountProfileUrl(login);
}

function associatedGitHubProfile(
  product: DestinationProduct,
  evidence: AssociatedAccountEvidence,
): string | undefined {
  if (evidence.evidenceOwnerId !== evidence.relationshipOwnerId) return undefined;
  if (evidence.productSlug !== product.slug) return undefined;
  if (product.slug !== "github" || productHost(product) !== "github.com") return undefined;
  const accountId = evidence.accountId ? githubLogin(evidence.accountId) ?? undefined : undefined;
  if (evidence.url) {
    const fromUrl = githubAccountFromUrl(evidence.url, product, accountId);
    if (fromUrl) return fromUrl;
  }
  return accountId ? githubAccountProfileUrl(accountId) : undefined;
}

/**
 * Private card destination. Owner-selected non-homepage links stay selected.
 * Associated GitHub account evidence may replace the product website on this
 * private surface only. Publication keeps using stored primary links.
 */
export function privateCardPrimaryLink(input: {
  product: DestinationProduct;
  links: DestinationLink[];
  associatedEvidence: AssociatedAccountEvidence[];
}): DestinationLink | undefined {
  const selected = input.links.find(link => link.isPrimary);
  if (selected && !isProductWebsite(selected.url, input.product)) {
    return { type: selected.type, url: selected.url, label: selected.label };
  }
  const profile = input.associatedEvidence
    .map(item => associatedGitHubProfile(input.product, item))
    .find((url): url is string => Boolean(url));
  if (profile) {
    return {
      type: "CANONICAL",
      url: profile,
      label: selected?.label ?? `Check out ${input.product.name}`,
    };
  }
  if (selected) return { type: selected.type, url: selected.url, label: selected.label };
  if (input.product.domain) {
    return {
      type: "CANONICAL",
      url: `https://${input.product.domain}`,
      label: `Open ${input.product.name}`,
    };
  }
  return undefined;
}

/** Stored primary stays the publication default. Owner may opt into this private destination. */
export function offeredPrivatePublicationLink(input: {
  product: DestinationProduct;
  links: DestinationLink[];
  associatedEvidence: AssociatedAccountEvidence[];
}): DestinationLink | undefined {
  const stored = input.links.find(link => link.isPrimary);
  const storedUrl = stored?.url ?? (input.product.domain ? `https://${input.product.domain}` : undefined);
  const privateLink = privateCardPrimaryLink(input);
  if (!privateLink || !storedUrl || privateLink.url === storedUrl) return undefined;
  return privateLink;
}

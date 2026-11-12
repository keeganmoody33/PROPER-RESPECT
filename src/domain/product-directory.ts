import { isHttpsUrl, parseLooseHttpUrl } from "./http-url.ts";
import {
  DIRECTORY_ENTRIES,
  STARTER_SETS,
  type DirectoryEntry,
  type StarterRole,
  type StarterSetSource,
} from "./product-directory-entries.ts";

export type {
  DirectoryCategory,
  DirectoryEntry,
  StarterRole,
  StarterSetSource,
} from "./product-directory-entries.ts";

export type EvidenceEntry = DirectoryEntry & { evidence: NonNullable<DirectoryEntry["evidence"]> };

export type StarterSet = Readonly<{
  role: StarterRole;
  label: string;
  blurb: string;
  entries: readonly DirectoryEntry[];
}>;

export const DIRECTORY_SEARCH_LIMIT = 20;

export type Directory = Readonly<{
  entry: (slug: string) => DirectoryEntry | null;
  search: (text: string, limit?: number) => DirectoryEntry[];
  domainOwner: (domain: string) => DirectoryEntry | null;
  starterSets: readonly StarterSet[];
  evidenceTier: readonly EvidenceEntry[];
}>;

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

// The 39-character limit matches the card key. manual- and host- belong to
// per-user and evidence-derived identities, never to a shared directory entry.
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,38}$/;
const RESERVED_SLUG_PREFIXES = ["manual-", "host-"] as const;

// Unlike normalizeVendorName, a typed prefix such as "co" must not collapse to
// nothing, so corporate suffixes are kept.
function searchKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

// Best first: exact, prefix, then the prefix of any word. A hit's rank is its index.
const MATCHERS: readonly ((key: string, query: string) => boolean)[] = [
  (key, query) => key === query,
  (key, query) => key.startsWith(query),
  (key, query) => key.split(" ").some(word => word.startsWith(query)),
];

function matchRank(keys: readonly string[], query: string): number | null {
  const rank = MATCHERS.findIndex(matches => keys.some(key => matches(key, query)));
  return rank < 0 ? null : rank;
}

function rootDomain(entry: DirectoryEntry): string | null {
  const url = parseLooseHttpUrl(entry.website);
  if (!url || url.pathname !== "/" || url.search || url.hash) return null;
  return extractDomain(entry.website) === entry.domain ? entry.domain : null;
}

function checkEntry(entry: DirectoryEntry): void {
  const { slug } = entry;
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(`Directory slug "${slug}" must be lowercase letters, digits and hyphens, at most 39 characters.`);
  }
  const reserved = RESERVED_SLUG_PREFIXES.find(prefix => slug.startsWith(prefix));
  if (reserved) throw new Error(`Directory slug "${slug}" uses the reserved ${reserved} namespace.`);
  if (!searchKey(entry.name)) throw new Error(`Directory entry "${slug}" needs a name.`);
  if (entry.aliases.some(alias => !searchKey(alias))) throw new Error(`Directory entry "${slug}" has an empty alias.`);
  if (extractDomain(entry.domain) !== entry.domain) {
    throw new Error(`Directory entry "${slug}" domain "${entry.domain}" must be a lowercase host without www.`);
  }
  if (!isHttpsUrl(entry.website)) {
    throw new Error(`Directory entry "${slug}" website must be https without credentials.`);
  }
  const url = parseLooseHttpUrl(entry.website);
  if (!url || url.port) throw new Error(`Directory entry "${slug}" website must not name a port.`);
  const host = extractDomain(entry.website);
  if (host !== entry.domain && !host?.endsWith(`.${entry.domain}`)) {
    throw new Error(`Directory entry "${slug}" website is not on ${entry.domain}.`);
  }
}

/** Builds every index once and throws on the first invalid entry or starter set. */
export function parseDirectory(
  entries: readonly DirectoryEntry[],
  starters: readonly StarterSetSource[],
): Directory {
  const bySlug = new Map<string, DirectoryEntry>();
  const byName = new Map<string, string>();
  const rootOwners = new Map<string, DirectoryEntry>();
  const evidenceAliases = new Map<string, string>();

  for (const entry of entries) {
    checkEntry(entry);
    if (bySlug.has(entry.slug)) throw new Error(`Directory slug "${entry.slug}" is listed twice.`);
    bySlug.set(entry.slug, entry);

    const name = searchKey(entry.name);
    const sameName = byName.get(name);
    if (sameName) throw new Error(`Directory entries "${sameName}" and "${entry.slug}" share the name "${entry.name}".`);
    byName.set(name, entry.slug);

    const root = rootDomain(entry);
    const owner = root ? rootOwners.get(root) : undefined;
    if (owner) throw new Error(`Directory entries "${owner.slug}" and "${entry.slug}" both claim the root of ${root}.`);
    if (root) rootOwners.set(root, entry);

    if (entry.evidence) {
      for (const alias of new Set(entry.aliases.map(normalizeVendorName))) {
        const holder = evidenceAliases.get(alias);
        if (holder) throw new Error(`Evidence entries "${holder}" and "${entry.slug}" share the alias "${alias}".`);
        evidenceAliases.set(alias, entry.slug);
      }
    }
  }

  const roles = new Set<StarterRole>();
  const starterSets = starters.map((set): StarterSet => {
    if (roles.has(set.role)) throw new Error(`Starter set "${set.role}" is listed twice.`);
    roles.add(set.role);
    if (new Set(set.slugs).size !== set.slugs.length) throw new Error(`Starter set "${set.role}" repeats a slug.`);
    const resolved = set.slugs.map(slug => {
      const entry = bySlug.get(slug);
      if (!entry) throw new Error(`Starter set "${set.role}" names "${slug}", which is not in the directory.`);
      return entry;
    });
    return { role: set.role, label: set.label, blurb: set.blurb, entries: resolved };
  });

  const searchable = entries.map(entry => ({
    entry,
    keys: [entry.name, ...entry.aliases, entry.domain].map(searchKey),
  }));

  return {
    entry: slug => bySlug.get(slug) ?? null,
    search: (text, limit = DIRECTORY_SEARCH_LIMIT) => {
      const query = searchKey(text);
      if (!query) return [];
      return searchable
        .flatMap(({ entry, keys }) => {
          const rank = matchRank(keys, query);
          return rank === null ? [] : [{ entry, rank }];
        })
        .sort((a, b) => a.rank - b.rank || a.entry.name.localeCompare(b.entry.name, "en"))
        .slice(0, limit)
        .map(hit => hit.entry);
    },
    domainOwner: domain => {
      const host = extractDomain(domain);
      return host ? rootOwners.get(host) ?? null : null;
    },
    starterSets,
    evidenceTier: entries.filter((entry): entry is EvidenceEntry => entry.evidence !== undefined),
  };
}

const DIRECTORY = parseDirectory(DIRECTORY_ENTRIES, STARTER_SETS);

/** The only way to turn a client-sent slug into a directory identity. */
export function directoryEntry(slug: string): DirectoryEntry | null {
  return DIRECTORY.entry(slug);
}

/** Typeahead over names, aliases and domains: exact, then prefix, then word prefix, then name. */
export function searchDirectory(text: string, limit?: number): DirectoryEntry[] {
  return DIRECTORY.search(text, limit);
}

/** The entry whose website is the bare root of this domain: github.com is GitHub, never GitHub Copilot. */
export function directoryDomainOwner(domain: string): DirectoryEntry | null {
  return DIRECTORY.domainOwner(domain);
}

export function starterSets(): readonly StarterSet[] {
  return DIRECTORY.starterSets;
}

/** Entries that may classify private evidence, in source order. */
export function evidenceTier(): readonly EvidenceEntry[] {
  return DIRECTORY.evidenceTier;
}

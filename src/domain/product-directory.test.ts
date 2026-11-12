import { describe, expect, it } from "vitest";
import {
  directoryDomainOwner,
  directoryEntry,
  evidenceTier,
  parseDirectory,
  searchDirectory,
  starterSets,
  type DirectoryEntry,
  type StarterSetSource,
} from "./product-directory";

const tidal: DirectoryEntry = {
  slug: "tidal", name: "TIDAL", domain: "tidal.com", website: "https://tidal.com",
  description: "Music streaming.", aliases: [], category: "CONSUMER",
};
const coda: DirectoryEntry = {
  slug: "coda", name: "Coda", domain: "coda.io", website: "https://coda.io",
  description: "Docs that work like apps.", aliases: [], category: "PRODUCTIVITY",
};
const salesNavigator: DirectoryEntry = {
  slug: "linkedin-sales-navigator", name: "LinkedIn Sales Navigator", domain: "linkedin.com",
  website: "https://business.linkedin.com/sales-solutions/sales-navigator",
  description: "Prospecting on LinkedIn.", aliases: ["sales nav"], category: "SALES",
};
const linkedin: DirectoryEntry = {
  slug: "linkedin", name: "LinkedIn", domain: "linkedin.com", website: "https://www.linkedin.com",
  description: "Professional network.", aliases: [], category: "COMMUNICATION",
};
const fixtures = [tidal, coda, salesNavigator, linkedin];

function build(entries: readonly DirectoryEntry[], starters: readonly StarterSetSource[] = []) {
  return parseDirectory(entries, starters);
}

describe("parseDirectory search", () => {
  const directory = build(fixtures);

  it("finds entries by name prefix, alias, word prefix and domain", () => {
    expect(directory.search("tid").map(entry => entry.slug)).toEqual(["tidal"]);
    expect(directory.search("sales nav").map(entry => entry.slug)).toEqual(["linkedin-sales-navigator"]);
    expect(directory.search("navigator").map(entry => entry.slug)).toEqual(["linkedin-sales-navigator"]);
    expect(directory.search("coda.io").map(entry => entry.slug)).toEqual(["coda"]);
  });

  it("keeps a short prefix that looks like a corporate suffix", () => {
    expect(directory.search("co").map(entry => entry.slug)).toEqual(["coda"]);
  });

  it("orders an exact match before prefixes, then by name, and honors the limit", () => {
    expect(directory.search("linkedin").map(entry => entry.slug)).toEqual(["linkedin", "linkedin-sales-navigator"]);
    expect(directory.search("linkedin", 1).map(entry => entry.slug)).toEqual(["linkedin"]);
  });

  it("returns nothing for blank or unmatched text", () => {
    expect(directory.search("  ")).toEqual([]);
    expect(directory.search("spotify")).toEqual([]);
  });

  it("looks up slugs and root-domain owners", () => {
    expect(directory.entry("coda")).toBe(coda);
    expect(directory.entry("manual-coda")).toBeNull();
    expect(directory.domainOwner("linkedin.com")).toBe(linkedin);
    expect(directory.domainOwner("https://www.linkedin.com/in/someone")).toBe(linkedin);
    expect(directory.domainOwner("business.linkedin.com")).toBeNull();
    expect(directory.domainOwner("example.com")).toBeNull();
  });

  it("resolves starter sets in curated order", () => {
    const sets = build(fixtures, [{ role: "everyday", label: "Everyday", blurb: "Apps.", slugs: ["tidal", "coda"] }]).starterSets;
    expect(sets.map(set => [set.role, set.entries.map(entry => entry.slug)])).toEqual([["everyday", ["tidal", "coda"]]]);
  });
});

describe("parseDirectory validation", () => {
  it("rejects a duplicate slug", () => {
    expect(() => build([tidal, { ...coda, slug: "tidal" }])).toThrow('Directory slug "tidal" is listed twice.');
  });

  it("rejects the manual- and host- namespaces and malformed slugs", () => {
    expect(() => build([{ ...tidal, slug: "manual-tidal" }])).toThrow("reserved manual- namespace");
    expect(() => build([{ ...tidal, slug: "host-tidal" }])).toThrow("reserved host- namespace");
    expect(() => build([{ ...tidal, slug: "Tidal" }])).toThrow("lowercase letters, digits and hyphens");
    expect(() => build([{ ...tidal, slug: "t".repeat(40) }])).toThrow("at most 39 characters");
  });

  it("accepts only an https website without credentials", () => {
    expect(build([{ ...tidal, website: "https://tidal.com/browse" }]).entry("tidal")?.website).toBe("https://tidal.com/browse");
    for (const website of ["javascript:alert(1)", "data:text/html,x", "ftp://tidal.com/x", "https://user:pass@tidal.com", "http://tidal.com"]) {
      expect(() => build([{ ...tidal, website }])).toThrow('Directory entry "tidal" website must be https without credentials.');
    }
    expect(() => build([{ ...tidal, website: "https://tidal.com:8443" }])).toThrow("must not name a port");
    expect(() => build([{ ...tidal, website: "https://tidal.example.com" }])).toThrow("website is not on tidal.com");
  });

  it("rejects two root owners for one domain", () => {
    expect(() => build([linkedin, { ...tidal, slug: "linkedin-two", name: "LinkedIn Two", domain: "linkedin.com", website: "https://linkedin.com" }]))
      .toThrow('Directory entries "linkedin" and "linkedin-two" both claim the root of linkedin.com.');
  });

  it("rejects a repeated product name and a non-canonical domain", () => {
    expect(() => build([tidal, { ...coda, name: "Tidal" }])).toThrow('share the name "Tidal"');
    expect(() => build([{ ...tidal, domain: "www.tidal.com" }])).toThrow("must be a lowercase host without www");
  });

  it("rejects an alias shared by two evidence entries", () => {
    const withEvidence = (entry: DirectoryEntry, aliases: string[]) => ({ ...entry, aliases, evidence: { domains: [entry.domain] } });
    expect(() => build([withEvidence(tidal, ["stream"]), withEvidence(coda, ["Stream Inc"])]))
      .toThrow('Evidence entries "tidal" and "coda" share the alias "stream".');
    expect(build([withEvidence(tidal, ["stream"]), { ...coda, aliases: ["stream"] }]).evidenceTier.map(entry => entry.slug)).toEqual(["tidal"]);
  });

  it("rejects a starter set that names an unknown or repeated slug", () => {
    expect(() => build(fixtures, [{ role: "gtm-engineering", label: "GTM engineering", blurb: "x", slugs: ["gong"] }]))
      .toThrow('Starter set "gtm-engineering" names "gong", which is not in the directory.');
    expect(() => build(fixtures, [{ role: "gtm-engineering", label: "GTM engineering", blurb: "x", slugs: ["coda", "coda"] }]))
      .toThrow('Starter set "gtm-engineering" repeats a slug.');
  });
});

describe("the shipped directory", () => {
  it("names the root-domain owner, never a subproduct", () => {
    expect(directoryDomainOwner("github.com")?.slug).toBe("github");
    expect(directoryDomainOwner("devin.ai")?.slug).toBe("devin");
    expect(directoryDomainOwner("claude.com")).toBeNull();
  });

  it("looks up and searches catalog entries", () => {
    expect(directoryEntry("github-copilot")?.website).toBe("https://github.com/features/copilot");
    expect(directoryEntry("nope")).toBeNull();
    expect(searchDirectory("codeium").map(entry => entry.slug)).toEqual(["windsurf"]);
    expect(searchDirectory("github copilot").map(entry => entry.slug)).toEqual(["github-copilot"]);
  });

  it("keeps the evidence tier to the 38 catalog identities in their original order", () => {
    const slugs = evidenceTier().map(entry => entry.slug);
    expect(slugs.length).toBe(38);
    expect(slugs.slice(0, 5)).toEqual(["claude-code", "codex", "clay", "github", "github-copilot"]);
    expect(slugs.at(-1)).toBe("exa");
  });

  it("finds listed entries by name prefix and alias", () => {
    expect(searchDirectory("tid").map(entry => entry.slug)).toEqual(["tidal"]);
    expect(searchDirectory("twitter").map(entry => entry.slug)).toEqual(["x"]);
    expect(searchDirectory("sales nav").map(entry => entry.slug)).toEqual(["linkedin-sales-navigator"]);
    expect(directoryDomainOwner("linkedin.com")?.slug).toBe("linkedin");
    expect(directoryDomainOwner("apple.com")).toBeNull();
    expect(searchDirectory("brand.dev").map(entry => entry.slug)).toEqual(["context-dev"]);
    expect(searchDirectory("xai").map(entry => entry.slug)).toEqual(["grok-bot", "grok"]);
    expect(["porkbun.com", "dynadot.com", "elicit.com", "context.dev", "grok.com"].map(domain => directoryDomainOwner(domain)?.slug))
      .toEqual(["porkbun", "dynadot", "elicit", "context-dev", "grok"]);
    expect(evidenceTier().map(entry => entry.slug)).not.toEqual(expect.arrayContaining(["porkbun"]));
  });

  it("resolves every starter set in curated order", () => {
    expect(starterSets().map(set => [set.role, set.entries.length])).toEqual([
      ["gtm-engineering", 12], ["engineering", 10], ["design", 6], ["ai", 6], ["creator", 7], ["everyday", 8],
    ]);
    expect(starterSets()[0].entries.slice(0, 4).map(entry => entry.slug))
      .toEqual(["claude-code", "cursor", "github", "clay"]);
    expect(starterSets()[0]).toMatchObject({ label: "GTM engineering", blurb: "Data, scraping, agents and the infrastructure under them." });
    const enterpriseSales = ["salesforce", "hubspot", "outreach", "salesloft", "gong", "apollo", "zoominfo", "linkedin-sales-navigator", "mixmax"];
    expect(starterSets().flatMap(set => set.entries.map(entry => entry.slug)).filter(slug => enterpriseSales.includes(slug))).toEqual([]);
    expect(enterpriseSales.map(slug => directoryEntry(slug)?.slug)).toEqual(enterpriseSales);
  });
});

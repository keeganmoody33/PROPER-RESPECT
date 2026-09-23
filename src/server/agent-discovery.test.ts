import { afterEach, expect, it, vi } from "vitest";
import { agentCatalog, homepageMarkdown, productIdentity, publicSiteGuide } from "./agent-discovery";
import { contactIdentity } from "./trust-pages";

afterEach(() => vi.unstubAllEnvs());

it("links the app and contact page to the same factual creator on the configured origin", () => {
  vi.stubEnv("PUBLIC_SITE_ORIGIN", "https://canonical.example");
  vi.stubEnv("VERCEL_URL", "untrusted-preview.example");
  const app = productIdentity();
  expect(app).toMatchObject({
    "@type": "SoftwareApplication",
    name: "Proper Respect",
    url: "https://canonical.example/",
    sameAs: ["https://github.com/keeganmoody33/PROPER-RESPECT"],
    creator: {
      "@id": "https://canonical.example/about/contact#organization",
      "@type": "Organization",
      name: "lecturesfrom",
      address: { "@type": "PostalAddress", addressCountry: "US" },
      contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: "33@lecturesfrom.com" },
    },
  });
  expect(contactIdentity().mainEntity).toEqual({
    "@id": "https://canonical.example/about/contact#organization",
    "@type": "Organization",
    name: "lecturesfrom",
    address: { "@type": "PostalAddress", addressCountry: "US" },
    contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: "33@lecturesfrom.com" },
  });
  expect(app.creator).toEqual(contactIdentity().mainEntity);
  expect(app).not.toHaveProperty("address");
  expect(app).not.toHaveProperty("@graph");
  expect(JSON.stringify(app)).not.toMatch(/legalName|streetAddress|postalCode|aggregateRating|offers|untrusted-preview/);
});

it("includes the creator attribution and existing contact route in homepage Markdown", () => {
  vi.stubEnv("PUBLIC_SITE_ORIGIN", "https://canonical.example");
  expect(homepageMarkdown()).toContain("Created by lecturesfrom, a business in the United States.");
  expect(homepageMarkdown()).toContain("[Contact: 33@lecturesfrom.com](https://canonical.example/about/contact)");
});

it("publishes the AI Catalog transport version for ARD consumers", () => {
  vi.stubEnv("PUBLIC_SITE_ORIGIN", "https://public.example");

  expect(agentCatalog()).toHaveProperty("specVersion", "1.0");
});

it("advertises only the available public reading guide on the configured origin", () => {
  vi.stubEnv("PUBLIC_SITE_ORIGIN", "https://public.example");
  vi.stubEnv("VERCEL_URL", "untrusted-preview.example");

  const catalog = agentCatalog();
  expect(catalog.entries).toHaveLength(1);
  expect(catalog.entries[0]).toMatchObject({
    identifier: "urn:air:public.example:docs:public-profile",
    displayName: "Proper Respect public-profile reading guide",
    type: "text/markdown",
    url: "https://public.example/agents.md",
  });
  expect(catalog.entries[0]).not.toHaveProperty("data");
  expect(catalog.entries[0].description).toContain("not a remote MCP endpoint");
  expect(catalog.entries[0].representativeQueries).toHaveLength(2);
});

it("builds a compact public guide from configured canonical URLs and existing facts", () => {
  vi.stubEnv("PUBLIC_SITE_ORIGIN", "https://canonical.example");
  vi.stubEnv("VERCEL_URL", "untrusted-preview.example");
  const guide = publicSiteGuide();
  expect(guide.name).toBe(productIdentity().name);
  expect(guide.description).toBe(productIdentity().description);
  expect(guide.homepage).toBe("https://canonical.example/");
  expect(guide.documentation).toEqual({
    agents: "https://canonical.example/agents.md",
    authentication: "https://canonical.example/auth.md",
    homepageMarkdown: "https://canonical.example/index.md",
    origins: "https://canonical.example/about/origins.md",
    contact: "https://canonical.example/about/contact.md",
    privacy: "https://canonical.example/about/privacy.md",
  });
  expect(guide.profileReading).toMatchObject({ tool: "get_current_public_profile", input: {} });
  expect(guide.profileReading.procedure.join(" ")).toContain("supplied by the user");
  expect(guide.limits.join(" ")).toContain("Unknown usage is not zero");
  expect(JSON.stringify(guide)).not.toMatch(/untrusted-preview|lecturesfrom|keegan|token|credential/);
  expect(JSON.stringify(guide).length).toBeLessThan(2500);
});

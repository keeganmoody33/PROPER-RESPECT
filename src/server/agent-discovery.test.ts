import { afterEach, expect, it, vi } from "vitest";
import { agentCatalog, homepageMarkdown, productIdentity } from "./agent-discovery";
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

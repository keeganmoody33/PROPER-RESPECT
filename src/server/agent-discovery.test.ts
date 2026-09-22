import { afterEach, expect, it, vi } from "vitest";
import { agentCatalog } from "./agent-discovery";

afterEach(() => vi.unstubAllEnvs());

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

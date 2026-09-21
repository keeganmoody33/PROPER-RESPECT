import { expect, test } from "@playwright/test";

test("llms.txt is a plain-text description of the available public surface", async ({
  request,
}) => {
  const response = await request.get("/llms.txt");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/^text\/plain(?:;|$)/i);

  const body = await response.text();
  expect(body).toContain("# Proper Respect");
  expect(body).toContain("evidence-backed");
  expect(body).toContain("owner-approved");
  expect(body).toContain("get_current_public_profile accepts {}");
  expect(body).toContain("No public HTTP API, OpenAPI document, or remote MCP endpoint");
  expect(body).toContain("https://public.example/");
  expect(body).not.toContain("props.lecturesfrom.com");
  expect(body).not.toMatch(/<!doctype html|<html[\s>]/i);
});

test("an existing public profile still returns a successful HTML response", async ({
  request,
}) => {
  const response = await request.get("/keegan");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/^text\/html(?:;|$)/i);
});

for (const path of [
  "/no-such-linker",
  "/no-such-linker/unknown-route",
  "/openapi.json",
  "/mcp",
  "/developers",
  "/sandbox",
]) {
  test(`${path} returns HTTP 404 instead of implying an available resource`, async ({
    request,
  }) => {
    const response = await request.get(path);
    expect(response.status()).toBe(404);
  });
}

test("homepage advertises truthful identity and a working markdown alternate", async ({ request }) => {
  const response = await request.get("/");
  expect(response.headers()["content-type"]).toContain("text/html");
  expect(response.headers().link).toContain('</index.md>; rel="alternate"; type="text/markdown"');
  expect(response.headers().link).toContain('</sitemap.xml>; rel="sitemap"');
  const body = await response.text();
  const match = body.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  expect(match).not.toBeNull();
  const identity = JSON.parse(match![1]);
  expect(identity).toMatchObject({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Proper Respect",
    url: "https://public.example/",
    sameAs: ["https://github.com/keeganmoody33/PROPER-RESPECT"],
  });
  expect(identity).not.toHaveProperty("aggregateRating");
  expect(identity).not.toHaveProperty("offers");
  expect(identity).not.toHaveProperty("address");
});

test("markdown documents describe public capabilities without private data or invented credentials", async ({ request }) => {
  for (const path of ["/index.md", "/agents.md", "/auth.md"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/markdown");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    const body = await response.text();
    expect(body.startsWith("# "), path).toBe(true);
    expect(body).toContain("https://public.example/");
    expect(body).not.toMatch(/<!doctype html|<html[\s>]|props\.lecturesfrom\.com|Private source record/i);
  }
  const guide = await (await request.get("/agents.md")).text();
  expect(guide).toContain("## When to use Proper Respect");
  expect(guide).toContain("get_current_public_profile accepts {}");
  expect(guide).toContain("No public HTTP API, OpenAPI document, or remote MCP endpoint");
  expect(guide).toContain("/blob/main/AGENTS.md");
  const auth = await (await request.get("/auth.md")).text();
  expect(auth).toContain("No agent API keys or OAuth token exchange");
  expect(auth).toContain("Do not extract session cookies");
});

test("robots, factual sitemap date and ARD link only to available public resources", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Sitemap: https://public.example/sitemap.xml");
  expect(await robots.text()).toContain("Agentmap: https://public.example/.well-known/ard.json");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("<lastmod>2026-09-21T00:00:00.000Z</lastmod>");
  expect(sitemap).not.toMatch(/collection|origins|private-owner/);
  const response = await request.get("/.well-known/ard.json");
  expect(response.status()).toBe(200);
  expect(response.headers()["access-control-allow-origin"]).toBe("*");
  const catalog = await response.json();
  expect(catalog.entries).toHaveLength(1);
  expect(catalog.entries[0]).toMatchObject({
    identifier: "urn:air:public.example:docs:public-profile",
    type: "text/markdown",
    url: "https://public.example/agents.md",
  });
  expect(catalog.entries[0]).not.toHaveProperty("data");
  expect(catalog.entries[0].representativeQueries).toHaveLength(2);
});

import { parseMarkdownDocument } from "../markdown-document";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
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
  expect(body).toBe(parseMarkdownDocument(await (await request.get("/agents.md")).text()).body);
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
  const creator = {
    "@id": "https://public.example/about/contact#organization",
    "@type": "Organization",
    name: "lecturesfrom",
    address: { "@type": "PostalAddress", addressCountry: "US" },
    contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: "33@lecturesfrom.com" },
  };
  expect(identity.creator).toEqual(creator);
  const contact = await request.get("/about/contact");
  expect(contact.status()).toBe(200);
  const contactScript = (await contact.text()).match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  expect(contactScript).not.toBeNull();
  const contactIdentity = JSON.parse(contactScript![1]);
  expect(contactIdentity["@type"]).toBe("ContactPage");
  expect(contactIdentity.mainEntity).toEqual(creator);
});

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`creator attribution is readable and linked at ${viewport.width}px`, async ({ page, request }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const attribution = page.locator("main p").filter({ hasText: "Created by lecturesfrom, a business in the United States." });
    await attribution.scrollIntoViewIfNeeded();
    await expect(attribution).toBeVisible();
    await expect(attribution).toHaveText("Created by lecturesfrom, a business in the United States. Contact: 33@lecturesfrom.com.");
    await expect(attribution.getByRole("link", { name: "Contact: 33@lecturesfrom.com" })).toHaveAttribute("href", "/about/contact");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const markdown = parseMarkdownDocument(await (await request.get("/index.md")).text());
    expect(markdown.body).toContain("Created by lecturesfrom, a business in the United States. [Contact: 33@lecturesfrom.com](https://public.example/about/contact).");
    await attribution.getByRole("link").click();
    await expect(page).toHaveURL(/\/about\/contact$/);
    await expect(page.getByRole("heading", { name: "Contact Proper Respect", exact: true })).toBeVisible();
  });
}

test("markdown documents describe public capabilities without private data or invented credentials", async ({ request }) => {
  for (const path of ["/index.md", "/agents.md", "/auth.md"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/markdown");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    const body = await response.text();
    if (path === "/auth.md") {
      expect(body).toMatch(/^# Proper Respect authentication\n/);
      expect(body.length).toBeGreaterThan(200);
    } else {
      const document = parseMarkdownDocument(body);
      expect(document.body.startsWith("# "), path).toBe(true);
      expect(document.metadata.title).toEqual(expect.any(String));
      expect(document.metadata.canonical).toBe(`https://public.example${path === "/index.md" ? "/" : path}`);
    }
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
  expect(sitemap).toContain("<lastmod>2026-09-23T00:00:00.000Z</lastmod>");
  expect(sitemap).not.toMatch(/collection|private-owner/);
  const response = await request.get("/.well-known/ard.json");
  expect(response.status()).toBe(200);
  expect(response.headers()["access-control-allow-origin"]).toBe("*");
  const catalog = await response.json();
  expect(catalog.specVersion).toBe("1.0");
  expect(catalog.entries).toHaveLength(1);
  expect(catalog.entries[0]).toMatchObject({
    identifier: "urn:air:public.example:docs:public-profile",
    type: "text/markdown",
    url: "https://public.example/agents.md",
  });
  expect(catalog.entries[0]).not.toHaveProperty("data");
  expect(catalog.entries[0].representativeQueries).toHaveLength(2);
});

for (const path of ["/.well-known/agent-skills", "/.well-known/agent-skills/"]) {
  test(`${path} serves the public agent instructions with GET and HEAD`, async ({ request }) => {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/^text\/markdown(?:;|$)/i);
    expect(response.headers()["access-control-allow-origin"]).toBe("*");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    const body = await response.text();
    expect(parseMarkdownDocument(body).body.startsWith("# Proper Respect")).toBe(true);
    expect(body).toContain("## When to use Proper Respect");
    expect(body).toBe(await (await request.get("/agents.md")).text());
    const head = await request.head(path);
    expect(head.status()).toBe(200);
    expect(head.headers()["content-type"]).toBe(response.headers()["content-type"]);
    expect(head.headers()["access-control-allow-origin"]).toBe("*");
    expect(head.headers()["x-content-type-options"]).toBe("nosniff");
    expect(await head.body()).toHaveLength(0);
  });
}

test("public skill discovery downloads the exact indexed bytes with GET and HEAD", async ({ request }) => {
  const indexPath = "/.well-known/agent-skills/index.json";
  const response = await request.get(indexPath);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/^application\/json(?:;|$)/i);
  expect(response.headers()["access-control-allow-origin"]).toBe("*");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(await response.body()).toEqual(await readFile(`public${indexPath}`));
  const index = await response.json();
  expect(index.$schema).toBe("https://schemas.agentskills.io/discovery/0.2.0/schema.json");
  expect(index.skills).toHaveLength(1);
  const skill = index.skills[0];
  expect(skill).toMatchObject({ name: "read-public-profile", type: "skill-md" });
  expect(skill.url).toBe("/agent-plugins/proper-respect/skills/read-public-profile/SKILL.md");
  const download = await request.get(skill.url);
  expect(download.status()).toBe(200);
  expect(download.headers()["content-type"]).toMatch(/^text\/(?:markdown|plain)(?:;|$)/i);
  expect(download.headers()["access-control-allow-origin"]).toBe("*");
  expect(download.headers()["x-content-type-options"]).toBe("nosniff");
  expect(await download.body()).toEqual(await readFile(`public${skill.url}`));
  expect(`sha256:${createHash("sha256").update(await download.body()).digest("hex")}`).toBe(skill.digest);
  for (const [url, expectedContentType] of [[indexPath, response.headers()["content-type"]], [skill.url, download.headers()["content-type"]]]) {
    const head = await request.head(url);
    expect(head.status()).toBe(200);
    expect(head.headers()["content-type"]).toBe(expectedContentType);
    expect(head.headers()["access-control-allow-origin"]).toBe("*");
    expect(head.headers()["x-content-type-options"]).toBe("nosniff");
    expect(await head.body()).toHaveLength(0);
  }
});

test("both public plugin manifests are downloadable without authentication", async ({ request }) => {
  const manifests = [];
  for (const file of ["plugin.json", ".codex-plugin/plugin.json"]) {
    const response = await request.get(`/agent-plugins/proper-respect/${file}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/^application\/json(?:;|$)/i);
    expect(response.headers()["access-control-allow-origin"]).toBe("*");
    manifests.push(await response.json());
  }
  expect(manifests[0].name).toBe(manifests[1].name);
  expect(manifests[0].author).toEqual(manifests[1].author);
  expect(manifests[1].skills).toBe("./skills/");
});

for (const path of [
  "/.well-known/agent-skills/missing/SKILL.md",
  "/agent-plugins/proper-respect/skills/missing/SKILL.md",
  "/agent-plugins/proper-respect/mcp.json",
]) {
  test(`${path} remains unavailable to GET and HEAD`, async ({ request }) => {
    expect((await request.get(path)).status()).toBe(404);
    expect((await request.head(path)).status()).toBe(404);
  });
}

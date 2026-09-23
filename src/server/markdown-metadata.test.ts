import { afterEach, expect, it, vi } from "vitest";
import { GET as homepage } from "@/app/index.md/route";
import { GET as agents } from "@/app/agents.md/route";
import { GET as skills } from "@/app/.well-known/agent-skills/route";
import { GET as authentication } from "@/app/auth.md/route";
import { GET as llms } from "@/app/llms.txt/route";
import { homepageMarkdown, authenticationMarkdown, productIdentity } from "./agent-discovery";
import { agentInstructions } from "./agent-instructions";
import { trustDocuments, trustMarkdown, trustMarkdownResponse } from "./trust-pages";
import { parseMarkdownDocument } from "@/tests/markdown-document";

afterEach(() => vi.unstubAllEnvs());

it("adds factual metadata while preserving every existing public document body", async () => {
  vi.stubEnv("PUBLIC_SITE_ORIGIN", "https://canonical.example");
  vi.stubEnv("VERCEL_URL", "untrusted-preview.example");
  const documents = [
    [homepage(), homepageMarkdown(), "Proper Respect", "/"],
    [agents(), agentInstructions(), "Proper Respect public-profile reading guide", "/agents.md"],
    [skills(), agentInstructions(), "Proper Respect public-profile reading guide", "/agents.md"],
    [authentication(), authenticationMarkdown(), "Proper Respect authentication", "/auth.md"],
    ...(["origins", "contact", "privacy"] as const).map(slug => [trustMarkdownResponse(slug), trustMarkdown(slug), trustDocuments[slug].title, `/about/${slug}`] as const),
  ] as const;
  for (const [response, expectedBody, title, path] of documents) {
    const text = await response.text();
    const parsed = parseMarkdownDocument(text);
    expect(parsed.metadata).toMatchObject({ title, canonical: `https://canonical.example${path}` });
    expect(Object.keys(parsed.metadata).sort()).toEqual(parsed.metadata.description ? ["canonical", "description", "title"] : ["canonical", "title"]);
    expect(parsed.body).toBe(expectedBody);
    expect(parsed.body).toMatch(/^# [^\n]+\n/);
    expect(text).not.toContain("untrusted-preview.example");
    expect(response.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
  }
  expect(parseMarkdownDocument(await homepage().text()).metadata.description).toBe(productIdentity().description);
});

it("leaves llms.txt as the exact existing plain-text guide", async () => {
  vi.stubEnv("PUBLIC_SITE_ORIGIN", "https://canonical.example");
  const response = llms();
  expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
  expect(await response.text()).toBe(agentInstructions());
  expect(agentInstructions()).toMatch(/^# Proper Respect\n/);
});

it("round-trips YAML-sensitive scalars without introducing metadata fields or changing the body", async () => {
  const { markdownWithMetadata } = await import("./markdown-metadata");
  const title = 'Title: "quoted" # [value] \\ path\n---\ncanonical: https://wrong.example\r\n';
  const description = "true: null\t\0\u0085\u2028\u2029 café — context";
  const body = "# Unchanged heading\n\nOriginal body.\n";
  const text = markdownWithMetadata(body, { title, description, canonical: new URL("https://canonical.example/auth.md") });
  expect(parseMarkdownDocument(text)).toEqual({ metadata: { title, description, canonical: "https://canonical.example/auth.md" }, body });
  expect(text).toContain(String.raw`\u0085\u2028\u2029`);
  expect(text).not.toMatch(/[\u0085\u2028\u2029]/);
  expect(text.split("\n").filter(line => line === "---")).toHaveLength(2);
});

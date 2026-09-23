import { NextRequest } from "next/server";
import { expect, it } from "vitest";
import { homepageRepresentation, prefersHomepageMarkdown } from "./homepage-representation";

it.each([
  ["text/markdown", true],
  ["TEXT/MARKDOWN; charset=\"UTF-8\"", true],
  ["text/html;q=0.5, text/markdown;q=0.9", true],
  ["text/markdown;q=0.9, text/*;q=0.5", true],
  ["text/html;q=0, text/markdown;q=0.1, */*;q=1", true],
  [null, false], ["", false], ["*/*", false], ["text/*", false],
  ["text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", false],
  ["text/markdown, text/html", false],
  ["text/markdown;q=0.5, text/html;q=0.9", false],
  ["text/markdown;q=0, */*;q=1", false],
  ["text/markdown;q=0.5, */*;q=1", false],
  ["application/json", false],
  ["text/markdown;variant=GFM", false],
  ["text/markdown;q=2", false],
  ["text/markdown;q=0.1234", false],
  ["text/markdown;q=oops", false],
  ["text/markdown;q=1;q=0", false],
  ["text/markdown; note=\"x,text/html\"", false],
  ["text/markdown; note=\"unterminated", false],
] as const)("negotiates %s as markdown=%s", (accept, markdown) => {
  expect(prefersHomepageMarkdown(accept)).toBe(markdown);
});

it.each(["GET", "HEAD"])("rewrites only root %s with explicit preference", method => {
  const response = homepageRepresentation(new NextRequest("https://request.example/?tracking=public", { method, headers: { accept: "text/markdown" } }));
  expect(response.headers.get("x-middleware-rewrite")).toBe("https://request.example/index.md");
  expect(response.headers.get("vary")).toBe("Accept");
});

it("varies normal HTML and leaves component Accept requests to Next", () => {
  for (const [url, accept] of [["https://request.example/", "text/html"], ["https://request.example/?_rsc=next", "text/x-component"]]) {
    const response = homepageRepresentation(new NextRequest(url, { headers: { accept } }));
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("vary")).toBe("Accept");
  }
});

it.each(["/app/collection", "/onboarding", "/sign-in", "/sign-up/a", "/__clerk/v1/client", "/api/connect/github", "/keegan", "/mcp", "/openapi.json", "/private-owner"])("does not create a markdown representation for %s", path => {
  const response = homepageRepresentation(new NextRequest(`https://request.example${path}`, { headers: { accept: "text/markdown" } }));
  expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  expect(response.headers.get("vary")).toBeNull();
});

it("leaves non-read methods untouched", () => {
  const response = homepageRepresentation(new NextRequest("https://request.example/", { method: "POST", headers: { accept: "text/markdown" } }));
  expect(response.headers.get("x-middleware-rewrite")).toBeNull();
});

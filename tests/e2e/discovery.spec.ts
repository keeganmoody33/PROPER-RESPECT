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
  expect(body).toContain("No documented public API, OpenAPI document, MCP endpoint, or WebMCP tools");
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
  "/robots.txt",
]) {
  test(`${path} returns HTTP 404 instead of implying an available resource`, async ({
    request,
  }) => {
    const response = await request.get(path);
    expect(response.status()).toBe(404);
  });
}

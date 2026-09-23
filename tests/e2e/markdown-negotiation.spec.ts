import { expect, test } from "@playwright/test";

test("root GET/HEAD negotiates the exact existing public Markdown representation", async ({ request }, info) => {
  const explicit = await request.get("/index.md");
  const expected = await explicit.text();
  expect(expected).toMatch(/^# Proper Respect\n/);
  for (const path of ["/", "/?campaign=public"]) {
    const response = await request.get(path, { headers: { Accept: "text/markdown" } });
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("text/markdown; charset=utf-8");
    expect(response.headers().vary.toLowerCase().split(/,\s*/)).toContain("accept");
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["content-location"]).toBe("https://public.example/index.md");
    expect(response.headers().link).toContain('<https://public.example/>; rel="canonical"');
    expect(await response.text()).toBe(expected);
    const head = await request.head(path, { headers: { Accept: "text/markdown" } });
    expect(head.status()).toBe(200);
    expect(await head.body()).toHaveLength(0);
    for (const name of ["content-type", "content-location", "link"]) expect(head.headers()[name]).toBe(response.headers()[name]);
    if (info.config.metadata.preview) expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  }
});

test("qualities, specificity and browser defaults determine representation", async ({ request }) => {
  for (const [accept, type] of [
    ["text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "text/html"],
    ["*/*", "text/html"],
    ["text/markdown,text/html", "text/html"],
    ["text/markdown;q=0, */*;q=1", "text/html"],
    ["text/markdown;q=0.5, text/html;q=0.9", "text/html"],
    ["text/markdown;q=0.9, text/html;q=0.5", "text/markdown"],
    ["text/html;q=0, text/markdown;q=0.1, */*;q=1", "text/markdown"],
  ]) {
    const response = await request.get("/", { headers: { Accept: accept } });
    expect(response.status(), accept).toBe(200);
    expect(response.headers()["content-type"], accept).toContain(type);
  }
});

test("normal browser navigation and RSC requests retain HTML and Next semantics", async ({ page, request }, info) => {
  const response = await page.goto("/");
  expect(response?.headers()["content-type"]).toContain("text/html");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  if (info.config.metadata.preview) await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex, nofollow/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /^https:\/\/public\.example\/?$/);
  expect(response?.headers().link).toContain('</index.md>; rel="alternate"; type="text/markdown"');
  if (info.config.metadata.production) expect(response?.headers()["cache-control"]).toContain("no-store");
  const rsc = await request.get("/?_rsc", { headers: { Accept: "text/x-component", RSC: "1" } });
  expect(rsc.headers()["content-type"]).toContain("text/x-component");
});

test("the same Accept produces the same text for browser and agent user agents", async ({ request }) => {
  const bodies = await Promise.all(["Mozilla/5.0", "ExampleReaderBot/1.0"].map(async agent => {
    const response = await request.get("/", { headers: { Accept: "text/markdown", "User-Agent": agent } });
    return response.text();
  }));
  expect(bodies[0]).toBe(bodies[1]);
});

test("unsupported and private paths never become homepage Markdown", async ({ request }) => {
  for (const path of ["/mcp", "/openapi.json", "/private-owner", "/no-such-linker/unknown-route"]) {
    const response = await request.get(path, { headers: { Accept: "text/markdown" } });
    expect(response.status(), path).toBe(404);
    expect(response.headers()["content-type"], path).not.toContain("text/markdown");
  }
  // With Clerk disabled, sign-in/up can error. Compare unchanged status and noindex, not login success.
  for (const path of ["/app/collection", "/sign-in", "/sign-up"]) {
    const response = await request.get(path, { headers: { Accept: "text/markdown" } });
    const html = await request.get(path, { headers: { Accept: "text/html" } });
    expect(response.status(), path).toBe(html.status());
    expect(response.headers()["content-type"], path).toContain("text/html");
    expect(await response.text(), path).toMatch(/name="robots" content="noindex, nofollow"/);
  }
  const onboarding = await request.get("/onboarding", { maxRedirects: 0, headers: { Accept: "text/markdown" } });
  expect(onboarding.status()).toBe(307);
  expect(onboarding.headers().location).toBe("/app/collection");
});

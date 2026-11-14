import { expect, test } from "@playwright/test";

for (const path of ["/", "/keegan", "/app/collection"]) {
  test(`${path} carries the baseline security headers`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 });
    const headers = response.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=(), payment=()");
    expect(headers["content-security-policy-report-only"]).toContain("report-uri /api/csp-report");
    expect(headers["reporting-endpoints"]).toBe('csp-endpoint="/api/csp-report"');
    if (path.startsWith("/app")) {
      expect(headers["x-frame-options"]).toBe("DENY");
      expect(headers["content-security-policy"]).toBe("frame-ancestors 'none'");
    } else {
      expect(headers["x-frame-options"]).toBeUndefined();
    }
  });
}

test("the CSP report endpoint accepts a report", async ({ request }) => {
  const response = await request.post("/api/csp-report", {
    headers: { "Content-Type": "application/csp-report" },
    data: JSON.stringify({ "csp-report": { "effective-directive": "img-src", "blocked-uri": "https://img.example/a.png" } }),
  });
  expect(response.status()).toBe(204);
});

test("a brand logo served from this site keeps its own lock-down policy alongside the site's headers", async ({ request }) => {
  // Cloudflare's light wordmark from its committed snapshot; an SVG opened on its own must not run script.
  const response = await request.get("/api/brand-images/5019dab7-f07e-4e29-98bb-f8bb7b613877.svg");
  expect(response.status()).toBe(200);
  const headers = response.headers();
  expect(headers["content-type"]).toBe("image/svg+xml");
  expect(headers["content-security-policy"]).toBe("default-src 'none'; style-src 'unsafe-inline'; sandbox");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["content-security-policy-report-only"]).toContain("report-uri /api/csp-report");
  expect((await request.get("/api/brand-images/not-a-logo.svg")).status()).toBe(404);
  expect((await request.get("/api/brand-fonts/google/roboto/latest/x.ttf")).status()).toBe(404);
});

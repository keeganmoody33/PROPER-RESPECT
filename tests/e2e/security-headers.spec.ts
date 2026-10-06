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

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

const NOT_FOUND = 404;

test("the brand asset routes refuse anything but a provider file without fetching it, under the site's headers", async ({ request }) => {
  // A refused name is answered here, so no outside host is asked; the routes' own lock-down policy is covered by their unit tests.
  const paths = ["/api/brand-images/not-a-logo.svg", "/api/brand-fonts/google/roboto/latest/x.ttf"];
  const responses = await Promise.all(paths.map(path => request.get(path)));
  expect(responses.map(response => {
    const headers = response.headers();
    return [response.status(), headers["cache-control"], headers["x-content-type-options"], headers["content-security-policy"]];
  })).toEqual(paths.map(() => [NOT_FOUND, "no-store", "nosniff", undefined]));
  expect(responses.every(response => response.headers()["content-security-policy-report-only"].includes("report-uri /api/csp-report"))).toBe(true);
});

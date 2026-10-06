import { afterEach, expect, it, vi } from "vitest";
import { GET } from "@/app/api/analytics/searchable/route";

afterEach(() => vi.unstubAllEnvs());

it.each([undefined, "development", "preview"])("omits the frame outside production: %s", environment => {
  vi.stubEnv("VERCEL_ENV", environment);
  expect(GET(new Request("https://proper-respect.com/api/analytics/searchable?path=%2Fkeegan")).status).toBe(404);
});

it.each(["/app", "/app/collection/private", "/sign-in", "/sign-up", "/onboarding", "/admin", "/evidence-fixture", "/icon", "/apple-icon", "/agents", "/auth", "/index", "/keegan?secret=x", "/keegan#secret", "//attacker.test", "</script>"])("refuses frame path %s", path => {
  vi.stubEnv("VERCEL_ENV", "production");
  expect(GET(new Request(`https://proper-respect.com/api/analytics/searchable?path=${encodeURIComponent(path)}`)).status).toBe(404);
});

it("enforces opaque script-only isolation even when the frame endpoint is opened directly", async () => {
  vi.stubEnv("VERCEL_ENV", "production");
  const response = GET(new Request("https://proper-respect.com/api/analytics/searchable?path=%2Fkeegan"));
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Security-Policy")).toContain("sandbox allow-scripts");
  expect(response.headers.get("Content-Security-Policy")).not.toContain("allow-same-origin");
  expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  expect(response.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  const body = await response.text();
  expect(body).toContain('history.replaceState(null, "", "/keegan")');
  expect(body).toContain('event.source !== parent || event.origin !== parentOrigin');
  expect(body).toContain('tracker.dataset.cookie = "false"');
  expect(body).toContain('"-engagement,-scroll,-webvitals,-outbound,-ecommerce"');
  expect(body).not.toContain("allow-same-origin");
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { clerkFrontendApiHost, contentSecurityPolicyReportOnly } from "./security-headers";
import nextConfig from "@/next.config";

const SYNTHETIC_KEY = "pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk";
const liveKey = (host: string) => `pk_live_${Buffer.from(`${host}$`).toString("base64")}`;

afterEach(() => vi.unstubAllEnvs());

describe("Clerk Frontend API host", () => {
  it("decodes the synthetic CI key and a live key", () => {
    expect(clerkFrontendApiHost(SYNTHETIC_KEY)).toBe("example.clerk.accounts.dev");
    expect(clerkFrontendApiHost(liveKey("clerk.proper-respect.com"))).toBe("clerk.proper-respect.com");
  });

  it.each([undefined, "", "pk_test_", "pk_test_%%%", "sk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk",
    `pk_test_${Buffer.from("not a host$").toString("base64")}`, `pk_test_${Buffer.from("example.com").toString("base64")}`,
    // Buffer's decoder is lenient; these still decode to "example.clerk.accounts.dev$".
    `${SYNTHETIC_KEY}====`, "pk_test_ZXhhbXBsZS5j=bGVyay5hY2NvdW50cy5kZXYk", "pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk=",
    "pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk_-"])(
    "gives no host for a malformed key %s without throwing", key => {
      expect(clerkFrontendApiHost(key)).toBeUndefined();
    });
});

describe("report-only content security policy", () => {
  const directives = (policy: string) => Object.fromEntries(policy.split(";").map(part => part.trim()).filter(Boolean)
    .map(part => { const [name, ...values] = part.split(/\s+/); return [name, values]; }));

  it("allows the app, Clerk and Convex, and reports violations", () => {
    const policy = directives(contentSecurityPolicyReportOnly({ clerkHost: "example.clerk.accounts.dev", development: false }));
    expect(policy["default-src"]).toEqual(["'self'"]);
    expect(policy["script-src"]).toEqual(expect.arrayContaining(["'self'", "'unsafe-inline'", "https://example.clerk.accounts.dev", "https://challenges.cloudflare.com", "https://*.protect.clerk.com"]));
    expect(policy["script-src"]).not.toContain("'unsafe-eval'");
    expect(policy["connect-src"]).toEqual(expect.arrayContaining(["'self'", "https://example.clerk.accounts.dev", "https://*.protect.clerk.com:*", "https://*.convex.cloud", "wss://*.convex.cloud", "https://*.convex.site"]));
    expect(policy["img-src"]).toEqual(["'self'", "data:", "https:"]);
    expect(policy["font-src"]).toEqual(["'self'", "data:", "https:"]);
    expect(policy["worker-src"]).toEqual(["'self'", "blob:"]);
    expect(policy["style-src"]).toEqual(["'self'", "'unsafe-inline'"]);
    expect(policy["frame-src"]).toEqual(expect.arrayContaining(["https://challenges.cloudflare.com", "https://*.protect.clerk.com"]));
    expect(policy["report-uri"]).toEqual(["/api/csp-report"]);
    expect(policy["report-to"]).toEqual(["csp-endpoint"]);
    expect(policy).not.toHaveProperty("upgrade-insecure-requests");
  });

  it("adds unsafe-eval only in development, and leaves out a Clerk host it can't derive", () => {
    const policy = directives(contentSecurityPolicyReportOnly({ development: true }));
    expect(policy["script-src"]).toContain("'unsafe-eval'");
    expect(JSON.stringify(policy)).not.toContain("undefined");
  });
});

describe("next.config headers", () => {
  async function headersFor(path: string) {
    const rules = await nextConfig.headers!();
    const matches = (source: string) => {
      if (source === path) return true;
      const pattern = new RegExp(`^${source.replace(/\/:path\*$/, "(?:/.*)?").replace(/\(\?!/g, "(?!")}$`);
      return pattern.test(path);
    };
    const merged: Record<string, string> = {};
    for (const rule of rules) if (matches(rule.source)) for (const header of rule.headers) merged[header.key] = header.value;
    return merged;
  }

  it("sends the baseline headers everywhere and leaves HSTS to the platform", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", SYNTHETIC_KEY);
    for (const path of ["/", "/keegan", "/app/collection", "/about/privacy"]) {
      const headers = await headersFor(path);
      expect(headers["X-Content-Type-Options"]).toBe("nosniff");
      expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
      expect(headers["Permissions-Policy"]).toBe("camera=(), microphone=(), geolocation=(), payment=()");
      expect(headers["Content-Security-Policy-Report-Only"]).toContain("report-uri /api/csp-report");
      expect(headers["Reporting-Endpoints"]).toBe('csp-endpoint="/api/csp-report"');
      expect(headers).not.toHaveProperty("Strict-Transport-Security");
    }
  });

  it.each(["/app/collection", "/sign-in", "/sign-in/factor-one", "/sign-up"])("forbids framing %s", async path => {
    const headers = await headersFor(path);
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Content-Security-Policy"]).toBe("frame-ancestors 'none'");
  });

  it("keeps the homepage Link header and the agent-file headers", async () => {
    expect((await headersFor("/")).Link).toContain('rel="alternate"; type="text/markdown"');
    expect(await headersFor("/agent-plugins/proper-respect/plugin.json")).toMatchObject({
      "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "X-Content-Type-Options": "nosniff",
    });
  });
});

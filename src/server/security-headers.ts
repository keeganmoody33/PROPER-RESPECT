// Security headers for every response (R04). HSTS is left to the platform,
// which already sends a longer max-age than any value set here should.

const HOST_PATTERN = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(?:\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

/**
 * The Clerk Frontend API host encoded in a publishable key: strip the
 * pk_test_ or pk_live_ prefix, base64-decode, drop the trailing "$".
 * Anything else gives no host, so a malformed key never breaks the build.
 */
export function clerkFrontendApiHost(publishableKey: string | undefined): string | undefined {
  const match = /^pk_(?:test|live)_([A-Za-z0-9+/]+={0,2})$/.exec(publishableKey ?? "");
  if (!match) return undefined;
  const bytes = Buffer.from(match[1], "base64");
  // Buffer's decoder skips bad padding, so accept only the canonical encoding,
  // with or without its padding.
  const canonical = bytes.toString("base64");
  if (match[1] !== canonical && match[1] !== canonical.replace(/=+$/, "")) return undefined;
  const decoded = bytes.toString("utf8");
  if (!decoded.endsWith("$")) return undefined;
  const host = decoded.slice(0, -1).toLowerCase();
  return HOST_PATTERN.test(host) ? host : undefined;
}

/**
 * A starting report-only policy, following Next's "Without Nonces" guide
 * (nonces would force dynamic rendering of every page) and Clerk's CSP guide.
 * It leaves out upgrade-insecure-requests, which report-only mode ignores.
 */
export function contentSecurityPolicyReportOnly({ clerkHost, development }: { clerkHost?: string; development: boolean }) {
  const clerk = clerkHost ? [`https://${clerkHost}`] : [];
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // The inline theme bootstrap (app/layout.tsx) and Next's payload scripts need 'unsafe-inline'.
    "script-src": ["'self'", "'unsafe-inline'", ...(development ? ["'unsafe-eval'"] : []), ...clerk,
      "https://challenges.cloudflare.com", "https://*.protect.clerk.com"],
    // Evidence uploads POST to the Convex site URL.
    "connect-src": ["'self'", ...clerk, "https://*.protect.clerk.com:*", "https://clerk-telemetry.com",
      "https://*.clerk-telemetry.com", "https://*.convex.cloud", "wss://*.convex.cloud", "https://*.convex.site"],
    // Brand logos and fonts come from many hosts; Clerk needs https://img.clerk.com.
    "img-src": ["'self'", "data:", "https:"],
    "font-src": ["'self'", "data:", "https:"],
    "worker-src": ["'self'", "blob:"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "frame-src": ["'self'", "https://challenges.cloudflare.com", "https://*.protect.clerk.com"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "report-uri": ["/api/csp-report"],
    "report-to": ["csp-endpoint"],
  };
  return Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`).join("; ");
}

type HeaderRule = { source: string; headers: { key: string; value: string }[] };

export function securityHeaderRules(env: { publishableKey?: string; development: boolean }): HeaderRule[] {
  const noFraming = [
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  ];
  return [
    {
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicyReportOnly({
          clerkHost: clerkFrontendApiHost(env.publishableKey), development: env.development,
        }) },
        { key: "Reporting-Endpoints", value: 'csp-endpoint="/api/csp-report"' },
      ],
    },
    ...["/app/:path*", "/sign-in/:path*", "/sign-up/:path*"].map(source => ({ source, headers: noFraming })),
  ];
}

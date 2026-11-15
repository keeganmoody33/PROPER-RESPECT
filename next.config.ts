import type { NextConfig } from "next";
import { securityHeaderRules } from "./src/server/security-headers";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The homepage holds its examples row at a phone's foot, where the dev badge would sit on its first name. Errors still show.
  devIndicators: false,
  // Every visitor gets each page's metadata in its head, not streamed in later. Streamed metadata hydrates late,
  // and a visitor who followed a link before it did kept the old page's canonical link, beside or instead of the new one.
  // Matches any user agent, "Mozilla/5.0 (Macintosh) Chrome/142" and "bingbot/2.0" alike; it rejects none.
  // https://regex101.com/?regex=.*&testString=Mozilla%2F5.0%20(Macintosh)%20Chrome%2F142%0Abingbot%2F2.0
  htmlLimitedBots: /.*/,
  async headers() {
    // Later rules win for the same key, so the page-specific ones follow these.
    return [...securityHeaderRules({
      publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      development: process.env.NODE_ENV === "development",
    }), {
      source: "/",
      headers: [{ key: "Link", value: '</index.md>; rel="alternate"; type="text/markdown", </sitemap.xml>; rel="sitemap", </.well-known/ard.json>; rel="ard", </agents.md>; rel="describedby"; type="text/markdown"' }],
    }, ...[
      ["/.well-known/agent-skills/index.json", "application/json; charset=utf-8"],
      ["/agent-plugins/proper-respect/plugin.json", "application/json; charset=utf-8"],
      ["/agent-plugins/proper-respect/.codex-plugin/plugin.json", "application/json; charset=utf-8"],
      ["/agent-plugins/proper-respect/README.md", "text/markdown; charset=utf-8"],
      ["/agent-plugins/proper-respect/skills/read-public-profile/SKILL.md", "text/markdown; charset=utf-8"],
    ].map(([source, contentType]) => ({
      source,
      headers: [
        { key: "Content-Type", value: contentType },
        { key: "Access-Control-Allow-Origin", value: "*" },
        { key: "X-Content-Type-Options", value: "nosniff" },
      ],
    }))];
  },
  async redirects() {
    return [{ source: "/onboarding", destination: "/app/collection", permanent: false }];
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;

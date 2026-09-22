import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{
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

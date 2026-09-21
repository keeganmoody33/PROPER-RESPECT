import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{
      source: "/",
      headers: [{ key: "Link", value: '</index.md>; rel="alternate"; type="text/markdown", </sitemap.xml>; rel="sitemap", </.well-known/ard.json>; rel="ard", </agents.md>; rel="describedby"; type="text/markdown"' }],
    }];
  },
  async redirects() {
    return [{ source: "/onboarding", destination: "/app/collection", permanent: false }];
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;

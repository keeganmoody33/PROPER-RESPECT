import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [{ source: "/onboarding", destination: "/app/collection", permanent: false }];
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;

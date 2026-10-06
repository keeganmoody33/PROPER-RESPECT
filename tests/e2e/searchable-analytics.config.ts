import { defineConfig } from "@playwright/test";
import base from "../../playwright.config";

export default defineConfig({
  ...base,
  testDir: ".",
  testMatch: "searchable-analytics.spec.ts",
  outputDir: "../../test-results/searchable",
  use: { ...base.use, baseURL: "http://127.0.0.1:3041" },
  webServer: {
    command: "PROPER_RESPECT_E2E_REFERENCE=1 npm run dev -- --hostname 127.0.0.1 --port 3041",
    url: "http://127.0.0.1:3041",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
      CLERK_SECRET_KEY: "",
      NEXT_PUBLIC_CONVEX_URL: "",
      NEXT_PUBLIC_POSTHOG_KEY: "",
      PUBLIC_SITE_ORIGIN: "https://public.example",
      VERCEL_ENV: "production",
    },
  },
});

import { defineConfig } from "@playwright/test";
import base from "../../playwright.config";

export default defineConfig({
  ...base,
  testDir: ".",
  testMatch: "trust-pages.spec.ts",
  grep: /matching public/,
  metadata: { preview: true },
  webServer: {
    command: "PROPER_RESPECT_E2E_REFERENCE=1 npm run dev -- --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
      CLERK_SECRET_KEY: "",
      NEXT_PUBLIC_CONVEX_URL: "",
      PUBLIC_SITE_ORIGIN: "https://public.example",
      VERCEL_ENV: "preview",
    },
  },
});

import { defineConfig } from "@playwright/test";
import base from "../../playwright.config";

export default defineConfig({
  ...base,
  testDir: ".",
  testMatch: "markdown-negotiation.spec.ts",
  workers: 1,
  metadata: { production: process.env.NEGOTIATION_PRODUCTION === "1", preview: process.env.VERCEL_ENV === "preview" },
  use: { ...base.use, baseURL: "http://127.0.0.1:8883" },
  webServer: {
    command: process.env.NEGOTIATION_PRODUCTION === "1"
      ? "npm run start -- --hostname 127.0.0.1 --port 8883"
      : "npm run dev -- --webpack --hostname 127.0.0.1 --port 8883",
    url: "http://127.0.0.1:8883",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "", CLERK_SECRET_KEY: "", NEXT_PUBLIC_CONVEX_URL: "",
      PROPER_RESPECT_E2E_REFERENCE: "1", PUBLIC_SITE_ORIGIN: "https://public.example", NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});

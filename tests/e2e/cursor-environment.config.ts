import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
import base from "../../playwright.config";

export default defineConfig({
  ...base,
  testDir: ".",
  testMatch: ["public-profile.spec.ts"],
  webServer: {
    cwd: resolve(__dirname, "../.."),
    command: "node .cursor/start-fixture.mjs",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_CONVEX_URL: "https://poison.example",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "synthetic-poison",
      CLERK_SECRET_KEY: "synthetic-poison",
      NEXT_PUBLIC_POSTHOG_KEY: "synthetic-poison",
      CONVEX_DEPLOY_KEY: "synthetic-poison",
      PROPER_RESPECT_FIXTURE_PORT: "3000",
    },
  },
});

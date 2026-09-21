import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "profile.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: "../../test-results/native-webmcp",
  use: {
    ...devices["Desktop Chrome"],
    channel: "chrome",
    baseURL: "http://127.0.0.1:3001",
    trace: "retain-on-failure",
    launchOptions: {
      args: ["--enable-features=WebMCPTesting,DevToolsWebMCPSupport"],
    },
  },
  webServer: {
    env: {
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
      CLERK_SECRET_KEY: "",
      NEXT_PUBLIC_CONVEX_URL: "",
      PUBLIC_SITE_ORIGIN: "https://public.example",
      PROPER_RESPECT_E2E_REFERENCE: "1",
    },
    command: "npm run dev -- --hostname 127.0.0.1 --port 3001",
    cwd: "../..",
    url: "http://127.0.0.1:3001",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

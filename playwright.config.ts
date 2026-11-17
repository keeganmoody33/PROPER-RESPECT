import { defineConfig, devices } from "@playwright/test";

// Two checkouts can run the suite at once when each sets its own port.
const port = process.env.PROPER_RESPECT_E2E_PORT ?? "3000";
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: origin,
    trace: "on-first-retry",
    launchOptions: {
      args: ["--no-sandbox"],
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Fixture checks must not inherit real owner authentication or backend access.
    env: {
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
      CLERK_SECRET_KEY: "",
      NEXT_PUBLIC_CONVEX_URL: "",
      PUBLIC_SITE_ORIGIN: "https://public.example",
    },
    command:
      `PROPER_RESPECT_E2E_REFERENCE=1 npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: origin,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

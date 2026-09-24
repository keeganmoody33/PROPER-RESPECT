import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e", testMatch: "private-usage-card.spec.ts", fullyParallel: false,
  reporter: "list", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } },
});

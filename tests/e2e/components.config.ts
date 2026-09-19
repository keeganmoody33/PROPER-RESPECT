import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["product-card.spec.ts", "verified-product-assets.spec.ts"],
  outputDir: "../../test-results/components",
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    launchOptions: {
      args: ["--no-sandbox"],
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    },
  },
});

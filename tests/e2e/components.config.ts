import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["account-setup.spec.ts", "account-evidence.spec.ts", "product-card.spec.ts", "verified-product-assets.spec.ts", "discovery-review.spec.ts", "mailbox-discovery-run.spec.ts", "retained-mailbox-recheck.spec.ts"],
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

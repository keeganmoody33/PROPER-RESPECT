import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

const repository = resolve(__dirname, "../..");

export default defineConfig({
  testDir: ".",
  testMatch: "connection.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  reporter: "list",
  outputDir: "./artifacts",
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 1000 },
    baseURL: "http://127.0.0.1:4188",
    launchOptions: { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node tests/collector-browser/start.mjs",
    cwd: repository,
    url: "http://127.0.0.1:4188",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});

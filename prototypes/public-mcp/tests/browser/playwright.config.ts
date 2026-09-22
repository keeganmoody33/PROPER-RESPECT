import { defineConfig } from "@playwright/test";
import path from "node:path";
export default defineConfig({
  testDir: ".",
  testMatch: "panel.spec.ts",
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  outputDir: "../../test-results/browser",
  use: { baseURL: "http://127.0.0.1:8849", viewport: { width: 960, height: 900 }, trace: "retain-on-failure" },
  webServer: {
    command: "node tests/browser/start.mjs",
    cwd: path.resolve(import.meta.dirname, "../.."),
    url: "http://127.0.0.1:8849",
    reuseExistingServer: false,
    timeout: 30000,
  },
});

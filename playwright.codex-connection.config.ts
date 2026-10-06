import { defineConfig, devices } from "@playwright/test";

const browserEnvironment = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));

export default defineConfig({
  testDir: "./tests/prototypes",
  testMatch: "codex-connection.spec.ts",
  fullyParallel: true,
  workers: 2,
  retries: 0,
  reporter: "list",
  outputDir: "test-results/codex-connection",
  use: {
    baseURL: "http://127.0.0.1:4177",
    trace: "retain-on-failure",
    launchOptions: {
      args: ["--no-sandbox"],
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
      env: process.env.PLAYWRIGHT_BROWSER_HOME ? {
        ...browserEnvironment,
        HOME: process.env.PLAYWRIGHT_BROWSER_HOME,
        XDG_CONFIG_HOME: process.env.PLAYWRIGHT_BROWSER_HOME,
      } : undefined,
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1100 } } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
  webServer: {
    command: 'output=$(mktemp -d /tmp/proper-codex-preview.XXXXXX) && node scripts/codex-connection-preview.mjs --out "$output/site" && python3 -m http.server 4177 --bind 127.0.0.1 --directory "$output/site"',
    url: "http://127.0.0.1:4177",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});

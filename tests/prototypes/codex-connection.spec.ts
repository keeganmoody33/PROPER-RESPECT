import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function connectSample(page: Page) {
  await page.getByRole("button", { name: "Connect sample" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("2026-10-01 to 2026-10-08");
  await expect(page.getByRole("dialog")).toContainText("expires in 10 minutes");
  await page.getByRole("button", { name: "Approve and backfill" }).click();
  await expect(page.getByTestId("connection-phase")).toHaveText("Connected to fixture");
  await expect(page.getByTestId("observed-total")).toHaveText("150");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("consent, automatic backfill, replay, changed history and retained disconnect", async ({ page }, testInfo) => {
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== "http://127.0.0.1:4177") externalRequests.push(request.url());
  });
  // Include initial document and asset loads in the network proof.
  await page.reload();
  await expect(page.getByTestId("observed-total")).toHaveText("Not read");
  await expect(page.getByRole("button", { name: /fixture tokens/ })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath("before-connection.png"), fullPage: true });
  await connectSample(page);
  await expect(page.getByTestId("input-total")).toHaveText("120");
  await expect(page.getByTestId("output-total")).toHaveText("30");
  await expect(page.getByText("Account activity", { exact: true })).toBeVisible();
  await expect(page.getByText("Plan quota", { exact: true })).toBeVisible();
  await expect(page.getByText("Billed charges", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Sync again" }).click();
  await expect(page.getByTestId("connection-phase")).toHaveText("Connected to fixture");
  await expect(page.getByTestId("observed-total")).toHaveText("150");
  await expect(page.getByRole("status")).toContainText("Nothing was counted twice");
  await page.getByRole("button", { name: "Add 50 fixture tokens" }).click();
  await expect(page.getByTestId("observed-total")).toHaveText("200");
  await page.getByRole("button", { name: "Sync again" }).click();
  await expect(page.getByTestId("connection-phase")).toHaveText("Connected to fixture");
  await expect(page.getByTestId("observed-total")).toHaveText("200");
  await page.screenshot({ path: testInfo.outputPath("connected.png"), fullPage: true });
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", await page.locator("html").evaluate((html) => html.clientWidth));
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(page.getByTestId("connection-phase")).toHaveText("Disconnected");
  await expect(page.getByTestId("observed-total")).toHaveText("200");
  await expect(page.getByRole("status")).toContainText("until you reload");
  await expect(page.getByRole("button", { name: /fixture tokens/ })).toBeDisabled();
  await page.getByRole("button", { name: "Reconnect sample" }).click();
  await page.getByRole("button", { name: "Approve and backfill" }).click();
  await expect(page.getByTestId("connection-phase")).toHaveText("Connected to fixture");
  await expect(page.getByTestId("observed-total")).toHaveText("200");
  await page.reload();
  await expect(page.getByTestId("observed-total")).toHaveText("Not read");
  expect(externalRequests).toEqual([]);
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute("content", /connect-src 'none'/);
});

test("consent is cancellable, keyboard accessible, and performs no read", async ({ page }, testInfo) => {
  await page.getByRole("button", { name: "Connect sample" }).click();
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("consent.png"), fullPage: true });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByTestId("observed-total")).toHaveText("Not read");
  await expect(page.getByTestId("connection-phase")).toHaveText("Disconnected");
  await expect(page.getByRole("button", { name: "Connect sample" })).toBeFocused();
  await page.getByRole("button", { name: "Connect sample" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByTestId("connection-phase")).toHaveText("Disconnected");
});

test("a failed read retains counts and can be retried", async ({ page }) => {
  await connectSample(page);
  await page.getByText("Test recovery", { exact: true }).click();
  await page.getByRole("button", { name: "Simulate a failed sync" }).click();
  await expect(page.getByTestId("connection-phase")).toHaveText("Sync needs attention");
  await expect(page.getByTestId("observed-total")).toHaveText("150");
  await page.getByRole("button", { name: "Retry sync" }).click();
  await expect(page.getByTestId("connection-phase")).toHaveText("Connected to fixture");
  await expect(page.getByTestId("observed-total")).toHaveText("150");
});

test("expired approval requires new consent and keeps history", async ({ page }) => {
  await page.clock.install();
  await page.reload();
  await connectSample(page);
  await page.clock.fastForward(10 * 60 * 1000 + 1);
  await expect(page.getByTestId("connection-phase")).toHaveText("Approval expired");
  await expect(page.getByTestId("observed-total")).toHaveText("150");
  await page.getByRole("button", { name: "Reconnect sample" }).click();
  await page.getByRole("button", { name: "Approve and backfill" }).click();
  await expect(page.getByTestId("connection-phase")).toHaveText("Connected to fixture");
  await expect(page.getByTestId("observed-total")).toHaveText("150");
});

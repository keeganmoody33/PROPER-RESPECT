import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const screenshots = resolve(__dirname, "screenshots");

async function screenshot(page: Page, name: string) {
  await mkdir(screenshots, { recursive: true });
  await page.screenshot({ path: resolve(screenshots, `${name}.png`), fullPage: true });
}

async function connect(page: Page, provider: "codex" | "cursor", context: "PERSONAL" | "WORK") {
  await page.getByRole("combobox", { name: "Source", exact: true }).selectOption(provider);
  await page.getByRole("combobox", { name: "Account context", exact: true }).selectOption(context);
  await page.getByRole("button", { name: "Connect synthetic source" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Approve and backfill" }).click();
  const card = page.locator(`article[data-provider="${provider}"][data-context="${context}"]`);
  await expect(card.getByTestId("connection-phase")).toHaveText("Approved · fixture connected");
  await expect(page.getByRole("status")).toContainText("Source approved and backfilled");
  return card;
}

test("owner approval, replay-safe backfill, update, store recovery and retained revocation", async ({ page }) => {
  const externalRequests: string[] = [];
  const sourceActions: string[] = [];
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.origin !== "http://127.0.0.1:4188") externalRequests.push(request.url());
    if (["/fixture/approve", "/fixture/sync", "/fixture/update"].includes(url.pathname)) sourceActions.push(url.pathname);
  });
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("Ready");
  await expect(page.getByText("No source approved yet.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Connect synthetic source" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Synthetic fixture owner");
  await expect(dialog).toContainText("Provider account unverified");
  await expect(dialog).toContainText("Accepted history remains after disconnect");
  await expect(dialog).toContainText("Nothing public");
  await expect(dialog).toContainText("2026-10-01 to 2026-10-08");
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  expect(sourceActions).toEqual([]);
  await screenshot(page, "approval-desktop");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Connect synthetic source" })).toBeFocused();
  expect(sourceActions).toEqual([]);

  const card = await connect(page, "codex", "PERSONAL");
  await expect(card.getByTestId("modernTotalTokens")).toHaveText("30");
  await expect(card.getByTestId("legacyObservedIncrease")).toHaveText("20");
  await card.getByRole("button", { name: "Sync again", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Sync finished");
  await expect(card.getByTestId("modernTotalTokens")).toHaveText("30");
  await expect(card.getByTestId("legacyObservedIncrease")).toHaveText("20");
  await card.getByRole("button", { name: "Add synthetic update" }).click();
  await expect(page.getByRole("status")).toContainText("synthetic source update");
  await expect(card.getByTestId("modernTotalTokens")).toHaveText("70");
  await expect(card.getByTestId("legacyObservedIncrease")).toHaveText("20");
  await page.getByRole("button", { name: "Reopen fixture stores" }).click();
  await expect(page.getByText("Receiver and companion reopened. Accepted records survived this fixture restart.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(card.getByTestId("modernTotalTokens")).toHaveText("70");
  await expect(card.getByTestId("legacyObservedIncrease")).toHaveText("20");
  await card.getByRole("button", { name: "Sync again", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Sync finished");
  await expect(card.getByTestId("modernTotalTokens")).toHaveText("70");

  await card.getByText("Choose preview fields", { exact: true }).click();
  await expect(card.getByTestId("share-preview")).toContainText("No measurement fields selected");
  await card.getByRole("checkbox", { name: "Codex response tokens", exact: true }).check();
  await expect(card.getByTestId("share-preview")).toContainText("Codex response tokens: 70");
  await expect(card.getByTestId("share-preview")).not.toContainText("Legacy observed increase:");
  await expect(card.getByTestId("share-preview")).toContainText("Preview only, nothing published");
  await screenshot(page, "codex-connected-desktop");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await card.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(card.getByTestId("connection-phase")).toHaveText("Disconnected · history retained");
  await expect(card.getByTestId("modernTotalTokens")).toHaveText("70");
  await expect(card.getByRole("button", { name: "Sync again", exact: true })).toBeDisabled();
  await expect(card.getByRole("button", { name: "Add synthetic update" })).toBeDisabled();
  await page.reload();
  await expect(card.getByTestId("connection-phase")).toHaveText("Disconnected · history retained");
  await expect(card.getByTestId("modernTotalTokens")).toHaveText("70");
  await card.getByText("Choose preview fields", { exact: true }).click();
  await expect(card.getByRole("checkbox", { name: "Codex response tokens", exact: true })).not.toBeChecked();
  await screenshot(page, "codex-retained-desktop");
  expect(externalRequests).toEqual([]);
});

test("Cursor keeps its native tokens, supplied requests and source estimate separate", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("Ready");
  const card = await connect(page, "cursor", "WORK");
  await expect(card.getByTestId("cursorTokens")).toHaveText("100");
  await expect(card.getByTestId("cursorRequests")).toHaveText("2");
  await expect(card.getByTestId("cursorSourceCostUsd")).toHaveText("$0.0125");
  await expect(card).toContainText("Not an actual charge");
  await expect(page.locator('article[data-provider="codex"][data-context="PERSONAL"]')).toContainText("history retained");
  await card.getByRole("button", { name: "Sync again", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Sync finished");
  await expect(card.getByTestId("cursorTokens")).toHaveText("100");
  await expect(card.getByTestId("cursorSourceCostUsd")).toHaveText("$0.0125");
  await card.getByText("Choose preview fields", { exact: true }).click();
  await card.getByRole("checkbox", { name: "Source usage-cost estimate", exact: true }).check();
  await expect(card.getByTestId("share-preview")).toContainText("Source usage-cost estimate: $0.0125");
  await expect(card.getByTestId("share-preview")).not.toContainText("Native total tokens:");
  await screenshot(page, "cursor-connected-desktop");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("the retained multi-source record and approval dialog fit a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("Ready");
  await expect(page.locator("article")).toHaveCount(2);
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", await page.locator("html").evaluate(html => html.clientWidth));
  await screenshot(page, "connections-mobile");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Connect synthetic source" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await screenshot(page, "approval-mobile");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

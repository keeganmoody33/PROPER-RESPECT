import { expect, test } from "@playwright/test";
import { E2E_PROFILE_UNAVAILABLE_COOKIE } from "../../src/data/e2e-reference-profile";

const DESKTOP_WIDTH = 1280;
const PHONE_WIDTH = 390;
const VIEWPORT_HEIGHT = 900;

// The fixture read fails while the cookie is set. Try again only recovers if it
// fetches the page again; re-rendering the failed result would fail again.
[DESKTOP_WIDTH, PHONE_WIDTH].forEach(width => test(`a public page that failed to load recovers on Try again at ${width}px`, async ({ page, context, baseURL }, testInfo) => {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await context.addCookies([{ name: E2E_PROFILE_UNAVAILABLE_COOKIE, value: "1", url: baseURL! }]);
  await page.goto("/keegan");
  await expect(page.getByRole("heading", { level: 1, name: "This page couldn’t be loaded." })).toBeVisible();
  await expect(page.getByText("No source records were exposed.")).toBeVisible();
  await expect(page.getByText("Server Error")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath(`2026-11-17-profile-error-${width}.png`), fullPage: true });

  await context.clearCookies({ name: E2E_PROFILE_UNAVAILABLE_COOKIE });
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Keegan Moody" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "This page couldn’t be loaded." })).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe("/keegan");
}));

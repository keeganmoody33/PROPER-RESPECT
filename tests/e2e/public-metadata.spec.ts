import { expect, test } from "@playwright/test";

test("share-image remains a profile path, not a reserved image endpoint", async ({ request }) => {
  const response = await request.get("/share-image");
  expect(response.status()).toBe(404);
  expect(response.headers()["content-type"]).toContain("text/html");
});

test("published fixture uses canonical metadata on desktop and mobile", async ({ page }) => {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/keegan");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://public.example/keegan");
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", "https://public.example/keegan");
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", "https://public.example/share-image.png?v=20260922");
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
    await expect(page.getByRole("heading", { level: 1, name: "Keegan Moody" })).toBeVisible();
    await expect(page.getByText("Private source record")).toHaveCount(0);
  }
});

test("share image is a real PNG and sitemap has no private routes", async ({ request }) => {
  const image = await request.get("/share-image.png");
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");
  const bytes = await image.body();
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(bytes.readUInt32BE(16)).toBe(1200);
  expect(bytes.readUInt32BE(20)).toBe(630);
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain("<loc>https://public.example/</loc>");
  expect(await sitemap.text()).not.toMatch(/onboarding|collection|private-owner|sign-in/);
});

test("missing profiles and private onboarding are not indexed", async ({ page }) => {
  const response = await page.goto("/private-owner");
  expect(response?.status()).toBe(404);
  expect(await page.locator('meta[name="robots"]').evaluateAll(nodes => nodes.map(node => node.getAttribute("content")).join(","))).toContain("noindex");
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await page.goto("/onboarding");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

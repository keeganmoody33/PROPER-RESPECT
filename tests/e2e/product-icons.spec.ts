import { expect, test } from "@playwright/test";

for (const [width, density] of [[1440, 1], [1440, 2], [390, 3]]) {
  test(`product icons remain sharp and unframed at ${width}px and ${density}x density`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: density });
    const page = await context.newPage();
    try {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`${testInfo.project.use.baseURL}/`);
      const carousel = page.getByRole("region", { name: "Product usage examples" });
      let wisprSource = "";
      for (const product of ["Clay", "Wispr Flow"]) {
        await carousel.getByRole("button", { name: product, exact: true }).click();
        const icon = carousel.getByRole("article", { name: `${product} card` }).locator(".product-logo");
        const image = icon.locator("img");
        await expect(image).toBeVisible();
        await image.evaluate((element: HTMLImageElement) => element.decode());
        const geometry = await image.evaluate((element: HTMLImageElement) => {
          const rect = element.getBoundingClientRect();
          const parent = element.parentElement!;
          return { naturalWidth: element.naturalWidth, naturalHeight: element.naturalHeight, width: rect.width, height: rect.height,
            parentWidth: parent.getBoundingClientRect().width, background: getComputedStyle(parent).backgroundColor, border: getComputedStyle(parent).borderWidth };
        });
        expect(geometry.naturalWidth).toBeGreaterThanOrEqual(geometry.width * density);
        expect(geometry.naturalHeight).toBeGreaterThanOrEqual(geometry.height * density);
        expect(geometry.width).toBe(geometry.parentWidth);
        expect(geometry.width).toBe(geometry.height);
        expect(geometry.background).toBe("rgba(0, 0, 0, 0)");
        expect(geometry.border).toBe("0px");
        if (product === "Wispr Flow") wisprSource = (await image.getAttribute("src"))!;
        await carousel.screenshot({ path: testInfo.outputPath(`2026-09-21-${product.replaceAll(" ", "-")}-${width}-${density}x.png`) });
      }
      await page.goto(`${testInfo.project.use.baseURL}/keegan`);
      const profileIcon = page.getByRole("article", { name: "Wispr Flow card" }).locator(".product-logo img");
      await expect(profileIcon).toBeVisible();
      await expect(profileIcon).toHaveAttribute("src", wisprSource);
      await profileIcon.evaluate((element: HTMLImageElement) => element.decode());
      await page.getByRole("article", { name: "Wispr Flow card" }).screenshot({ path: testInfo.outputPath(`2026-09-21-profile-wispr-${width}-${density}x.png`) });
    } finally { await context.close(); }
  });
}

test("an official icon that fails before hydration falls back to product initials", async ({ page }) => {
  let resumeHydration!: () => void;
  const hydration = new Promise<void>(resolve => { resumeHydration = resolve; });
  await page.route(/\/_next\/.*\.js(?:\?|$)/, async route => { await hydration; await route.continue(); });
  let requested = false;
  await page.route("**/product-assets/wisprflow/**", route => { requested = true; return route.abort(); });
  try {
    await page.goto("/keegan", { waitUntil: "commit" });
    const icon = page.getByRole("article", { name: "Wispr Flow card" }).locator(".product-logo");
    await expect(icon.locator("img")).toHaveCount(1);
    await expect.poll(() => icon.locator("img").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth === 0)).toBe(true);
    await expect.poll(() => requested).toBe(true);
    resumeHydration();
    await expect(icon.locator("img")).toHaveCount(0);
    await expect(icon).toHaveText("WF");
  } finally { resumeHydration(); }
});

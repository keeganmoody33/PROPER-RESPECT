import { expect, test } from "@playwright/test";

function pngSize(body: Buffer) {
  expect(body.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return { width: body.readUInt32BE(16), height: body.readUInt32BE(20) };
}

test("publishes working PR icons and the current share image on public pages", async ({ page, request }) => {
  for (const path of ["/", "/about/origins"]) {
    await page.goto(path);
    for (const [rel, size] of [["icon", 32], ["apple-touch-icon", 180]] as const) {
      const icon = page.locator(`link[rel="${rel}"]`);
      await expect(icon).toHaveAttribute("sizes", `${size}x${size}`);
      const response = await request.get((await icon.getAttribute("href"))!);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("image/png");
      expect(pngSize(await response.body())).toEqual({ width: size, height: size });
    }
  }
  await page.goto("/");
  const image = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(image).toBe("https://public.example/share-image.png?v=20260922");
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute("content", image!);
  const imageUrl = new URL(image!);
  const response = await request.get(imageUrl.pathname + imageUrl.search);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
  expect(pngSize(await response.body())).toEqual({ width: 1200, height: 630 });
});

test("serves the same PR icon at the conventional favicon URL", async ({ request, page }) => {
  const response = await request.get("/favicon.ico");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/^image\/(?:x-icon|vnd\.microsoft\.icon)/);
  const ico = await response.body();
  expect(ico.readUInt16LE(0)).toBe(0);
  expect(ico.readUInt16LE(2)).toBe(1);
  expect(ico.readUInt16LE(4)).toBe(1);
  expect(ico[6]).toBe(32);
  expect(ico[7]).toBe(32);
  expect(ico.readUInt16LE(10)).toBe(1);
  expect(ico.readUInt16LE(12)).toBe(32);
  const imageLength = ico.readUInt32LE(14);
  const imageOffset = ico.readUInt32LE(18);
  expect(imageOffset + imageLength).toBe(ico.length);
  const png = ico.subarray(imageOffset);
  expect(pngSize(png)).toEqual({ width: 32, height: 32 });
  expect(png.equals(await (await request.get("/icon")).body())).toBe(true);
  await page.goto("/favicon.ico");
  await expect.poll(() => page.locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(32);
});

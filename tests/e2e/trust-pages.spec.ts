import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const pages = [
  ["origins", "Giving credit its context"],
  ["contact", "Contact Proper Respect"],
  ["privacy", "How your data is handled"],
];

for (const [slug, title] of pages) test(`${slug} has matching public HTML and Markdown`, async ({ page, request }, testInfo) => {
  const path = `/about/${slug}`;
  expect((await page.goto(path))?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://public.example${path}`);
  await expect(page.locator('link[rel="alternate"][type="text/markdown"]')).toHaveAttribute("href", `https://public.example${path}.md`);
  const markdown = await request.get(`${path}.md`);
  expect(markdown.status()).toBe(200);
  expect(markdown.headers()["content-type"]).toContain("text/markdown");
  const body = await markdown.text();
  expect(body.startsWith(`# ${title}\n`)).toBe(true);
  for (const paragraph of await page.locator("article p[data-trust-copy]").allTextContents()) expect(body).toContain(paragraph);
  for (const link of await page.locator("article section a").evaluateAll(links => links.map(link => link.getAttribute("href")))) expect(body).toContain(link);
  const preview = testInfo.config.metadata.preview === true;
  if (preview) {
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex, nofollow/);
    expect(markdown.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  } else {
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    expect(markdown.headers()["x-robots-tag"]).toBeUndefined();
  }
  for (const suffix of ["", ".md"]) {
    const head = await request.head(`${path}${suffix}`);
    expect(head.status()).toBe(200);
    expect(await head.body()).toHaveLength(0);
    expect(head.headers()["content-type"]).toContain(suffix ? "text/markdown" : "text/html");
    if (preview && suffix) expect(head.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  }
});

test("nested trust pages preserve claimable root profiles", async ({ page, request }) => {
  for (const handle of ["about", "contact", "privacy", "app", "collection"]) {
    expect((await page.goto(`/${handle}`))?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Existing ${handle} owner`);
  }
  expect((await request.get("/about/missing")).status()).toBe(404);
  expect((await request.get("/about/missing.md")).status()).toBe(404);
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const [slug] of pages) expect(sitemap).toContain(`<loc>https://public.example/about/${slug}</loc>`);
  expect(sitemap.match(/<lastmod>2026-09-22<\/lastmod>/g)).toHaveLength(3);
  expect(sitemap).not.toContain(".md</loc>");
});

test("contact identity matches its visible operator and avoids invented business facts", async ({ page }) => {
  await page.goto("/about/contact");
  const identity = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() || "{}");
  expect(identity).toMatchObject({ "@type": "ContactPage", url: "https://public.example/about/contact", mainEntity: { "@type": "Person", name: "Keegan Moody", email: "33@lecturesfrom.com" } });
  await expect(page.locator("article")).toContainText("Created by LecturesFrom. Operated by Keegan Moody.");
  await expect(page.locator('article a[href="mailto:33@lecturesfrom.com"]')).toBeVisible();
  expect(JSON.stringify(identity)).not.toMatch(/legalName|address|offers|aggregateRating|accountablePerson|creator/);
});

for (const width of [320, 1440]) for (const mode of ["light", "dark"]) test(`trust pages remain readable at ${width}px in ${mode}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto("/");
  await page.getByRole("combobox", { name: "Appearance" }).first().selectOption(mode);
  for (const [slug] of pages) {
    await page.goto(`/about/${slug}`);
    await expect(page.locator("html")).toHaveAttribute("data-theme", mode);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`2026-09-22-${slug}-${width}-${mode}.png`), fullPage: true });
  }
  const footer = page.getByRole("navigation", { name: "Footer navigation" });
  const contact = footer.getByRole("link", { name: "Contact", exact: true });
  await contact.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/about\/contact$/);
  const email = page.locator('article a[href="mailto:33@lecturesfrom.com"]');
  await email.focus();
  await expect(email).toBeFocused();
});

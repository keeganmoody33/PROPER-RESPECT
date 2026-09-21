import { readFileSync } from "node:fs";
import { buildSync } from "esbuild";
import { expect, test, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { THEME_STORAGE_KEY } from "../../src/client/theme";

async function appearance(card: Locator) {
  return card.evaluate(element => [element, ...element.querySelectorAll("h2, .product-logo, .product-logo img, .card-button, .card-back-content")].map(node => {
    const css = getComputedStyle(node);
    return { color: css.color, background: css.backgroundColor, font: css.fontFamily, outline: css.outlineColor, scheme: css.colorScheme, filter: css.filter, image: node instanceof HTMLImageElement ? node.src : null };
  }));
}

for (const width of [320, 390, 460, 1440]) test(`theme controls and shell fit at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ colorScheme: "light" });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/");
  const header = page.locator(".site-header").getByRole("combobox", { name: "Appearance" });
  const footer = page.locator(".site-footer").getByRole("combobox", { name: "Appearance" });
  await expect(header).toHaveValue("system");
  await expect(header).toBeVisible();
  expect((await header.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.evaluate(() => document.fonts.ready);
  for (const mode of ["light", "dark"]) {
    await header.selectOption(mode);
    await expect(footer).toHaveValue(mode);
    await expect(page.locator("html")).toHaveAttribute("data-theme", mode);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const mark = page.locator(".site-header .site-mark");
    await expect(mark).toHaveCSS("background-color", mode === "dark" ? "rgb(240, 238, 231)" : "rgb(23, 23, 19)");
    if (width === 320 || width === 1440) {
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.getByRole("img", { name: "Two fists meeting at a bright red diamond" }).scrollIntoViewIfNeeded();
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: testInfo.outputPath(`2026-09-21-${mode}-homepage-${width}.png`), fullPage: true });
    }
  }
  await footer.selectOption("light");
  await expect(header).toHaveValue("light");
  await header.focus();
  await page.keyboard.press("d");
  await page.keyboard.press("Tab");
  await expect(header).toHaveValue("dark");
  await expect(footer).toHaveValue("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(errors).toEqual([]);
});

test("preference persists through navigation and reload while System follows OS", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const controls = page.getByRole("combobox", { name: "Appearance" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(controls.first()).toHaveValue("system");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await controls.first().selectOption("dark");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Origins" }).click();
  await expect(controls.first()).toHaveValue("dark");
  await page.reload();
  await expect(controls.first()).toHaveValue("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await controls.first().selectOption("system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("theme synchronizes across tabs and storage clear returns to System", async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const other = await context.newPage();
  await other.goto("/about/origins");
  await other.getByRole("combobox", { name: "Appearance" }).first().selectOption("light");
  await expect(page.getByRole("combobox", { name: "Appearance" }).first()).toHaveValue("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await other.evaluate(() => localStorage.clear());
  await expect(page.getByRole("combobox", { name: "Appearance" }).first()).toHaveValue("system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await other.getByRole("combobox", { name: "Appearance" }).first().selectOption("light");
  await expect(page.getByRole("combobox", { name: "Appearance" }).first()).toHaveValue("light");
  await other.evaluate(key => localStorage.setItem(key, "invalid"), THEME_STORAGE_KEY);
  await expect(page.getByRole("combobox", { name: "Appearance" }).first()).toHaveValue("system");
  await other.close();
});

for (const stored of ["invalid", "dark"]) test(`prepaint resolves ${stored} storage before hydration`, async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: THEME_STORAGE_KEY, value: stored });
  await page.route("**/_next/static/**/*.js", route => route.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", stored === "dark" ? "dark" : "light");
  await expect(page.locator("html")).toHaveAttribute("data-theme-preference", stored === "dark" ? "dark" : "system");
  await expect(page.locator("html")).toHaveCSS("color-scheme", stored === "dark" ? "dark" : "light");
});

test("denied storage keeps working theme controls and navigation", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Denied", "SecurityError"); } }));
  await page.goto("/");
  const control = page.getByRole("combobox", { name: "Appearance" }).first();
  await expect(control).toHaveValue("system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await control.selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Origins" }).click();
  await expect(control).toHaveValue("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await control.selectOption("system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(errors).toEqual([]);
});

test("all four branded examples keep their palette, logo, typography and focused controls", async ({ page }) => {
  await page.goto("/");
  const control = page.getByRole("combobox", { name: "Appearance" }).first();
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  for (const name of ["GitHub", "Clay", "Wispr Flow", "Claude Code"]) {
    await carousel.getByRole("button", { name, exact: true }).click();
    const card = carousel.getByRole("article", { name: `${name} card` });
    await control.selectOption("light");
    await card.getByRole("button", { name: "Details", exact: true }).focus();
    const light = await appearance(card);
    await control.selectOption("dark");
    await card.getByRole("button", { name: "Details", exact: true }).focus();
    expect(await appearance(card)).toEqual(light);
    await card.getByRole("button", { name: "Details", exact: true }).click();
    await page.mouse.move(0, 0);
    const darkBack = await appearance(card);
    await control.selectOption("light");
    await page.mouse.move(0, 0);
    expect(await appearance(card)).toEqual(darkBack);
    await card.getByRole("button", { name: "Close details", exact: true }).click();
  }
});

const unbrandedFixture = buildSync({
  stdin: { contents: `import { createElement } from "react"; import { createRoot } from "react-dom/client"; import { ProductCard } from "./components/product-card";
    import { ThemeProvider } from "./components/theme-provider"; import { ThemeSelector } from "./components/theme-selector";
    createRoot(document.getElementById("root")).render(createElement(ThemeProvider, null,
      createElement(ThemeSelector), createElement(ProductCard, { index: 0, card: {
        product: { name: "Unbranded tool", slug: "unbranded", domain: "example.com", description: "Synthetic unbranded fixture" },
        status: "ACTIVE", headline: "Synthetic owner note", note: "Synthetic details" } }),
      createElement("label", { className: "review-field" }, "Note", createElement("input", { placeholder: "Add a note" }))));`, resolveDir: process.cwd() },
  bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
});

test("unbranded cards stay fixed while private form controls follow appearance", async ({ page }) => {
  await page.route("**/theme-fixture", route => route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="en"><body><main id="root"></main></body></html>' }));
  await page.goto("/theme-fixture");
  await page.addStyleTag({ content: readFileSync("app/globals.css", "utf8") });
  await page.addScriptTag({ content: unbrandedFixture.outputFiles[0].text });
  const control = page.getByRole("combobox", { name: "Appearance" });
  const card = page.getByRole("article", { name: "Unbranded tool card" });
  await control.selectOption("light");
  await card.getByRole("button", { name: "Details", exact: true }).focus();
  const light = await appearance(card);
  await expect(page.getByRole("textbox", { name: "Note" })).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await control.selectOption("dark");
  await card.getByRole("button", { name: "Details", exact: true }).focus();
  expect(await appearance(card)).toEqual(light);
  await expect(page.getByRole("textbox", { name: "Note" })).toHaveCSS("background-color", "rgb(23, 23, 19)");
  await expect(page.getByRole("textbox", { name: "Note" })).toHaveCSS("color", "rgb(240, 238, 231)");
});

for (const route of ["/keegan", "/app/collection", "/onboarding"]) test(`shared appearance reaches fixture or unconfigured route ${route}`, async ({ page }) => {
  await page.goto(route);
  for (const mode of ["light", "dark"]) {
    await page.getByRole("combobox", { name: "Appearance" }).first().selectOption(mode);
    await expect(page.getByRole("combobox", { name: "Appearance" }).last()).toHaveValue(mode);
    await expect(page.locator("html")).toHaveAttribute("data-theme", mode);
    await expect(page.locator("html")).toHaveCSS("background-color", mode === "dark" ? "rgb(23, 23, 19)" : "rgb(240, 238, 231)");
    await expect(page.locator("main")).toHaveCSS("color", mode === "dark" ? "rgb(240, 238, 231)" : "rgb(23, 23, 19)");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});


const authFrameFixture = buildSync({
  stdin: { contents: `import { createElement } from "react"; import { createRoot } from "react-dom/client";
    import { ThemeProvider } from "./components/theme-provider"; import { ThemeSelector } from "./components/theme-selector"; import { AuthFrame } from "./components/site-frame";
    createRoot(document.getElementById("root")).render(createElement(ThemeProvider, null, createElement(AuthFrame, null,
      createElement("div", null, createElement(ThemeSelector), createElement("p", null, "Synthetic form. Clerk is not connected."),
        createElement("label", { className: "review-field" }, "Email", createElement("input", { type: "email" }))))));`, resolveDir: process.cwd() },
  bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
});

test("auth frame follows appearance around an explicitly synthetic form", async ({ page }) => {
  await page.route("**/auth-frame-fixture", route => route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="en"><head><title>Auth frame fixture</title></head><body><div id="root"></div></body></html>' }));
  await page.goto("/auth-frame-fixture");
  await page.addStyleTag({ content: readFileSync("app/globals.css", "utf8") });
  await page.addScriptTag({ content: authFrameFixture.outputFiles[0].text });
  for (const mode of ["light", "dark"]) {
    await page.getByRole("combobox", { name: "Appearance" }).selectOption(mode);
    await expect(page.locator(".auth-shell")).toHaveCSS("color", mode === "dark" ? "rgb(240, 238, 231)" : "rgb(23, 23, 19)");
    await expect(page.getByRole("textbox", { name: "Email" })).toHaveCSS("background-color", mode === "dark" ? "rgb(23, 23, 19)" : "rgb(255, 255, 255)");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});

// Dev probe: the chooser at each width, captured and measured, for picking how it names each example's capability.
import { chromium } from "playwright";
const [base = "http://127.0.0.1:3312", label = "a"] = process.argv.slice(2);
const browser = await chromium.launch();
for (const width of [1440, 390, 320]) {
  const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
  await page.goto(base);
  const chooser = page.getByRole("group", { name: "Choose a product example" });
  await page.evaluate(() => document.fonts.ready);
  const box = await chooser.boundingBox();
  await page.getByRole("region", { name: "Product usage examples" }).screenshot({ path: `.artifacts/homepage-breadth/prototypes/chooser-${label}-${width}.png` });
  console.log(label, width, "chooser height", Math.round(box.height), "page overflow", await page.evaluate(() => document.documentElement.scrollWidth - innerWidth));
  await page.close();
}
await browser.close();

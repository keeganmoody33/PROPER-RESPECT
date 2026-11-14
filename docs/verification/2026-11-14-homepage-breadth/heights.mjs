// Dev probe: each example's content height once its brand assets load, and the frame around it.
import { chromium } from "playwright";
const base = process.argv[2] ?? "http://127.0.0.1:3312";
const widths = (process.argv[3] ?? "1440,390,320").split(",").map(Number);
const browser = await chromium.launch();
for (const width of widths) {
  const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
  await page.goto(base);
  const carousel = page.getByRole("region", { name: "Product usage examples" });
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  const stageAt = () => carousel.evaluate(element => Math.round(element.querySelector("[aria-roledescription=slide]").parentElement.getBoundingClientRect().height));
  const atLoad = await stageAt();
  const names = await page.getByRole("group", { name: "Choose a product example" }).getByRole("button").evaluateAll(buttons => buttons.map(button => button.firstChild?.textContent ?? ""));
  const rows = [];
  for (const name of names) {
    await carousel.getByRole("button", { name, exact: true }).click();
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    rows.push(await carousel.evaluate((element, name) => {
      const stage = element.querySelector("[aria-roledescription=slide]").parentElement.getBoundingClientRect();
      const slide = element.querySelector("[data-current=true]");
      const bottom = Math.max(...[...slide.children].map(child => child.getBoundingClientRect().bottom));
      return `${name}:${Math.round(bottom - stage.top)}/${Math.round(stage.height)}`;
    }, name));
  }
  console.log(width, `frame at load ${atLoad}, after all ${await stageAt()}`, rows.join(" "));
  await page.close();
}
await browser.close();

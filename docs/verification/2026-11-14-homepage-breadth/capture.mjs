// Captures every homepage example, front and back, at 1440 and 390 from a stamped production build, and measures the frame.
//   node .artifacts/homepage-breadth/capture.mjs --base http://127.0.0.1:3311 --label before
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const option = name => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
const base = option("base"), label = option("label");
const backOf = (option("backs") ?? "").split(",").filter(Boolean);
if (!base || !label) throw new Error("needs --base and --label");
const out = resolve(".artifacts/homepage-breadth", label);
mkdirSync(out, { recursive: true });
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

// The same proof scripts/brand-fidelity.mjs takes: this checkout serves the port, from a build stamped with this commit.
function serverProof() {
  const { port } = new URL(base);
  const pid = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], { encoding: "utf8" }).trim().split("\n")[0];
  const cwd = execFileSync("lsof", ["-a", "-p", pid, "-d", "cwd", "-Fn"], { encoding: "utf8" }).split("\n").find(line => line.startsWith("n"))?.slice(1);
  const command = execFileSync("ps", ["-p", pid, "-o", "args="], { encoding: "utf8" }).trim();
  if (cwd !== process.cwd()) throw new Error(`Port ${port} is served from ${cwd}, not ${process.cwd()}.`);
  const stamp = resolve(".next/brand-fidelity-build.json");
  const built = existsSync(stamp) ? JSON.parse(readFileSync(stamp, "utf8")) : undefined;
  if (!command.startsWith("next-server") || !built || built.commit !== commit || built.uncommittedChanges !== "none") throw new Error(`Port ${port} is not a stamped production build of ${commit}: ${command} ${JSON.stringify(built)}`);
  return { port, pid, cwd, command, commit, build: built };
}

/** Every example's name: the featured ones, then those behind More examples, which the chooser holds only once it opens. */
async function everyExample(carousel, chooser) {
  const featured = await chooser.getByRole("button").count();
  await carousel.getByRole("button", { name: "More examples" }).click();
  await carousel.locator("[aria-expanded=true]", { hasText: "More examples" }).waitFor();
  await chooser.getByRole("button").nth(featured).waitFor();
  return chooser.getByRole("button").evaluateAll(buttons => buttons.map(button => button.firstChild?.textContent ?? ""));
}

const proof = serverProof();
writeFileSync(join(out, "server.json"), `${JSON.stringify(proof, null, 2)}\n`);
const browser = await chromium.launch();
const report = { commit, widths: {} };
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
    await page.goto(base);
    const carousel = page.getByRole("region", { name: "Product usage examples" });
    const chooser = page.getByRole("group", { name: "Choose a product example" });
    const chooserHeight = await chooser.evaluate(element => element.getBoundingClientRect().height);
    const names = await everyExample(carousel, chooser);
    const rows = [];
    for (const [index, name] of names.entries()) {
      await carousel.getByRole("button", { name, exact: true }).click();
      const card = carousel.getByRole("article", { name: `${name} card` });
      await card.waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForLoadState("networkidle");
      const slug = name.toLowerCase().replaceAll(" ", "-").replaceAll(".", "-");
      const number = String(index + 1).padStart(2, "0");
      const measured = await carousel.evaluate(element => {
        const stage = element.querySelector("[aria-roledescription=slide]").parentElement;
        const slide = element.querySelector("[data-current=true]");
        const front = slide.querySelector(".card-front");
        const rowGap = parseFloat(getComputedStyle(front).rowGap);
        const parts = [...front.children];
        const gaps = parts.slice(1).map((part, at) => part.getBoundingClientRect().top - parts[at].getBoundingClientRect().bottom
          - parseFloat(getComputedStyle(parts[at]).marginBottom) - parseFloat(getComputedStyle(part).marginTop));
        const stageBox = stage.getBoundingClientRect(), contentBottom = Math.max(...[...slide.children].map(child => child.getBoundingClientRect().bottom));
        const stageHeight = stageBox.height, slideHeight = contentBottom - stageBox.top;
        return { stageHeight, slideHeight, leftover: Math.round(stageBox.bottom - contentBottom), rowGap, largestFrontGap: Math.max(...gaps),
          above: [...slide.children].filter(child => !child.matches("article")).map(child => child.textContent), front: front.innerText };
      });
      await carousel.screenshot({ path: join(out, `${number}-${slug}-front-${width}.png`) });
      let back;
      if (backOf.includes(slug) || backOf.includes("all")) {
        await card.getByRole("button", { name: "Details", exact: true }).click();
        await card.locator(".card-back").waitFor();
        back = await card.locator(".card-back").innerText();
        await carousel.screenshot({ path: join(out, `${number}-${slug}-back-${width}.png`) });
        await card.getByRole("button", { name: "Close details" }).click();
      }
      rows.push({ name, ...measured, back });
    }
    report.widths[width] = { chooserHeight, rows };
    await page.close();
  }
} finally { await browser.close(); }
writeFileSync(join(out, "measurements.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [width, { chooserHeight, rows }] of Object.entries(report.widths)) {
  console.log(`${width}px chooser ${chooserHeight}px frame ${rows[0].stageHeight}px, largest leftover ${Math.max(...rows.map(row => row.leftover))}px (${rows.reduce((a, b) => (b.leftover > a.leftover ? b : a)).name}), largest front gap ${Math.max(...rows.map(row => row.largestFrontGap)).toFixed(1)} vs row gap ${rows[0].rowGap}`);
}

// Round 2: Clay's front and back, Docker's front, and the chooser, at 1440 and 390, from this checkout's own dev server.
//   node docs/verification/2026-11-14-homepage-breadth/round-2/capture.mjs --base http://127.0.0.1:3217
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const base = args[args.indexOf("--base") + 1];
if (!base?.startsWith("http")) throw new Error("needs --base");
const out = dirname(fileURLToPath(import.meta.url));
const git = (...parts) => execFileSync("git", parts, { encoding: "utf8" }).trim();
const commit = git("rev-parse", "HEAD");

// The port is served by next dev running in this checkout, at a commit with no uncommitted source changes.
function serverProof() {
  const { port } = new URL(base);
  const pid = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], { encoding: "utf8" }).trim().split("\n")[0];
  const cwd = execFileSync("lsof", ["-a", "-p", pid, "-d", "cwd", "-Fn"], { encoding: "utf8" }).split("\n").find(line => line.startsWith("n"))?.slice(1);
  const command = execFileSync("ps", ["-p", pid, "-o", "args="], { encoding: "utf8" }).trim();
  const changed = git("status", "--porcelain", "--", "app", "components", "src", "next.config.ts");
  if (cwd !== process.cwd()) throw new Error(`Port ${port} is served from ${cwd}, not ${process.cwd()}.`);
  if (changed) throw new Error(`Uncommitted source changes:\n${changed}`);
  return { port, pid, cwd, command, commit };
}

const proof = serverProof();
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
    await page.goto(base);
    const carousel = page.getByRole("region", { name: "Product usage examples" });
    const chooser = page.getByRole("group", { name: "Choose a product example" });
    const order = await chooser.getByRole("button").evaluateAll(buttons => buttons.map(button => button.firstChild?.textContent ?? ""));
    await chooser.screenshot({ path: join(out, `chooser-${width}.png`) });
    results.push({ target: `chooser-${width}`, assertion: "Clay is second, after GitHub", observed: order.slice(0, 3).join(", ") });
    const settle = async () => { await page.evaluate(() => document.fonts.ready); await page.waitForLoadState("networkidle"); };

    await chooser.getByRole("button", { name: "Clay", exact: true }).click();
    const clay = carousel.getByRole("article", { name: "Clay card" });
    await clay.waitFor();
    await settle();
    await carousel.screenshot({ path: join(out, `clay-front-${width}.png`) });
    results.push({ target: `clay-front-${width}`, assertion: "Enriched 2,140,000 Rows, unit said once", observed: (await clay.locator(".card-front .usage-measurement-measurement").innerText()).split("\n").slice(0, 3).join(" ") });
    await clay.getByRole("button", { name: "Details", exact: true }).click();
    await clay.getByRole("button", { name: "Close details" }).waitFor();
    await settle();
    await carousel.screenshot({ path: join(out, `clay-back-${width}.png`) });
    results.push({ target: `clay-back-${width}`, assertion: "every row grouped: 2,140,000, 86, 48,500", observed: (await clay.locator(".card-back .usage-measurement-value").allInnerTexts()).join(", ") });
    await clay.getByRole("button", { name: "Close details" }).click();

    await chooser.getByRole("button", { name: "Docker", exact: true }).click();
    const docker = carousel.getByRole("article", { name: "Docker card" });
    await docker.waitFor();
    await settle();
    await carousel.screenshot({ path: join(out, `docker-front-${width}.png`) });
    const preview = docker.locator(".card-front .card-activity-preview");
    results.push({ target: `docker-front-${width}`, assertion: "3 artifacts, then three linked works", observed: `${await preview.locator("> p").first().innerText()} / ${(await preview.locator(".card-artifact-links a").evaluateAll(links => links.map(link => `${link.textContent} -> ${link.getAttribute("href")}`))).join(" | ")}` });
    results.push({ target: `page-${width}`, assertion: "no sideways scroll", observed: String(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)) });
    await page.close();
  }
} finally {
  await browser.close();
}
writeFileSync(join(out, "capture.json"), `${JSON.stringify({ server: proof, results }, null, 2)}\n`);
console.log(JSON.stringify({ server: proof, results }, null, 2));

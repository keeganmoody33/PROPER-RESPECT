// Round 3: the collapsed chooser, the five featured fronts, Clay's back, the opened chooser, two of the nine others,
// and Clay's front beside clay.com, from this checkout's own dev server.
//   node docs/verification/2026-11-14-homepage-breadth/round-3/capture.mjs --base http://127.0.0.1:3219 [--draft]
// --draft skips the clean-tree check, for looking at work in progress; its pictures are not the receipt.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const base = args[args.indexOf("--base") + 1];
const draft = args.includes("--draft");
if (!base?.startsWith("http")) throw new Error("needs --base");
const here = dirname(fileURLToPath(import.meta.url));
const out = draft ? join(process.env.TMPDIR ?? "/tmp", "round-3-draft") : here;
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
  if (changed && !draft) throw new Error(`Uncommitted source changes:\n${changed}`);
  return { port, pid, cwd, command, commit, uncommittedSource: changed || "none" };
}

const FEATURED = ["Clay", "Cloudflare", "Firecrawl", "GitHub", "n8n"];
const slug = name => name.toLowerCase().replaceAll(" ", "-");
const proof = serverProof();
execFileSync("mkdir", ["-p", out]);
const browser = await chromium.launch();
const results = [];
const record = (target, assertion, observed) => results.push({ target, assertion, observed });
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
    await page.goto(base);
    const settle = async () => { await page.evaluate(() => document.fonts.ready); await page.waitForLoadState("networkidle"); };
    const carousel = page.getByRole("region", { name: "Product usage examples" });
    const chooser = carousel.getByRole("group", { name: "Choose a product example" });
    await carousel.getByRole("article", { name: "Clay card" }).waitFor();
    await settle();
    const counts = await page.evaluate(() => ({ carousel: document.querySelector('[aria-label="Product usage examples"]').querySelectorAll("*").length, page: document.querySelectorAll("*").length }));
    const chooserBox = await carousel.locator(":scope > div").first().boundingBox();
    if (width === 1440) {
      await page.screenshot({ path: join(out, "chooser-collapsed-1440-viewport.png") });
      const footer = await carousel.getByRole("article", { name: "Clay card" }).locator(".card-footer").boundingBox();
      record("chooser-collapsed-1440-viewport", "chooser at most 100px tall; Clay's footer above 1000px", `chooser ${chooserBox.height.toFixed(1)}px; footer bottom ${(footer.y + footer.height).toFixed(1)}px; elements in carousel ${counts.carousel}, page ${counts.page}`);
    } else {
      await carousel.locator(":scope > div").first().screenshot({ path: join(out, "chooser-collapsed-390.png") });
      record("chooser-collapsed-390", "five names and More examples", `chooser ${chooserBox.height.toFixed(1)}px; elements in carousel ${counts.carousel}`);
    }
    for (const name of FEATURED) {
      await chooser.getByRole("button", { name, exact: true }).click();
      const card = carousel.getByRole("article", { name: `${name} card` });
      await card.waitFor();
      await settle();
      await page.evaluate(() => scrollTo(0, 0));
      await carousel.locator("[data-current=true]").screenshot({ path: join(out, `${slug(name)}-front-${width}.png`) });
      const footer = await card.locator(".card-footer").evaluate(element => element.getBoundingClientRect().bottom + scrollY);
      record(`${slug(name)}-front-${width}`, "front text as a visitor reads it", `${(await card.locator(".card-front").innerText()).replaceAll("\n", " / ")} [footer bottom ${footer.toFixed(0)}px]`);
    }
    if (width === 1440) {
      await chooser.getByRole("button", { name: "Clay", exact: true }).click();
      const clay = carousel.getByRole("article", { name: "Clay card" });
      await clay.getByRole("button", { name: "Details", exact: true }).click();
      await clay.getByRole("button", { name: "Close details" }).waitFor();
      await settle();
      await carousel.locator("[data-current=true]").screenshot({ path: join(out, "clay-back-1440.png") });
      record("clay-back-1440", "back keeps periods, disclosures, cost and work sample", (await clay.locator(".card-back").innerText()).replaceAll("\n", " / "));
      await clay.getByRole("button", { name: "Close details" }).click();
      await carousel.getByRole("button", { name: "More examples" }).click();
      await settle();
      const opened = await page.evaluate(() => document.querySelector('[aria-label="Product usage examples"]').querySelectorAll("*").length);
      await carousel.locator(":scope > div").first().screenshot({ path: join(out, "chooser-more-1440.png") });
      record("chooser-more-1440", "all fourteen toggles in one group", `${(await chooser.getByRole("button").evaluateAll(buttons => buttons.map(button => button.firstChild?.textContent))).join(", ")}; elements in carousel ${opened}`);
      for (const name of ["Open Places", "Elicit"]) {
        await chooser.getByRole("button", { name, exact: true }).click();
        const card = carousel.getByRole("article", { name: `${name} card` });
        await card.waitFor();
        await settle();
        await carousel.locator("[data-current=true]").screenshot({ path: join(out, `${slug(name)}-front-1440.png`) });
        record(`${slug(name)}-front-1440`, "front text as a visitor reads it", (await card.locator(".card-front").innerText()).replaceAll("\n", " / "));
      }
    }
    record(`page-${width}`, "no sideways scroll", String(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)));
    await page.close();
  }

  // Clay's front beside the clay.com half of the brand-fidelity pair, both at 1440.
  const pair = join(here, "../../2026-11-14-brand-fidelity/pairs/clay-1440.png");
  const page = await browser.newPage({ viewport: { width: 1600, height: 740 }, deviceScaleFactor: 1 });
  const toData = path => `data:image/png;base64,${execFileSync("base64", ["-i", path], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).replaceAll("\n", "")}`;
  await page.setContent(`<body style="margin:0;background:#808080;font:16px Arial;color:#fff;display:flex;gap:24px;padding:16px;align-items:flex-start">
    <figure style="margin:0"><figcaption style="margin-bottom:8px">clay.com at 1440, from the brand-fidelity pair</figcaption>
      <div style="width:960px;height:600px;background:url(${toData(pair)}) 0 -36px no-repeat"></div></figure>
    <figure style="margin:0"><figcaption style="margin-bottom:8px">Clay card front at 1440 @ ${commit.slice(0, 7)}</figcaption>
      <img src="${toData(join(out, "clay-front-1440.png"))}" style="width:560px"></figure></body>`);
  await page.screenshot({ path: join(out, "clay-front-beside-clay-com.png"), fullPage: true });
  await page.close();
} finally {
  await browser.close();
}
writeFileSync(join(out, "capture.json"), `${JSON.stringify({ server: proof, results }, null, 2)}\n`);
console.log(out);
console.log(JSON.stringify(results.map(({ target, observed }) => `${target}: ${observed.slice(0, 300)}`), null, 1));

// Round 4: the first screen, the five featured fronts and backs, the opened chooser, n8n and Elicit, Clay's front beside
// clay.com, and every card's front and back height, from this checkout's own dev server.
//   node docs/verification/2026-11-14-homepage-breadth/round-4/capture.mjs --base http://127.0.0.1:3317 [--draft]
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
const out = draft ? join(process.env.TMPDIR ?? "/tmp", "round-4-draft") : here;
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

const FEATURED = ["Clay", "GitHub", "Cloudflare", "Docker", "Firecrawl"];
const ALL = [...FEATURED, "n8n", "Claude Code", "Exa", "Porkbun", "Spider", "Open Places", "Grok Bot", "Elicit", "Context.dev"];
const slug = name => name.toLowerCase().replaceAll(" ", "-").replaceAll(".", "-");
const proof = serverProof();
execFileSync("mkdir", ["-p", out]);
const browser = await chromium.launch();
const results = [];
const heights = {};
const record = (target, assertion, observed) => results.push({ target, assertion, observed });
try {
  for (const [width, height] of [[1440, 1000], [390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2, reducedMotion: "reduce" });
    await page.goto(base);
    const settle = async () => { await page.evaluate(() => document.fonts.ready); await page.waitForLoadState("networkidle"); };
    const carousel = page.getByRole("region", { name: "Product usage examples" });
    const chooser = carousel.getByRole("group", { name: "Choose a product example" });
    await carousel.getByRole("article", { name: "Clay card" }).waitFor();
    await settle();
    await page.screenshot({ path: join(out, `first-screen-${width}.png`) });
    const first = await page.evaluate(() => ({ carouselTop: Math.round(document.querySelector('[aria-label="Product usage examples"]').getBoundingClientRect().top), elements: document.querySelectorAll("*").length }));
    record(`first-screen-${width}`, `${width}×${height} viewport`, `carousel top ${first.carouselTop}px; elements in page ${first.elements}`);
    for (const name of FEATURED) {
      await chooser.getByRole("button", { name, exact: true }).click();
      const card = carousel.getByRole("article", { name: `${name} card` });
      await card.waitFor();
      await settle();
      await carousel.locator("[data-current=true]").scrollIntoViewIfNeeded();
      await carousel.locator("[data-current=true]").screenshot({ path: join(out, `${slug(name)}-front-${width}.png`) });
      record(`${slug(name)}-front-${width}`, "front text as a visitor reads it", (await card.locator(".card-front").innerText()).replaceAll("\n", " / "));
      await card.getByRole("button", { name: "Details", exact: true }).click();
      await card.getByRole("button", { name: "Close details" }).waitFor();
      await settle();
      await carousel.locator("[data-current=true]").screenshot({ path: join(out, `${slug(name)}-back-${width}.png`) });
      record(`${slug(name)}-back-${width}`, "back text, How this was measured closed", (await card.locator(".card-back").innerText()).replaceAll("\n", " / "));
      await card.getByRole("button", { name: "Close details" }).click();
    }
    await carousel.getByRole("button", { name: "More examples" }).click();
    await settle();
    await carousel.getByRole("group", { name: "Choose a product example" }).locator("..").screenshot({ path: join(out, `more-opened-${width}.png`) });
    record(`more-opened-${width}`, "all fourteen toggles; none of the nine mounted", `${(await chooser.getByRole("button").evaluateAll(buttons => buttons.map(button => button.firstChild?.textContent))).join(", ")}; slides mounted ${await carousel.locator("[aria-roledescription=slide]").count()}`);
    for (const name of ["n8n", "Elicit"]) {
      await chooser.getByRole("button", { name, exact: true }).click();
      const card = carousel.getByRole("article", { name: `${name} card` });
      await card.waitFor();
      await settle();
      await carousel.locator("[data-current=true]").scrollIntoViewIfNeeded();
      await carousel.locator("[data-current=true]").screenshot({ path: join(out, `${slug(name)}-front-${width}.png`) });
      record(`${slug(name)}-front-${width}`, "front text as a visitor reads it", (await card.locator(".card-front").innerText()).replaceAll("\n", " / "));
    }
    // Every card's height, front and back with How this was measured closed; the back's content height is where its last line ends.
    for (const name of ALL) {
      await chooser.getByRole("button", { name, exact: true }).click();
      const card = carousel.getByRole("article", { name: `${name} card` });
      await settle();
      const front = await card.evaluate(element => Math.round(element.getBoundingClientRect().height));
      await card.getByRole("button", { name: "Details", exact: true }).click();
      await card.getByRole("button", { name: "Close details" }).waitFor();
      const back = await card.evaluate(element => {
        const box = element.getBoundingClientRect();
        const last = [...element.querySelectorAll(".card-back-content > *")].at(-1).getBoundingClientRect();
        const style = getComputedStyle(element);
        return { card: Math.round(box.height), content: Math.round(last.bottom - box.top + parseFloat(style.paddingBottom) + parseFloat(style.borderBottomWidth)) };
      });
      await card.getByRole("button", { name: "Close details" }).click();
      (heights[name] ??= {})[width] = { front, back: back.card, backContent: back.content, difference: back.card - front, contentDifference: back.content - front };
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
writeFileSync(join(out, "capture.json"), `${JSON.stringify({ server: proof, results, heights }, null, 2)}\n`);
console.log(out);
console.log(JSON.stringify(heights));

#!/usr/bin/env node
import { open, constants, readFile, mkdir, writeFile, copyFile } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { buildUsageCostReport, USAGE_REPORT_LIMITS, SYNTHETIC_SCENARIO } from "../src/domain/usage-cost-report.ts";
import { projectPrivateUsage } from "../src/domain/private-usage-card.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

try {
  const args = process.argv.slice(2);
  const scenario = args[0] === "--synthetic-haiku-20260924" ? args.shift() : null;
  if (args.shift() !== "--out") throw new Error();
  const destination = args.shift();
  if (!destination || !args.length || args.length > USAGE_REPORT_LIMITS.files || args.some(path => path.startsWith("--"))) throw new Error();
  const texts = [];
  for (const path of args) {
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > USAGE_REPORT_LIMITS.bytes) throw new Error();
      const buffer = Buffer.alloc(USAGE_REPORT_LIMITS.bytes + 1);
      let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await file.read(buffer, length, buffer.length - length, null);
        if (!bytesRead) break;
        length += bytesRead;
      }
      if (length > USAGE_REPORT_LIMITS.bytes) throw new Error();
      texts.push(new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, length)));
    } finally { await file.close(); }
  }
  const report = buildUsageCostReport(texts, scenario ? { syntheticScenario: SYNTHETIC_SCENARIO } : {});
  const preview = projectPrivateUsage(report);
  const generatedAt = new Date().toISOString();
  const compiled = await build({
    stdin: { contents: `import { createElement as h, useState } from "react";
      import { createRoot } from "react-dom/client";
      import { ProductCard } from "./components/product-card";
      const preview = ${JSON.stringify(preview)};
      const product = slug => slug === "claude-code"
        ? { slug, name: "Claude Code", domain: "claude.com", description: "An AI coding agent for your terminal and editor." }
        : { slug, name: "Codex", domain: "openai.com", description: "A coding agent. This local preview has no connected account." };
      function App() {
        const [theme, setTheme] = useState("light");
        return h("main", { className: "private-usage-preview-shell" },
          h("header", null, h("p", { className: "eyebrow" }, "PROPER RESPECT / LOCAL PREVIEW"),
            h("h1", null, "Usage behind your tools"),
            h("p", null, "Private local preview · not saved or published. Demonstration relationships; source designations appear on each row. No genuine owner metering has been validated."),
            h("p", null, "No collector connected. No automatic updates. Independent snapshots may overlap; there is no global total."),
            h("p", null, "Generated ${generatedAt}. API-equivalent scenario: ${scenario ? "explicit synthetic example" : "off (default)"}."),
            h("label", null, "Appearance ", h("select", { value: theme, onChange: event => { setTheme(event.target.value); document.documentElement.dataset.theme = event.target.value; } },
              h("option", { value: "light" }, "Light"), h("option", { value: "dark" }, "Dark")))),
          h("div", { className: "card-grid" },
            ...preview.tools.map((usage, index) => h("div", { key: usage.productSlug, "data-preview-product": usage.productSlug },
              h(ProductCard, { card: { product: product(usage.productSlug), status: "TESTING", headline: "A local snapshot for private review.", note: "Demonstration relationship only. Not saved in a collection or published profile." }, index, audience: "owner", privateUsage: usage }))),
            h(ProductCard, { card: { product: { slug: "github-copilot", name: "GitHub Copilot", domain: "github.com", description: "An unchanged, non-metered card using retained official branding." }, status: "TESTING", headline: "A tool does not need a usage meter.", note: "Synthetic relationship for compatibility verification." }, index: 2, audience: "owner" })),
          h("p", { className: "private-usage-preview-note" }, "Claude Code retains the existing example identity and initials; Codex uses initials because no exact retained product logo is configured. GitHub Copilot retains its existing official assets. Branding does not establish usage."));
      }
      createRoot(document.getElementById("root")).render(h(App));`, resolveDir: root },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const css = await readFile(join(root, "app/globals.css"), "utf8");
  const manifest = JSON.parse(await readFile(join(root, "public/product-assets/github-copilot/2026-09-19/source-manifest.json"), "utf8"));
  const assets = [...manifest.logos, ...manifest.typography.files, manifest.typography.license, { path: manifest.manifestPath }];
  // A new private directory is required: never overwrite an earlier preview.
  const output = resolve(destination);
  await mkdir(output, { mode: 0o700 });
  for (const asset of assets) {
    const target = join(output, asset.path.slice(1));
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    await copyFile(join(root, "public", asset.path.slice(1)), target, constants.COPYFILE_EXCL);
  }
  await writeFile(join(output, "preview.js"), compiled.outputFiles[0].text, { flag: "wx", mode: 0o600 });
  await writeFile(join(output, "styles.css"), css, { flag: "wx", mode: 0o600 });
  await writeFile(join(output, "index.html"), `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'"><title>Private usage card preview</title><link rel="stylesheet" href="./styles.css"></head><body><div id="root"></div><script src="./preview.js"></script></body></html>`, { flag: "wx", mode: 0o600 });
  console.log(`Private preview generated at ${generatedAt}. Serve the output directory on loopback only; open index.html through that local server. No source identities were included.`);
} catch {
  console.error("Could not create preview. Use Node.js 22+ with --experimental-strip-types, optional --synthetic-haiku-20260924, --out NEW_DIRECTORY, and 1–32 explicit sanitized capture files. Existing outputs are never overwritten.");
  process.exitCode = 1;
}

#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

try {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--out" || !args[1] || args[1].startsWith("--")) {
    throw new Error("Expected --out NEW_DIRECTORY.");
  }
  const compiled = await build({
    absWorkingDir: root,
    entryPoints: ["prototypes/codex-connection/entry.tsx"],
    bundle: true,
    write: false,
    outfile: "preview.js",
    platform: "browser",
    format: "iife",
    target: ["es2022"],
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const javascript = compiled.outputFiles.find((file) => file.path.endsWith(".js"));
  const stylesheet = compiled.outputFiles.find((file) => file.path.endsWith(".css"));
  if (!javascript || !stylesheet) throw new Error("The local bundle is incomplete.");
  // An exclusive new directory prevents overwriting an earlier preview or source files.
  const output = resolve(args[1]);
  await mkdir(output, { mode: 0o700 });
  await writeFile(join(output, "preview.js"), javascript.contents, { flag: "wx", mode: 0o600 });
  await writeFile(join(output, "styles.css"), stylesheet.contents, { flag: "wx", mode: 0o600 });
  await writeFile(join(output, "index.html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'"><title>Codex connection preview · Proper Respect</title><link rel="icon" href="data:,"><link rel="stylesheet" href="./styles.css"></head><body><div id="root"></div><script src="./preview.js"></script></body></html>`, { flag: "wx", mode: 0o600 });
  console.log(`Synthetic Codex connection preview created at ${output}. Serve this directory on loopback only. It contains generated fixture data and no real account or device history.`);
} catch (error) {
  console.error(`Could not create the local preview: ${error instanceof Error ? error.message : "unknown error"} Use --out NEW_DIRECTORY. Existing output is never overwritten.`);
  process.exitCode = 1;
}

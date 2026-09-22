import { build } from "esbuild";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const repositoryRoot = path.resolve(packageRoot, "../..");
const common = { absWorkingDir: packageRoot, bundle: true, format: "esm", target: "es2022", alias: { "@": repositoryRoot }, logLevel: "warning" };
await mkdir(path.join(packageRoot, "dist"), { recursive: true });
await build({ ...common, entryPoints: ["src/main.ts"], outfile: "dist/main.mjs", platform: "node", packages: "external" });
await build({ ...common, entryPoints: ["scripts/runtime-probe.ts"], outfile: "dist/runtime-probe.mjs", platform: "node", packages: "external" });
if (!process.argv.includes("--server-only")) {
  const ui = await build({ ...common, entryPoints: ["ui/main.ts"], write: false, platform: "browser", loader: { ".svg": "dataurl", ".jpg": "dataurl", ".png": "dataurl" } });
  const js = ui.outputFiles.find(file => !file.path.endsWith(".css"))?.text;
  if (!js) throw new Error("Widget JavaScript bundle missing");
  const css = await readFile(path.join(packageRoot, "ui/style.css"), "utf8");
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Proper Respect public profile</title><style>${css.replaceAll("</style", "<\\/style")}</style><body><div id="root"></div><script type="module">${js.replaceAll("</script", "<\\/script")}</script></body></html>`;
  await writeFile(path.join(packageRoot, "dist/widget.html"), html);
  await mkdir(path.join(packageRoot, "dist/host"), { recursive: true });
  for (const name of ["main", "sandbox"]) {
    await build({ ...common, entryPoints: [`host/${name}.ts`], outfile: `dist/host/${name}.js`, platform: "browser" });
  }
  for (const name of ["index", "sandbox"]) await copyFile(path.join(packageRoot, `host/${name}.html`), path.join(packageRoot, `dist/host/${name}.html`));
  await build({ ...common, entryPoints: ["host/server.ts"], outfile: "dist/host-server.mjs", platform: "node", packages: "external" });
}
console.log("Local prototype build complete.");

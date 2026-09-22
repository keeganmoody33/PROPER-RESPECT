import { build } from "esbuild";
import { spawn } from "node:child_process";
import path from "node:path";
const packageRoot = path.resolve(import.meta.dirname, "../..");
await build({ absWorkingDir: packageRoot, entryPoints: ["tests/browser/fixture-server.ts"], outfile: "dist/browser-fixture.mjs", bundle: true, platform: "node", format: "esm", target: "node22", packages: "external", alias: { "@": path.resolve(packageRoot, "../..") } });
const child = spawn(process.execPath, ["dist/browser-fixture.mjs"], { cwd: packageRoot, stdio: "inherit", env: { ...process.env, PROPER_RESPECT_LOCAL_MCP: "1", PUBLIC_SITE_ORIGIN: "https://public.example:8443" } });
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
child.on("exit", code => process.exit(code ?? 0));

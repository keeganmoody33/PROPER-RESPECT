import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
const packageRoot = fileURLToPath(new URL("../", import.meta.url));
await build({ absWorkingDir: packageRoot, entryPoints: ["tests/server.test.ts"], outfile: ".test-build/server.test.mjs", bundle: true, platform: "node", format: "esm", target: "node22", packages: "external", alias: { "@": path.resolve(packageRoot, "../..") } });
const result = spawnSync(process.execPath, ["--test", ".test-build/server.test.mjs"], { cwd: packageRoot, stdio: "inherit" });
process.exit(result.status ?? 1);

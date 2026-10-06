import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
if (process.versions.node.split(".")[0] !== "24") {
  throw new Error("Use Node 24 from .nvmrc for this fixture environment.");
}
const port = process.env.PROPER_RESPECT_FIXTURE_PORT ?? "3000";
if (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65535) {
  throw new Error("PROPER_RESPECT_FIXTURE_PORT must be an unprivileged port.");
}

const environment = Object.fromEntries(
  ["PATH", "TMPDIR", "TEMP", "TMP", "TERM", "SystemRoot", "CI"]
    .filter(key => process.env[key] !== undefined)
    .map(key => [key, process.env[key]]),
);
for (const filename of [".env", ".env.local", ".env.development", ".env.development.local"]) {
  const path = resolve(root, filename);
  if (!existsSync(path)) continue;
  for (const match of readFileSync(path, "utf8").matchAll(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)) {
    environment[match[1]] = "";
  }
}
for (const key of [
  "NEXT_PUBLIC_CONVEX_URL", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_POSTHOG_KEY", "NEXT_PUBLIC_POSTHOG_API_HOST", "CONVEX_DEPLOY_KEY",
  "CONVEX_DEPLOYMENT", "CONVEX_SELF_HOSTED_URL", "CONVEX_SELF_HOSTED_ADMIN_KEY",
]) environment[key] = "";
Object.assign(environment, {
  NODE_ENV: "development",
  NEXT_TELEMETRY_DISABLED: "1",
  PROPER_RESPECT_E2E_REFERENCE: "1",
  PUBLIC_SITE_ORIGIN: "https://public.example",
});

console.log(`Synthetic public fixture: http://127.0.0.1:${port}/lecturesfrom`);
const child = spawn(process.execPath, [resolve(root, "node_modules/next/dist/bin/next"),
  "dev", "--hostname", "127.0.0.1", "--port", port], { cwd: root, env: environment, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });

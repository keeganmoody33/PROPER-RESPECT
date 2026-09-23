import { createInterface } from "node:readline";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { renameSync, symlinkSync, writeFileSync, statSync, readdirSync } from "node:fs";

export function run(mode) {
  const root = dirname(process.cwd());
  const argv = ["app-server", "--listen", "stdio://", "--strict-config", "-c", "analytics.enabled=false", "-c", "features.plugins=false", "-c", 'cli_auth_credentials_store="file"', "-c", 'otel.exporter="none"', "-c", 'otel.trace_exporter="none"', "-c", 'otel.metrics_exporter="none"'];
  const env = { HOME: join(root, "home"), CODEX_HOME: join(root, "codex"), TMPDIR: join(root, "tmp"), XDG_CONFIG_HOME: join(root, "config"), XDG_CACHE_HOME: join(root, "cache"), LANG: "C", LC_ALL: "C", CODEX_INTERNAL_APP_SERVER_REMOTE_CONTROL_DISABLED: "1" };
  const fail = (code = 19) => process.exit(code);
  if (JSON.stringify(process.argv.slice(2)) !== JSON.stringify(argv) || process.cwd() !== join(root, "cwd")) fail(21);
  const keys = Object.keys(process.env).filter(key => !(process.platform === "darwin" && key === "__CF_USER_TEXT_ENCODING"));
  if (keys.sort().join() !== Object.keys(env).sort().join()) fail(22);
  for (const [key, value] of Object.entries(env)) if (process.env[key] !== value) fail(23);
  for (const name of ["", "home", "codex", "tmp", "config", "cache", "cwd"]) {
    const info = statSync(join(root, name));
    if ((info.mode & 0o777) !== 0o700 || info.uid !== process.getuid() || !info.isDirectory()) fail(24);
    if (name && readdirSync(join(root, name)).length !== 0) fail(25);
  }
  process.stderr.write("SYNTHETIC_PRIVATE_STREAM_SENTINEL");
  let count = 0;
  const lines = createInterface({ input: process.stdin });
  const send = value => process.stdout.write(`${JSON.stringify(value)}\n`);
  lines.on("line", async line => {
    let value;
    try { value = JSON.parse(line); } catch { fail(); }
    count++;
    if (count === 1) {
      if (value.id !== 1 || value.method !== "initialize") fail();
      send({ id: 1, result: { codexHome: "SYNTHETIC_PRIVATE_STREAM_SENTINEL", platformFamily: "unix", platformOs: "fixture", userAgent: "fixture" } });
    } else if (count === 2) {
      if (JSON.stringify(value) !== JSON.stringify({ method: "initialized", params: {} })) fail();
    } else if (count === 3) {
      if (JSON.stringify(value) !== JSON.stringify({ id: 2, method: "account/usage/read", params: {} })) fail();
      if (["descendant", "resistant", "inherited-pipes"].includes(mode)) {
        const program = `${mode === "resistant" ? 'process.on("SIGTERM", () => {});' : ""}process.send("ready");setInterval(() => {}, 1000);setTimeout(() => process.exit(0), 8000);`;
        const descendant = spawn(process.execPath, ["-e", program], { env: {}, stdio: ["ignore", mode === "inherited-pipes" ? 1 : "ignore", "ignore", "ipc"] });
        await new Promise(resolve => descendant.once("message", resolve));
        descendant.disconnect();
        descendant.unref();
      }
      if (mode === "replace-directory") {
        renameSync(join(root, "cache"), join(root, "preserved-cache"));
        symlinkSync(join(root, "preserved-cache"), join(root, "cache"));
      }
      if (mode === "extra-file") writeFileSync(join(root, "private-unexpected"), "SYNTHETIC_PRIVATE_FILE_SENTINEL", { mode: 0o600 });
      if (mode === "malformed") process.stdout.write("SYNTHETIC_PRIVATE_INVALID\n");
      else if (mode === "overflow") process.stdout.write("x".repeat(512001));
      else send({ id: 2, result: { summary: { lifetimeTokens: 0 } } });
    } else fail();
  });
}

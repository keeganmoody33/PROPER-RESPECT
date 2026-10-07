import { spawn } from "node:child_process";
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const directory = await realpath(await mkdtemp(join(tmpdir(), "proper-respect-browser-fixture-")));
await chmod(directory, 0o700);
const child = spawn(process.execPath, [
  "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
  "--disable-warning=ExperimentalWarning",
  fileURLToPath(new URL("../../scripts/collector-fixture-server.mjs", import.meta.url)),
  "--directory", directory, "--port", "4188",
], { cwd: fileURLToPath(new URL("../..", import.meta.url)), stdio: "inherit" });
let closing = false;
const stop = () => {
  if (closing) return;
  closing = true;
  child.kill("SIGTERM");
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
child.on("error", async () => {
  await rm(directory, { recursive: true, force: true });
  process.exitCode = 1;
});
child.on("exit", async code => {
  await rm(directory, { recursive: true, force: true });
  process.exitCode = closing ? 0 : code ?? 1;
});

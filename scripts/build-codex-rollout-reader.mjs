#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { linkSync, lstatSync, realpathSync, rmSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

// Development artifact only. No installation, source discovery or application launch.
let temporary;
try {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--output" || !isAbsolute(args[1]) || resolve(args[1]) !== args[1] || !["darwin", "linux"].includes(process.platform)) throw new Error();
  const output = args[1], parent = dirname(output);
  if (realpathSync(parent) !== parent || !lstatSync(parent).isDirectory()) throw new Error();
  try { lstatSync(output); throw new Error("existing-output"); } catch (error) { if (error.code !== "ENOENT") throw error; }
  temporary = join(parent, `.proper-codex-reader-${randomBytes(12).toString("hex")}`);
  const source = fileURLToPath(new URL("../native/codex-rollout-reader.c", import.meta.url));
  const result = spawnSync("cc", ["-std=c11", "-O2", "-Wall", "-Wextra", "-Werror", "-fstack-protector-strong", "-D_FORTIFY_SOURCE=2", source, "-o", temporary], { encoding: "utf8", timeout: 30_000, stdio: "pipe" });
  if (result.status !== 0 || result.error) throw new Error();
  // The requested destination must stay new; output is never an existing installed helper.
  try { lstatSync(output); throw new Error("existing-output"); } catch (error) { if (error.code !== "ENOENT") throw error; }
  linkSync(temporary, output); rmSync(temporary); temporary = undefined;
  process.stdout.write("Built the local Codex rollout reader.\n");
} catch {
  process.stderr.write("Could not build the local Codex rollout reader. Select a new absolute output in an existing canonical directory with a C compiler available.\n");
  process.exitCode = 1;
} finally {
  if (temporary) rmSync(temporary, { force: true });
}

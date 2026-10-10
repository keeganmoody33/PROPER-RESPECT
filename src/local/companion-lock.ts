import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { lstat, realpath } from "node:fs/promises";
export async function acquireCompanionLock(path: string): Promise<() => Promise<void>> {
  const parent = dirname(resolve(path)), stat = await lstat(parent);
  if (!stat.isDirectory() || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.() || await realpath(parent) !== parent) throw new Error("Private state directory required.");
  const child = spawn(fileURLToPath(new URL("../../.local-bin/companion-lock", import.meta.url)), [path], { stdio: ["pipe", "pipe", "ignore"], env: { NODE_ENV: "production", LANG: "C", LC_ALL: "C" } });
  const closed = new Promise<void>(resolve => child.once("close", () => resolve()));
  await new Promise<void>((resolve, reject) => {
    child.once("error", () => reject(new Error("Companion lock unavailable.")));
    child.once("exit", () => reject(new Error("Another helper owns this state, or the state lock is unsafe.")));
    child.stdout.once("data", data => data.toString() === "1" ? resolve() : reject(new Error("Companion lock unavailable.")));
  });
  return async () => { child.stdin.end(); await closed; };
}

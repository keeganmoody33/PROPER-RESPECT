import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { lstat, mkdir, mkdtemp, realpath, rmdir } from "node:fs/promises";
import type { Stats } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { captureCodexAccount } from "../../src/local/codex-account-capture";
import { CODEX_NATIVE_SPECIFICATION } from "../../src/local/codex-native-adapter";

type Mode = "success" | "malformed" | "descendant" | "resistant" | "inherited-pipes" | "replace-directory" | "extra-file" | "overflow";
type Input = { privateScratchBase: string; captureInput: Parameters<typeof captureCodexAccount>[0]; mode: Mode };
const modes: readonly Mode[] = ["success", "malformed", "descendant", "resistant", "inherited-pipes", "replace-directory", "extra-file", "overflow"];
const same = (a: Stats, b: Stats) => a.dev === b.dev && a.ino === b.ino;
const ownedDirectory = (s: Stats) => s.isDirectory() && s.uid === process.getuid?.() && (s.mode & 0o7777) === 0o700;
const delay = (ms: number) => new Promise<void>(done => setTimeout(done, ms));

function groupState(pid: number): "present" | "absent" | "unknown" {
  try { process.kill(-pid, 0); return "present"; }
  catch (error) { return (error as NodeJS.ErrnoException).code === "ESRCH" ? "absent" : "unknown"; }
}

/** Test-only POSIX group exercise. This does not launch or sandbox native Codex. */
export async function exerciseSyntheticAdapter(provided: Input): Promise<Awaited<ReturnType<typeof captureCodexAccount>>> {
  const input = { ...provided, captureInput: { ...provided.captureInput } };
  if (process.platform === "win32" || !modes.includes(input.mode)) return { status: "invalid-input" };
  let root: string | undefined, rootInfo: Stats | undefined, baseInfo: Stats;
  const directories = new Map<string, Stats>();
  let child: ChildProcessWithoutNullStreams | undefined;
  let finished: Promise<"complete" | "termination-unconfirmed" | "cleanup-unconfirmed"> | undefined;
  const finish = () => finished ??= (async () => {
    let uncertain = false;
    if (child?.pid && groupState(child.pid) !== "absent") {
      uncertain = true;
      for (const signal of ["SIGTERM", "SIGKILL"] as const) {
        try { process.kill(-child.pid, signal); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") return "termination-unconfirmed"; }
        const deadline = Date.now() + 250;
        while (Date.now() < deadline && groupState(child.pid) !== "absent") await delay(10);
        if (groupState(child.pid) === "absent") break;
      }
      if (groupState(child.pid) !== "absent") return "termination-unconfirmed";
    }
    if (root) {
      try {
        const currentBase = await lstat(input.privateScratchBase);
        if (!baseInfo || !same(baseInfo, currentBase) || !ownedDirectory(currentBase) || await realpath(input.privateScratchBase) !== input.privateScratchBase) throw new Error("Rejected scratch.");
        const currentRoot = await lstat(root);
        if (!rootInfo || !same(rootInfo, currentRoot) || !ownedDirectory(currentRoot)) throw new Error("Rejected scratch.");
        for (const [name, info] of directories) {
          const current = await lstat(join(root, name));
          if (!same(info, current) || !ownedDirectory(current)) throw new Error("Rejected scratch.");
        }
        for (const [name, info] of directories) {
          const current = await lstat(join(root, name));
          if (!same(info, current) || !ownedDirectory(current)) throw new Error("Rejected scratch.");
          await rmdir(join(root, name));
        }
        if (!same(rootInfo, await lstat(root))) throw new Error("Rejected scratch.");
        await rmdir(root);
      } catch { return "cleanup-unconfirmed"; }
    }
    return uncertain ? "termination-unconfirmed" : "complete";
  })();
  try {
    if (!isAbsolute(input.privateScratchBase) || resolve(input.privateScratchBase) !== input.privateScratchBase || await realpath(input.privateScratchBase) !== input.privateScratchBase) return { status: "invalid-input" };
    baseInfo = await lstat(input.privateScratchBase);
    if (!ownedDirectory(baseInfo)) return { status: "invalid-input" };
    root = await mkdtemp(join(input.privateScratchBase, "synthetic-"));
    rootInfo = await lstat(root);
    if (!ownedDirectory(rootInfo)) throw new Error("Rejected scratch.");
    for (const name of CODEX_NATIVE_SPECIFICATION.directories) {
      await mkdir(join(root, name), { mode: 0o700 });
      const info = await lstat(join(root, name));
      if (!ownedDirectory(info)) throw new Error("Rejected scratch.");
      directories.set(name, info);
    }
    const environment: Record<string, string> = { ...CODEX_NATIVE_SPECIFICATION.fixedEnvironment };
    for (const [key, directory] of Object.entries(CODEX_NATIVE_SPECIFICATION.environment)) environment[key] = join(root, directory);
    const cwd = join(root, "cwd");
    const script = resolve("tests/fixtures/codex-native-adapter", `${input.mode}.mjs`);
    return await captureCodexAccount(input.captureInput, () => {
      const started = spawn(process.execPath, [script, ...CODEX_NATIVE_SPECIFICATION.argv], { cwd, env: environment as NodeJS.ProcessEnv, shell: false, detached: true, stdio: ["pipe", "pipe", "pipe"] });
      child = started;
      started.once("exit", () => { void finish(); });
      return started;
    }, finish);
  } catch {
    const completion = await finish();
    return { status: completion === "complete" ? "transport-rejected" : completion };
  }
}

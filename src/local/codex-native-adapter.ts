import { createHash } from "node:crypto";
import { constants, type Stats } from "node:fs";
import { lstat, open, realpath, type FileHandle } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

export const CODEX_NATIVE_PIN = Object.freeze({
  platform: "darwin", architecture: "arm64", version: "0.153.4", bytes: 220584000,
  sha256: "b973d440acac501fd2594a43e7ca9ce41e0a65b9dfb28d0d7a7837c99e1261e3",
  sourceCommit: "3d2ee51ca2d5db578f328aa75e20aa22c0197c9a",
} as const);

export const CODEX_NATIVE_SPECIFICATION = Object.freeze({
  argv: Object.freeze(["app-server", "--listen", "stdio://", "--strict-config", "-c", "analytics.enabled=false", "-c", "features.plugins=false", "-c", 'cli_auth_credentials_store="file"', "-c", 'otel.exporter="none"', "-c", 'otel.trace_exporter="none"', "-c", 'otel.metrics_exporter="none"']),
  directories: Object.freeze(["home", "codex", "tmp", "config", "cache", "cwd"] as const),
  environment: Object.freeze({ HOME: "home", CODEX_HOME: "codex", TMPDIR: "tmp", XDG_CONFIG_HOME: "config", XDG_CACHE_HOME: "cache" } as const),
  fixedEnvironment: Object.freeze({ LANG: "C", LC_ALL: "C", CODEX_INTERNAL_APP_SERVER_REMOTE_CONTROL_DISABLED: "1" }),
});

const blockers = Object.freeze(["system-config-not-isolated", "managed-preferences-not-isolated", "startup-services-not-contained", "account-selection-unproved"] as const);
type Diagnostic = "unsupported-host" | "invalid-executable" | "pin-mismatch" | "identity-changed" | "inspection-failed";
class InspectionRejection extends Error { constructor(readonly diagnostic: Diagnostic) { super("Inspection rejected."); } }
type Inspection =
  | { status: "identity-rejected"; diagnostic: Diagnostic }
  | { status: "blocked"; pin: typeof CODEX_NATIVE_PIN; specification: typeof CODEX_NATIVE_SPECIFICATION; blockers: typeof blockers; nativeExecuted: false; sourceBinaryReproducibilityProven: false };
const rejected = (diagnostic: Diagnostic): Inspection => ({ status: "identity-rejected", diagnostic });
const valid = (s: Stats) => s.isFile() && s.nlink === 1 && (s.mode & 0o111) !== 0 && (s.mode & 0o022) === 0;
const same = (a: Stats, b: Stats) => ["dev", "ino", "size", "mode", "uid", "gid", "nlink", "mtimeMs", "ctimeMs"].every(key => a[key as keyof Stats] === b[key as keyof Stats]);

/** Inspects public release bytes only; a match never grants native execution. */
export async function inspectPinnedCodexAdapter(input: Readonly<{ executablePath: string }>): Promise<Inspection> {
  if (process.platform !== CODEX_NATIVE_PIN.platform || process.arch !== CODEX_NATIVE_PIN.architecture) return rejected("unsupported-host");
  let handle: FileHandle | undefined;
  let result: Inspection = rejected("inspection-failed");
  try {
    const path = input.executablePath;
    if (!isAbsolute(path) || resolve(path) !== path || await realpath(path) !== path) return rejected("invalid-executable");
    const before = await lstat(path);
    if (!valid(before)) return rejected("invalid-executable");
    if (before.size !== CODEX_NATIVE_PIN.bytes) return rejected("pin-mismatch");
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const initial = await handle.stat();
    if (!valid(initial) || !same(before, initial)) throw new InspectionRejection("identity-changed");
    const hash = createHash("sha256"), buffer = Buffer.alloc(64 * 1024);
    let length = 0;
    const deadline = Date.now() + 5_000;
    for (;;) {
      if (Date.now() > deadline) throw new Error("Inspection failed.");
      const { bytesRead } = await handle.read(buffer, 0, Math.min(buffer.length, CODEX_NATIVE_PIN.bytes + 1 - length), length);
      if (!bytesRead) break;
      length += bytesRead;
      if (length > CODEX_NATIVE_PIN.bytes) throw new InspectionRejection("identity-changed");
      hash.update(buffer.subarray(0, bytesRead));
    }
    const after = await handle.stat(), current = await lstat(path);
    if (!valid(after) || !valid(current) || !same(initial, after) || !same(initial, current) || await realpath(path) !== path) result = rejected("identity-changed");
    else if (length !== CODEX_NATIVE_PIN.bytes || hash.digest("hex") !== CODEX_NATIVE_PIN.sha256) result = rejected("pin-mismatch");
    else result = { status: "blocked", pin: CODEX_NATIVE_PIN, specification: CODEX_NATIVE_SPECIFICATION, blockers, nativeExecuted: false, sourceBinaryReproducibilityProven: false };
  } catch (error) { result = rejected(error instanceof InspectionRejection ? error.diagnostic : "inspection-failed"); }
  finally {
    try { await handle?.close(); }
    catch { result = rejected("inspection-failed"); }
  }
  return result;
}

import { afterEach, expect, test, vi } from "vitest";
import { spawn } from "node:child_process";
import { mkdtemp, realpath, rm, readdir, writeFile, chmod, symlink, lstat, readFile, open, type FileHandle } from "node:fs/promises";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { captureCodexAccount } from "./codex-account-capture";
import { CODEX_NATIVE_PIN, CODEX_NATIVE_SPECIFICATION, inspectPinnedCodexAdapter } from "./codex-native-adapter";
import { exerciseSyntheticAdapter } from "../../tests/support/codex-synthetic-adapter";

vi.mock("node:fs/promises", async importOriginal => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, open: vi.fn(actual.open), lstat: vi.fn(actual.lstat) };
});
vi.mock("node:crypto", async importOriginal => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, createHash: vi.fn(actual.createHash) };
});
vi.mock("node:child_process", async importOriginal => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return { ...actual, spawn: vi.fn(actual.spawn) };
});

const bases: string[] = [];
const hostPlatform = Object.getOwnPropertyDescriptor(process, "platform")!;
const hostArch = Object.getOwnPropertyDescriptor(process, "arch")!;
afterEach(async () => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  Object.defineProperty(process, "platform", hostPlatform);
  Object.defineProperty(process, "arch", hostArch);
  await Promise.all(bases.splice(0).map(path => rm(path, { recursive: true, force: true })));
});
async function base() { const path = await realpath(await mkdtemp(join(tmpdir(), "codex-native-test-"))); bases.push(path); return path; }
const metadata = { ownerAlias: "fixture-owner", accountAlias: "fixture-account", captureId: "fixture-capture", capturedAt: "2026-09-23T12:00:00Z" };
const child = (mode = "ok") => spawn(process.execPath, [resolve("tests/fixtures/codex-capture/server.mjs"), mode], { stdio: ["pipe", "pipe", "pipe"], env: {} as NodeJS.ProcessEnv });

test("rejects lifecycle failure before retention", async () => {
  const privateBase = await base();
  const outcome = await captureCodexAccount({ ...metadata, privateBase, directoryName: "attempt" }, () => child(), async () => "termination-unconfirmed");
  expect(outcome).toEqual({ status: "termination-unconfirmed" });
  expect(await readdir(privateBase)).toEqual([]);
});

test.each(["throw", "hang", "cleanup"])("bounds lifecycle %s and never retains", async mode => {
  const privateBase = await base();
  const barrier = async () => {
    if (mode === "throw") throw new Error("SYNTHETIC_PRIVATE_STREAM_SENTINEL");
    if (mode === "hang") return await new Promise<"complete">(() => {});
    return "cleanup-unconfirmed" as const;
  };
  const outcome = await captureCodexAccount({ ...metadata, privateBase, directoryName: "attempt" }, () => child(), barrier);
  expect(outcome).toEqual({ status: mode === "cleanup" ? "cleanup-unconfirmed" : "termination-unconfirmed" });
  expect(await readdir(privateBase)).toEqual([]);
});

test.each(["invalid-input", "transport-rejected", "spawn-throw"])("runs completion once on %s", async mode => {
  const privateBase = await base();
  const finish = vi.fn(async () => "complete" as const);
  const outcome = await captureCodexAccount({ ...metadata, privateBase, directoryName: mode === "invalid-input" ? "../bad" : "attempt" }, () => {
    if (mode === "spawn-throw") throw new Error("SYNTHETIC_PRIVATE_STREAM_SENTINEL");
    return child("malformed");
  }, finish);
  expect(outcome.status).toBe(mode === "invalid-input" ? mode : "transport-rejected");
  expect(finish).toHaveBeenCalledTimes(1);
  expect(await readdir(privateBase)).toEqual([]);
});

test("retention waits for completion, then uses immutable copied input", async () => {
  const privateBase = await base();
  const input = { ...metadata, privateBase, directoryName: "attempt" };
  let inspected = false;
  const outcome = await captureCodexAccount(input, () => child(), async () => {
    inspected = (await readdir(privateBase)).length === 0;
    input.directoryName = "../outside";
    input.ownerAlias = "mutated";
    return "complete";
  });
  expect(inspected).toBe(true);
  expect(outcome).toEqual({ status: "saved" });
  const retained = JSON.parse(await readFile(join(privateBase, "attempt", "capture.json"), "utf8"));
  expect(retained.scope.ownerAlias === metadata.ownerAlias).toBe(true);
});

function supportedHost() {
  Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
  Object.defineProperty(process, "arch", { value: "arm64", configurable: true });
}

test("native inspection rejects unsupported host without opening anything", async () => {
  Object.defineProperty(process, "platform", { value: "win32", configurable: true });
  expect(await inspectPinnedCodexAdapter({ executablePath: "/unread" })).toEqual({ status: "identity-rejected", diagnostic: "unsupported-host" });
});

test.each(["relative", "symlink", "directory", "writable", "nonexecutable", "wrong-size"])("native inspection rejects %s without launch", async mode => {
  supportedHost();
  const directory = await base(), file = join(directory, "executable");
  await writeFile(file, "synthetic", { mode: 0o700 });
  let path = file;
  if (mode === "relative") path = "relative";
  if (mode === "directory") path = directory;
  if (mode === "symlink") { path = join(directory, "link"); await symlink(file, path); }
  if (mode === "writable") await chmod(file, 0o777);
  if (mode === "nonexecutable") await chmod(file, 0o600);
  expect(await inspectPinnedCodexAdapter({ executablePath: path })).toEqual({ status: "identity-rejected", diagnostic: mode === "wrong-size" ? "pin-mismatch" : "invalid-executable" });
});

test("native pin and invocation policy are deeply frozen without execution controls", () => {
  expect([CODEX_NATIVE_PIN, CODEX_NATIVE_SPECIFICATION, CODEX_NATIVE_SPECIFICATION.argv, CODEX_NATIVE_SPECIFICATION.environment, CODEX_NATIVE_SPECIFICATION.fixedEnvironment, CODEX_NATIVE_SPECIFICATION.directories].every(Object.isFrozen)).toBe(true);
  expect("launchAuthorized" in CODEX_NATIVE_SPECIFICATION).toBe(false);
});

test.each(["match", "wrong-hash", "replacement", "changed-descriptor", "growth", "read-failure", "close-failure", "deadline"])("synthetic identity snapshot %s", async mode => {
  supportedHost();
  const directory = await base(), file = join(directory, "synthetic-identity");
  await writeFile(file, "synthetic-only", { mode: 0o700 });
  const actualInfo = await lstat(file);
  const info = Object.assign(Object.create(Object.getPrototypeOf(actualInfo)), actualInfo, { size: CODEX_NATIVE_PIN.bytes });
  const close = vi.fn(async () => { if (mode === "close-failure") throw new Error("PRIVATE"); });
  let stats = 0, reads = 0, lstatCalls = 0;
  vi.mocked(lstat).mockImplementation(async () => {
    lstatCalls++;
    return Object.assign(Object.create(Object.getPrototypeOf(info)), info, { ino: mode === "replacement" && lstatCalls > 1 ? info.ino + 1 : info.ino });
  });
  vi.mocked(open).mockResolvedValue({
    stat: async () => { stats++; return Object.assign(Object.create(Object.getPrototypeOf(info)), info, { mtimeMs: mode === "changed-descriptor" && stats > 1 ? info.mtimeMs + 1 : info.mtimeMs }); },
    read: async (_buffer: Buffer, _offset: number, length: number, position: number) => {
      reads++;
      if (mode === "read-failure") throw new Error("PRIVATE");
      return { bytesRead: Math.min(length, Math.max(0, CODEX_NATIVE_PIN.bytes + (mode === "growth" ? 1 : 0) - position)) };
    }, close,
  } as unknown as FileHandle);
  vi.mocked(createHash).mockReturnValue({ update() { return this; }, digest: () => mode === "wrong-hash" ? "wrong" : CODEX_NATIVE_PIN.sha256 } as unknown as ReturnType<typeof createHash>);
  if (mode === "deadline") vi.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValue(5_001);
  const outcome = await inspectPinnedCodexAdapter({ executablePath: file });
  expect(mode === "deadline" ? reads === 0 : reads > 0 && reads <= Math.ceil((CODEX_NATIVE_PIN.bytes + 1) / 65536) + 1).toBe(true);
  expect(close).toHaveBeenCalledTimes(1);
  expect(vi.mocked(open).mock.calls[0][1]).toBe(constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  expect(spawn).not.toHaveBeenCalled();
  if (mode === "match") {
    expect(outcome.status).toBe("blocked");
    expect("nativeExecuted" in outcome && outcome.nativeExecuted === false).toBe(true);
  } else expect(outcome).toEqual({ status: "identity-rejected", diagnostic: mode === "wrong-hash" ? "pin-mismatch" : ["read-failure", "close-failure", "deadline"].includes(mode) ? "inspection-failed" : "identity-changed" });
});

test("synthetic runner proves exact argv closed environment cwd modes cleanup and output containment", async () => {
  const privateBase = await base(), privateScratchBase = await base();
  process.env.SYNTHETIC_INHERITED_SECRET = "PRIVATE";
  try {
    const outcome = await exerciseSyntheticAdapter({ mode: "success", privateScratchBase, captureInput: { ...metadata, privateBase, directoryName: "attempt" } });
    expect(outcome).toEqual({ status: "saved" });
    expect(spawn).toHaveBeenCalledTimes(1);
    const invocation = vi.mocked(spawn).mock.calls[0];
    const options = invocation[2] as { env: Record<string, string>; shell: boolean; detached: boolean; cwd: string; stdio: string[] };
    expect(invocation[0] === process.execPath && JSON.stringify((invocation[1] as string[]).slice(1)) === JSON.stringify(CODEX_NATIVE_SPECIFICATION.argv)).toBe(true);
    expect(Object.keys(options.env).sort().join() === ["HOME", "CODEX_HOME", "TMPDIR", "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "LANG", "LC_ALL", "CODEX_INTERNAL_APP_SERVER_REMOTE_CONTROL_DISABLED"].sort().join()).toBe(true);
    expect(options.shell === false && options.detached === true && options.stdio.every(value => value === "pipe")).toBe(true);
    expect(await readdir(privateScratchBase)).toEqual([]);
    const text = await readFile(join(privateBase, "attempt", "capture.json"), "utf8");
    expect(text.includes("SYNTHETIC_PRIVATE")).toBe(false);
    expect((await lstat(join(privateBase, "attempt", "capture.json"))).mode & 0o777).toBe(0o600);
  } finally { delete process.env.SYNTHETIC_INHERITED_SECRET; }
});

test.each(["descendant", "resistant", "inherited-pipes"] as const)("synthetic runner rejects %s even after forced teardown", async mode => {
  const privateBase = await base(), privateScratchBase = await base();
  const started = performance.now();
  const outcome = await exerciseSyntheticAdapter({ mode, privateScratchBase, captureInput: { ...metadata, privateBase, directoryName: "attempt" } });
  expect(outcome).toEqual({ status: "termination-unconfirmed" });
  expect(performance.now() - started < 3_000).toBe(true);
  expect(await readdir(privateBase)).toEqual([]);
});

test("synthetic runner cleans scratch on spawn exception", async () => {
  const privateBase = await base(), privateScratchBase = await base();
  vi.mocked(spawn).mockImplementationOnce(() => { throw new Error("SYNTHETIC_PRIVATE_STREAM_SENTINEL"); });
  expect(await exerciseSyntheticAdapter({ mode: "success", privateScratchBase, captureInput: { ...metadata, privateBase, directoryName: "attempt" } })).toEqual({ status: "transport-rejected" });
  expect(await readdir(privateScratchBase)).toEqual([]);
  expect(await readdir(privateBase)).toEqual([]);
});

test("synthetic runner snapshots inputs before its first await", async () => {
  const privateBase = await base(), privateScratchBase = await base();
  const input = { mode: "success" as const, privateScratchBase, captureInput: { ...metadata, privateBase, directoryName: "attempt" } };
  const attempt = exerciseSyntheticAdapter(input);
  input.privateScratchBase = "invalid";
  input.captureInput.directoryName = "../bad";
  expect(await attempt).toEqual({ status: "saved" });
  expect(await readdir(privateScratchBase)).toEqual([]);
});

test("synthetic runner rejects a scratch symlink before spawning", async () => {
  const privateBase = await base(), privateScratchBase = await base();
  const link = join(privateBase, "link");
  await symlink(privateScratchBase, link);
  expect(await exerciseSyntheticAdapter({ mode: "success", privateScratchBase: link, captureInput: { ...metadata, privateBase, directoryName: "attempt" } })).toEqual({ status: "invalid-input" });
  expect(spawn).not.toHaveBeenCalled();
  expect((await lstat(link)).isSymbolicLink()).toBe(true);
});

test.each(["malformed", "overflow"] as const)("synthetic runner cleans %s failure without saving", async mode => {
  const privateBase = await base(), privateScratchBase = await base();
  const outcome = await exerciseSyntheticAdapter({ mode, privateScratchBase, captureInput: { ...metadata, privateBase, directoryName: "attempt" } });
  expect(outcome).toEqual({ status: "transport-rejected" });
  expect(await readdir(privateBase)).toEqual([]);
  expect(await readdir(privateScratchBase)).toEqual([]);
});

test.each(["replace-directory", "extra-file"] as const)("synthetic runner preserves %s and rejects cleanup", async mode => {
  const privateBase = await base(), privateScratchBase = await base();
  const outcome = await exerciseSyntheticAdapter({ mode, privateScratchBase, captureInput: { ...metadata, privateBase, directoryName: "attempt" } });
  expect(outcome).toEqual({ status: "cleanup-unconfirmed" });
  expect(await readdir(privateBase)).toEqual([]);
  const entries = await readdir(privateScratchBase);
  expect(entries.length).toBe(1);
  const root = join(privateScratchBase, entries[0]);
  if (mode === "replace-directory") expect((await lstat(join(root, "cache"))).isSymbolicLink()).toBe(true);
  else expect((await readFile(join(root, "private-unexpected"), "utf8")).includes("SYNTHETIC_PRIVATE_FILE_SENTINEL")).toBe(true);
});

import { afterEach, expect, test, vi } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtemp, realpath, rm, readdir, stat, readFile, mkdir, chmod, symlink, writeFile, open, unlink } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { captureCodexAccount } from "./codex-account-capture";

vi.mock("node:fs/promises", async importOriginal => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, open: vi.fn(actual.open) };
});

const bases: string[] = [];
afterEach(async () => { await Promise.all(bases.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
async function base() {
  const p = await realpath(await mkdtemp(join(tmpdir(), "codex-offline-")));
  bases.push(p);
  return p;
}
const metadata = { ownerAlias: "fixture-owner", accountAlias: "fixture-account", captureId: "fixture-capture", capturedAt: "2026-09-23T12:00:00Z" };
const child = (mode = "ok") => spawn(process.execPath, [resolve("tests/fixtures/codex-capture/server.mjs"), mode], { stdio: ["pipe", "pipe", "pipe"], env: { NODE_ENV: "test" } });

test("retains only validated metadata after clean child close and privately verifies replay", async () => {
  const privateBase = await base();
  expect(await captureCodexAccount({ ...metadata, privateBase, directoryName: "attempt" }, () => child())).toEqual({ status: "saved" });
  expect((await stat(join(privateBase, "attempt"))).mode & 0o777).toBe(0o700);
  expect((await stat(join(privateBase, "attempt", "capture.json"))).mode & 0o777).toBe(0o600);
  const saved = await readFile(join(privateBase, "attempt", "capture.json"), "utf8");
  expect(saved).not.toContain("PRIVATE_SENTINEL");
  expect(JSON.parse(saved).response.summary.lifetimeTokens).toBe(0);
});

test.each(["duplicate", "late-duplicate", "malformed", "utf8", "nonzero", "eof", "unknown", "request", "thread", "extra", "fraction", "underflow", "unsafe", "escaped-duplicate", "flood", "stderr", "deep", "oversize", "wrong-id", "rounded-init-id", "rounded-usage-id", "days", "stdout-total", "truncated-utf8", "duplicate-date", "capture-limit"])("rejects %s without retention", async mode => {
  const privateBase = await base();
  expect((await captureCodexAccount({ ...metadata, privateBase, directoryName: "attempt" }, () => child(mode))).status).not.toBe("saved");
  expect(await readdir(privateBase)).toEqual([]);
});


test.each(["split", "nulls", "missing"])("accepts bounded %s", async mode => {
  const privateBase = await base();
  expect(await captureCodexAccount({ ...metadata, privateBase, directoryName: "attempt" }, () => child(mode))).toEqual({ status: "saved" });
  const saved = JSON.parse(await readFile(join(privateBase, "attempt", "capture.json"), "utf8"));
  expect(saved.response.summary.lifetimeTokens).toBe(mode === "split" ? 0 : null);
  expect(saved.response.summary.peakDailyTokens).toBe(null);
});

test.each(["tail", "signal", "drain-hang"])("rejects %s after valid candidate", async mode => {
  const privateBase = await base();
  expect(await captureCodexAccount({ ...metadata, privateBase, directoryName: "attempt" }, () => child(mode))).toEqual({ status: "transport-rejected" });
  expect(await readdir(privateBase)).toEqual([]);
});

test.each(["mode", "git", "existing", "symlink", "noncanonical", "traversal"])("rejects unsafe destination %s before starting child", async mode => {
  let privateBase = await base();
  let directoryName = "attempt";
  if (mode === "mode") await chmod(privateBase, 0o755);
  if (mode === "git") await writeFile(join(privateBase, ".git"), "synthetic");
  if (mode === "existing") await mkdir(join(privateBase, "attempt"));
  if (mode === "symlink") await symlink(privateBase, join(privateBase, "attempt"));
  if (mode === "noncanonical") privateBase += "/.";
  if (mode === "traversal") directoryName = "../escape";
  const start = vi.fn(() => child());
  expect(await captureCodexAccount({ ...metadata, privateBase, directoryName }, start)).toEqual({ status: "invalid-input" });
  expect(start).not.toHaveBeenCalled();
});

test("does not overwrite an accepted capture", async () => {
  const privateBase = await base();
  const input = { ...metadata, privateBase, directoryName: "attempt" };
  expect(await captureCodexAccount(input, () => child())).toEqual({ status: "saved" });
  const original = await readFile(join(privateBase, "attempt", "capture.json"));
  const start = vi.fn(() => child());
  expect(await captureCodexAccount(input, start)).toEqual({ status: "invalid-input" });
  expect(start).not.toHaveBeenCalled();
  expect(await readFile(join(privateBase, "attempt", "capture.json"))).toEqual(original);
});

test("keeps child stderr and notifications out of ambient output", async () => {
  const privateBase = await base();
  const log = vi.spyOn(console, "log");
  const error = vi.spyOn(console, "error");
  try {
    expect(await captureCodexAccount({ ...metadata, privateBase, directoryName: "attempt" }, () => child())).toEqual({ status: "saved" });
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  } finally { log.mockRestore(); error.mockRestore(); }
});

test("returns a fixed spawn failure without disclosing its message", async () => {
  const privateBase = await base();
  expect(await captureCodexAccount({ ...metadata, privateBase, directoryName: "attempt" }, () => { throw new Error("PRIVATE_SENTINEL"); })).toEqual({ status: "transport-rejected" });
});


test.each(["hang", "ignore-term"])("terminates real %s child within absolute budget", async mode => {
  const privateBase = await base();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  let ready!: () => void;
  const started = new Promise<void>(resolve => { ready = resolve; });
  try {
    const attempt = captureCodexAccount({ ...metadata, privateBase, directoryName: "attempt" }, () => {
      const fixture = child(mode);
      fixture.stderr.once("data", ready);
      return fixture;
    });
    await started;
    await vi.advanceTimersByTimeAsync(27_500);
    expect(await attempt).toEqual({ status: "transport-rejected" });
    expect(await readdir(privateBase)).toEqual([]);
  } finally { vi.useRealTimers(); }
});

test("reports unconfirmed termination when close never arrives", async () => {
  const privateBase = await base();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  let ready!: () => void;
  const started = new Promise<void>(resolve => { ready = resolve; });
  const fixture = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill: vi.fn(() => false), unref: vi.fn() });
  try {
    const attempt = captureCodexAccount({ ...metadata, privateBase, directoryName: "attempt" }, () => { ready(); return fixture as unknown as ChildProcessWithoutNullStreams; });
    await started;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await attempt).toEqual({ status: "termination-unconfirmed" });
    expect(fixture.kill.mock.calls).toEqual([["SIGTERM"], ["SIGKILL"]]);
    expect(await readdir(privateBase)).toEqual([]);
  } finally { vi.useRealTimers(); }
});

test.each([false, true])("observes delayed write callbacks, error=%s", async fail => {
  const privateBase = await base();
  const attempt = captureCodexAccount({ ...metadata, privateBase, directoryName: "attempt" }, () => {
    const fixture = child();
    const original = fixture.stdin.write.bind(fixture.stdin);
    fixture.stdin.write = ((chunk: string, callback: (error?: Error | null) => void) => original(chunk, error => {
      setTimeout(() => callback(fail ? new Error("PRIVATE_SENTINEL") : error), 50);
    })) as typeof fixture.stdin.write;
    return fixture;
  });
  expect(await attempt).toEqual({ status: fail ? "transport-rejected" : "saved" });
  if (fail) expect(await readdir(privateBase)).toEqual([]);
});


test("snapshots caller metadata and destination before asynchronous work", async () => {
  const privateBase = await base();
  const input = { ...metadata, privateBase, directoryName: "attempt" };
  const start = () => {
    input.directoryName = "../escape";
    input.privateBase = "/untrusted";
    input.ownerAlias = "changed-owner";
    input.accountAlias = "changed-account";
    input.captureId = "changed-capture";
    input.capturedAt = "2000-01-01T00:00:00Z";
    return child();
  };
  expect(await captureCodexAccount(input, start)).toEqual({ status: "saved" });
  const saved = JSON.parse(await readFile(join(privateBase, "attempt", "capture.json"), "utf8"));
  expect(saved.scope).toEqual({ ownerAlias: metadata.ownerAlias, accountAlias: metadata.accountAlias, requestedThreadId: null });
  expect(saved.capture).toEqual({ id: metadata.captureId, capturedAt: "2026-09-23T12:00:00.000Z" });
});


test.each(["open-error", "changed-bytes", "symlink"])("rejects actual file readback failure %s", async mode => {
  const privateBase = await base();
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  const target = join(privateBase, "unchanged-target");
  if (mode === "symlink") await writeFile(target, "PRIVATE_SENTINEL", { mode: 0o600 });
  let injected = false;
  vi.mocked(open).mockImplementation(async (path, flags, options) => {
    if (flags === (constants.O_RDONLY | constants.O_NOFOLLOW) && !injected) {
      injected = true;
      if (mode === "open-error") throw new Error("PRIVATE_SENTINEL");
      if (mode === "changed-bytes") await writeFile(path, "PRIVATE_SENTINEL");
      if (mode === "symlink") { await unlink(path); await symlink(target, path); }
    }
    return actual.open(path, flags, options);
  });
  try {
    expect(await captureCodexAccount({ ...metadata, privateBase, directoryName: "attempt" }, () => child())).toEqual({ status: mode === "symlink" ? "cleanup-unconfirmed" : "storage-rejected" });
    expect(injected).toBe(true);
    if (mode === "symlink") {
      expect(await readFile(target, "utf8")).toBe("PRIVATE_SENTINEL");
    } else expect(await readdir(privateBase)).toEqual([]);
  } finally { vi.mocked(open).mockImplementation(actual.open); }
});


test("accepts the full 3660-day boundary without deriving totals", async () => {
  const privateBase = await base();
  expect(await captureCodexAccount({ ...metadata, privateBase, directoryName: "attempt" }, () => child("day-limit"))).toEqual({ status: "saved" });
  const saved = JSON.parse(await readFile(join(privateBase, "attempt", "capture.json"), "utf8"));
  expect(saved.response.dailyUsageBuckets).toHaveLength(3660);
  expect(saved.response.summary.lifetimeTokens).toBe(0);
});

test.each(["process", "stdin", "stdout", "stderr"])("rejects %s error and observes fixture termination", async source => {
  const privateBase = await base();
  expect(await captureCodexAccount({ ...metadata, privateBase, directoryName: "attempt" }, () => {
    const fixture = child("hang");
    queueMicrotask(() => (source === "process" ? fixture : fixture[source as "stdin" | "stdout" | "stderr"]).emit("error", new Error("PRIVATE_SENTINEL")));
    return fixture;
  })).toEqual({ status: "transport-rejected" });
  expect(await readdir(privateBase)).toEqual([]);
});

test.each(["HEAD", "head"])("accepts an ordinary %s directory outside Git", async name => {
  const privateBase = await base();
  await mkdir(join(privateBase, name));
  expect(await captureCodexAccount({ ...metadata, privateBase, directoryName: "attempt" }, () => child())).toEqual({ status: "saved" });
});

test("rejects a bare Git layout before starting the child", async () => {
  const privateBase = await base();
  await writeFile(join(privateBase, "HEAD"), "ref: refs/heads/main\n");
  await mkdir(join(privateBase, "objects"));
  await mkdir(join(privateBase, "refs"));
  const start = vi.fn(() => child());
  expect(await captureCodexAccount({ ...metadata, privateBase, directoryName: "attempt" }, start)).toEqual({ status: "invalid-input" });
  expect(start).not.toHaveBeenCalled();
});

import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { constants, type Stats } from "node:fs";
import { lstat, realpath, mkdir, open, unlink, rmdir, type FileHandle } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { parseCodexUsageCapture, reviewCodexUsageCaptures, type CodexUsageCapture, CODEX_USAGE_LIMITS } from "../domain/codex-usage";
import { CODEX_NOTIFICATION_METHODS } from "./codex-account-capture-notifications";

const LIMITS = { stdout: 512_000, stderr: 64_000, frame: 260_000, messages: 128, depth: 32, acquireMs: 27_000, totalMs: 30_000, drainMs: 1_000, killMs: 500 } as const;
type Input = { privateBase: string; directoryName: string; ownerAlias: string; accountAlias: string; captureId: string; capturedAt: string };
type Status = "saved" | "invalid-input" | "transport-rejected" | "termination-unconfirmed" | "storage-rejected" | "cleanup-unconfirmed";
type Outcome = { status: Status };
type State = "initializing" | "requesting" | "draining" | "rejected" | "closed";
const invalid = () => new Error("Rejected capture.");
const object = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const keys = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).every(k => allowed.includes(k));

function scanFrame(text: string) {
  let i = 0;
  let result: string | undefined;
  let id: string | undefined;
  const whitespace = () => { while (/[\x20\t\r\n]/.test(text[i] ?? "x")) i++; };
  function string(): string {
    const start = i++;
    while (i < text.length) {
      const ch = text[i++];
      if (ch === "\\") i++;
      else if (ch === '"') return JSON.parse(text.slice(start, i));
    }
    throw invalid();
  }
  function value(depth: number): void {
    if (depth > LIMITS.depth) throw invalid();
    whitespace();
    if (text[i] === "{") {
      i++; whitespace();
      const seen = new Set<string>();
      if (text[i] !== "}") for (;;) {
        if (text[i] !== '"') throw invalid();
        const key = string();
        if (seen.has(key)) throw invalid();
        seen.add(key); whitespace();
        if (text[i++] !== ":") throw invalid();
        whitespace();
        const start = i;
        value(depth + 1);
        if (depth === 0 && key === "result") result = text.slice(start, i);
        if (depth === 0 && key === "id") id = text.slice(start, i);
        whitespace();
        if (text[i] !== ",") break;
        i++; whitespace();
      }
      if (text[i++] !== "}") throw invalid();
    } else if (text[i] === "[") {
      i++; whitespace();
      if (text[i] !== "]") for (;;) {
        value(depth + 1); whitespace();
        if (text[i] !== ",") break;
        i++; whitespace();
      }
      if (text[i++] !== "]") throw invalid();
    } else if (text[i] === '"') string();
    else {
      const token = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i));
      if (!token) throw invalid();
      i += token[0].length;
    }
  }
  value(0); whitespace();
  if (i !== text.length) throw invalid();
  return { envelope: JSON.parse(text) as unknown, result, id };
}

function captureText(input: Input, result: string) {
  const metadata = JSON.stringify({ formatVersion: 1, source: { method: "account/usage/read", version: "0.153.4" }, scope: { ownerAlias: input.ownerAlias, accountAlias: input.accountAlias, requestedThreadId: null }, capture: { id: input.captureId, capturedAt: input.capturedAt } });
  return `${metadata.slice(0, -1)},"response":${result}}`;
}

function acquire(input: Input, startFixture: () => ChildProcessWithoutNullStreams): Promise<{ capture: CodexUsageCapture } | Outcome> {
  return new Promise(resolveResult => {
    let child: ChildProcessWithoutNullStreams;
    try { child = startFixture(); } catch { resolveResult({ status: "transport-rejected" }); return; }
    let state: State = "initializing";
    let candidate: CodexUsageCapture | undefined;
    let pending = Buffer.alloc(0), stdoutBytes = 0, stderrBytes = 0, messages = 0, writes = 0;
    let stdoutEnd = false, stderrEnd = false, closed = false, done = false;
    let closeCode: number | null = null, closeSignal: NodeJS.Signals | null = null;
    let drainTimer: NodeJS.Timeout | undefined, killTimer: NodeJS.Timeout | undefined;
    const acquisitionTimer = setTimeout(reject, LIMITS.acquireMs);
    const totalTimer = setTimeout(() => {
      reject();
      finish({ status: closed ? "transport-rejected" : "termination-unconfirmed" });
    }, LIMITS.totalMs);
    function finish(outcome: { capture: CodexUsageCapture } | Outcome) {
      if (done) return;
      done = true; state = "closed";
      clearTimeout(acquisitionTimer); clearTimeout(totalTimer); clearTimeout(drainTimer); clearTimeout(killTimer);
      candidate = undefined; pending = Buffer.alloc(0);
      if (!closed) { child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy(); child.unref(); }
      resolveResult(outcome);
    }
    function settle() {
      if (!closed || done) return;
      if (state === "rejected") { finish({ status: "transport-rejected" }); return; }
      if (closeCode !== 0 || closeSignal !== null || !stdoutEnd || !stderrEnd || state !== "draining" || !candidate || pending.length) { reject(); return; }
      if (writes === 0) finish({ capture: candidate });
    }
    function reject() {
      if (done || state === "rejected") return;
      state = "rejected"; candidate = undefined; pending = Buffer.alloc(0);
      clearTimeout(acquisitionTimer); clearTimeout(drainTimer);
      child.stdin.destroy();
      if (!closed) {
        try { child.kill("SIGTERM"); } catch { /* Closure still must be observed. */ }
        killTimer = setTimeout(() => { try { child.kill("SIGKILL"); } catch {} }, LIMITS.killMs);
      }
      settle();
    }
    function write(message: unknown) {
      if (state === "rejected" || done) return;
      writes++;
      try {
        child.stdin.write(`${JSON.stringify(message)}\n`, error => {
          writes--;
          if (error) reject();
          settle();
        });
      } catch { writes--; reject(); }
    }
    function frame(bytes: Buffer) {
      if (++messages > LIMITS.messages || bytes.length > LIMITS.frame) throw invalid();
      const { envelope, result, id } = scanFrame(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      if (!object(envelope)) throw invalid();
      if (typeof envelope.method === "string") {
        if (!keys(envelope, ["method", "params"]) || !CODEX_NOTIFICATION_METHODS.includes(envelope.method)) throw invalid();
        return;
      }
      if (!keys(envelope, ["id", "result"]) || !result || !object(envelope.result)) throw invalid();
      if (state === "initializing" && id === "1") {
        const init = envelope.result;
        const names = ["codexHome", "platformFamily", "platformOs", "userAgent"];
        if (!keys(init, names) || !names.every(name => typeof init[name] === "string")) throw invalid();
        write({ method: "initialized", params: {} });
        if (state !== "initializing") return;
        state = "requesting";
        write({ id: 2, method: "account/usage/read", params: {} });
      } else if (state === "requesting" && id === "2") {
        if (envelope.result.threadUsage != null) throw invalid();
        candidate = parseCodexUsageCapture(captureText(input, result));
        state = "draining";
        clearTimeout(acquisitionTimer);
        drainTimer = setTimeout(reject, LIMITS.drainMs);
        child.stdin.end();
      } else throw invalid();
    }
    child.on("error", reject);
    child.stdin.on("error", reject);
    child.stdout.on("error", reject);
    child.stderr.on("error", reject);
    child.stdout.on("data", (chunk: Buffer) => {
      if (state === "rejected" || done) return;
      try {
        stdoutBytes += chunk.length;
        if (stdoutBytes > LIMITS.stdout) throw invalid();
        pending = Buffer.concat([pending, chunk]);
        let newline: number;
        while ((newline = pending.indexOf(10)) >= 0) {
          const line = pending.subarray(0, newline);
          pending = pending.subarray(newline + 1);
          frame(line);
          if ((state as State) === "rejected") return;
        }
        if (pending.length > LIMITS.frame) throw invalid();
      } catch { reject(); }
    });
    child.stderr.on("data", (chunk: Buffer) => { stderrBytes += chunk.length; if (stderrBytes > LIMITS.stderr) reject(); });
    child.stdout.on("end", () => { stdoutEnd = true; if (pending.length || state !== "draining") reject(); settle(); });
    child.stderr.on("end", () => { stderrEnd = true; settle(); });
    child.on("close", (code, signal) => { closed = true; closeCode = code; closeSignal = signal; settle(); });
    write({ id: 1, method: "initialize", params: { clientInfo: { name: "proper_respect_private_usage_probe", version: "0.1.0" }, capabilities: { experimentalApi: false, requestAttestation: false, optOutNotificationMethods: CODEX_NOTIFICATION_METHODS } } });
  });
}

const same = (a: Stats, b: Stats) => a.dev === b.dev && a.ino === b.ino;
const owned = (s: Stats, mode: number) => s.uid === process.getuid?.() && (s.mode & 0o7777) === mode;
async function validateBase(base: string) {
  if (!isAbsolute(base) || resolve(base) !== base || await realpath(base) !== base) throw invalid();
  const info = await lstat(base);
  if (!info.isDirectory() || !owned(info, 0o700)) throw invalid();
  for (let p = base;; p = dirname(p)) {
    const inspect = async (name: string) => {
      try { return await lstat(join(p, name)); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw invalid();
        return undefined;
      }
    };
    if (await inspect(".git")) throw invalid();
    const [head, objects, refs] = await Promise.all(["HEAD", "objects", "refs"].map(inspect));
    if (head?.isFile() && objects?.isDirectory() && refs?.isDirectory()) throw invalid();
    if (dirname(p) === p) break;
  }
  return info;
}

async function retain(input: Input, baseInfo: Stats, capture: CodexUsageCapture): Promise<Outcome> {
  const directory = join(input.privateBase, input.directoryName), file = join(directory, "capture.json");
  let dirInfo: Stats | undefined, fileInfo: Stats | undefined;
  let createdDirectory = false;
  let retainedHandle: FileHandle | undefined;
  let outcome: Outcome;
  try {
    if (!same(baseInfo, await validateBase(input.privateBase))) throw invalid();
    if (Buffer.byteLength(JSON.stringify(capture)) > CODEX_USAGE_LIMITS.bytes) throw invalid();
    await mkdir(directory, { mode: 0o700 });
    createdDirectory = true;
    dirInfo = await lstat(directory);
    if (!dirInfo.isDirectory() || !owned(dirInfo, 0o700)) throw invalid();
    retainedHandle = await open(file, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
    fileInfo = await retainedHandle.stat();
    if (!fileInfo.isFile() || !owned(fileInfo, 0o600) || fileInfo.nlink !== 1) throw invalid();
    await retainedHandle.writeFile(JSON.stringify(capture));
    await retainedHandle.sync();
    const read = async () => {
      const directoryInfo = await lstat(directory);
      if (!same(baseInfo, await validateBase(input.privateBase)) || !same(dirInfo!, directoryInfo) || !directoryInfo.isDirectory() || !owned(directoryInfo, 0o700)) throw invalid();
      const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const info = await handle.stat();
        if (!same(fileInfo!, info) || !info.isFile() || !owned(info, 0o600) || info.nlink !== 1 || info.size > CODEX_USAGE_LIMITS.bytes) throw invalid();
        const buffer = Buffer.alloc(CODEX_USAGE_LIMITS.bytes + 1);
        let length = 0;
        while (length < buffer.length) {
          const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
          if (!bytesRead) break;
          length += bytesRead;
        }
        if (length > CODEX_USAGE_LIMITS.bytes) throw invalid();
        const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, length));
        if (text !== JSON.stringify(capture)) throw invalid();
        return parseCodexUsageCapture(text);
      } finally { await handle.close(); }
    };
    const review = reviewCodexUsageCaptures([await read(), await read()]);
    if (review.accounts.length !== 1 || review.replays !== 1 || review.accounts[0].snapshots.length !== 1 || review.accounts[0].conflicts.length !== 0) throw invalid();
    outcome = { status: "saved" };
  } catch {
    outcome = { status: "storage-rejected" };
    try {
      if (createdDirectory && !dirInfo) throw invalid();
      if (dirInfo) {
        const directoryInfo = await lstat(directory);
        if (!same(baseInfo, await validateBase(input.privateBase)) || !same(dirInfo, directoryInfo) || !directoryInfo.isDirectory() || !owned(directoryInfo, 0o700)) throw invalid();
        if (fileInfo) {
          const current = await lstat(file);
          if (!same(fileInfo, current) || !current.isFile() || !owned(current, 0o600) || current.nlink !== 1) throw invalid();
          await unlink(file);
        }
        await rmdir(directory);
      }
    } catch { outcome = { status: "cleanup-unconfirmed" }; }
  }
  try { await retainedHandle?.close(); }
  catch { outcome = { status: "cleanup-unconfirmed" }; }
  return outcome;
}

/** Offline boundary only. No Codex executable, launcher, or account selection is provided. */
export async function captureCodexAccount(providedInput: Input, startFixture: () => ChildProcessWithoutNullStreams): Promise<Outcome> {
  let baseInfo: Stats;
  let input: Input;
  try {
    input = { ...providedInput };
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(input.directoryName)) throw invalid();
    parseCodexUsageCapture(captureText(input, '{"summary":{}}'));
    baseInfo = await validateBase(input.privateBase);
    try { await lstat(join(input.privateBase, input.directoryName)); throw invalid(); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw invalid(); }
  } catch { return { status: "invalid-input" }; }
  const result = await acquire(input, startFixture);
  if ("status" in result) return result;
  return retain(input, baseInfo, result.capture);
}

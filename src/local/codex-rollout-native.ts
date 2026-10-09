import { spawn } from "node:child_process";
import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import type { CodexRolloutDirectory } from "./codex-rollout-files.ts";

const failure = "Codex rollout directory could not be read safely.";
const maxOutput = 32 * 1024 * 1024 + 16 + 64 * 4;
const cancelled = () => { const error = new Error("Codex rollout read cancelled."); error.name = "AbortError"; return error; };

function decode(bytes: Buffer): CodexRolloutDirectory {
  if (bytes.length < 16 || !bytes.subarray(0, 8).equals(Buffer.from("PRRES001"))) throw new Error(failure);
  const count = bytes.readUInt32BE(8), ignoredEntries = bytes.readUInt32BE(12);
  if (count > 64 || ignoredEntries > 1000) throw new Error(failure);
  let offset = 16, total = 0, lineCount = 0;
  const files: CodexRolloutDirectory["files"] = [];
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  for (let i = 0; i < count; i++) {
    if (offset + 4 > bytes.length) throw new Error(failure);
    const size = bytes.readUInt32BE(offset); offset += 4; total += size;
    if (size > 4 * 1024 * 1024 || total > 32 * 1024 * 1024 || offset + size > bytes.length) throw new Error(failure);
    const content = bytes.subarray(offset, offset + size); offset += size;
    if (size !== 0 && content[size - 1] !== 10) throw new Error(failure);
    const lines: string[] = [];
    let start = 0;
    for (let end = 0; end < content.length; end++) {
      if (content[end] !== 10) continue;
      if (end - start > 256 * 1024 || ++lineCount > 100_000) throw new Error(failure);
      const line = decoder.decode(content.subarray(start, end));
      lines.push(line.endsWith("\r") ? line.slice(0, -1) : line); start = end + 1;
    }
    files.push({ lines });
  }
  if (offset !== bytes.length) throw new Error(failure);
  return { files, scannedFiles: count, ignoredEntries };
}

/** Explicit helper and source only. Raw mixed-source bytes stay in this private IPC boundary. */
export async function readCodexRolloutDirectoryNative({ directory, executablePath, signal }: {
  directory: string; executablePath: string; signal: AbortSignal;
}): Promise<CodexRolloutDirectory> {
  const started = performance.now();
  try {
    if (signal.aborted) throw cancelled();
    const path = Buffer.from(directory, "utf8");
    if (!["linux", "darwin"].includes(process.platform) || !isAbsolute(directory) || directory.includes("\0") ||
      path.length === 0 || path.length > 4096 || path.toString("utf8") !== directory ||
      directory.split("/").some(component => component === "." || component === "..") ||
      !isAbsolute(executablePath) || resolve(executablePath) !== executablePath || await realpath(executablePath) !== executablePath) throw new Error(failure);
    const info = await lstat(executablePath);
    if (!info.isFile() || info.nlink !== 1 || (info.mode & 0o111) === 0 || (info.mode & 0o022) !== 0 || signal.aborted || performance.now() - started >= 5000) throw new Error(failure);
    const header = Buffer.alloc(12); header.write("PRREQ001"); header.writeUInt32BE(path.length, 8);
    const bytes = await acquire(executablePath, Buffer.concat([header, path]), signal, started);
    if (signal.aborted || performance.now() - started >= 5000) throw new Error(failure);
    const result = decode(bytes);
    if (signal.aborted || performance.now() - started >= 5000) throw new Error(failure);
    return result;
  } catch {
    if (signal.aborted) throw cancelled();
    throw new Error(failure);
  }
}

function acquire(executablePath: string, input: Buffer, signal: AbortSignal, started: number): Promise<Buffer> {
  return new Promise((resolveResult, rejectResult) => {
    const child = spawn(executablePath, [], { stdio: ["pipe", "pipe", "pipe"], env: { NODE_ENV: "production" }, cwd: "/", shell: false });
    const chunks: Buffer[] = [];
    let stdout = 0, stderr = 0, rejected = false, closed = false;
    let kill: ReturnType<typeof setTimeout> | undefined, barrier: ReturnType<typeof setTimeout> | undefined;
    const timeout = setTimeout(reject, Math.ceil(Math.max(0, 5000 - (performance.now() - started))));
    function reject() {
      if (rejected || closed) return;
      rejected = true; chunks.length = 0; child.stdin.destroy();
      child.kill("SIGTERM");
      kill = setTimeout(() => { if (!closed) child.kill("SIGKILL"); }, 100);
      barrier = setTimeout(() => { cleanup(); child.stdout.destroy(); child.stderr.destroy(); child.unref(); rejectResult(new Error(failure)); }, 1100);
    }
    function cleanup() { clearTimeout(timeout); clearTimeout(kill); clearTimeout(barrier); signal.removeEventListener("abort", reject); }
    child.on("error", reject); child.stdin.on("error", reject); child.stdout.on("error", reject); child.stderr.on("error", reject);
    child.stdout.on("data", (chunk: Buffer) => {
      if (rejected) return;
      stdout += chunk.length;
      if (stdout > maxOutput) { reject(); return; }
      chunks.push(chunk);
    });
    // Even fixed native diagnostics stay private. Raw/error streams are never surfaced.
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.length; if (stderr > 4096) reject(); });
    child.on("close", (code, exitSignal) => {
      closed = true; cleanup();
      if (rejected || code !== 0 || exitSignal !== null || stderr !== 0 || signal.aborted || performance.now() - started >= 5000) rejectResult(new Error(failure));
      else resolveResult(Buffer.concat(chunks, stdout));
    });
    signal.addEventListener("abort", reject, { once: true });
    if (signal.aborted) reject();
    else child.stdin.end(input);
  });
}

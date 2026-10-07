import { constants, type BigIntStats } from "node:fs";
import { lstat, open, opendir, type FileHandle } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { readNativeCodexDirectory } from "./codex-native-reader.ts";

const limits = {
  files: 64,
  totalBytes: 32 * 1024 * 1024,
  fileBytes: 4 * 1024 * 1024,
  lines: 100_000,
  lineBytes: 256 * 1024,
  entries: 1_000,
  depth: 5,
};
const readFlags = constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK;
const directoryFlags = readFlags | constants.O_DIRECTORY;
const failureMessage = "Codex rollout directory could not be read safely.";

export type CodexRolloutDirectory = {
  files: { lines: string[] }[];
  scannedFiles: number;
  ignoredEntries: number;
};

function checkAbort(signal: AbortSignal): void {
  if (signal.aborted) {
    const error = new Error("Codex rollout read cancelled.");
    error.name = "AbortError";
    throw error;
  }
}

function reject(): never {
  throw new Error(failureMessage);
}

function sameFile(before: BigIntStats, after: BigIntStats): boolean {
  return before.dev === after.dev && before.ino === after.ino && before.mode === after.mode
    && before.size === after.size && before.mtimeNs === after.mtimeNs
    && before.ctimeNs === after.ctimeNs && before.nlink === after.nlink;
}

// Node has no openat API. Linux's descriptor paths keep each lookup attached to
// the already-open parent, even if somebody renames it during the scan. The only
// symlinks followed are these kernel-owned descriptor references, never entries
// in the selected tree. Unsupported platforms fail closed before any I/O.
function descriptorPath(handle: FileHandle, name?: string): string {
  return `/proc/self/fd/${handle.fd}${name === undefined ? "" : `/${name}`}`;
}

/**
 * Read one explicitly selected absolute directory. No home, environment, auth,
 * or history_base discovery. All limits reject the whole read, including a
 * final partial JSONL line. Symlinks, hardlinked rollouts, and special files
 * are rejected. Paths and filesystem error details never escape.
 */
export async function readCodexRolloutDirectory({ directory, signal }: {
  directory: string;
  signal: AbortSignal;
}): Promise<CodexRolloutDirectory> {
  if (process.platform === "darwin") return readNativeCodexDirectory({ directory, signal });
  const handles: FileHandle[] = [];
  const ancestors: { parent: FileHandle; child: FileHandle; name: string }[] = [];
  try {
    checkAbort(signal);
    if (process.platform !== "linux" || !isAbsolute(directory) || directory.length > 4096 || directory.includes("\0")) reject();
    const components = directory.split("/").filter(component => component !== "");
    if (components.length > 128 || components.some(component => component === "." || component === "..")) reject();

    // Start at the trusted filesystem root and open each component separately.
    // O_NOFOLLOW alone on an ordinary full path would still follow ancestors.
    let root = await open("/", directoryFlags);
    handles.push(root);
    checkAbort(signal);
    for (const component of components) {
      const child = await open(descriptorPath(root, component), directoryFlags);
      handles.push(child);
      ancestors.push({ parent: root, child, name: component });
      checkAbort(signal);
      root = child;
    }

    const result: CodexRolloutDirectory = { files: [], scannedFiles: 0, ignoredEntries: 0 };
    let totalBytes = 0;
    let totalLines = 0;
    let totalEntries = 0;

    async function readFile(parent: FileHandle, name: string, expected: BigIntStats): Promise<void> {
      if (++result.scannedFiles > limits.files || expected.size > BigInt(limits.fileBytes) || expected.nlink !== BigInt(1)) reject();
      totalBytes += Number(expected.size);
      if (totalBytes > limits.totalBytes) reject();
      checkAbort(signal);
      const handle = await open(descriptorPath(parent, name), readFlags);
      try {
        checkAbort(signal);
        const before = await handle.stat({ bigint: true });
        checkAbort(signal);
        if (!before.isFile() || !sameFile(expected, before)) reject();
        // One extra byte detects growth without permitting an unbounded read.
        const buffer = Buffer.alloc(Number(before.size) + 1);
        let bytes = 0;
        while (bytes < buffer.length) {
          checkAbort(signal);
          const { bytesRead } = await handle.read(buffer, bytes, Math.min(64 * 1024, buffer.length - bytes), bytes);
          checkAbort(signal);
          if (bytesRead === 0) break;
          bytes += bytesRead;
        }
        const after = await handle.stat({ bigint: true });
        checkAbort(signal);
        const current = await lstat(descriptorPath(parent, name), { bigint: true });
        checkAbort(signal);
        if (bytes !== Number(before.size) || !sameFile(before, after) || !sameFile(before, current)) reject();
        if (bytes !== 0 && buffer[bytes - 1] !== 10) reject();
        const lines: string[] = [];
        const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
        let start = 0;
        for (let end = 0; end < bytes; end++) {
          if (buffer[end] !== 10) continue;
          if (end - start > limits.lineBytes || ++totalLines > limits.lines) reject();
          const line = decoder.decode(buffer.subarray(start, end));
          lines.push(line.endsWith("\r") ? line.slice(0, -1) : line);
          start = end + 1;
        }
        checkAbort(signal);
        result.files.push({ lines });
      } finally {
        await handle.close();
      }
    }

    async function visit(handle: FileHandle, depth: number): Promise<void> {
      checkAbort(signal);
      const before = await handle.stat({ bigint: true });
      checkAbort(signal);
      if (!before.isDirectory()) reject();
      const entries = await opendir(descriptorPath(handle), { bufferSize: 32 });
      try {
        while (true) {
          checkAbort(signal);
          const entry = await entries.read();
          checkAbort(signal);
          if (entry === null) break;
          if (++totalEntries > limits.entries) reject();
          const path = descriptorPath(handle, entry.name);
          const stat = await lstat(path, { bigint: true });
          checkAbort(signal);
          // Refuse links and special files instead of silently omitting them.
          if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) reject();
          if (stat.isDirectory()) {
            if (depth >= limits.depth) reject();
            const child = await open(path, directoryFlags);
            try {
              checkAbort(signal);
              const opened = await child.stat({ bigint: true });
              checkAbort(signal);
              if (!sameFile(stat, opened)) reject();
              await visit(child, depth + 1);
              const current = await lstat(path, { bigint: true });
              checkAbort(signal);
              if (!sameFile(stat, current)) reject();
            } finally {
              await child.close();
            }
          } else if (entry.name.startsWith("rollout-") && entry.name.endsWith(".jsonl")) {
            await readFile(handle, entry.name, stat);
          } else {
            result.ignoredEntries++;
          }
        }
      } finally {
        await entries.close();
      }
      checkAbort(signal);
      const after = await handle.stat({ bigint: true });
      checkAbort(signal);
      if (!sameFile(before, after)) reject();
    }

    await visit(root, 0);
    // The selected location must still identify the pinned directory chain.
    // Ignore ancestor timestamps: unrelated siblings may change during a scan.
    for (const { parent, child, name } of ancestors) {
      checkAbort(signal);
      const current = await lstat(descriptorPath(parent, name), { bigint: true });
      checkAbort(signal);
      const opened = await child.stat({ bigint: true });
      checkAbort(signal);
      if (!current.isDirectory() || current.dev !== opened.dev || current.ino !== opened.ino) reject();
    }
    checkAbort(signal);
    return result;
  } catch {
    // Includes decoding, OS, cancellation-reason, and traversal errors. Never
    // attach the original cause: it may contain a private filename or content.
    checkAbort(signal);
    throw new Error(failureMessage);
  } finally {
    // Close ancestor descriptors even on abort or a failed component lookup.
    // close errors must not replace the path-free error at this boundary.
    for (const handle of handles.reverse()) await handle.close().catch(() => undefined);
  }
}

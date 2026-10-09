import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { CodexRolloutDirectory } from "./codex-rollout-files.ts";

const failure = "Codex rollout directory could not be read safely.";
const directorySchema = z.string().max(4096).startsWith("/").refine(value => !value.includes("\0") && !value.split("/").some(part => part === "." || part === ".."));
export async function readNativeCodexDirectory(input: { directory: string; signal: AbortSignal }): Promise<CodexRolloutDirectory> {
  const result = await readNativeCodexPage({ ...input, offset: 0 });
  if (result.nextOffset !== null) throw new Error(failure);
  return { files: result.files, scannedFiles: result.scannedFiles, ignoredEntries: result.ignoredEntries };
}
export async function readNativeCodexPage(input: { directory: string; signal: AbortSignal; offset: number }): Promise<CodexRolloutDirectory & { nextOffset: number | null }> {
  try {
    const directory = directorySchema.parse(input.directory);
    const bytes = await new Promise<Buffer>((resolve, reject) => {
      const offset = z.number().int().min(0).max(100_000).parse(input.offset);
      execFile(fileURLToPath(new URL("../../.local-bin/codex-reader", import.meta.url)), [directory, String(offset)],
        { encoding: "buffer", maxBuffer: 33 * 1024 * 1024, timeout: 5500, signal: input.signal, env: { LANG: "C", LC_ALL: "C", NODE_ENV: "production" } },
        (error, stdout) => error ? reject(new Error(failure)) : resolve(stdout));
    });
    if (input.signal.aborted) throw new Error(failure);
    let offset = 0;
    const word = () => { const value = bytes.readUInt32BE(offset); offset += 4; return value; };
    const count = word();
    const next = word();
    if (count > 64) throw new Error(failure);
    const files: CodexRolloutDirectory["files"] = [];
    const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
    for (let i = 0; i < count; i++) {
      const size = word();
      if (size > 4 * 1024 * 1024 || offset + size > bytes.length) throw new Error(failure);
      const text = decoder.decode(bytes.subarray(offset, offset + size)); offset += size;
      files.push({ lines: size === 0 ? [] : text.slice(0, -1).split("\n").map(line => line.endsWith("\r") ? line.slice(0, -1) : line) });
    }
    if (offset !== bytes.length) throw new Error(failure);
    if (next !== 0 && next <= input.offset) throw new Error(failure);
    return { files, scannedFiles: count, ignoredEntries: 0, nextOffset: next === 0 ? null : next };
  } catch { throw new Error(input.signal.aborted ? "Codex rollout read cancelled." : failure); }
}

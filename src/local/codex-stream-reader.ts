import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { CodexRolloutDirectory } from "./codex-rollout-files.ts";

const failure = "Codex rollout directory could not be read safely.";
const maxLine = 64 * 1024 * 1024;
const pathSchema = z.string().startsWith("/").max(4096).refine(value => !value.includes("\0") && !value.split("/").some(part => part === "." || part === ".."));

/** Consume the descriptor-pinned native stream locally. Nothing is returned until
 * the child validates every opened file and ancestor and exits successfully. */
export async function readNativeCodexUsagePage(input: { directory: string; signal: AbortSignal; offset: number }): Promise<CodexRolloutDirectory & { nextOffset: number | null }> {
  let child: ReturnType<typeof spawn> | undefined;
  try {
    if (input.signal.aborted) throw new Error(failure);
    const directory = pathSchema.parse(input.directory);
    const offset = z.number().int().min(0).max(100_000).parse(input.offset);
    child = spawn(fileURLToPath(new URL("../../.local-bin/codex-stream-reader", import.meta.url)), [directory, String(offset)], {
      stdio: ["ignore", "pipe", "ignore"], signal: input.signal,
      env: { LANG: "C", LC_ALL: "C", NODE_ENV: "production" },
    });
    const processResult = new Promise<boolean>(resolve => {
      child!.once("error", () => resolve(false));
      child!.once("close", code => resolve(code === 0));
    });
    const timer = setTimeout(() => child?.kill("SIGKILL"), 5500);
    const files: CodexRolloutDirectory["files"] = [];
    let scannedFiles = 0, ignoredEntries = 0, projectionBytes = 0, projectionLines = 0;
    let buffer = Buffer.alloc(0), remaining: number | null = null, footer = false, nextOffset: number | null = null;
    let decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
    let lineParts: string[] = [], lineLength = 0, projected: string[] = [], invalid = false, rawLines = 0;
    const consumeLine = (text: string) => {
      if (invalid) return;
      try {
        const record = JSON.parse(text);
        if (!record || typeof record !== "object" || typeof record.type !== "string" || (rawLines++ === 0 && record.type !== "session_meta")) throw new Error();
        let selected: string | null = null;
        if (record.type === "session_meta") {
          const payload = record.payload;
          if (!payload || typeof payload.id !== "string") throw new Error();
          const markers = Object.fromEntries(["forked_from_id", "parent_thread_id", "history_base", "subagent_history_start_ordinal"]
            .filter(key => payload[key] !== undefined && payload[key] !== null).map(key => [key, true]));
          selected = JSON.stringify({ type: record.type, payload: { id: payload.id, ...markers } });
        } else if (record.type === "compacted") {
          selected = JSON.stringify({ type: record.type, timestamp: record.timestamp });
        } else if (record.type === "token_usage_record" || (record.type === "event_msg" && record.payload?.type === "token_count")) {
          // Keep the numeric lexemes exact. The collector reconstructs the strict
          // numeric allowlist before any persisted state or transport is possible.
          selected = text;
        }
        if (selected !== null) {
          const size = Buffer.byteLength(selected);
          if (size > 256 * 1024) throw new Error();
          projectionBytes += size; projectionLines++;
          projected.push(selected);
        }
      } catch { invalid = true; projected = []; }
    };
    const consumeText = (text: string) => {
      if (invalid) return;
      let start = 0, end: number;
      while ((end = text.indexOf("\n", start)) !== -1) {
        lineParts.push(text.slice(start, end)); lineLength += end - start;
        if (lineLength > maxLine) { invalid = true; projected = []; lineParts = []; lineLength = 0; return; }
        consumeLine(lineParts.join("").replace(/\r$/, ""));
        lineParts = []; lineLength = 0; start = end + 1;
        if (invalid) return;
      }
      lineParts.push(text.slice(start)); lineLength += text.length - start;
      if (lineLength > maxLine) { invalid = true; projected = []; lineParts = []; lineLength = 0; }
    };
    const finish = () => {
      try { consumeText(decoder.decode()); } catch { invalid = true; }
      if (lineLength || rawLines === 0) invalid = true;
      scannedFiles++;
      if (invalid) ignoredEntries++;
      else files.push({ lines: projected });
      decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
      lineParts = []; lineLength = 0; projected = []; invalid = false; rawLines = 0; remaining = null;
    };
    try {
      for await (const chunk of child.stdout!) {
        if (input.signal.aborted || footer) throw new Error(failure);
        buffer = buffer.length ? Buffer.concat([buffer, chunk]) : chunk;
        for (;;) {
          if (remaining === null) {
            if (buffer.length < 4) break;
            const size = buffer.readUInt32BE(0);
            if (size === 0xffffffff) {
              if (buffer.length < 12) break;
              const count = buffer.readUInt32BE(4), next = buffer.readUInt32BE(8);
              if (count !== scannedFiles || count > 64 || (next !== 0 && next <= offset) || buffer.length !== 12) throw new Error(failure);
              nextOffset = next === 0 ? null : next; buffer = Buffer.alloc(0); footer = true; break;
            }
            if (size > 512 * 1024 * 1024 || scannedFiles >= 64) throw new Error(failure);
            buffer = buffer.subarray(4); remaining = size;
            if (remaining === 0) { finish(); continue; }
          }
          if (!buffer.length) break;
          const size = Math.min(remaining, buffer.length);
          if (!invalid) {
            try { consumeText(decoder.decode(buffer.subarray(0, size), { stream: true })); }
            catch { invalid = true; projected = []; }
          }
          remaining -= size; buffer = buffer.subarray(size);
          if (projectionBytes > 32 * 1024 * 1024 || projectionLines > 100_000) throw new Error(failure);
          if (remaining === 0) finish();
        }
      }
      if (!(await processResult) || !footer || input.signal.aborted) throw new Error(failure);
      return { files, scannedFiles, ignoredEntries, nextOffset };
    } finally { clearTimeout(timer); child.kill("SIGKILL"); }
  } catch {
    child?.kill("SIGKILL");
    throw new Error(input.signal.aborted ? "Codex rollout read cancelled." : failure);
  }
}

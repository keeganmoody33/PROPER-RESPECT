#!/usr/bin/env node
import { open, constants } from "node:fs/promises";
import { sanitizeClaudeNativeMetrics } from "../src/server/claude-native/sanitize.ts";
import { NATIVE_LIMITS } from "../src/domain/claude-native-evidence.ts";
import { buildUsageCostReport, formatUsageCostReport } from "../src/domain/usage-cost-report.ts";

async function readFile(path, cap, key = false) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > cap || (key && (stat.mode & 0o077))) throw new Error();
    const buffer = Buffer.alloc(cap + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await file.read(buffer, length, buffer.length - length, null);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > cap || (key && length !== 32)) throw new Error();
    return buffer.subarray(0, length);
  } finally { await file.close(); }
}
let key;
try {
  const args = process.argv.slice(2), values = new Map();
  const mode = args.shift();
  if (!["--synthetic", "--owner-supplied"].includes(mode) || args.some(arg => arg === "--synthetic" || arg === "--owner-supplied")) throw new Error();
  const sample = mode === "--synthetic" ? "synthetic" : "owner-supplied";
  while (args[0]?.startsWith("--")) {
    const name = args.shift(), value = args.shift();
    if (!["--key-file", "--source-scope", "--captured-at", "--content-type", "--format"].includes(name) || values.has(name) || !value || value.startsWith("--")) throw new Error();
    values.set(name, value);
  }
  if (!args.length || args.length > NATIVE_LIMITS.captures || !values.has("--key-file") || !values.has("--source-scope") || !values.has("--captured-at") || !values.has("--content-type")) throw new Error();
  const format = values.get("--format") ?? "report";
  if (!["report", "sanitized"].includes(format) || (format === "sanitized" && args.length !== 1)) throw new Error();
  key = await readFile(values.get("--key-file"), 32, true);
  const captures = [];
  let points = 0;
  for (const path of args) {
    const capture = sanitizeClaudeNativeMetrics(await readFile(path, NATIVE_LIMITS.bytes), {
      identityKey: key, sourceScope: values.get("--source-scope"), capturedAt: values.get("--captured-at"),
      sample, contentType: values.get("--content-type"),
    });
    points += capture.points.length;
    if (points > NATIVE_LIMITS.aggregatePoints) throw new Error();
    captures.push(capture);
  }
  const report = buildUsageCostReport(captures.map(capture => JSON.stringify(capture)));
  process.stdout.write(format === "sanitized" ? `${JSON.stringify(captures[0])}\n` : formatUsageCostReport(report));
  if (report.hasConflicts) process.exitCode = 2;
} catch {
  console.error("Native metrics rejected. Start with exactly one of --synthetic or --owner-supplied; supply bounded OTLP JSON files and an explicit private 32-byte key. No partial report emitted.");
  process.exitCode = 1;
} finally { key?.fill(0); }

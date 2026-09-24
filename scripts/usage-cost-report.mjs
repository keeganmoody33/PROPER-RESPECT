#!/usr/bin/env node
import { open, constants } from "node:fs/promises";
import { USAGE_REPORT_LIMITS, SYNTHETIC_SCENARIO, buildUsageCostReport, formatUsageCostReport } from "../src/domain/usage-cost-report.ts";

try {
  const args = process.argv.slice(2);
  const scenario = args[0] === "--synthetic-haiku-20260924" ? args.shift() : null;
  if (!args.length || args.length > USAGE_REPORT_LIMITS.files || args.some(path => path.startsWith("--"))) throw new Error();
  const texts = [];
  for (const path of args) {
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > USAGE_REPORT_LIMITS.bytes) throw new Error();
      const buffer = Buffer.alloc(USAGE_REPORT_LIMITS.bytes + 1);
      let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await file.read(buffer, length, buffer.length - length, null);
        if (!bytesRead) break;
        length += bytesRead;
      }
      if (length > USAGE_REPORT_LIMITS.bytes) throw new Error();
      texts.push(new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, length)));
    } finally { await file.close(); }
  }
  const report = buildUsageCostReport(texts, scenario ? { syntheticScenario: SYNTHETIC_SCENARIO } : {});
  process.stdout.write(formatUsageCostReport(report));
  if (report.hasConflicts) process.exitCode = 2;
} catch {
  console.error("Could not report usage. Supply 1–32 bounded regular JSON files matching the Codex or sanitized Claude contract. No account read or write occurred.");
  process.exitCode = 1;
}

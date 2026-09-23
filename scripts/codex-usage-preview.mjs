#!/usr/bin/env node
// Explicit local files only. No directory discovery, account request or persistence.
// Run: node --no-warnings --experimental-strip-types scripts/codex-usage-preview.mjs CAPTURE.json [CAPTURE.json ...]
import { open, constants } from "node:fs/promises";
import { CODEX_USAGE_LIMITS, parseCodexUsageCapture, reviewCodexUsageCaptures, formatCodexUsagePreview } from "../src/domain/codex-usage.ts";

const paths = process.argv.slice(2);
try {
  if (!paths.length || paths.length > CODEX_USAGE_LIMITS.captures) throw new Error();
  const captures = [];
  for (const path of paths) {
    // Reject directories, FIFOs and symlinks; bound even a file that grows after stat.
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > CODEX_USAGE_LIMITS.bytes) throw new Error();
      const buffer = Buffer.alloc(CODEX_USAGE_LIMITS.bytes + 1);
      let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await file.read(buffer, length, buffer.length - length, null);
        if (bytesRead === 0) break;
        length += bytesRead;
      }
      if (length > CODEX_USAGE_LIMITS.bytes) throw new Error();
      const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, length));
      captures.push(parseCodexUsageCapture(text));
    } finally { await file.close(); }
  }
  const review = reviewCodexUsageCaptures(captures);
  process.stdout.write(formatCodexUsagePreview(review));
  if (review.accounts.some(account => account.conflicts.length > 0)) process.exitCode = 2;
} catch {
  // Do not print exception text: it may contain raw JSON, source values or private paths.
  console.error("Could not preview Codex metadata. Supply 1–32 bounded regular JSON captures matching the supported schema. No account read or write occurred.");
  process.exitCode = 1;
}

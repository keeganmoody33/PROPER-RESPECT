#!/usr/bin/env node
// Run with Node 22+ and --experimental-strip-types. Never writes to Convex.
import { readFileSync, writeFileSync, realpathSync } from "node:fs";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { z } from "zod";
import { rawSignalSchema, proposeDrafts, prepareImportedProp } from "../src/domain/discovery.ts";

const inputSchema = z.object({
  capturedAt: z.iso.datetime(),
  entries: z.array(z.object({
    id: z.string().min(1),
    acquisition: z.enum(["PROVIDER", "MANIFEST", "ASSISTANT_EXTRACTED", "USER_SUPPLIED"]),
    sourceRef: z.string().min(1),
    excerpt: z.string().min(1),
    signal: rawSignalSchema,
  })).min(1),
}).refine(input => new Set(input.entries.map(entry => entry.id)).size === input.entries.length,
  "Evidence IDs must be unique.");

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error("Usage: node --experimental-strip-types scripts/replay-evidence.mjs INPUT.json PRIVATE_OUTPUT.json");
}
const repo = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
const output = resolve(realpathSync(dirname(resolve(outputPath))), resolve(outputPath).split(/[\\/]/).at(-1));
const withinRepo = relative(repo, output);
if (withinRepo !== ".." && !withinRepo.startsWith("../") && !isAbsolute(withinRepo)) {
  throw new Error("Evidence output must be outside the repository.");
}
const bytes = readFileSync(inputPath);
const input = inputSchema.parse(JSON.parse(bytes));
const signals = input.entries.map(entry => entry.signal);
const proposals = proposeDrafts(signals);
const matched = new Set(proposals.flatMap(proposal => proposal.signalIndexes));
const result = {
  formatVersion: 1,
  runAt: new Date().toISOString(),
  evidenceCapturedAt: input.capturedAt,
  execution: "LOCAL_REPLAY_NOT_LIVE_IMPORT",
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim(),
  resolverSha256: createHash("sha256").update(readFileSync(resolve(repo, "src/domain/discovery.ts"))).digest("hex"),
  inputSha256: createHash("sha256").update(bytes).digest("hex"),
  entries: input.entries,
  proposals: proposals.map(proposal => ({
    ...proposal,
    draft: prepareImportedProp(proposal, signals[proposal.signalIndexes[0]].sourceType),
    evidenceIds: proposal.signalIndexes.map(index => input.entries[index].id),
  })),
  unresolvedEvidenceIds: input.entries.filter((_, index) => !matched.has(index)).map(entry => entry.id),
};
writeFileSync(output, JSON.stringify(result, null, 2) + "\n", { mode: 0o600, flag: "wx" });
console.log(`Private replay saved: ${proposals.length} proposals, ${result.unresolvedEvidenceIds.length} unresolved signals. No publication or database writes.`);

import { execFileSync } from "node:child_process";
import { mkdtemp, realpath, writeFile, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { beforeAll, afterEach, expect, it } from "vitest";
import { readNativeCodexUsagePage } from "./codex-stream-reader.ts";
import { collectCodexRolloutHistory } from "./codex-history-collector.ts";

const roots: string[] = [];
beforeAll(() => execFileSync(process.execPath, ["scripts/build-codex-reader.mjs"]));
afterEach(async () => { await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function fixture() { const root = await realpath(await mkdtemp("/tmp/pr-stream-reader-")); roots.push(root); return root; }
const header = JSON.stringify({ type: "session_meta", payload: { id: "real-shape-fixture", cwd: "/PRIVATE_PROJECT", instructions: "PRIVATE_PROMPT" } });
const usage = JSON.stringify({ type: "token_usage_record", timestamp: "2026-10-06T00:00:00.000Z", payload: { thread_id: "real-shape-fixture", response_id: "response-1", usage: { input_tokens: 12, output_tokens: 3, total_tokens: 15 } } });
const read = (directory: string, offset = 0) => readNativeCodexUsagePage({ directory, offset, signal: new AbortController().signal });

it("reads a large real-shaped rollout while discarding prompts locally", async () => {
  const root = await fixture();
  await writeFile(join(root, "rollout-large.jsonl"), [header, JSON.stringify({ type: "response_item", payload: { text: "PRIVATE_PROMPT".repeat(450000) } }), usage].join("\n") + "\n");
  const page = await read(root);
  expect(page.scannedFiles).toBe(1); expect(page.ignoredEntries).toBe(0);
  expect(JSON.stringify(page)).not.toContain("PRIVATE_");
  const history = collectCodexRolloutHistory({ window: { start: "2026-10-01T00:00:00.000Z", end: "2026-10-08T00:00:00.000Z" }, signal: new AbortController().signal }, page.files);
  expect(history.responses.totals.find(row => row.metric === "total_tokens")?.value).toBe("15");
});

it("quarantines an invalid file as a coverage gap without admitting its usage", async () => {
  const root = await fixture();
  await writeFile(join(root, "rollout-invalid.jsonl"), `${header}\n${usage}\nnot-json\n`);
  await writeFile(join(root, "rollout-valid.jsonl"), `${header}\n${usage}\n`);
  const page = await read(root);
  expect(page.scannedFiles).toBe(2); expect(page.ignoredEntries).toBe(1); expect(page.files).toHaveLength(1);
});

it("rejects links and interrupted reads before returning projected rows", async () => {
  const root = await fixture();
  await symlink("/PRIVATE_TARGET", join(root, "rollout-link.jsonl"));
  await expect(read(root)).rejects.toThrow("could not be read safely");
  const controller = new AbortController(); controller.abort();
  await expect(readNativeCodexUsagePage({ directory: root, offset: 0, signal: controller.signal })).rejects.toThrow("cancelled");
});

it("preserves exact counters beyond JavaScript integer precision", async () => {
  const root = await fixture();
  await writeFile(join(root, "rollout-exact.jsonl"), `${header}\n${usage.replace('"total_tokens":15', '"total_tokens":9007199254740993')}\n`);
  const page = await read(root);
  expect(page.files[0].lines[1]).toContain("9007199254740993");
});

// Generated fixtures only. Run from the repository root with Node 24.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { build } from "esbuild";

const baseline = "15fcf7bd1a9723c2ffad16adc18e97448503af42";
async function compile(contents) {
  const result = await build({ stdin: { contents, resolveDir: resolve("src/local"), loader: "ts" }, bundle: true, platform: "node", format: "esm", write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`);
}
const previous = await compile(execFileSync("git", ["show", `${baseline}:src/local/codex-history-collector.ts`], { encoding: "utf8" }));
const current = await compile('export { prepareCodexRolloutHistory } from "./codex-history-collector.ts";');
const counts = input => ({ input_tokens: input, cached_input_tokens: 0, output_tokens: 0, total_tokens: input, reasoning_output_tokens: 0, cache_write_input_tokens: 0 });
const event = (type, timestamp, payload) => JSON.stringify({ type, timestamp, payload });
const start = Date.parse("2026-01-01T00:00:00.000Z"), end = Date.parse("2027-01-01T00:00:00.000Z"), week = 7 * 86400_000;
const at = days => new Date(start + days * 86400_000).toISOString();
const meta = (id, extra = {}) => event("session_meta", at(0), { id, ...extra });
const response = (id, date, input, thread) => event("token_usage_record", date, { thread_id: thread, response_id: id, usage: counts(input) });
const legacy = (date, total, last) => event("event_msg", date, { type: "token_count", info: { total_token_usage: counts(total), last_token_usage: counts(last) } });
const fixtures = Array.from({ length: 60 }, (_, file) => [meta(`modern-${file}`), ...Array.from({ length: 96 }, (_, index) => response(`r-${index}`, at(Math.floor(index * 364 / 96)), index + 1, `modern-${file}`))]);
fixtures.push(
  [meta("legacy"), legacy(at(-1), 10, 10), legacy(at(1), 20, 10), legacy(at(8), 30, 10)],
  [meta("fork", { forked_from_id: "parent" }), legacy(at(2), 50, 50)],
  [meta("conflict"), response("same", at(30), 5, "conflict"), response("same", at(280), 7, "conflict")],
  [meta("precedence"), legacy(at(1), 500, 500), response("modern", at(281), 2, "precedence")],
);
const windows = Array.from({ length: Math.ceil((end - start) / week) }, (_, index) => ({ start: new Date(start + index * week).toISOString(), end: new Date(Math.min(end, start + (index + 1) * week)).toISOString() }));
const signal = new AbortController().signal;
let previousPasses = 0, currentPasses = 0;
const beforeStart = performance.now();
const before = windows.map(window => previous.collectCodexRolloutHistory({ window, signal }, fixtures.map(lines => ({ get lines() { previousPasses++; return lines; } }))));
const previousMs = performance.now() - beforeStart;
const afterStart = performance.now();
const select = current.prepareCodexRolloutHistory(fixtures.map(lines => ({ get lines() { currentPasses++; return lines; } })), signal);
const after = windows.map(window => select(window));
const currentMs = performance.now() - afterStart;
assert.deepEqual(after, before);
assert.equal(currentPasses, fixtures.length);
assert.equal(previousPasses, fixtures.length * windows.length);
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), baseline, generatedFixture: true, files: fixtures.length, windows: windows.length, identicalResults: true, previousPasses, currentPasses, previousMs: Math.round(previousMs), currentMs: Math.round(currentMs) }, null, 2));

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

test("private replay preserves acquisition, reports unresolved evidence, and never overwrites a baseline", () => {
  const dir = mkdtempSync(join(tmpdir(), "proper-respect-replay-"));
  try {
    const input = join(dir, "input.json");
    const output = join(dir, "baseline.json");
    const base = { acquisition: "ASSISTANT_EXTRACTED", sourceRef: "private-test-source", excerpt: "Receipt line", signal: { sourceType: "BILLING", capturedAt: "2026-09-16T00:00:00Z", payload: "private-test-payload" } };
    writeFileSync(input, JSON.stringify({ capturedAt: "2026-09-16T00:00:00Z", entries: [
      { ...base, id: "copilot", signal: { ...base.signal, vendor: "GitHub Copilot Pro", url: "https://github.com" } },
      { ...base, id: "unknown", signal: { ...base.signal, vendor: "Unknown subscription" } },
    ] }));
    const run = target => spawnSync(process.execPath, ["--experimental-strip-types", "scripts/replay-evidence.mjs", input, target], { encoding: "utf8" });
    const first = run(output);
    assert.equal(first.status, 0, first.stderr);
    const raw = readFileSync(output, "utf8");
    const result = JSON.parse(raw);
    assert.deepEqual(result.unresolvedEvidenceIds, ["unknown"]);
    assert.equal(result.entries[0].acquisition, "ASSISTANT_EXTRACTED");
    assert.equal(result.proposals[0].draft.visibility, "DRAFT");
    assert.equal(result.execution, "LOCAL_REPLAY_NOT_LIVE_IMPORT");
    assert.equal(statSync(output).mode & 0o777, 0o600);
    assert.equal(first.stdout.includes("private-test-payload"), false);
    assert.notEqual(run(output).status, 0);
    assert.equal(readFileSync(output, "utf8"), raw);
    assert.notEqual(run(join(process.cwd(), "should-not-write-evidence.json")).status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

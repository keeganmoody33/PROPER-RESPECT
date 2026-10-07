import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, expect, it } from "vitest";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
const cli = resolve("scripts/codex-history-preview.mjs");
const fixture = resolve("tests/fixtures/codex-rollouts");
const windowArgs = ["--start", "2026-10-01T00:00:00.000Z", "--end", "2026-10-08T00:00:00.000Z"];
it("runs the real CLI over active/archive official-format fixtures without content or double counting", () => {
  const text = execFileSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", cli, "--directory", fixture, ...windowArgs], { encoding: "utf8" });
  const review = JSON.parse(text);
  expect(review.responses.totals.find((row: { metric: string }) => row.metric === "total_tokens").value).toBe("30");
  expect(review.legacy.totals.find((row: { metric: string }) => row.metric === "total_tokens").value).toBe("20");
  expect(review.responses.replays).toBe(1);
  expect(review.scan.scannedFiles).toBe(3);
  expect(text).not.toMatch(/SYNTHETIC_PRIVATE|11111111|22222222|resp_fixture|rollout-fixture|cwd|prompt/);
  expect(review.source.accountAlias).toBeNull();
});
it("emits an identical replacement snapshot on rerun instead of accumulating usage", () => {
  const run = () => execFileSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", cli, "--directory", fixture, ...windowArgs], { encoding: "utf8" });
  expect(run()).toBe(run());
});
it("fails atomically with generic errors on invalid window or private source bytes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codex-cli-synthetic-"));
  roots.push(directory);
  await mkdir(join(directory, "sessions"));
  await writeFile(join(directory, "sessions", "rollout-invalid.jsonl"), "PRIVATE_INVALID_JSON\n");
  for (const args of [["--directory", directory, ...windowArgs], ["--directory", fixture, "--start", "2026-10-01T00:00:00.0001Z", "--end", windowArgs[3]]]) {
    const result = spawnSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", cli, ...args], { encoding: "utf8" });
    expect(result.status).toBe(1); expect(result.stdout).toBe("");
    expect(result.stderr).not.toContain(directory); expect(result.stderr).not.toContain("PRIVATE_INVALID_JSON");
  }
  expect(await readFile(join(directory, "sessions", "rollout-invalid.jsonl"), "utf8")).toBe("PRIVATE_INVALID_JSON\n");
}, 30_000);

it("has clean stderr for the documented help and fixture commands", () => {
  for (const args of [["--help"], ["--directory", fixture, ...windowArgs]]) {
    const result = spawnSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", cli, ...args], { encoding: "utf8" });
    expect(result.status).toBe(0); expect(result.stderr).toBe("");
  }
});

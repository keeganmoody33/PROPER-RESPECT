import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, writeFile, rm, symlink, readFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { buildUsageCostReport, formatUsageCostReport } from "../../domain/usage-cost-report.ts";
import { sanitizeClaudeNativeMetrics } from "./sanitize.ts";
const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "native-synthetic-")); dirs.push(dir);
  const key = join(dir, "key"); await writeFile(key, new Uint8Array(32).fill(7), { mode: 0o600 });
  const args = ["--no-warnings", "--experimental-strip-types", "scripts/claude-native-report.mjs", "--synthetic", "--key-file", key, "--source-scope", "synthetic-device", "--captured-at", "2026-09-24T12:00:00.000Z", "--content-type", "application/json"];
  return { dir, key, run: (...files: string[]) => spawnSync(process.execPath, [...args, ...files], { encoding: "utf8", timeout: 10000, maxBuffer: 2_000_000 }) };
}
const token = "tests/fixtures/claude-native/tokens.json", cost = "tests/fixtures/claude-native/cost.json";
describe("synthetic explicit-file pipeline", () => {
  it("runs native files to exact independent private report and detects replay", async () => {
    const { run } = await setup(), result = run(token, cost, token);
    expect(result.status).toBe(0); expect(result.stderr).toBe("");
    expect(result.stdout).toContain("9007199254740993");
    expect(result.stdout).toContain("0.00000000000000000001234567890123456789");
    expect(result.stdout).toContain("1790244000000000001");
    expect(result.stdout).toContain("Semantic replays ignored: 1");
    expect(result.stdout).not.toMatch(/SYNTHETIC-PRIVATE|synthetic-device|user.email|session.id/);
  });
  it("exports one sanitized capture consumable by the existing CLI", async () => {
    const { run, dir } = await setup(), sanitized = run("--format", "sanitized", token);
    expect(sanitized.status).toBe(0);
    const path = join(dir, "sanitized.json"); await writeFile(path, sanitized.stdout);
    const report = spawnSync(process.execPath, ["--no-warnings", "--experimental-strip-types", "scripts/usage-cost-report.mjs", path], { encoding: "utf8", timeout: 10000 });
    expect(report.status).toBe(0); expect(report.stdout).toContain("Native Claude metrics");
  });
  it("rejects later malformed input without partial stdout or sensitive diagnostics", async () => {
    const { run, dir } = await setup(), path = join(dir, "PRIVATE-PATH.json");
    await writeFile(path, '{"PRIVATE-CONTENT":');
    const result = run(token, path);
    expect(result.status).toBe(1); expect(result.stdout).toBe(""); expect(result.stderr).not.toContain("PRIVATE");
  });
  it("rejects symlinks, directories, oversized files and insecure key permissions", async () => {
    const { run, dir, key } = await setup(), link = join(dir, "link"), huge = join(dir, "huge");
    await symlink(resolve(token), link); await writeFile(huge, " ".repeat(256001));
    for (const path of [link, dir, huge]) { const result = run(path); expect(result.status).toBe(1); expect(result.stdout).toBe(""); }
    await chmod(key, 0o644); expect(run(token).status).toBe(1);
  });
  it("preserves the legacy report lane when mixed with native data", async () => {
    const native = sanitizeClaudeNativeMetrics(await readFile(token), { contentType: "application/json", identityKey: new Uint8Array(32).fill(7), sourceScope: "synthetic", sample: "synthetic", capturedAt: "2026-09-24T12:00:00.000Z" });
    const old = await readFile("tests/fixtures/usage-cost/priced-synthetic.json", "utf8");
    const before = buildUsageCostReport([old]), mixed = buildUsageCostReport([old, JSON.stringify(native)]);
    expect(mixed.claude).toEqual(before.claude); expect(mixed.valuations).toEqual(before.valuations);
    expect(mixed.nativeClaude?.rows).toHaveLength(1); expect(formatUsageCostReport(mixed)).toContain("API equivalent unpriced");
  });
});

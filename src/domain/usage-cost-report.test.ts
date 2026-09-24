import { describe, expect, it } from "vitest";
import { buildUsageCostReport, formatUsageCostReport, SYNTHETIC_SCENARIO } from "./usage-cost-report.ts";
import { readFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";

const fixture = () => JSON.parse(readFileSync("tests/fixtures/usage-cost/priced-synthetic.json", "utf8"));
const scenario = { syntheticScenario: SYNTHETIC_SCENARIO } as const;

describe("private usage cost report", () => {
  it("reuses Codex facts without valuing account snapshots", () => {
    const text = readFileSync("tests/fixtures/codex-usage/account-snapshot.json", "utf8");
    const report = buildUsageCostReport([text]);
    expect(report.codex?.accounts[0].snapshots[0].response.summary.lifetimeTokens).toBe(1200);
    const output = formatUsageCostReport(report);
    expect(output).toContain("Codex");
    expect(output).toContain("unpriced");
    expect(output).toContain("Billed: unknown");
    expect(output).toContain("No global total");
  });
  it("rejects empty, excessive and unrelated inputs without raw content", () => {
    for (const inputs of [[], Array(33).fill("{}"), ['{"prompt":"SECRET"}']]) {
      expect(() => buildUsageCostReport(inputs)).toThrow("Invalid usage report input.");
    }
  });
  it("prices only an explicit synthetic scenario with exact cited arithmetic", () => {
    const text = JSON.stringify(fixture());
    const unpriced = buildUsageCostReport([text]);
    const priced = buildUsageCostReport([text], scenario);
    expect(unpriced.valuations[0].kind).toBe("unpriced");
    expect(priced.valuations[0]).toMatchObject({ kind: "api-equivalent", exactUsd: "0.002010000000", currency: "USD" });
    expect(priced.claude?.observations).toEqual(unpriced.claude?.observations);
    expect(priced.claude?.rows[0].sourceCostUsd).toBe("0.009123456789");
    const output = formatUsageCostReport(priced);
    expect(output).toContain("SYNTHETIC");
    expect(output).toContain("(1000 × 1 + 200 × 5 + 100 × 0.10) / 1000000 USD");
    expect(output).toContain("https://platform.claude.com/docs/en/models/haiku-4-5/overview");
  });
  it("keeps a single cached token and huge counts exact", () => {
    const f = fixture();
    f.bundles[0].counts = { input: "9007199254740993", output: "0", cacheRead: "1", cacheCreation: "0" };
    const report = buildUsageCostReport([JSON.stringify(f)], scenario);
    expect(report.valuations[0]).toMatchObject({ exactUsd: "9007199254.740993100000" });
  });
  it.each([
    ["owner data", (f: ReturnType<typeof fixture>) => { f.sample = "owner-supplied"; }],
    ["unknown model", (f: ReturnType<typeof fixture>) => { f.bundles[0].model = null; }],
    ["mixed model", (f: ReturnType<typeof fixture>) => { f.bundles[0].model = "mixed"; }],
    ["alias model", (f: ReturnType<typeof fixture>) => { f.bundles[0].model = "claude-haiku-4-5"; }],
    ["missing category", (f: ReturnType<typeof fixture>) => { f.bundles[0].counts.input = null; }],
    ["unknown cache TTL", (f: ReturnType<typeof fixture>) => { f.bundles[0].counts.cacheCreation = "1"; }],
    ["missing version", (f: ReturnType<typeof fixture>) => { f.sourceVersion = null; }],
    ["old version", (f: ReturnType<typeof fixture>) => { f.sourceVersion = "2.1.213"; }],
    ["future version", (f: ReturnType<typeof fixture>) => { f.sourceVersion = "2.1.999"; }],
    ["unknown timezone", (f: ReturnType<typeof fixture>) => { f.timezone = "unknown"; }],
    ["historical rate", (f: ReturnType<typeof fixture>) => {
      f.bundles[0].start = "2026-09-23T00:00:00.000Z"; f.bundles[0].end = "2026-09-23T00:01:00.000Z";
    }],
  ])("leaves %s unpriced", (_name, mutate) => {
    const f = fixture(); mutate(f);
    expect(buildUsageCostReport([JSON.stringify(f)], scenario).valuations[0].kind).toBe("unpriced");
  });
  it("reports resets, replay and overlap without global addition", () => {
    const reset = readFileSync("tests/fixtures/usage-cost/cumulative-reset.json", "utf8");
    const report = buildUsageCostReport([reset, reset], scenario);
    expect(report.claude?.rows.filter(row => row.status === "measured").map(row => row.counts.input)).toEqual(["0", "60", "10"]);
    expect(report.replays).toBeGreaterThan(0);
    const overlap = buildUsageCostReport([readFileSync("tests/fixtures/usage-cost/overlap.json", "utf8")], scenario);
    expect(overlap.hasConflicts).toBe(true);
    expect(overlap.valuations.every(value => value.kind === "unpriced")).toBe(true);
  });
  it("renders a runnable two-provider report", () => {
    const output = execFileSync(process.execPath, ["--no-warnings", "--experimental-strip-types", "scripts/usage-cost-report.mjs", "--synthetic-haiku-20260924", "tests/fixtures/usage-cost/priced-synthetic.json", "tests/fixtures/usage-cost/codex-account-synthetic.json"], { encoding: "utf8" });
    expect(output).toContain("0.002010000000");
    expect(output).toContain("Codex / OpenAI");
    expect(output).toContain("Claude Code / Anthropic / SYNTHETIC");
  });
  it("returns conflict and invalid-input exit statuses without partial report", () => {
    const args = ["--no-warnings", "--experimental-strip-types", "scripts/usage-cost-report.mjs"];
    const conflict = spawnSync(process.execPath, [...args, "tests/fixtures/usage-cost/overlap.json"], { encoding: "utf8" });
    expect(conflict.status).toBe(2);
    const bad = spawnSync(process.execPath, [...args, "tests/fixtures/usage-cost/priced-synthetic.json", "/does-not-exist-SECRET"], { encoding: "utf8" });
    expect(bad.status).toBe(1);
    expect(bad.stdout).toBe("");
    expect(bad.stderr).not.toContain("SECRET");
  });
});

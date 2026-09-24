import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, writeFile, readFile, rm, symlink, chmod, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductCard } from "../../../components/product-card";
import { parseClaudeNativeCapture } from "../../domain/claude-native-evidence.ts";
import { buildUsageCostReport } from "../../domain/usage-cost-report.ts";
import { projectPrivateUsage } from "../../domain/private-usage-card.ts";

// Every input is generated test data, including cases labelled owner-supplied.
const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
const huge = "9007199254740993";
const tiny = "0.00000000000000000001234567890123456789";
const capturedAt = "2026-09-24T12:00:00.000Z";
function fixture(cost = false, value = huge, name = cost ? "claude_code.cost.usage" : "claude_code.token.usage") {
  return JSON.stringify({ resourceMetrics: [{
    resource: { attributes: [
      { key: "service.name", value: { stringValue: "claude-code" } },
      { key: "service.version", value: { stringValue: "2.1.274" } },
      { key: "user.email", value: { stringValue: "PRIVATE_GENERATED@example.test" } },
    ] },
    scopeMetrics: [{ metrics: [{ name, unit: cost ? "USD" : "tokens", sum: {
      aggregationTemporality: 1, isMonotonic: true, dataPoints: [{
        attributes: [{ key: "model", value: { stringValue: "unknown-test-model" } },
          ...(!cost ? [{ key: "type", value: { stringValue: "input" } }] : [])],
        startTimeUnixNano: cost ? "1790244000000000004" : "1790244000000000001",
        timeUnixNano: cost ? "1790244000000000108" : "1790244000000000100",
        ...(cost ? { asDouble: "DECIMAL_LEXEME" } : { asInt: value }),
      }],
    } }] }],
  }] }).replace('"DECIMAL_LEXEME"', "1.234567890123456789e-20");
}
function cli(script: string, args: string[], cwd = process.cwd()) {
  return spawnSync(process.execPath, ["--no-warnings", "--experimental-strip-types", join(process.cwd(), "scripts", script), ...args], {
    cwd, encoding: "utf8", timeout: 15000, maxBuffer: 2_000_000,
  });
}
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "claude-selected-generated-")); dirs.push(dir);
  const key = join(dir, "key");
  await writeFile(key, Buffer.alloc(32, 19), { mode: 0o600, flag: "wx" });
  const input = join(dir, "owner-supplied-name-only.json"), cost = join(dir, "synthetic-name-only.json");
  await writeFile(input, fixture(), { mode: 0o600, flag: "wx" });
  await writeFile(cost, fixture(true), { mode: 0o600, flag: "wx" });
  const options = ["--key-file", key, "--source-scope", "PRIVATE_GENERATED_SCOPE", "--captured-at", capturedAt, "--content-type", "application/json"];
  const run = (modes: string[], files = [input], extra: string[] = []) => cli("claude-native-report.mjs", [...modes, ...options, ...extra, ...files], dir);
  return { dir, key, input, cost, options, run };
}
function rejected(result: ReturnType<typeof cli>) {
  expect(result.status, result.stderr).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("Native metrics rejected.");
  expect(result.stderr).not.toMatch(/PRIVATE_GENERATED|owner-supplied-name-only|Error:|ENOENT/);
}

describe("explicit source origin on the real native CLI", () => {
  it.each(["synthetic", "owner-supplied"])("preserves exact values and independent times through %s sanitation and reporting", async sample => {
    const { run, input, cost } = await setup();
    const texts = [input, cost].map(path => {
      const result = run([`--${sample}`], [path], ["--format", "sanitized"]);
      expect(result.status, result.stderr).toBe(0); expect(result.stderr).toBe("");
      expect(result.stdout.endsWith("\n")).toBe(true);
      expect(result.stdout).not.toMatch(/PRIVATE_GENERATED|unknown-test-model/);
      const capture = parseClaudeNativeCapture(result.stdout);
      expect(capture).toMatchObject({ sample, capturedAt });
      expect(capture.points[0].model).toBeNull();
      return result.stdout;
    });
    const report = buildUsageCostReport(texts);
    expect(report.nativeClaude!.rows.map(row => [row.metric, row.quantity, row.startUnixNano, row.endUnixNano]).sort()).toEqual([
      ["input", huge, "1790244000000000001", "1790244000000000100"],
      ["sourceCostUsd", tiny, "1790244000000000004", "1790244000000000108"],
    ]);
    const result = run([`--${sample}`], [input, cost, input]);
    expect(result.status, result.stderr).toBe(0);
    for (const value of [huge, tiny, "Semantic replays ignored: 1", "API equivalent unpriced", "actual billed unknown", sample]) expect(result.stdout).toContain(value);
  });

  it("rejects missing, unknown, duplicate, conflicting and misplaced modes without output", async () => {
    const { run, input, dir } = await setup();
    for (const modes of [[], ["--real"], ["--synthetic", "--owner-supplied"], ["--owner-supplied", "--synthetic"], ["--synthetic", "--synthetic"], ["--owner-supplied", "--owner-supplied"]]) rejected(run(modes));
    // Real flag-named files must not make a misplaced/conflicting selector valid.
    await writeFile(join(dir, "--synthetic"), fixture(), { mode: 0o600 });
    await writeFile(join(dir, "--owner-supplied"), fixture(), { mode: 0o600 });
    rejected(run(["--owner-supplied"], [input, "--synthetic"]));
    rejected(run(["--synthetic"], [input, "--owner-supplied"]));
    rejected(run([], [input, "--owner-supplied"]));
  });

  it("rejects mixed metrics and later invalid files atomically in owner mode", async () => {
    const { run, input, dir } = await setup();
    const mixed = join(dir, "mixed.json"), invalid = join(dir, "PRIVATE_GENERATED.json");
    const document = JSON.parse(fixture());
    document.resourceMetrics[0].scopeMetrics[0].metrics.push(JSON.parse(fixture(false, "1", "claude_code.session.count")).resourceMetrics[0].scopeMetrics[0].metrics[0]);
    await writeFile(mixed, JSON.stringify(document), { mode: 0o600 });
    await writeFile(invalid, '{"PRIVATE_GENERATED":', { mode: 0o600 });
    rejected(run(["--owner-supplied"], [mixed]));
    rejected(run(["--owner-supplied"], [input, invalid]));
    rejected(run(["--owner-supplied"], [input, input], ["--format", "sanitized"]));
  });

  it("retains bounded regular-file and private-key enforcement in owner mode", async () => {
    const { run, input, dir, key } = await setup();
    const link = join(dir, "link"), oversized = join(dir, "oversized");
    await symlink(input, link); await writeFile(oversized, " ".repeat(256001), { mode: 0o600 });
    for (const path of [link, dir, oversized, join(dir, "absent")]) rejected(run(["--owner-supplied"], [path]));
    await chmod(key, 0o644); rejected(run(["--owner-supplied"]));
    await chmod(key, 0o600); await writeFile(key, Buffer.alloc(31)); rejected(run(["--owner-supplied"]));
  });

  it("retains conflict exit 2 for values and origin changes; preview success does not clear the gate", async () => {
    const { run, input, dir } = await setup();
    const changed = join(dir, "changed.json"); await writeFile(changed, fixture(false, "7"), { mode: 0o600 });
    const conflict = run(["--owner-supplied"], [input, changed]);
    expect(conflict.status).toBe(2); expect(conflict.stderr).toBe(""); expect(conflict.stdout).toContain("conflict");
    const captures = [];
    for (const mode of ["--synthetic", "--owner-supplied"]) {
      const result = run([mode], [input], ["--format", "sanitized"]);
      expect(result.status, result.stderr).toBe(0);
      const path = join(dir, `${mode}.json`); await writeFile(path, result.stdout, { mode: 0o600, flag: "wx" }); captures.push(path);
    }
    const report = cli("usage-cost-report.mjs", captures);
    expect(report.status).toBe(2); expect(report.stderr).toBe("");
    expect(report.stdout).toContain("Changed source metadata or origin; entire stream quarantined.");
    const out = join(dir, "diagnostic-preview");
    const diagnostic = cli("private-usage-card-preview.mjs", ["--out", out, ...captures]);
    expect(diagnostic.status, diagnostic.stderr).toBe(0);
    expect(await readFile(join(out, "preview.js"), "utf8")).toContain("Changed source metadata or origin; entire stream quarantined.");
  });

  it("feeds the branded private card without publishing or pricing owner-labelled test data", async () => {
    const { run, input, cost, dir } = await setup();
    const texts: string[] = [], paths: string[] = [];
    for (const [index, source] of [input, cost].entries()) {
      const result = run(["--owner-supplied"], [source], ["--format", "sanitized"]);
      expect(result.status, result.stderr).toBe(0); texts.push(result.stdout);
      const path = join(dir, `capture-${index}.json`); paths.push(path);
      await writeFile(path, result.stdout, { mode: 0o600, flag: "wx" });
    }
    const usage = projectPrivateUsage(buildUsageCostReport(texts)).tools[0];
    expect(usage.nativeClaude!.rows.every(row => row.sample === "owner-supplied-unverified" && row.apiEquivalent === "unpriced" && row.billed === "unknown")).toBe(true);
    const card = { product: { slug: "claude-code", name: "Claude Code", domain: "claude.com", description: "Generated test" }, status: "TESTING" as const, headline: "Generated test", note: "Generated test" };
    const owner = renderToStaticMarkup(createElement(ProductCard, { card, index: 0, audience: "owner", privateUsage: usage }));
    expect(owner).toContain(huge); expect(owner).toContain("Owner-supplied · unverified");
    const publicCard = renderToStaticMarkup(createElement(ProductCard, { card, index: 0, audience: "visitor", privateUsage: usage }));
    expect(publicCard).not.toContain(huge); expect(publicCard).not.toContain("private-native-usage");
    const out = join(dir, "preview");
    expect(cli("usage-cost-report.mjs", paths).status).toBe(0);
    expect(cli("private-usage-card-preview.mjs", ["--out", out, ...paths]).status).toBe(0);
    const js = await readFile(join(out, "preview.js"), "utf8");
    for (const exact of [huge, tiny, "owner-supplied-unverified", capturedAt]) expect(js).toContain(exact);
    const digests = texts.flatMap(text => { const value = parseClaudeNativeCapture(text); return [value.keyScopeDigest, ...value.points.flatMap(point => [point.streamDigest, point.familyDigest])]; });
    for (const value of [...digests, "PRIVATE_GENERATED", "unknown-test-model"]) expect(js).not.toContain(value);
    const asset = "product-assets/claude-code/2026-09-24/app-icon.png";
    expect(await readFile(join(out, asset))).toEqual(await readFile(join("public", asset)));
    expect(await readFile(join(out, "index.html"), "utf8")).toContain("connect-src 'none'");
    expect((await stat(out)).mode & 0o777).toBe(0o700);
    expect((await stat(join(out, "preview.js"))).mode & 0o777).toBe(0o600);
    expect(cli("private-usage-card-preview.mjs", ["--out", out, ...paths]).status).toBe(1);
    expect(await readFile(join(out, "preview.js"), "utf8")).toBe(js);
  });
});

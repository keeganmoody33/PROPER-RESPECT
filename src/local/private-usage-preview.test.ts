import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { expect, test } from "vitest";

const args = ["--no-warnings", "--experimental-strip-types", "scripts/private-usage-card-preview.mjs"];
const priced = "tests/fixtures/usage-cost/priced-synthetic.json";
test("generates the actual private card application with default-off pricing and no raw identities", () => {
  const parent = mkdtempSync(join(tmpdir(), "private-card-cli-"));
  const out = join(parent, "preview");
  const result = spawnSync(process.execPath, [...args, "--out", out, priced, "tests/fixtures/usage-cost/codex-account-synthetic.json"], { encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
  const js = readFileSync(join(out, "preview.js"), "utf8");
  expect(js).toContain("0.009123456789");
  expect(js).not.toContain("0.002010000000");
  for (const text of ["synthetic-owner", "synthetic-account", "synthetic-device", "synthetic-session", "synthetic-process", "synthetic-capture-1", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]) expect(js).not.toContain(text);
  expect(readFileSync(join(out, "index.html"), "utf8")).toContain("connect-src 'none'");
  expect(existsSync(join(out, "product-assets/github-copilot/2026-09-19/GitHub_Copilot_Lockup_White.svg"))).toBe(true);
  const before = readFileSync(join(out, "index.html"), "utf8");
  const repeated = spawnSync(process.execPath, [...args, "--out", out, priced], { encoding: "utf8" });
  expect(repeated.status).toBe(1);
  expect(readFileSync(join(out, "index.html"), "utf8")).toBe(before);
});

test("rejects invalid input without partial preview or sensitive diagnostics", () => {
  const parent = mkdtempSync(join(tmpdir(), "private-card-invalid-"));
  const invalid = join(parent, "PRIVATE_FILENAME.json");
  writeFileSync(invalid, '{"secret":"PRIVATE_CONTENT"}');
  const out = join(parent, "preview");
  const result = spawnSync(process.execPath, [...args, "--out", out, priced, invalid], { encoding: "utf8" });
  expect(result.status).toBe(1);
  expect(existsSync(out)).toBe(false);
  expect(result.stderr).not.toContain("PRIVATE_");
});

test.each([false, true])("synthetic native files through sanitizer produce an exact private preview, mixed=%s", (mixed) => {
  const parent = mkdtempSync(join(tmpdir(), "private-card-native-"));
  const key = join(parent, "synthetic.key");
  writeFileSync(key, Buffer.alloc(32, 17), { mode: 0o600 });
  const digests: string[] = [];
  const sanitized = ["tokens", "cost"].map((name) => {
    const input = join(parent, `${name}-synthetic.json`);
    const raw = readFileSync(`tests/fixtures/claude-native/${name}.json`, "utf8")
      .replace('"asInt": "9007199254740993"', '"asDouble": 900719925474099312345678901234');
    writeFileSync(input, raw);
    const result = spawnSync(process.execPath, ["--no-warnings", "--experimental-strip-types", "scripts/claude-native-report.mjs",
      "--synthetic", "--key-file", key, "--source-scope", "PRIVATE_SYNTHETIC_SCOPE",
      "--captured-at", "2026-09-24T12:00:00.000Z", "--content-type", "application/json", "--format", "sanitized", input], { encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).not.toMatch(/SYNTHETIC-PRIVATE|PRIVATE_SYNTHETIC_SCOPE/);
    const capture = JSON.parse(result.stdout);
    digests.push(capture.keyScopeDigest, ...capture.points.flatMap((point: {streamDigest: string; familyDigest: string}) => [point.streamDigest, point.familyDigest]));
    const path = join(parent, `${name}-sanitized.json`);
    writeFileSync(path, result.stdout);
    return path;
  });
  const out = join(parent, "preview");
  const inputs = [...sanitized, ...(mixed ? [priced, "tests/fixtures/usage-cost/codex-account-synthetic.json"] : [])];
  const result = spawnSync(process.execPath, [...args, "--out", out, ...inputs], { encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
  const js = readFileSync(join(out, "preview.js"), "utf8");
  for (const exact of ["900719925474099312345678901234", "0.00000000000000000001234567890123456789", "1790244000000000001", "1790244000000000100", "1790244000000000004", "1790244000000000108"]) expect(js).toContain(exact);
  for (const privateText of [...digests, "SYNTHETIC-PRIVATE", "PRIVATE_SYNTHETIC_SCOPE"]) expect(js).not.toContain(privateText);
  expect(js).toContain("Native Claude metrics");
  expect(readFileSync(join(out, "index.html"), "utf8")).toContain("connect-src 'none'");
  const repeated = spawnSync(process.execPath, [...args, "--out", out, ...inputs], { encoding: "utf8" });
  expect(repeated.status).toBe(1);
  expect(readFileSync(join(out, "preview.js"), "utf8")).toBe(js);
});

test("invalid native input fails before creating a partial mixed preview", () => {
  const parent = mkdtempSync(join(tmpdir(), "private-card-native-invalid-"));
  const native = join(parent, "PRIVATE_FILENAME.json");
  writeFileSync(native, JSON.stringify({ format: "claude-code-native-metrics-v1", secret: "PRIVATE_CONTENT" }));
  const out = join(parent, "preview");
  const result = spawnSync(process.execPath, [...args, "--out", out, priced, native], { encoding: "utf8" });
  expect(result.status).toBe(1);
  expect(existsSync(out)).toBe(false);
  expect(result.stderr).not.toContain("PRIVATE_");
});

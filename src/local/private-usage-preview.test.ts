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

test("reports unsupported native evidence without writing a partial aligned preview", () => {
  const parent = mkdtempSync(join(tmpdir(), "private-card-native-"));
  const native = join(parent, "native.json");
  writeFileSync(native, JSON.stringify({ format: "claude-code-native-metrics-v1", sample: "synthetic", capturedAt: "2026-09-24T00:00:00.000Z", keyScopeDigest: "c".repeat(64),
    points: [{ streamDigest: "a".repeat(64), familyDigest: "b".repeat(64), metric: "input", model: null, sourceVersion: "2.1.274", temporality: "delta", startUnixNano: "1000000000000000001", endUnixNano: "1000000000000000002", quantity: "5" }] }));
  const out = join(parent, "preview");
  const result = spawnSync(process.execPath, [...args, "--out", out, priced, native], { encoding: "utf8" });
  expect(result.status).toBe(1);
  expect(existsSync(out)).toBe(false);
  expect(result.stderr.trim()).toBe("Native single-metric evidence is not supported by this private card preview. Use the native metrics report.");
});

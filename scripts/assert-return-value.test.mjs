import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const SKIP_DIRS = new Set([".git", ".next", "node_modules", "convex/_generated", "release-tools", "coverage", "dist"]);
const TEST_FILE = /\.(?:test|spec)\./;
const VACUOUS = ".not" + ".toThrow(";

export function vacuousThrowViolations(files) {
  const violations = [];
  for (const file of files) {
    if (!TEST_FILE.test(file.name)) continue;
    const match = file.source.indexOf(VACUOUS);
    if (match < 0) continue;
    const line = file.source.slice(0, match).split("\n").length;
    violations.push(
      `${file.name}:${line} uses not.toThrow(). Assert the value the function returns; a function that returns nothing still passes not.toThrow().`,
    );
  }
  return violations;
}

function scan(root) {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const rel = relative(root, path);
      if ([...SKIP_DIRS].some((skip) => rel === skip || rel.startsWith(`${skip}/`))) continue;
      const stat = statSync(path);
      if (stat.isDirectory()) {
        walk(path);
        continue;
      }
      if (!TEST_FILE.test(name)) continue;
      files.push({ name: rel, source: readFileSync(path, "utf8") });
    }
  };
  walk(root);
  return files;
}

test("not.toThrow on a successful parse is the exact-json and collector-receipt mistake", () => {
  const past = [
    "expect(() => parseExactJson(text, { maxStringLength: 256_000 }))",
    VACUOUS,
    ");",
  ].join("");
  const violations = vacuousThrowViolations([{ name: "src/domain/exact-json.test.ts", source: past }]);
  assert.equal(violations.length, 1);
  assert.match(violations[0], /exact-json\.test\.ts/);
  assert.match(violations[0], /returns nothing/);
});

test("no test treats not.toThrow as success", () => {
  assert.deepEqual(vacuousThrowViolations(scan(process.cwd())), []);
});

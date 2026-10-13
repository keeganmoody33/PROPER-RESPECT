import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const OWNER = "src/domain/convex-auth-token.ts";
const SKIP_DIRS = new Set([".git", ".next", "node_modules", "convex/_generated", "release-tools", "coverage", "dist"]);
const SOURCE = /\.(?:[cm]?[jt]sx?)$/;
const TEST_FILE = /\.(?:test|spec)\./;
const COPIED = /aud\s*===\s*["']convex["']|template\s*:\s*["']convex["']/;

export function convexTokenViolations(files) {
  const violations = [];
  for (const file of files) {
    if (file.name === OWNER || TEST_FILE.test(file.name)) continue;
    const match = file.source.match(COPIED);
    if (!match) continue;
    const line = file.source.slice(0, match.index).split("\n").length;
    violations.push(
      `${file.name}:${line} selects a Convex token itself. Call convexAuthToken from src/domain/convex-auth-token.ts.`,
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
      if (!SOURCE.test(name) || TEST_FILE.test(name)) continue;
      files.push({ name: rel, source: readFileSync(path, "utf8") });
    }
  };
  walk(root);
  return files;
}

test("a second route that copies the Convex audience branch is the mailbox and GitHub mistake", () => {
  const past = [
    "const convexToken = sessionClaims?.aud === \"convex\"",
    " ? await getToken() : await getToken({ template: \"convex\" });",
  ].join("\n");
  const violations = convexTokenViolations([{ name: "app/api/connect/github/route.ts", source: past }]);
  assert.equal(violations.length, 1);
  assert.match(violations[0], /convexAuthToken/);
  assert.match(violations[0], /src\/domain\/convex-auth-token\.ts/);
  assert.equal(convexTokenViolations([{ name: OWNER, source: past }]).length, 0);
});

test("production source has one Convex token selection", () => {
  assert.deepEqual(convexTokenViolations(scan(process.cwd())), []);
});

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const OWNER = "src/domain/http-url.mjs";
const SKIP_DIRS = new Set([".git", ".next", "node_modules", "convex/_generated", "release-tools", "coverage", "dist"]);
const SOURCE = /\.(?:[cm]?[jt]sx?)$/;
const TEST_FILE = /\.(?:test|spec)\./;

export function protocolViolations(files) {
  const violations = [];
  for (const file of files) {
    if (file.name === OWNER || TEST_FILE.test(file.name)) continue;
    const match = file.source.match(/\.protocol\b/);
    if (!match) continue;
    const line = file.source.slice(0, match.index).split("\n").length;
    violations.push(
      `${file.name}:${line} reads URL.protocol. Use isHttpUrl, isHttpsUrl, allowsWebProtocol, or allowsHttpsProtocol from src/domain/http-url.ts (implemented in ${OWNER}).`,
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

test("a copied scheme check is the #106 and #107 mistake", () => {
  // The inline refine from src/domain/usage-links.ts and src/domain/inventory.ts
  // before this pass, and the same shape profile-links.ts grew for #106 while
  // artifact links (#107) still needed another copy.
  const past = [
    "return url",
    ".protocol === \"https:\" && !url.username && !url.password;",
  ].join("");
  const violations = protocolViolations([
    { name: "src/domain/usage-links.ts", source: past },
    { name: "src/domain/inventory.ts", source: past },
  ]);
  assert.equal(violations.length, 2);
  assert.match(violations[0], /src\/domain\/http-url\.ts/);
  assert.match(violations[0], /isHttpsUrl/);
  assert.equal(protocolViolations([{ name: OWNER, source: past }]).length, 0);
});

test("production source has one URL scheme owner", () => {
  const violations = protocolViolations(scan(process.cwd()));
  assert.deepEqual(violations, []);
});

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, it } from "vitest";
import { canonicalJson } from "./canonical-json";
import { sha256 } from "./product-knowledge";
import { e2eReferenceProfile } from "../data/e2e-reference-profile";

// The release runbook's hash script must match what the migration checks
// (convex/publicationMigration.ts: sha256(canonicalJson({ ...profile, handle: from }))).
const directory = mkdtempSync(join(tmpdir(), "migration-hash-"));
afterAll(() => rmSync(directory, { recursive: true, force: true }));
const run = (value: unknown, ...args: string[]) => {
  const file = join(directory, `${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(file, JSON.stringify(value));
  return spawnSync(process.execPath, ["--no-warnings", "--experimental-strip-types", "scripts/migration-profile-hash.mjs", file, ...args], { encoding: "utf8" });
};

it.each([
  ["a stored row", (profile: typeof e2eReferenceProfile) => ({ _id: "row", handle: "lecturesfrom", revision: 4, profile })],
  ["a bare profile", (profile: typeof e2eReferenceProfile) => profile],
])("hashes %s exactly as the migration does", async (_label, wrap) => {
  const profile = { ...e2eReferenceProfile, handle: "lecturesfrom" };
  const result = run(wrap(profile));
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout.trim()).toBe(await sha256(canonicalJson({ ...profile, handle: "keegan" })));
});

it("refuses a file without a profile", () => {
  const result = run({ unrelated: true });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("publishedProfiles row");
});

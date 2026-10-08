import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, expect, it } from "vitest";
import { ensureCollectorFixtureSources } from "./collector-fixture.ts";

const cleanup: string[] = [];
afterEach(async () => { for (const directory of cleanup.splice(0).reverse()) await rm(directory, { recursive: true, force: true }); });

async function workspace() {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "collector-sources-")));
  cleanup.push(directory);
  const sourceDirectory = join(directory, "synthetic-sources");
  return { sourceDirectory, repository: resolve(".") };
}

it("recovers independently after a partial first start that left only the source directory", async () => {
  const { sourceDirectory, repository } = await workspace();
  await mkdir(sourceDirectory, { mode: 0o700 });
  await ensureCollectorFixtureSources({ sourceDirectory, repository });
  expect(await readFile(join(sourceDirectory, "codex/sessions/2026/10/02/rollout-fixture-modern.jsonl"), "utf8")).toContain("token_usage_record");
  expect(await readFile(join(sourceDirectory, "cursor.csv"), "utf8")).toContain("SYNTHETIC_PRIVATE_MODEL");
});

it("finishes a missing Cursor copy without replacing an existing Codex tree, and the reverse", async () => {
  const { sourceDirectory, repository } = await workspace();
  await mkdir(join(sourceDirectory, "codex/sessions/2026/10/02"), { recursive: true, mode: 0o700 });
  await writeFile(join(sourceDirectory, "codex/sessions/2026/10/02/rollout-fixture-modern.jsonl"), "SYNTHETIC_EXISTING_CODEX\n", { mode: 0o600 });
  await ensureCollectorFixtureSources({ sourceDirectory, repository });
  expect(await readFile(join(sourceDirectory, "codex/sessions/2026/10/02/rollout-fixture-modern.jsonl"), "utf8")).toBe("SYNTHETIC_EXISTING_CODEX\n");
  expect(await readFile(join(sourceDirectory, "cursor.csv"), "utf8")).toContain("0.0125");

  const second = await workspace();
  await mkdir(second.sourceDirectory, { mode: 0o700 });
  await writeFile(join(second.sourceDirectory, "cursor.csv"), "SYNTHETIC_EXISTING_CURSOR\n", { mode: 0o600 });
  await ensureCollectorFixtureSources({ sourceDirectory: second.sourceDirectory, repository });
  expect(await readFile(join(second.sourceDirectory, "cursor.csv"), "utf8")).toBe("SYNTHETIC_EXISTING_CURSOR\n");
  expect(await readFile(join(second.sourceDirectory, "codex/sessions/2026/10/02/rollout-fixture-modern.jsonl"), "utf8")).toContain("token_usage_record");
});

it("recovers missing Codex files after the modern marker was copied without replacing existing updates", async () => {
  const { sourceDirectory, repository } = await workspace();
  const modern = join(sourceDirectory, "codex/sessions/2026/10/02/rollout-fixture-modern.jsonl");
  await mkdir(join(sourceDirectory, "codex/sessions/2026/10/02"), { recursive: true, mode: 0o700 });
  await writeFile(modern, "SYNTHETIC_EXISTING_CODEX_UPDATE\n", { mode: 0o600 });
  await ensureCollectorFixtureSources({ sourceDirectory, repository });
  expect(await readFile(modern, "utf8")).toBe("SYNTHETIC_EXISTING_CODEX_UPDATE\n");
  expect(await readFile(join(sourceDirectory, "codex/sessions/2026/10/02/rollout-fixture-legacy.jsonl"), "utf8")).toContain("token_count");
  expect(await readFile(join(sourceDirectory, "codex/archived_sessions/rollout-fixture-modern-copy.jsonl"), "utf8")).toContain("token_usage_record");
});

it("preserves existing Codex updates while recovering a missing modern marker", async () => {
  const { sourceDirectory, repository } = await workspace();
  const legacy = join(sourceDirectory, "codex/sessions/2026/10/02/rollout-fixture-legacy.jsonl");
  await mkdir(join(sourceDirectory, "codex/sessions/2026/10/02"), { recursive: true, mode: 0o700 });
  await writeFile(legacy, "SYNTHETIC_EXISTING_LEGACY_UPDATE\n", { mode: 0o600 });
  await ensureCollectorFixtureSources({ sourceDirectory, repository });
  expect(await readFile(legacy, "utf8")).toBe("SYNTHETIC_EXISTING_LEGACY_UPDATE\n");
  expect(await readFile(join(sourceDirectory, "codex/sessions/2026/10/02/rollout-fixture-modern.jsonl"), "utf8")).toContain("token_usage_record");
});

it("allows simultaneous bootstrap calls without replacing existing synthetic updates", async () => {
  const { sourceDirectory, repository } = await workspace();
  const modern = join(sourceDirectory, "codex/sessions/2026/10/02/rollout-fixture-modern.jsonl");
  await mkdir(join(sourceDirectory, "codex/sessions/2026/10/02"), { recursive: true, mode: 0o700 });
  await writeFile(modern, "SYNTHETIC_EXISTING_CODEX_UPDATE\n", { mode: 0o600 });
  const attempts = await Promise.allSettled(Array.from({ length: 16 }, () => ensureCollectorFixtureSources({ sourceDirectory, repository })));
  expect(attempts.filter(attempt => attempt.status === "rejected")).toEqual([]);
  expect(await readFile(modern, "utf8")).toBe("SYNTHETIC_EXISTING_CODEX_UPDATE\n");
  expect(await readFile(join(sourceDirectory, "codex/archived_sessions/rollout-fixture-modern-copy.jsonl"), "utf8")).toContain("token_usage_record");
});

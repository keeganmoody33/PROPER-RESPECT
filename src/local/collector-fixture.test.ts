import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { ensureCollectorFixtureSources } from "./collector-fixture.ts";

const copyControl = vi.hoisted(() => ({
  next: null as null | ((source: string, destination: string) => Promise<void>),
  cursor: null as null | ((destination: string, data: unknown) => Promise<void>),
}));
vi.mock("node:fs/promises", async importOriginal => {
  const original = await importOriginal<typeof import("node:fs/promises")>();
  return { ...original, copyFile: async (...args: Parameters<typeof original.copyFile>) => {
    const next = copyControl.next;
    if (next) { copyControl.next = null; return next(String(args[0]), String(args[1])); }
    return original.copyFile(...args);
  }, writeFile: async (...args: Parameters<typeof original.writeFile>) => {
    const next = copyControl.cursor;
    if (next && (String(args[0]).includes("/.bootstrap-staging/cursor-") || String(args[0]).endsWith("/cursor.csv"))) {
      copyControl.cursor = null; return next(String(args[0]), args[1]);
    }
    return original.writeFile(...args);
  } };
});
const cleanup: string[] = [];
afterEach(async () => { for (const directory of cleanup.splice(0).reverse()) await rm(directory, { recursive: true, force: true }); });

async function changedCodex(repository: string, name: "modern" | "legacy" = "modern") {
  return await readFile(join(repository, `tests/fixtures/codex-rollouts/sessions/2026/10/02/rollout-fixture-${name}.jsonl`), "utf8") + '{"type":"synthetic_fixture_update"}\n';
}

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
  const updated = await changedCodex(repository);
  await writeFile(join(sourceDirectory, "codex/sessions/2026/10/02/rollout-fixture-modern.jsonl"), updated, { mode: 0o600 });
  await ensureCollectorFixtureSources({ sourceDirectory, repository });
  expect(await readFile(join(sourceDirectory, "codex/sessions/2026/10/02/rollout-fixture-modern.jsonl"), "utf8")).toBe(updated);
  expect(await readFile(join(sourceDirectory, "cursor.csv"), "utf8")).toContain("0.0125");

  const second = await workspace();
  await mkdir(second.sourceDirectory, { mode: 0o700 });
  const changedCursor = "timestamp,total_tokens\n2026-10-02T12:00:00.000Z,333\n";
  await writeFile(join(second.sourceDirectory, "cursor.csv"), changedCursor, { mode: 0o600 });
  await ensureCollectorFixtureSources({ sourceDirectory: second.sourceDirectory, repository });
  expect(await readFile(join(second.sourceDirectory, "cursor.csv"), "utf8")).toBe(changedCursor);
  expect(await readFile(join(second.sourceDirectory, "codex/sessions/2026/10/02/rollout-fixture-modern.jsonl"), "utf8")).toContain("token_usage_record");
});

it("recovers missing Codex files after the modern marker was copied without replacing existing updates", async () => {
  const { sourceDirectory, repository } = await workspace();
  const modern = join(sourceDirectory, "codex/sessions/2026/10/02/rollout-fixture-modern.jsonl");
  await mkdir(join(sourceDirectory, "codex/sessions/2026/10/02"), { recursive: true, mode: 0o700 });
  const updated = await changedCodex(repository);
  await writeFile(modern, updated, { mode: 0o600 });
  await ensureCollectorFixtureSources({ sourceDirectory, repository });
  expect(await readFile(modern, "utf8")).toBe(updated);
  expect(await readFile(join(sourceDirectory, "codex/sessions/2026/10/02/rollout-fixture-legacy.jsonl"), "utf8")).toContain("token_count");
  expect(await readFile(join(sourceDirectory, "codex/archived_sessions/rollout-fixture-modern-copy.jsonl"), "utf8")).toContain("token_usage_record");
});

it("preserves existing Codex updates while recovering a missing modern marker", async () => {
  const { sourceDirectory, repository } = await workspace();
  const legacy = join(sourceDirectory, "codex/sessions/2026/10/02/rollout-fixture-legacy.jsonl");
  await mkdir(join(sourceDirectory, "codex/sessions/2026/10/02"), { recursive: true, mode: 0o700 });
  const updated = await changedCodex(repository, "legacy");
  await writeFile(legacy, updated, { mode: 0o600 });
  await ensureCollectorFixtureSources({ sourceDirectory, repository });
  expect(await readFile(legacy, "utf8")).toBe(updated);
  expect(await readFile(join(sourceDirectory, "codex/sessions/2026/10/02/rollout-fixture-modern.jsonl"), "utf8")).toContain("token_usage_record");
});

it("allows simultaneous bootstrap calls without replacing existing synthetic updates", async () => {
  const { sourceDirectory, repository } = await workspace();
  const modern = join(sourceDirectory, "codex/sessions/2026/10/02/rollout-fixture-modern.jsonl");
  await mkdir(join(sourceDirectory, "codex/sessions/2026/10/02"), { recursive: true, mode: 0o700 });
  const updated = await changedCodex(repository);
  await writeFile(modern, updated, { mode: 0o600 });
  const attempts = await Promise.allSettled(Array.from({ length: 16 }, () => ensureCollectorFixtureSources({ sourceDirectory, repository })));
  expect(attempts.filter(attempt => attempt.status === "rejected")).toEqual([]);
  expect(await readFile(modern, "utf8")).toBe(updated);
  expect(await readFile(join(sourceDirectory, "codex/archived_sessions/rollout-fixture-modern-copy.jsonl"), "utf8")).toContain("token_usage_record");
});

it("never reports ready with another initializer's unfinished file", async () => {
  const { sourceDirectory, repository } = await workspace();
  let release = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  let created = () => {};
  const started = new Promise<void>(resolve => { created = resolve; });
  copyControl.next = async (source, destination) => {
    const complete = await readFile(source);
    await writeFile(destination, complete.subarray(0, 17), { flag: "wx", mode: 0o600 });
    created();
    await held;
    await writeFile(destination, complete);
  };
  const first = ensureCollectorFixtureSources({ sourceDirectory, repository });
  let second: Promise<void> | undefined;
  let secondFinished = false;
  try {
    await started;
    second = ensureCollectorFixtureSources({ sourceDirectory, repository }).then(() => { secondFinished = true; });
    await new Promise(resolve => setTimeout(resolve, 25));
    expect(secondFinished).toBe(false);
  } finally { release(); await first; await second; }
  expect(await readFile(join(sourceDirectory, "codex/sessions/2026/10/02/rollout-fixture-modern.jsonl"))).toEqual(await readFile(join(repository, "tests/fixtures/codex-rollouts/sessions/2026/10/02/rollout-fixture-modern.jsonl")));
});

it("recovers after a copy is interrupted with a regular partial file", async () => {
  const { sourceDirectory, repository } = await workspace();
  copyControl.next = async (source, destination) => {
    const complete = await readFile(source);
    await writeFile(destination, complete.subarray(0, 17), { flag: "wx", mode: 0o600 });
    throw new Error("Synthetic interrupted copy");
  };
  await expect(ensureCollectorFixtureSources({ sourceDirectory, repository })).rejects.toThrow("Synthetic interrupted copy");
  await ensureCollectorFixtureSources({ sourceDirectory, repository });
  expect(await readFile(join(sourceDirectory, "codex/sessions/2026/10/02/rollout-fixture-modern.jsonl")))
    .toEqual(await readFile(join(repository, "tests/fixtures/codex-rollouts/sessions/2026/10/02/rollout-fixture-modern.jsonl")));
});

it("keeps Cursor initialization pending until its staged write is complete", async () => {
  const { sourceDirectory, repository } = await workspace();
  let release = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  let created = () => {};
  const started = new Promise<void>(resolve => { created = resolve; });
  let complete: Buffer | undefined;
  copyControl.cursor = async (destination, data) => {
    complete = Buffer.from(data as Uint8Array);
    await writeFile(destination, complete.subarray(0, 17), { flag: "wx", mode: 0o600 });
    created(); await held; await writeFile(destination, complete);
  };
  const first = ensureCollectorFixtureSources({ sourceDirectory, repository });
  let second: Promise<void> | undefined, secondFinished = false;
  try {
    await started;
    second = ensureCollectorFixtureSources({ sourceDirectory, repository }).then(() => { secondFinished = true; });
    await new Promise(resolve => setTimeout(resolve, 25));
    expect(secondFinished).toBe(false);
    await expect(readFile(join(sourceDirectory, "cursor.csv"))).rejects.toMatchObject({ code: "ENOENT" });
  } finally { release(); await first; await second; }
  expect(await readFile(join(sourceDirectory, "cursor.csv"))).toEqual(complete);
});

it.each(["modern", "cursor"])("repairs an old empty or template-prefix %s file without accepting partial history", async kind => {
  const { sourceDirectory, repository } = await workspace();
  await ensureCollectorFixtureSources({ sourceDirectory, repository });
  const target = kind === "modern" ? join(sourceDirectory, "codex/sessions/2026/10/02/rollout-fixture-modern.jsonl") : join(sourceDirectory, "cursor.csv");
  const complete = await readFile(target);
  for (const length of [0, 17]) {
    await writeFile(target, complete.subarray(0, length));
    await ensureCollectorFixtureSources({ sourceDirectory, repository });
    expect(await readFile(target)).toEqual(complete);
  }
  await writeFile(target, "SYNTHETIC_CORRUPTION\n");
  await expect(ensureCollectorFixtureSources({ sourceDirectory, repository })).rejects.toThrow("incomplete or invalid");
  expect(await readFile(target, "utf8")).toBe("SYNTHETIC_CORRUPTION\n");
});

it("recovers the transaction lock and abandoned regular staging after a process is killed", async () => {
  const { sourceDirectory, repository } = await workspace();
  const script = `
    import { mkdir, writeFile } from "node:fs/promises";
    import { pathToFileURL } from "node:url";
    import { join } from "node:path";
    const [source, repository] = process.argv.slice(1);
    const { openCollectorPrivateStore } = await import(pathToFileURL(join(repository, "src/local/collector-private-store.ts")));
    await mkdir(source, { recursive: true, mode: 0o700 });
    const db = openCollectorPrivateStore({ databasePath: join(source, "bootstrap.sqlite") });
    db.exec("BEGIN IMMEDIATE");
    await mkdir(join(source, ".bootstrap-staging"), { mode: 0o700 });
    await writeFile(join(source, ".bootstrap-staging/codex-00000000000000000000000000000000"), "SYNTHETIC_PARTIAL", { mode: 0o600 });
    process.stdout.write("staged\\n");
    setInterval(() => {}, 1000);
  `;
  const child = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--input-type=module", "-e", script, sourceDirectory, repository], { stdio: ["ignore", "pipe", "pipe"] });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Synthetic staging worker did not start.")), 5000);
      child.once("error", error => { clearTimeout(timer); reject(error); });
      child.once("exit", () => { clearTimeout(timer); reject(new Error("Synthetic staging worker exited early.")); });
      child.stdout.once("data", () => { clearTimeout(timer); resolve(); });
    });
    const stopped = new Promise<void>(resolve => { child.once("exit", () => resolve()); });
    child.kill("SIGKILL"); await stopped;
    await ensureCollectorFixtureSources({ sourceDirectory, repository });
    expect(await readdir(join(sourceDirectory, ".bootstrap-staging"))).toEqual([]);
    expect(await readFile(join(sourceDirectory, "codex/sessions/2026/10/02/rollout-fixture-modern.jsonl")))
      .toEqual(await readFile(join(repository, "tests/fixtures/codex-rollouts/sessions/2026/10/02/rollout-fixture-modern.jsonl")));
  } finally { if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL"); }
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdtemp, realpath, mkdir, writeFile, rm, symlink, link, rename, appendFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { readCodexRolloutDirectoryNative } from "./codex-rollout-native.ts";
import { collectCodexRolloutHistory } from "./codex-history-collector.ts";

const failure = "Codex rollout directory could not be read safely.";
const supported = process.platform === "linux" || process.platform === "darwin";
let temporary = "", executable = "", raceExecutable = "";
let counter = 0;
async function fixture() {
  const path = join(temporary, `source-${counter++}`);
  await mkdir(path);
  return path;
}
const read = (directory: string, signal = new AbortController().signal) => readCodexRolloutDirectoryNative({ directory, executablePath: executable, signal });
function request(directory: string) {
  const path = Buffer.from(directory);
  const header = Buffer.alloc(12);
  header.write("PRREQ001"); header.writeUInt32BE(path.length, 8);
  return Buffer.concat([header, path]);
}

describe.skipIf(!supported)("native descriptor-relative synthetic Codex acquisition", () => {
  beforeAll(async () => {
    temporary = await realpath(await mkdtemp(join(tmpdir(), "proper-native-synthetic-")));
    executable = join(temporary, "reader"); raceExecutable = join(temporary, "race-reader");
    execFileSync(process.execPath, [resolve("scripts/build-codex-rollout-reader.mjs"), "--output", executable], { stdio: "pipe" });
    execFileSync("cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-DPR_READER_TEST_HOOKS", resolve("native/codex-rollout-reader.c"), "-o", raceExecutable], { stdio: "pipe" });
  });
  afterAll(async () => { if (temporary) await rm(temporary, { recursive: true, force: true }); });

  it("reads only selected rollout files with no paths in the returned data", async () => {
    const root = await fixture(); await mkdir(join(root, "sessions"));
    await writeFile(join(root, "sessions", "rollout-one.jsonl"), '{"number":1}\r\n');
    await writeFile(join(root, "ignored.jsonl"), "UNSELECTED_SECRET");
    expect(await read(root)).toEqual({ files: [{ lines: ['{"number":1}'] }], scannedFiles: 1, ignoredEntries: 1 });
  });
  it("feeds the existing real-format numeric parser without changing replay or coverage semantics", async () => {
    const signal = new AbortController().signal;
    const scanned = await read(await realpath(resolve("tests/fixtures/codex-rollouts")), signal);
    const review = collectCodexRolloutHistory({ window: { start: "2026-10-01T00:00:00.000Z", end: "2026-10-08T00:00:00.000Z" }, signal }, scanned.files);
    expect(review.responses.totals.find(row => row.metric === "total_tokens")?.value).toBe("30");
    expect(review.legacy.totals.find(row => row.metric === "total_tokens")?.value).toBe("20");
    expect(review.responses.rows).toHaveLength(1); expect(review.responses.replays).toBe(1);
    expect(review.source.accountAlias).toBeNull(); expect(review.coverage).toBe("partial");
    expect(JSON.stringify(review)).not.toMatch(/PRIVATE_|\/workspace|rollout-fixture/);
  });
  it.each(["relative", "/tmp/../tmp", "/tmp/./private", "/SECRET\0PATH"])("rejects invalid selection without disclosing %j", async directory => {
    await expect(read(directory)).rejects.toThrow(failure);
  });
  it.each(["root", "ancestor", "file", "directory"])("rejects %s symlinks", async kind => {
    const root = await fixture(), outside = await fixture();
    await writeFile(join(outside, "rollout-secret.jsonl"), "OUTSIDE_SECRET\n");
    if (kind === "root") { await symlink(outside, join(root, "selected")); await expect(read(join(root, "selected"))).rejects.toThrow(failure); }
    else if (kind === "ancestor") { await symlink(outside, join(root, "parent")); await mkdir(join(outside, "selected")); await expect(read(join(root, "parent", "selected"))).rejects.toThrow(failure); }
    else { await symlink(kind === "file" ? join(outside, "rollout-secret.jsonl") : outside, join(root, kind === "file" ? "rollout-one.jsonl" : "child")); await expect(read(root)).rejects.toThrow(failure); }
  });
  it("rejects hardlinks and special files without blocking", async () => {
    const root = await fixture(), outside = await fixture();
    await writeFile(join(outside, "source"), "SECRET\n"); await link(join(outside, "source"), join(root, "rollout-one.jsonl"));
    await expect(read(root)).rejects.toThrow(failure);
    await rm(join(root, "rollout-one.jsonl")); execFileSync("mkfifo", [join(root, "rollout-one.jsonl")]);
    await expect(read(root)).rejects.toThrow(failure);
  });
  it.each([Buffer.from("SECRET"), Buffer.from([0xff, 10])])("rejects incomplete final lines and invalid UTF-8 atomically", async content => {
    const root = await fixture(); await writeFile(join(root, "rollout-one.jsonl"), content);
    await expect(read(root)).rejects.toThrow(failure);
  });
  it("accepts empty files and directories", async () => {
    const root = await fixture(); expect(await read(root)).toEqual({ files: [], scannedFiles: 0, ignoredEntries: 0 });
    await writeFile(join(root, "rollout-empty.jsonl"), ""); expect((await read(root)).files).toEqual([{ lines: [] }]);
  });
  it("enforces exact file and traversal limits", async () => {
    const root = await fixture();
    for (let i = 0; i < 64; i++) await writeFile(join(root, `rollout-${i}.jsonl`), "{}\n");
    expect((await read(root)).scannedFiles).toBe(64);
    await writeFile(join(root, "rollout-over.jsonl"), "{}\n"); await expect(read(root)).rejects.toThrow(failure);
    const deep = await fixture(); let selected = deep;
    for (let i = 0; i < 5; i++) { selected = join(selected, "child"); await mkdir(selected); }
    expect((await read(deep)).scannedFiles).toBe(0);
    await mkdir(join(selected, "child")); await expect(read(deep)).rejects.toThrow(failure);
  });
  it("enforces entry, line, per-file and total byte limits", async () => {
    const root = await fixture();
    for (let i = 0; i < 1000; i++) await writeFile(join(root, `ignored-${i}`), "");
    expect((await read(root)).ignoredEntries).toBe(1000);
    await writeFile(join(root, "one-too-many"), ""); await expect(read(root)).rejects.toThrow(failure);
    const lines = await fixture(); await writeFile(join(lines, "rollout-lines.jsonl"), "\n".repeat(100_000));
    expect((await read(lines)).files[0].lines).toHaveLength(100_000);
    await appendFile(join(lines, "rollout-lines.jsonl"), "\n"); await expect(read(lines)).rejects.toThrow(failure);
    const large = await fixture(); await writeFile(join(large, "rollout-large.jsonl"), "x".repeat(256 * 1024) + "\n");
    expect((await read(large)).scannedFiles).toBe(1);
    await appendFile(join(large, "rollout-large.jsonl"), "x".repeat(256 * 1024 + 1) + "\n"); await expect(read(large)).rejects.toThrow(failure);
    const bytes = await fixture(); const exact = ("x".repeat(65535) + "\n").repeat(64);
    for (let i = 0; i < 8; i++) await writeFile(join(bytes, `rollout-${i}.jsonl`), exact);
    expect((await read(bytes)).scannedFiles).toBe(8);
    await writeFile(join(bytes, "rollout-over.jsonl"), "{}\n"); await expect(read(bytes)).rejects.toThrow(failure);
    await rm(join(bytes, "rollout-over.jsonl")); await appendFile(join(bytes, "rollout-0.jsonl"), "\n"); await expect(read(bytes)).rejects.toThrow(failure);
  }, 20_000);
  it("rejects before spawning when cancelled and hides cancellation reasons", async () => {
    const controller = new AbortController(); controller.abort("SECRET_REASON");
    await expect(read("/NEVER_OPEN", controller.signal)).rejects.toThrow("Codex rollout read cancelled.");
  });
  it.each(["magic", "length", "nul", "utf8", "trailing"])("native boundary rejects malformed stdin %s before acquisition", kind => {
    let input = request("/UNAUTHORIZED_SECRET_SOURCE");
    if (kind === "magic") input[0] = 0;
    if (kind === "length") input.writeUInt32BE(4097, 8);
    if (kind === "nul") input[12] = 0;
    if (kind === "utf8") input[12] = 0xff;
    if (kind === "trailing") input = Buffer.concat([input, Buffer.from("TRAILING_SECRET")]);
    const result = spawnSync(executable, [], { input, env: { NODE_ENV: "test" }, timeout: 1000 });
    expect(result.status).toBe(1); expect(result.stdout).toHaveLength(0);
    expect(result.stderr.toString()).toBe("Codex rollout acquisition failed.\n");
  });
  it("never reads through an ancestor renamed to a symlink", async () => {
    const root = await fixture(), selected = join(root, "selected"), outside = await fixture();
    await mkdir(selected); await writeFile(join(selected, "rollout-one.jsonl"), "ORIGINAL\n"); await writeFile(join(outside, "rollout-one.jsonl"), "OUTSIDE_SECRET\n");
    const result = await raceRead(selected, "D", async () => { await rename(selected, join(root, "original")); await symlink(outside, selected); });
    expect(result.code).toBe(1); expect(result.stdout).toHaveLength(0); expect(result.stderr).not.toContain("OUTSIDE_SECRET");
  });
  it.each(["replace", "mutate"])("rejects file %s at the actual read boundary", async kind => {
    const root = await fixture(), path = join(root, "rollout-one.jsonl"); await writeFile(path, "ORIGINAL\n");
    const result = await raceRead(root, kind === "replace" ? "S" : "F", async () => {
      if (kind === "replace") { await rename(path, join(root, "old")); await writeFile(path, "REPLACEMENT_SECRET\n"); }
      else await appendFile(path, "MUTATION_SECRET\n");
    });
    expect(result.code).toBe(1); expect(result.stdout).toHaveLength(0); expect(result.stderr).toBe("Codex rollout acquisition failed.\n");
  });
  it.each(["magic", "high-bit-magic", "count", "truncated", "trailing", "utf8", "stderr"])("rejects malformed or contaminated private IPC %s", async kind => {
    const header = Buffer.alloc(16); header.write("PRRES001");
    let output = header, errors = Buffer.alloc(0);
    if (kind === "magic") output = Buffer.from("SOURCE_SECRET");
    if (kind === "high-bit-magic") for (let i = 0; i < 8; i++) header[i] |= 0x80;
    if (kind === "count") header.writeUInt32BE(65, 8);
    if (kind === "truncated") header.writeUInt32BE(1, 8);
    if (kind === "trailing") output = Buffer.concat([header, Buffer.from("PRIVATE_TRAILING_SECRET")]);
    if (kind === "utf8") { header.writeUInt32BE(1, 8); const size = Buffer.alloc(4); size.writeUInt32BE(2); output = Buffer.concat([header, size, Buffer.from([0xff, 10])]); }
    if (kind === "stderr") errors = Buffer.from("PRIVATE_ERROR_SECRET");
    const binary = await fakeReader(output, errors);
    await expect(readCodexRolloutDirectoryNative({ directory: await fixture(), executablePath: binary, signal: new AbortController().signal })).rejects.toThrow(failure);
  });
  it("cancels a running reader, confirms child termination and emits only a fixed error", async () => {
    const pidPath = join(temporary, "cancel-pid");
    const binary = await fakeReader(Buffer.alloc(0), Buffer.alloc(0), pidPath);
    const controller = new AbortController();
    const pending = readCodexRolloutDirectoryNative({ directory: await fixture(), executablePath: binary, signal: controller.signal });
    const rejected = expect(pending).rejects.toThrow("Codex rollout read cancelled.");
    let pid = 0;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { pid = Number(await readFile(pidPath, "utf8")); break; } catch { await new Promise(resolveWait => setTimeout(resolveWait, 10)); }
    }
    expect(pid).toBeGreaterThan(0); controller.abort("PRIVATE_REASON"); await rejected;
    expect(() => process.kill(pid, 0)).toThrow();
  });
  it("rejects a stalled reader within its deadline and kills a child that ignores TERM", async () => {
    const pidPath = join(temporary, "deadline-pid");
    const binary = await fakeReader(Buffer.alloc(0), Buffer.alloc(0), pidPath);
    const started = performance.now();
    await expect(readCodexRolloutDirectoryNative({ directory: await fixture(), executablePath: binary, signal: new AbortController().signal })).rejects.toThrow(failure);
    expect(performance.now() - started).toBeLessThan(6500);
    const pid = Number(await readFile(pidPath, "utf8")); expect(() => process.kill(pid, 0)).toThrow();
  }, 10_000);
  it("never overwrites an existing build artifact", async () => {
    const output = join(temporary, "existing-artifact"); await writeFile(output, "OWNER_FILE");
    expect(() => execFileSync(process.execPath, [resolve("scripts/build-codex-rollout-reader.mjs"), "--output", output], { stdio: "pipe" })).toThrow();
    expect(await readFile(output, "utf8")).toBe("OWNER_FILE");
  });
});

async function fakeReader(stdout: Buffer, stderr: Buffer, pidPath?: string) {
  const source = join(temporary, `fake-${counter++}.c`), binary = source.slice(0, -2);
  const bytes = (value: Buffer) => value.length ? [...value].join(",") : "0";
  const hang = pidPath ? `signal(SIGTERM, SIG_IGN); FILE *f = fopen(${JSON.stringify(pidPath)}, "w"); if (!f) return 1; fprintf(f, "%ld", (long)getpid()); fclose(f); for (;;) pause();` : "";
  await writeFile(source, `#include <stdio.h>\n#include <unistd.h>\n#include <signal.h>\nint main(void) { while (getchar() != EOF) {} unsigned char out[] = {${bytes(stdout)}}; unsigned char err[] = {${bytes(stderr)}}; fwrite(out, 1, ${stdout.length}, stdout); fflush(stdout); fwrite(err, 1, ${stderr.length}, stderr); fflush(stderr); ${hang} return 0; }`);
  execFileSync("cc", ["-std=c11", source, "-o", binary], { stdio: "pipe" });
  return binary;
}

async function raceRead(directory: string, phase: string, mutate: () => Promise<void>) {
  const child = spawn(raceExecutable, [], { stdio: ["pipe", "pipe", "pipe", "pipe", "pipe"], env: { NODE_ENV: "test" } });
  const output: Buffer[] = [], errors: Buffer[] = [];
  child.stdout.on("data", chunk => output.push(chunk)); child.stderr.on("data", chunk => errors.push(chunk));
  let changed = false;
  const hook = child.stdio[3], control = child.stdio[4];
  if (!hook || !control || !("on" in hook) || !("write" in control)) throw new Error("Missing synthetic hook streams.");
  hook.on("data", async (chunk: Buffer) => {
    for (const event of chunk.toString()) {
      if (!changed && event === phase) { changed = true; await mutate(); }
      control.write("1");
    }
  });
  child.stdin.end(request(directory));
  return await new Promise<{ code: number | null; stdout: Buffer; stderr: string }>((resolveResult, reject) => {
    child.on("error", reject); child.on("close", code => resolveResult({ code, stdout: Buffer.concat(output), stderr: Buffer.concat(errors).toString() }));
  });
}

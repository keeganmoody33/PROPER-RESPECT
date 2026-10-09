import { execFileSync, spawnSync } from "node:child_process";
import { constants } from "node:fs";
import * as fs from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readCodexRolloutDirectory } from "./codex-rollout-files.ts";

vi.mock("node:fs/promises", async importOriginal => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, open: vi.fn(actual.open) };
});

const roots: string[] = [];
const failure = "Codex rollout directory could not be read safely.";
async function fixture(): Promise<string> {
  // Deliberately fixed synthetic location; never use the user's home or history.
  const root = await fs.mkdtemp("/tmp/codex-rollout-reader-test-");
  roots.push(root);
  return root;
}
function read(directory: string, signal = new AbortController().signal) {
  return readCodexRolloutDirectory({ directory, signal });
}
async function rollout(directory: string, body = "{}\n", name = "rollout-one.jsonl") {
  await fs.mkdir(directory, { recursive: true });
  const path = join(directory, name);
  await fs.writeFile(path, body);
  return path;
}
afterEach(async () => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  vi.mocked(fs.open).mockImplementation(actual.open);
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

describe.skipIf(process.platform !== "linux")("bounded synthetic Codex rollout reader", () => {
  it("reads only rollout JSONL files under the selected root and returns no paths", async () => {
    const root = await fixture();
    await rollout(join(root, "sessions", "2026", "10", "06"), '{"type":"session_meta"}\n{"type":"event_msg"}\r\n');
    await rollout(join(root, "archived_sessions"), "{}\n", "rollout-archived.jsonl");
    await fs.writeFile(join(root, "auth.json"), "PRIVATE_SECRET");
    await fs.writeFile(join(root, "history.jsonl"), "PRIVATE_CHAT");
    await fs.writeFile(join(root, "rollout-wrong.txt"), "PRIVATE_DATA");
    const result = await read(root);
    expect(result.scannedFiles).toBe(2);
    expect(result.ignoredEntries).toBe(3);
    expect(result.files.flatMap(file => file.lines).sort()).toEqual(['{"type":"event_msg"}', '{"type":"session_meta"}', "{}"].sort());
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_|\/tmp\/|rollout-|sessions/);
  });

  it("does not discover or follow history_base outside the selected directory", async () => {
    const root = await fixture();
    const outside = await fixture();
    await rollout(outside, "OUTSIDE_PRIVATE_CONTENT\n");
    const line = JSON.stringify({ history_base: outside });
    await rollout(root, `${line}\n`);
    expect(await read(root)).toEqual({ files: [{ lines: [line] }], scannedFiles: 1, ignoredEntries: 0 });
  });

  it("accepts empty directories and files", async () => {
    const root = await fixture();
    expect(await read(root)).toEqual({ files: [], scannedFiles: 0, ignoredEntries: 0 });
    await rollout(root, "");
    expect((await read(root)).files).toEqual([{ lines: [] }]);
  });

  it.each(["relative", "", "/tmp/../tmp", "/tmp/./child", "/tmp/secret\0name"])("rejects invalid selected path %j without leaking it", async directory => {
    await expect(read(directory)).rejects.toThrow(failure);
  });

  it("rejects missing paths without exposing the OS error", async () => {
    const root = await fixture();
    const error = await read(join(root, "PRIVATE_MISSING")).catch(value => value);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe(failure);
    expect(error.cause).toBeUndefined();
    expect(String(error)).not.toContain(root);
  });

  it.each(["root", "ancestor", "file", "directory"])("rejects %s symlinks into another synthetic root", async kind => {
    const root = await fixture();
    const outside = await fixture();
    await rollout(join(outside, "nested"), "OUTSIDE_PRIVATE_CONTENT\n");
    if (kind === "root" || kind === "ancestor") {
      await fs.symlink(outside, join(root, "link"));
      await expect(read(join(root, "link", ...(kind === "ancestor" ? ["nested"] : [])))).rejects.toThrow(failure);
    } else {
      await fs.symlink(kind === "file" ? join(outside, "nested", "rollout-one.jsonl") : outside, join(root, kind === "file" ? "rollout-link.jsonl" : "linked"));
      await expect(read(root)).rejects.toThrow(failure);
    }
  });

  it("rejects a FIFO without blocking", async () => {
    const root = await fixture();
    execFileSync("mkfifo", [join(root, "rollout-pipe.jsonl")]);
    await expect(read(root)).rejects.toThrow(failure);
  });

  it("rejects hardlinked rollout files", async () => {
    const root = await fixture();
    const outside = await fixture();
    const target = await rollout(outside);
    await fs.link(target, join(root, "rollout-linked.jsonl"));
    await expect(read(root)).rejects.toThrow(failure);
  });

  it("rejects an incomplete final line and invalid UTF-8", async () => {
    const root = await fixture();
    const path = await rollout(root, "{}\n{\"partial\":");
    await expect(read(root)).rejects.toThrow(failure);
    await fs.writeFile(path, Buffer.from([0xc3, 0x28, 10]));
    await expect(read(root)).rejects.toThrow(failure);
  });

  it("accepts five directory levels and rejects a sixth", async () => {
    const root = await fixture();
    const fifth = join(root, "1", "2", "3", "4", "5");
    await rollout(fifth);
    expect((await read(root)).scannedFiles).toBe(1);
    await fs.mkdir(join(fifth, "6"));
    await expect(read(root)).rejects.toThrow(failure);
  });

  it("accepts 64 files and rejects the entire result at 65", async () => {
    const root = await fixture();
    await Promise.all(Array.from({ length: 64 }, (_, index) => rollout(root, "{}\n", `rollout-${index}.jsonl`)));
    expect((await read(root)).scannedFiles).toBe(64);
    await rollout(root, "{}\n", "rollout-65.jsonl");
    await expect(read(root)).rejects.toThrow(failure);
  });

  it("accepts 1000 entries and rejects the entire result at 1001", async () => {
    const root = await fixture();
    await Promise.all(Array.from({ length: 1000 }, (_, index) => fs.writeFile(join(root, `ignored-${index}`), "")));
    expect((await read(root)).ignoredEntries).toBe(1000);
    await fs.writeFile(join(root, "ignored-overflow"), "");
    await expect(read(root)).rejects.toThrow(failure);
  });

  it("enforces the 4 MiB per-file limit before allocating file contents", async () => {
    const root = await fixture();
    const path = await rollout(root);
    await fs.truncate(path, 4 * 1024 * 1024 + 1);
    await expect(read(root)).rejects.toThrow(failure);
  });

  it("accepts 32 MiB total and rejects the entire result above it", async () => {
    const root = await fixture();
    const row = `${"x".repeat(256 * 1024 - 1)}\n`;
    await Promise.all(Array.from({ length: 8 }, (_, index) => rollout(root, row.repeat(16), `rollout-${index}.jsonl`)));
    expect((await read(root)).scannedFiles).toBe(8);
    await rollout(root, "{}\n", "rollout-overflow.jsonl");
    await expect(read(root)).rejects.toThrow(failure);
  });

  it("accepts 100000 lines and rejects the entire result at 100001", async () => {
    const root = await fixture();
    const path = await rollout(root, "{}\n".repeat(100_000));
    expect((await read(root)).files[0]?.lines).toHaveLength(100_000);
    await fs.appendFile(path, "{}\n");
    await expect(read(root)).rejects.toThrow(failure);
  });

  it("enforces the line limit in bytes rather than UTF-16 characters", async () => {
    const root = await fixture();
    const path = await rollout(root, `${"é".repeat(128 * 1024)}\n`);
    expect((await read(root)).files[0]?.lines).toHaveLength(1);
    await fs.writeFile(path, `${"é".repeat(128 * 1024)}x\n`);
    await expect(read(root)).rejects.toThrow(failure);
  });

  it("aborts before I/O and hides private cancellation reasons", async () => {
    const controller = new AbortController();
    controller.abort("PRIVATE_ABORT_REASON");
    const error = await read("/does-not-exist", controller.signal).catch(value => value);
    expect(error.name).toBe("AbortError");
    expect(error.message).toBe("Codex rollout read cancelled.");
    expect(fs.open).not.toHaveBeenCalled();
  });

  it("uses no-follow/nonblocking flags for files and stops after an I/O-boundary abort", async () => {
    const root = await fixture();
    await rollout(root);
    const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    const controller = new AbortController();
    vi.mocked(fs.open).mockImplementation(async (path, flags, mode) => {
      const handle = await actual.open(path, flags, mode);
      if (String(path).endsWith("/rollout-one.jsonl")) {
        expect(flags).toBe(constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        controller.abort("PRIVATE_ABORT_REASON");
      }
      return handle;
    });
    await expect(read(root, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });

  it("rejects a file replaced after inspection and before opening", async () => {
    const root = await fixture();
    const target = await rollout(root);
    const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    vi.mocked(fs.open).mockImplementation(async (path, flags, mode) => {
      if (String(path).endsWith("/rollout-one.jsonl")) {
        await fs.rename(target, join(root, "original"));
        await fs.writeFile(target, "CHANGED\n");
      }
      return actual.open(path, flags, mode);
    });
    await expect(read(root)).rejects.toThrow(failure);
  });

  it("never follows an ancestor replaced by a symlink during traversal", async () => {
    const fixtureRoot = await fixture();
    const selected = join(fixtureRoot, "selected");
    const outside = await fixture();
    await rollout(selected, "ORIGINAL\n");
    await rollout(outside, "OUTSIDE_PRIVATE_CONTENT\n");
    const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    let redirected = false;
    let readContents = "";
    vi.mocked(fs.open).mockImplementation(async (path, flags, mode) => {
      const handle = await actual.open(path, flags, mode);
      if (String(path).endsWith("/selected") && !redirected) {
        redirected = true;
        await fs.rename(selected, join(fixtureRoot, "original"));
        await fs.symlink(outside, selected);
      }
      if (String(path).endsWith("/rollout-one.jsonl")) {
        // Independent positional inspection does not advance the reader's file offset.
        const buffer = Buffer.alloc(64);
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
        readContents = buffer.subarray(0, bytesRead).toString();
      }
      return handle;
    });
    await expect(read(selected)).rejects.toThrow(failure);
    expect(readContents).toBe("ORIGINAL\n");
    expect(readContents).not.toContain("OUTSIDE_PRIVATE_CONTENT");
  });

  it.each(["symlink", "fifo"])("rejects a file changed to a %s before opening", async kind => {
    const root = await fixture();
    const target = await rollout(root);
    const outside = await fixture();
    const outsideTarget = await rollout(outside, "OUTSIDE_PRIVATE_CONTENT\n");
    const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    vi.mocked(fs.open).mockImplementation(async (path, flags, mode) => {
      if (String(path).endsWith("/rollout-one.jsonl")) {
        await fs.unlink(target);
        if (kind === "symlink") await fs.symlink(outsideTarget, target);
        else execFileSync("mkfifo", [target]);
      }
      return actual.open(path, flags, mode);
    });
    await expect(read(root)).rejects.toThrow(failure);
  });

  it("rejects mutation during a file read", async () => {
    const root = await fixture();
    const target = await rollout(root);
    const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    vi.mocked(fs.open).mockImplementation(async (path, flags, mode) => {
      const handle = await actual.open(path, flags, mode);
      if (String(path).endsWith("/rollout-one.jsonl")) {
        const originalRead = handle.read.bind(handle);
        vi.spyOn(handle, "read").mockImplementation(async (...args: Parameters<typeof handle.read>) => {
          const result = await originalRead(...args);
          await fs.appendFile(target, "CHANGED\n");
          return result;
        });
      }
      return handle;
    });
    await expect(read(root)).rejects.toThrow(failure);
  });

  it("runs directly in a Linux Node 24 CLI without bundler aliases", async () => {
    const root = await fixture();
    await rollout(root);
    const modulePath = fileURLToPath(new URL("./codex-rollout-files.ts", import.meta.url));
    const source = `import { readCodexRolloutDirectory } from ${JSON.stringify(modulePath)};
      const value = await readCodexRolloutDirectory({ directory: ${JSON.stringify(root)}, signal: new AbortController().signal });
      process.stdout.write(JSON.stringify(value));`;
    const result = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "--eval", source], { encoding: "utf8", timeout: 10_000 });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ files: [{ lines: ["{}"] }], scannedFiles: 1, ignoredEntries: 0 });
  });
});

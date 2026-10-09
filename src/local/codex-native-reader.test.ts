import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, symlink, link, rm, realpath } from "node:fs/promises";
import { join } from "node:path";
import { beforeAll, afterEach, describe, expect, it } from "vitest";
import { readNativeCodexDirectory, readNativeCodexPage } from "./codex-native-reader.ts";
const roots: string[] = [];
beforeAll(() => { execFileSync(process.execPath, ["scripts/build-codex-reader.mjs"]); });
afterEach(async () => { await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function fixture() { const root = await realpath(await mkdtemp("/tmp/pr-native-reader-")); roots.push(root); return root; }
const read = (directory: string) => readNativeCodexDirectory({ directory, signal: new AbortController().signal });
describe("native descriptor-relative reader, host platform only", () => {
  it("pages a 65-file tree without dropping or repeating files", async () => {
    const root = await fixture();
    for (let i=0;i<65;i++) await writeFile(join(root,`rollout-${i}.jsonl`), `${JSON.stringify({ number:i })}\n`);
    const first=await readNativeCodexPage({directory:root,signal:new AbortController().signal,offset:0});
    expect(first.scannedFiles).toBe(64);expect(first.nextOffset).toBe(64);
    const second=await readNativeCodexPage({directory:root,signal:new AbortController().signal,offset:64});
    expect(second.scannedFiles).toBe(1);expect(second.nextOffset).toBeNull();
    expect(new Set([...first.files,...second.files].flatMap(file=>file.lines)).size).toBe(65);
  });
  it("reads selected rollout bytes, leaves credentials unopened, and exposes no paths", async () => {
    const root = await fixture(); await mkdir(join(root, "sessions"));
    await writeFile(join(root, "sessions", "rollout-one.jsonl"), '{}\n{"type":"response_item"}\r\n');
    await writeFile(join(root, "auth.json"), "SECRET");
    expect(await read(root)).toMatchObject({ files: [{ lines: ["{}", '{"type":"response_item"}'] }], scannedFiles: 1 });
  });
  it("rejects symlinked roots and ancestors", async () => {
    const root = await fixture(), parent = await fixture();
    await symlink(root, join(parent, "alias"));
    await expect(read(join(parent, "alias"))).rejects.toThrow("could not be read safely");
    await mkdir(join(root,"child")); await expect(read(join(parent,"alias","child"))).rejects.toThrow("could not be read safely");
  });
  it("rejects symlinked children", async () => {
    const root = await fixture(); await symlink("/outside/PRIVATE_SECRET", join(root, "rollout-one.jsonl"));
    await expect(read(root)).rejects.toThrow("could not be read safely");
  });
  it("rejects hardlinked rollouts", async () => {
    const root = await fixture(); await writeFile(join(root, "rollout-one.jsonl"), "{}\n");
    await link(join(root, "rollout-one.jsonl"), join(root, "rollout-two.jsonl"));
    await expect(read(root)).rejects.toThrow("could not be read safely");
  });
  it.each(["partial", "\uFEFF{}\n", ""])("handles complete framing without disclosing source content: %j", async body => {
    const root = await fixture(); await writeFile(join(root, "rollout-one.jsonl"), body);
    if (body === "partial") await expect(read(root)).rejects.toThrow("could not be read safely");
    else expect((await read(root)).scannedFiles).toBe(1);
  });
  it("rejects invalid UTF-8", async () => {
    const root = await fixture(); await writeFile(join(root, "rollout-one.jsonl"), Buffer.from([255,10]));
    await expect(read(root)).rejects.toThrow("could not be read safely");
  });
  it("rejects aborted acquisition and path traversal", async () => {
    const root = await fixture(); await expect(read(`${root}/../`)).rejects.toThrow("could not be read safely");
    const controller = new AbortController(); controller.abort("PRIVATE");
    await expect(readNativeCodexDirectory({ directory: root, signal: controller.signal })).rejects.toThrow("read cancelled");
  });
});

import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile, rm, realpath } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(path => rm(path,{recursive:true,force:true}))); });
async function fixture() {
  const root = await realpath(await mkdtemp("/tmp/pr-native-race-")); roots.push(root);
  const binary = `${root}.reader`; roots.push(binary);
  expect(spawnSync("cc",["-std=c11","-Wall","-Wextra","-Werror","-DPR_READER_TEST_HOOKS","native/codex-reader.c","-o",binary]).status).toBe(0);
  await writeFile(join(root,"rollout-one.jsonl"),"{}\n"); return {root,binary};
}
it("a file mutation during the pinned read emits no private bytes",async()=>{
  const {root,binary}=await fixture(); const result=spawnSync(binary,[root,"0"],{env:{PR_TEST_MUTATE:"1",NODE_ENV:"test"}});
  expect(result.status).toBe(1);expect(result.stdout.length).toBe(0);expect(result.stderr.toString()).not.toContain(root);
});
it("renaming the selected directory after acquisition rejects its ancestor chain",async()=>{
  const {root,binary}=await fixture(); const renamed=`${root}.renamed`;roots.push(renamed);
  const result=spawnSync(binary,[root,"0"],{env:{PR_TEST_RENAME:renamed,NODE_ENV:"test"}});
  expect(result.status).toBe(1);expect(result.stdout.length).toBe(0);
});

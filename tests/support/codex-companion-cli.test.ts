import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, chmod, rm } from "node:fs/promises";
import { join } from "node:path";
import { expect, it } from "vitest";
import { loadCompanionState } from "../../src/local/codex-companion";
it("actual CLI prepare and identity preserve the key, reveal no credentials, and never read an unpaired source",async()=>{
  execFileSync(process.execPath,["scripts/build-codex-reader.mjs"]);
  const root=await mkdtemp("/tmp/pr-cli-");await chmod(root,0o700);const path=join(root,"state.json");
  try {
    const args=["--experimental-strip-types","scripts/codex-companion.mjs"];
    const prepared=spawnSync(process.execPath,[...args,"prepare",path,"/SYNTHETIC_NONEXISTENT_SOURCE"],{encoding:"utf8"});
    expect(prepared.status).toBe(0);const state=await loadCompanionState(path);
    const identity=spawnSync(process.execPath,[...args,"identity",path],{encoding:"utf8"});expect(identity.status).toBe(0);
    expect(`${prepared.stdout}${identity.stdout}`).not.toContain(state.privateKey.d);
    expect((await loadCompanionState(path)).privateKey).toEqual(state.privateKey);
    const sync=spawnSync(process.execPath,[...args,"sync",path],{encoding:"utf8"});expect(sync.status).toBe(1);
    expect((await loadCompanionState(path)).sequence).toBe(0);
  } finally { await rm(root,{recursive:true,force:true}); }
});

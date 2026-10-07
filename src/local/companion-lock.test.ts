import { mkdtemp, chmod, rm } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";
import { acquireCompanionLock } from "./companion-lock";
it("the actual OS lock excludes a second helper and releases for a restart",async()=>{
  execFileSync(process.execPath,["scripts/build-codex-reader.mjs"]);
  const root=await mkdtemp("/tmp/pr-lock-");await chmod(root,0o700);
  try {
    const path=join(root,"state.lock"),release=await acquireCompanionLock(path);
    try { await expect(acquireCompanionLock(path)).rejects.toThrow("Another helper"); } finally { await release(); }
    const restart=await acquireCompanionLock(path);await restart();
  } finally { await rm(root,{recursive:true,force:true}); }
});

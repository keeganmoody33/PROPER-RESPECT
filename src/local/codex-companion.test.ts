import { mkdtemp, chmod, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { createCompanionState, loadCompanionState, saveCompanionState, syncCompanion, type CompanionState } from "./codex-companion.ts";
import { packetId, type UsagePacket } from "../domain/usage-sync.ts";
import { deviceDigest, devicePublicKey } from "../domain/device-proof.ts";
const roots: string[] = [];
const at = Date.parse("2026-10-07T00:00:00.000Z");
afterEach(async () => { await Promise.all(roots.splice(0).map(path => rm(path,{recursive:true,force:true}))); });
async function fixture() {
  const root = await mkdtemp("/tmp/pr-companion-"); roots.push(root); await chmod(root, 0o700);
  const directory = join(root,"history"); await mkdir(directory);
  await writeFile(join(directory,"rollout-one.jsonl"), [
    JSON.stringify({type:"session_meta",payload:{id:"synthetic-thread"}}),
    JSON.stringify({type:"token_usage_record",timestamp:"2026-10-02T00:00:00.000Z",payload:{thread_id:"synthetic-thread",response_id:"response",usage:{input_tokens:10,output_tokens:0,total_tokens:10,cached_input_tokens:0,reasoning_output_tokens:0}}}),
  ].join("\n")+"\n");
  const initial = createCompanionState(directory);
  const scope = { sourceKey: initial.sourceKey, deviceDigest: deviceDigest(devicePublicKey(initial.privateKey)), context:"personal", accountIdentity:"unverified",provider:"codex",
    start:"2026-10-01T00:00:00.000Z",end:"2026-10-08T00:00:00.000Z",expiresAt:"2026-10-08T00:00:00.000Z",retainOnDisconnect:true,destination:"https://utmost-mongoose-374.convex.cloud" } as const;
  let state: CompanionState = {...initial,scope,grantId:"synthetic-grant"};
  const path = join(root,"state.json"); await saveCompanionState(path,state);
  const receipts = new Map<number,string>(); let remoteSequence = 0, active = true;
  const transport = { status:async()=>{if(!active)throw new Error("revoked");return {scope,sequence:remoteSequence};},
    send:async(packet:UsagePacket)=> { if(!active)throw new Error("revoked"); receipts.set(packet.sequence,packetId(packet)); remoteSequence=packet.sequence;return {sequence:packet.sequence,packetId:packetId(packet)}; } };
  const save=async(next:CompanionState)=>{await saveCompanionState(path,next);state=next;};
  const input=()=>({state,save,transport,signal:new AbortController().signal,now:()=>at});
  return {input,path,receipts,revoke:()=>{active=false;},restart:async()=>{state=await loadCompanionState(path);}};
}
it("persists pending packets before sending; lost ACK and actual state-file restart recover",async()=>{
  const f=await fixture(), original=f.input().transport.send;let lose=true;
  f.input().transport.send=async packet=>{const ack=await original(packet);expect((await loadCompanionState(f.path)).pending[0].sequence).toBe(packet.sequence);if(lose){lose=false;throw new Error("lost ACK");}return ack;};
  await expect(syncCompanion(f.input())).rejects.toThrow("lost ACK");
  expect((await loadCompanionState(f.path)).sequence).toBe(0);
  await f.restart(); await syncCompanion(f.input());
  expect((await loadCompanionState(f.path)).pending).toEqual([]);
  expect((await loadCompanionState(f.path)).sequence).toBe(2);
  expect(f.receipts.size).toBe(2);
});
it("revocation blocks pending recovery before reading",async()=>{
  const f=await fixture();f.revoke();let reads=0;
  await expect(syncCompanion({...f.input(),read:async()=>{reads++;return{files:[],scannedFiles:0,ignoredEntries:0,nextOffset:null};}})).rejects.toThrow("revoked");expect(reads).toBe(0);
});
it("a changed local source cannot reuse its approval",async()=>{
  const f=await fixture(); await expect(syncCompanion({...f.input(),state:{...f.input().state,directory:"/PRIVATE_OTHER"}})).rejects.toThrow("Approval changed");
});
it("bad ACKs leave pending state and never advance the checkpoint",async()=>{
  const f=await fixture();f.input().transport.send=async packet=>({sequence:packet.sequence,packetId:"0".repeat(64)});
  await expect(syncCompanion(f.input())).rejects.toThrow("Acknowledgment");
  expect((await loadCompanionState(f.path)).sequence).toBe(0);expect((await loadCompanionState(f.path)).pending.length).toBeGreaterThan(0);
});
it("expiry prevents acquisition without a guessed checkpoint",async()=>{
  const f=await fixture();await expect(syncCompanion({...f.input(),now:()=>Date.parse("2026-10-08T00:00:00.000Z")})).rejects.toThrow("expired");
  expect((await loadCompanionState(f.path)).sequence).toBe(0);
});

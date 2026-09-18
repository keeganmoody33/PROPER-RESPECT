// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, expect, test, vi } from "vitest";
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});
import schema from "./schema";
import type { OfferingFacts } from "../src/domain/product-knowledge";
const modules=import.meta.glob("./**/*.ts");
const discover=makeFunctionReference<"mutation">("productKnowledge:discover"),setRefresh=makeFunctionReference<"mutation">("productKnowledge:setRefresh"),get=makeFunctionReference<"query">("productKnowledge:getForProduct"),claim=makeFunctionReference<"mutation">("productKnowledge:claim"),persist=makeFunctionReference<"mutation">("productKnowledge:persist"),due=makeFunctionReference<"query">("productKnowledge:due");
async function setup() {
 const t=convexTest(schema,modules);
 const ids=await t.run(async ctx=>{
  const user=await ctx.db.insert("users",{handle:"owner",authSubject:"owner",displayName:"Owner",bio:""});
  const other=await ctx.db.insert("users",{handle:"other",authSubject:"other",displayName:"Other",bio:""});
  const product=await ctx.db.insert("products",{slug:"wispr-flow",name:"Wispr Flow",domain:"wisprflow.ai",description:"Dictation"});
  const fields={productId:product,status:"ACTIVE" as const,visibility:"DRAFT" as const,headline:"",note:""};
  const propId=await ctx.db.insert("props",{...fields,userId:user});
  const otherPropId=await ctx.db.insert("props",{...fields,userId:other});
  return {propId,otherPropId};
 });
 const owner=t.withIdentity({subject:"owner"}),other=t.withIdentity({subject:"other"});
 // Turning off is idempotent and registers only disabled sources.
 await owner.mutation(setRefresh,{propId:ids.propId,enabled:false});
 const source=await t.run(ctx=>ctx.db.query("productSources").first());
 const rawStorageId=await t.run(ctx=>ctx.storage.store(new Blob(["synthetic official capture"])));
 return {t,owner,other,...ids,source:source!,rawStorageId};
}
const facts=(amount=15):OfferingFacts=>({tiers:[{name:"Pro",option:"Standard",excerpt:"Pro terms",features:["Unlimited dictations"],prices:[{amount,currency:"USD",displayBasis:"MONTH",billingCadence:"MONTH",perSeat:true,availability:"LISTED",excerpt:"Pro terms"}],allowances:[],overage:"UNKNOWN"}],documentation:[],effectiveDate:null});
test("owner authorization and independent refresh consent; bounded disabled-by-default scheduler",async()=>{
 const {t,owner,other,propId,otherPropId}=await setup();
 await expect(t.query(get,{propId})).rejects.toThrow("Authentication required");
 await expect(other.query(get,{propId})).rejects.toThrow("Evidence unavailable");
 await expect(other.mutation(discover,{propId})).rejects.toThrow("Evidence unavailable");
 expect(await t.query(due,{now:Date.now()+1})).toHaveLength(0);
 await owner.mutation(setRefresh,{propId,enabled:true});
 await other.mutation(setRefresh,{propId:otherPropId,enabled:true});
 await owner.mutation(setRefresh,{propId,enabled:false});
 expect((await owner.query(get,{propId})).sources.every((s:{watchEnabled:boolean})=>!s.watchEnabled)).toBe(true);
 expect((await other.query(get,{propId:otherPropId})).sources.every((s:{watchEnabled:boolean})=>s.watchEnabled)).toBe(true);
 expect(await t.query(due,{now:Date.now()+1})).toHaveLength(5);
 await other.mutation(setRefresh,{propId:otherPropId,enabled:false});
 expect(await t.query(due,{now:Date.now()+1})).toHaveLength(0);
});
test("immutable changed history, duplicate persistence, unchanged capture and failure retention never mutate private tables",async()=>{
 vi.useFakeTimers({toFake:["Date"]});
 const {t,owner,propId,source,rawStorageId}=await setup();
 const before=await t.run(async ctx=>({props:await ctx.db.query("props").collect(),usage:await ctx.db.query("usageSignals").collect(),raw:await ctx.db.query("rawEvidence").collect(),profiles:await ctx.db.query("publishedProfiles").collect()}));
 let seq=0;
 async function save(options:{amount?:number;complete?:boolean;error?:boolean;parserVersion?:string}={}) {
  vi.setSystemTime(Date.now()+60_001);
  const token=`capture-${seq++}`,result=await t.mutation(claim,{sourceId:source._id,token,recurring:false});
  const args={sourceId:source._id,token,startedAt:result.startedAt,capturedAt:new Date().toISOString(),parserVersion:options.parserVersion??"v1",rawStorageId,rawHash:`hash-${token}`,normalizedText:"Pro terms Unlimited dictations",finalUrl:source.canonicalUrl,facts:facts(options.amount),complete:options.complete??true,error:options.error??false};
  const id=await t.mutation(persist,args);return {args,id};
 }
 const baseline=await save();
 await t.mutation(persist,baseline.args);
 const unchanged=await save();
 await save({amount:20});
 await save({complete:false});
 await save({error:true});
 let state=await owner.query(get,{propId});
 let selected=state.sources.find((s:{source:{_id:string}})=>s.source._id===source._id);
 expect(selected.latestObservation.facts.tiers[0].prices[0].amount).toBe(20);
 expect(selected.latestRun.status).toBe("ERROR");
 expect(selected.history).toHaveLength(2);
 expect(await t.run(ctx=>ctx.db.get(unchanged.id))).toMatchObject({status:"UNCHANGED",rawStorageId,rawHash:unchanged.args.rawHash});
 await save({amount:20,parserVersion:"v2"});
 state=await owner.query(get,{propId});selected=state.sources.find((s:{source:{_id:string}})=>s.source._id===source._id);
 expect(selected.latestRun.status).toBe("REPARSED");expect(selected.history).toHaveLength(3);
 expect(await t.run(ctx=>ctx.db.query("productRefreshRuns").collect())).toHaveLength(6);
 await expect(t.mutation(persist,{...baseline.args,rawHash:"collision"})).rejects.toThrow("collision");
 const after=await t.run(async ctx=>({props:await ctx.db.query("props").collect(),usage:await ctx.db.query("usageSignals").collect(),raw:await ctx.db.query("rawEvidence").collect(),profiles:await ctx.db.query("publishedProfiles").collect()}));
 expect(after).toEqual(before);
});
test("concurrent leases and obsolete completions cannot replace latest values",async()=>{
 const {t,source,rawStorageId}=await setup();
 const initial=await t.mutation(claim,{sourceId:source._id,token:"old",recurring:false});
 expect(await t.mutation(claim,{sourceId:source._id,token:"duplicate",recurring:false})).toBeNull();
 await t.run(ctx=>ctx.db.patch(source._id,{leaseUntil:0}));
 const latest=await t.mutation(claim,{sourceId:source._id,token:"new",recurring:false});
 const base={sourceId:source._id,capturedAt:new Date().toISOString(),parserVersion:"v1",rawStorageId,rawHash:"hash",normalizedText:"Pro terms Unlimited dictations",complete:true,error:false};
 await t.mutation(persist,{...base,token:"new",startedAt:latest.startedAt,facts:facts(20)});
 const obsoleteId=await t.mutation(persist,{...base,token:"old",startedAt:initial.startedAt,facts:facts(15)});
 expect(await t.run(ctx=>ctx.db.get(obsoleteId))).toMatchObject({status:"INCOMPLETE"});
 const current=await t.run(ctx=>ctx.db.get(source._id));
 expect(await t.run(ctx=>ctx.db.get(current!.latestObservationId!))).toMatchObject({facts:{tiers:[{prices:[{amount:20}]}]}});
});

test("complete unchanged attempts validate nested excerpts and reuse fresh source captures",async()=>{
 const {t,source,rawStorageId}=await setup();
 const first=await t.mutation(claim,{sourceId:source._id,token:"baseline",recurring:false});
 const base={sourceId:source._id,token:"baseline",startedAt:first.startedAt,capturedAt:new Date().toISOString(),parserVersion:"v1",rawStorageId,rawHash:"hash",normalizedText:"Pro terms Unlimited dictations",complete:true,error:false,facts:facts()};
 const forged=facts();forged.tiers[0].prices[0].excerpt="not in original";
 await expect(t.mutation(persist,{...base,facts:forged})).rejects.toThrow("excerpts");
 const badAllowance=facts();badAllowance.tiers[0].allowances=[{metric:"words",value:100,unit:"words",period:"WEEK",platform:"desktop",excerpt:"not in original"}];
 await expect(t.mutation(persist,{...base,facts:badAllowance})).rejects.toThrow("excerpts");
 await t.mutation(persist,base);
 expect(await t.mutation(claim,{sourceId:source._id,token:"reuse",recurring:false})).toBeNull();
 await t.run(ctx=>ctx.db.patch(source._id,{lastCompletedAt:Date.now()-61_000}));
 const retry=await t.mutation(claim,{sourceId:source._id,token:"failure",recurring:false});
 await t.mutation(persist,{...base,token:"failure",startedAt:retry.startedAt,error:true,complete:false});
 expect(await t.mutation(claim,{sourceId:source._id,token:"retry-error",recurring:false})).toBeNull();
});
test("real refresh action captures immutable original bytes, parser failure and HTTP failure without losing last good facts",async()=>{
 vi.useFakeTimers({toFake:["Date"]});
 const {t}=await setup();
 const source=await t.run(ctx=>ctx.db.query("productSources").withIndex("by_key",q=>q.eq("key","wispr-usage")).unique());
 const refresh=makeFunctionReference<"action">("productKnowledge:refreshSource");
 const html='<div class="kb-article-body"><h1>Your Usage</h1><p>Insights shows your total words dictated.</p></div>';
 const fetcher=vi.fn(async()=>new Response(html,{headers:{"content-type":"text/html"}}));
 vi.stubGlobal("fetch",fetcher);
 try {
  await t.action(refresh,{sourceId:source!._id});
  const first=await t.run(ctx=>ctx.db.get(source!._id));
  const firstRun=await t.run(ctx=>ctx.db.get(first!.latestRunId!));
  expect(firstRun!.status).toBe("BASELINE");
  expect(await t.run(async ctx=>(await ctx.storage.get(firstRun!.rawStorageId!))!.text())).toBe(html);
  expect(firstRun!.rawHash).toMatch(/^[a-f0-9]{64}$/);
  await t.action(refresh,{sourceId:source!._id});expect(fetcher).toHaveBeenCalledTimes(1);
  vi.setSystemTime(Date.now()+61_000);
  fetcher.mockImplementation(async()=>new Response('<div>page shape changed</div>',{headers:{"content-type":"text/html"}}));
  await t.action(refresh,{sourceId:source!._id});
  const incomplete=await t.run(ctx=>ctx.db.get(source!._id));
  expect(incomplete!.latestObservationId).toBe(first!.latestObservationId);
  expect(await t.run(ctx=>ctx.db.get(incomplete!.latestRunId!))).toMatchObject({status:"INCOMPLETE"});
  vi.setSystemTime(Date.now()+61_000);
  fetcher.mockImplementation(async()=>new Response(null,{status:503}));
  await t.action(refresh,{sourceId:source!._id});
  const failed=await t.run(ctx=>ctx.db.get(source!._id));
  expect(failed!.latestObservationId).toBe(first!.latestObservationId);
  expect(await t.run(ctx=>ctx.db.get(failed!.latestRunId!))).toMatchObject({status:"ERROR",message:"Official fetch HTTP 503."});
 } finally {vi.unstubAllGlobals();}
});


test.each(["BASELINE", "INCOMPLETE", "ERROR"] as const)("all terminal statuses enforce sixty seconds after completion: %s", async (status) => {
  vi.useFakeTimers({toFake:["Date"]});
  const {t,source,rawStorageId}=await setup();
  const captured=await t.mutation(claim,{sourceId:source._id,token:"cooldown",recurring:false});
  // A slow request must get a full cooldown after completion, not after its start.
  vi.setSystemTime(Date.now()+45_000);
  await t.mutation(persist,{sourceId:source._id,token:"cooldown",startedAt:captured.startedAt,capturedAt:new Date().toISOString(),parserVersion:"v1",rawStorageId,rawHash:"hash",normalizedText:"Pro terms Unlimited dictations",facts:facts(),complete:status==="BASELINE",error:status==="ERROR"});
  expect(await t.mutation(claim,{sourceId:source._id,token:"immediate",recurring:false})).toBeNull();
  vi.setSystemTime(Date.now()+59_999);
  expect(await t.mutation(claim,{sourceId:source._id,token:"too-soon",recurring:false})).toBeNull();
  vi.setSystemTime(Date.now()+1);
  expect(await t.mutation(claim,{sourceId:source._id,token:"after-cooldown",recurring:false})).not.toBeNull();
});

test("an expired recurring lease without terminal persistence remains due, then terminal persistence schedules the next day", async () => {
  vi.useFakeTimers({toFake:["Date"]});
  const {t,owner,propId,source}=await setup();
  await owner.mutation(setRefresh,{propId,enabled:true});
  const first=await t.mutation(claim,{sourceId:source._id,token:"interrupted",recurring:true});
  expect(first).not.toBeNull();
  vi.setSystemTime(Date.now()+60_001);
  expect((await t.query(due,{now:Date.now()})).map((s:{_id:string})=>s._id)).toContain(source._id);
  const recovered=await t.mutation(claim,{sourceId:source._id,token:"recovered",recurring:true});
  expect(recovered).not.toBeNull();
  await t.mutation(persist,{sourceId:source._id,token:"recovered",startedAt:recovered.startedAt,capturedAt:new Date().toISOString(),parserVersion:"v1",complete:false,error:true,message:"Synthetic network error"});
  const finished=await t.run(ctx=>ctx.db.get(source._id));
  expect(finished!.nextRefreshAt).toBe(Date.now()+86_400_000);
  expect(finished!.leaseToken).toBeUndefined();
  expect((await t.query(due,{now:Date.now()})).map((s:{_id:string})=>s._id)).not.toContain(source._id);
});

test("a failed terminal persistence does not stop later due sources", async () => {
  const {t,owner,propId}=await setup();
  await owner.mutation(setRefresh,{propId,enabled:true});
  const sources=await t.query(due,{now:Date.now()});
  const first=sources[0];
  const fetcher=vi.fn(async (url: string | URL | Request) => {
    // Remove only a synthetic fixture source after claim, forcing both persist attempts to reject.
    if(String(url)===first.canonicalUrl) await t.run(ctx=>ctx.db.delete(first._id));
    return new Response('<div class="kb-article-body">Synthetic changed page structure</div>',{headers:{"content-type":"text/html"}});
  });
  vi.stubGlobal("fetch",fetcher);
  vi.spyOn(console,"error").mockImplementation(()=>{});
  await expect(t.action(makeFunctionReference<"action">("productKnowledge:refreshDue"),{})).resolves.toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(sources.length);
  const runs=await t.run(ctx=>ctx.db.query("productRefreshRuns").collect());
  expect(runs.map(r=>r.sourceId).sort()).toEqual(sources.slice(1).map((s:{_id:string})=>s._id).sort());
  expect(runs.every(r=>r.status==="INCOMPLETE")).toBe(true);
});

test("oversized multibyte documentation retains original HTML and the last good observation", async () => {
  vi.useFakeTimers({toFake:["Date"]});
  const {t}=await setup();
  const source=await t.run(ctx=>ctx.db.query("productSources").withIndex("by_key",q=>q.eq("key","wispr-usage")).unique());
  const refresh=makeFunctionReference<"action">("productKnowledge:refreshSource");
  const prefix="Your Usage Insights total words";
  let html=`<div class="kb-article-body">${prefix}</div>`;
  vi.stubGlobal("fetch",vi.fn(async()=>new Response(html,{headers:{"content-type":"text/html"}})));
  await t.action(refresh,{sourceId:source!._id});
  const baseline=await t.run(ctx=>ctx.db.get(source!._id));
  vi.setSystemTime(Date.now()+60_001);
  html=`<div class="kb-article-body">${prefix} ${"界".repeat(22_000)}</div>`;
  await t.action(refresh,{sourceId:source!._id});
  const current=await t.run(ctx=>ctx.db.get(source!._id));
  expect(current!.latestObservationId).toBe(baseline!.latestObservationId);
  const run=await t.run(ctx=>ctx.db.get(current!.latestRunId!));
  expect(run!.status).toBe("INCOMPLETE");
  expect(run!.normalizedText).toBe("");
  expect(await t.run(async ctx=>(await ctx.storage.get(run!.rawStorageId!))!.text())).toBe(html);
});

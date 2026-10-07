// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference, type FunctionArgs, type FunctionReturnType } from "convex/server";
import { afterEach, expect, test, vi } from "vitest";
import schema from "./schema";
import { approveUsage, listUsage, usageEvidence, disconnectUsage, eraseUsage, type ConnectionsAPI } from "../src/client/usage-connection-api";
import { digest, privateUsageTotals, type UsagePacket, type GrantScope } from "../src/domain/usage-sync";
const exchange = makeFunctionReference<"mutation", FunctionArgs<ConnectionsAPI["exchange"]>, FunctionReturnType<ConnectionsAPI["exchange"]>>("usageConnections:exchange");
const status = makeFunctionReference<"query", FunctionArgs<ConnectionsAPI["status"]>, FunctionReturnType<ConnectionsAPI["status"]>>("usageConnections:status");
const ingest = makeFunctionReference<"mutation", FunctionArgs<ConnectionsAPI["ingest"]>, FunctionReturnType<ConnectionsAPI["ingest"]>>("usageConnections:ingest");
import { createDeviceKey, signDeviceMessage } from "../src/local/device-signature";
import { deviceDigest, devicePublicKey } from "../src/domain/device-proof";
import { packetId } from "../src/domain/usage-sync";
const key = createDeviceKey(), code = "b".repeat(64);
const pairArgs = (code: string) => ({ code, publicKeyJson: JSON.stringify(devicePublicKey(key)), ...signDeviceMessage(key, { operation: "pair", code }) });
const scope: GrantScope = { sourceKey: "c".repeat(64), deviceDigest: deviceDigest(devicePublicKey(key)), context: "personal", accountIdentity: "unverified", provider: "codex",
  start: "2026-10-01T00:00:00.000Z", end: "2026-10-15T00:00:00.000Z", expiresAt: "2026-10-15T00:00:00.000Z", retainOnDisconnect: true,
  destination: "https://utmost-mongoose-374.convex.cloud" };
const packet = (sequence = 1, count = "9007199254740993"): UsagePacket => ({ version: "proper-respect-codex-sync-v1", sourceKey: scope.sourceKey,
  sequence, start: scope.start, end: "2026-10-08T00:00:00.000Z", coverage: "partial", rows: [{ kind: "response", thread: "d".repeat(64), response: "e".repeat(64),
    at: "2026-10-02T00:00:00.000Z", status: "measured", counts: { input_tokens: count, cached_input_tokens: "0", output_tokens: "0", reasoning_output_tokens: "0", total_tokens: count, cache_write_input_tokens: null } }] });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
async function fixture(retain = true) {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-07T00:00:00.000Z"));
  vi.stubEnv("CONVEX_CLOUD_URL", scope.destination);
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  await t.run(async ctx => { for (const subject of ["owner", "other"]) await ctx.db.insert("users", { authSubject: subject, handle: subject, displayName: subject, bio: "" }); });
  const owner = t.withIdentity({ subject: "owner" }), other = t.withIdentity({ subject: "other" });
  const grantId = await owner.mutation(approveUsage, { scopeJson: JSON.stringify({ ...scope, retainOnDisconnect: retain }), codeDigest: digest(code) });
  await t.mutation(exchange, pairArgs(code));
  const send = (value = packet()) => t.mutation(ingest, { grantId, packetJson: JSON.stringify(value), ...signDeviceMessage(key, { operation: "ingest", grantId, packetId: packetId(value) }) });
  const read = async () => {
    const [grant] = await owner.query(listUsage, {});
    return owner.query(usageEvidence, { sourceId: grant.sourceId, cursor: null });
  };
  return { t, owner, other, grantId, send, read };
}
test("durable ACK, lost ACK replay and another packet retain exact non-additive totals", async () => {
  const f = await fixture(); const ack = await f.send();
  expect((await f.send()).packetId).toBe(ack.packetId);
  await f.send(packet(2));
  const rows = (await f.read()).page;
  expect(rows).toHaveLength(1);
  expect(privateUsageTotals(rows).responses.find(row => row.metric === "total_tokens")?.value).toBe("9007199254740993");
  expect(await f.t.query(status, { grantId: f.grantId, ...signDeviceMessage(key, { operation: "status", grantId: f.grantId }) })).toMatchObject({ sequence: 2 });
});
test("one-use pairing binds the device; wrong secret cannot read or ingest", async () => {
  const f = await fixture();
  await expect(f.t.mutation(exchange, pairArgs(code))).rejects.toThrow("Pairing unavailable");
  await expect(f.t.query(status, { grantId: f.grantId, ...signDeviceMessage(createDeviceKey(), { operation: "status", grantId: f.grantId }) })).rejects.toThrow("Device proof unavailable");
});
test("private owner isolation includes disconnect and deletion", async () => {
  const f = await fixture(); await f.send(); const [grant] = await f.owner.query(listUsage, {});
  expect(await f.other.query(listUsage, {})).toEqual([]);
  await expect(f.other.query(usageEvidence, { sourceId: grant.sourceId, cursor: null })).rejects.toThrow("Source unavailable");
  await expect(f.other.mutation(disconnectUsage, { grantId: f.grantId })).rejects.toThrow("Connection unavailable");
  await expect(f.other.mutation(eraseUsage, { grantId: f.grantId })).rejects.toThrow();
});
test("sequence collision and skipped checkpoints never acknowledge new evidence", async () => {
  const f = await fixture(); await f.send();
  await expect(f.send(packet(1, "2"))).rejects.toThrow("Sequence conflict");
  await expect(f.send(packet(3))).rejects.toThrow("Checkpoint conflict");
  expect((await f.read()).page).toHaveLength(1);
});
test("conflicting evidence persists across packets rather than selecting a maximum", async () => {
  const f = await fixture(); await f.send(); await f.send(packet(2, "2"));
  expect(privateUsageTotals((await f.read()).page).responses.find(row => row.metric === "total_tokens")).toMatchObject({ value: null, conflict: true });
});
test("re-pairing preserves source evidence and revokes the old device capability", async () => {
  const f = await fixture(); await f.send();
  const nextCode = "f".repeat(64);
  const next = await f.owner.mutation(approveUsage, { scopeJson: JSON.stringify(scope), codeDigest: digest(nextCode) });
  await expect(f.send(packet(2))).rejects.toThrow("Connection unavailable");
  await f.t.mutation(exchange, pairArgs(nextCode));
  await f.t.mutation(ingest, { grantId: next, packetJson: JSON.stringify(packet()), ...signDeviceMessage(key, { operation: "ingest", grantId: next, packetId: packetId(packet()) }) });
  expect((await f.read()).page).toHaveLength(1);
  await expect(f.owner.mutation(approveUsage, { scopeJson: JSON.stringify({ ...scope, context: "work" }), codeDigest: digest("1".repeat(64)) })).rejects.toThrow("separate source");
});
test("expiry and disconnect reject queued retries; retention stays private", async () => {
  const f = await fixture(); await f.send();
  await f.owner.mutation(disconnectUsage, { grantId: f.grantId });
  await expect(f.send()).rejects.toThrow("Connection unavailable"); expect((await f.read()).page).toHaveLength(1);
  await f.owner.mutation(eraseUsage, { grantId: f.grantId }); expect((await f.read()).page).toHaveLength(0);
});
test("absolute expiry blocks even identical retries", async () => {
  const f = await fixture(); await f.send(); vi.setSystemTime(new Date(scope.expiresAt));
  await expect(f.send()).rejects.toThrow("Connection unavailable");
});
test("unknown fields, paths and prompt payloads fail closed; the transaction retains no partial write", async () => {
  const f = await fixture();
  await expect(f.t.mutation(ingest, { grantId: f.grantId, packetJson: JSON.stringify({ ...packet(), prompt: "PRIVATE_SECRET" }), ...signDeviceMessage(key, { operation: "ingest", grantId: f.grantId, packetId: packetId(packet()) }) })).rejects.toThrow();
  expect((await f.read()).page).toHaveLength(0);
});
test("non-retained disconnect deletes evidence and receipts without depending on a browser", async () => {
  const f=await fixture(false);await f.send();await f.owner.mutation(disconnectUsage,{grantId:f.grantId});
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect((await f.read()).page).toHaveLength(0);
  expect(await f.t.run(ctx=>ctx.db.query("usageReceipts").collect())).toHaveLength(0);
});
test("an expired pairing code cannot activate its pending grant", async () => {
  const f=await fixture();const nextCode="1".repeat(64);
  await f.owner.mutation(approveUsage,{scopeJson:JSON.stringify(scope),codeDigest:digest(nextCode)});
  vi.setSystemTime(new Date("2026-10-07T00:06:00.000Z"));
  await expect(f.t.mutation(exchange,pairArgs(nextCode))).rejects.toThrow("Pairing unavailable");
});
test("the endpoint refuses a production deployment even with a valid device capability", async () => {
  const f=await fixture();vi.stubEnv("CONVEX_CLOUD_URL","https://striped-chicken-693.convex.cloud");
  await expect(f.send()).rejects.toThrow("Development connection unavailable");
});
test("a deleted owner cannot leave an ingest capability active",async()=>{
  const f=await fixture();await f.t.run(async ctx=>{const owner=await ctx.db.query("users").withIndex("by_auth_subject",q=>q.eq("authSubject","owner")).unique();if(owner)await ctx.db.delete(owner._id);});
  await expect(f.send()).rejects.toThrow("Connection unavailable");
});
test("a status proof cannot authorize a changed packet or an ingestion operation",async()=>{
  const f=await fixture();
  const proof=signDeviceMessage(key,{operation:"status",grantId:f.grantId});
  await expect(f.t.mutation(ingest,{grantId:f.grantId,packetJson:JSON.stringify(packet()),...proof})).rejects.toThrow("Device proof unavailable");
  const signed=signDeviceMessage(key,{operation:"ingest",grantId:f.grantId,packetId:packetId(packet())});
  await expect(f.t.mutation(ingest,{grantId:f.grantId,packetJson:JSON.stringify(packet(1,"2")),...signed})).rejects.toThrow("Device proof unavailable");
  expect((await f.read()).page).toHaveLength(0);
});
test("device proofs expire while the grant remains active; only a public key is persisted",async()=>{
  const f=await fixture();const proof=signDeviceMessage(key,{operation:"status",grantId:f.grantId});
  vi.setSystemTime(new Date("2026-10-07T00:00:31.000Z"));
  await expect(f.t.query(status,{grantId:f.grantId,...proof})).rejects.toThrow("Device proof unavailable");
  const stored=await f.t.run(ctx=>ctx.db.get(f.grantId));
  expect(JSON.parse(stored?.publicKeyJson ?? "null")).toEqual(devicePublicKey(key));
  expect(stored?.publicKeyJson).not.toContain(key.d);
});

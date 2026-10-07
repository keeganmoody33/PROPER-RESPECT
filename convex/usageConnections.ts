import { mutation, query, internalMutation } from "./_generated/server";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { requireUser } from "./authHelpers";
import { canonicalJson } from "../src/domain/canonical-json";
import { digest, digestSchema, secretSchema, grantScopeSchema, usagePacketSchema, packetId, evidenceKey, numericEvidenceSchema } from "../src/domain/usage-sync";
import { deviceDigest, devicePublicKeySchema, verifyDeviceProof, type DeviceProof, type DeviceMessage } from "../src/domain/device-proof";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
const eraseRef = makeFunctionReference<"mutation">("usageConnections:eraseRevoked");
function developmentOnly() {
  if (process.env.CONVEX_CLOUD_URL !== "https://utmost-mongoose-374.convex.cloud") throw new Error("Development connection unavailable.");
}

async function activeGrant(ctx: QueryCtx, grantId: Id<"usageGrants">, proof: DeviceProof, message: DeviceMessage) {
  developmentOnly();
  const grant = await ctx.db.get(grantId);
  if (!grant || grant.state !== "active" || grant.expiresAt <= Date.now() || !grant.publicKeyJson) throw new Error("Connection unavailable.");
  await verifyDeviceProof({ key: devicePublicKeySchema.parse(JSON.parse(grant.publicKeyJson)), proof, message });
  const owner = await ctx.db.get(grant.userId), source = await ctx.db.get(grant.sourceId);
  if (!owner || !source || source.userId !== owner._id || source.erasing) throw new Error("Connection unavailable.");
  return grant;
}

export const approve = mutation({ args: { scopeJson: v.string(), codeDigest: v.string() }, handler: async (ctx, args) => {
  developmentOnly();
  const owner = await requireUser(ctx);
  if (args.scopeJson.length > 4096) throw new Error("Invalid scope.");
  const scope = grantScopeSchema.parse(JSON.parse(args.scopeJson));
  digestSchema.parse(args.codeDigest);
  if (Date.parse(scope.expiresAt) <= Date.now() || Date.parse(scope.expiresAt) > Date.now() + 31 * 86400_000) throw new Error("Invalid expiry.");
  const duplicate = await ctx.db.query("usageGrants").withIndex("by_code", q => q.eq("codeDigest", args.codeDigest)).unique();
  if (duplicate) throw new Error("Pairing code already used.");
  const prior = await ctx.db.query("usageSources").withIndex("by_owner_source", q => q.eq("userId", owner._id).eq("sourceKey", scope.sourceKey)).unique();
  if (prior?.erasing) throw new Error("Previous history deletion is still running.");
  if (prior && prior.context !== scope.context) throw new Error("Use a separate source for work and personal history.");
  const sourceId = prior?._id ?? await ctx.db.insert("usageSources", { userId: owner._id, sourceKey: scope.sourceKey, context: scope.context });
  // Re-pairing revokes previous capabilities without removing authorized evidence.
  for (const grant of await ctx.db.query("usageGrants").withIndex("by_source", q => q.eq("sourceId", sourceId)).collect()) {
    if (grant.state !== "revoked") await ctx.db.patch(grant._id, { state: "revoked" });
  }
  return ctx.db.insert("usageGrants", { userId: owner._id, sourceId, scopeJson: canonicalJson(scope), codeDigest: args.codeDigest,
    deviceDigest: scope.deviceDigest, pairExpiresAt: Date.now() + 300_000, expiresAt: Date.parse(scope.expiresAt), state: "pending", sequence: 0 });
} });

export const exchange = mutation({ args: { code: v.string(), publicKeyJson: v.string(), issuedAt: v.string(), signature: v.string() }, handler: async (ctx, args) => {
  developmentOnly();
  secretSchema.parse(args.code);
  if (args.publicKeyJson.length > 1024) throw new Error("Pairing unavailable.");
  const key = devicePublicKeySchema.parse(JSON.parse(args.publicKeyJson));
  const grant = await ctx.db.query("usageGrants").withIndex("by_code", q => q.eq("codeDigest", digest(args.code))).unique();
  if (!grant || grant.state !== "pending" || grant.pairExpiresAt <= Date.now() || grant.expiresAt <= Date.now() || grant.deviceDigest !== deviceDigest(key)) throw new Error("Pairing unavailable.");
  await verifyDeviceProof({ key, proof: args, message: { operation: "pair", code: args.code } });
  await ctx.db.patch(grant._id, { state: "active", publicKeyJson: canonicalJson(key) });
  return { grantId: grant._id, scope: grantScopeSchema.parse(JSON.parse(grant.scopeJson)), sequence: 0 };
} });

export const status = query({ args: { grantId: v.id("usageGrants"), issuedAt: v.string(), signature: v.string() }, handler: async (ctx, args) => {
  const grant = await activeGrant(ctx, args.grantId, args, { operation: "status", grantId: args.grantId });
  return { scope: grantScopeSchema.parse(JSON.parse(grant.scopeJson)), sequence: grant.sequence };
} });

export const ingest = mutation({ args: { grantId: v.id("usageGrants"), issuedAt: v.string(), signature: v.string(), packetJson: v.string() }, handler: async (ctx, args) => {
  if (new TextEncoder().encode(args.packetJson).length > 256_000) throw new Error("Packet too large.");
  const packet = usagePacketSchema.parse(JSON.parse(args.packetJson));
  const grant = await activeGrant(ctx, args.grantId, args, { operation: "ingest", grantId: args.grantId, packetId: packetId(packet) });
  const scope = grantScopeSchema.parse(JSON.parse(grant.scopeJson));
  if (packet.sourceKey !== scope.sourceKey || packet.start < scope.start || packet.end > scope.end) throw new Error("Packet outside approval.");
  const id = packetId(packet);
  const receipt = await ctx.db.query("usageReceipts").withIndex("by_grant_sequence", q => q.eq("grantId", grant._id).eq("sequence", packet.sequence)).unique();
  if (receipt) {
    if (receipt.packetId !== id) throw new Error("Sequence conflict.");
    return receipt;
  }
  if (packet.sequence !== grant.sequence + 1) throw new Error("Checkpoint conflict.");
  for (const row of packet.rows) {
    const key = evidenceKey(row), rowJson = canonicalJson(row), fingerprint = digest(rowJson);
    const prior = await ctx.db.query("usageEvidence").withIndex("by_source_key", q => q.eq("sourceId", grant.sourceId).eq("key", key)).collect();
    if (!prior.some(item => item.fingerprint === fingerprint)) await ctx.db.insert("usageEvidence", { sourceId: grant.sourceId, key, fingerprint, rowJson });
  }
  const acceptedAt = new Date().toISOString();
  await ctx.db.insert("usageReceipts", { grantId: grant._id, sequence: packet.sequence, packetId: id, acceptedAt });
  await ctx.db.patch(grant._id, { sequence: packet.sequence, lastSyncedAt: acceptedAt });
  return { grantId: grant._id, sequence: packet.sequence, packetId: id, acceptedAt };
} });

export const list = query({ args: {}, handler: async ctx => {
  const owner = await requireUser(ctx);
  const grants = await ctx.db.query("usageGrants").withIndex("by_owner", q => q.eq("userId", owner._id)).collect();
  return grants.map(grant => ({ ownerSubject: owner.authSubject ?? "", grantId: grant._id, sourceId: grant.sourceId, scope: grantScopeSchema.parse(JSON.parse(grant.scopeJson)),
    state: grant.state === "revoked" ? "revoked" : grant.expiresAt <= Date.now() ? "expired" : grant.state,
    pairExpiresAt: grant.pairExpiresAt, sequence: grant.sequence, lastSyncedAt: grant.lastSyncedAt ?? null }));
} });

export const evidence = query({ args: { sourceId: v.id("usageSources"), cursor: v.union(v.string(), v.null()) }, handler: async (ctx, args) => {
  const owner = await requireUser(ctx), source = await ctx.db.get(args.sourceId);
  if (!source || source.userId !== owner._id) throw new Error("Source unavailable.");
  const page = await ctx.db.query("usageEvidence").withIndex("by_source", q => q.eq("sourceId", source._id)).paginate({ numItems: 200, cursor: args.cursor });
  return { ...page, page: page.page.map(row => numericEvidenceSchema.parse(JSON.parse(row.rowJson))) };
} });

export const disconnect = mutation({ args: { grantId: v.id("usageGrants") }, handler: async (ctx, args) => {
  const owner = await requireUser(ctx), grant = await ctx.db.get(args.grantId);
  if (!grant || grant.userId !== owner._id) throw new Error("Connection unavailable.");
  const scope = grantScopeSchema.parse(JSON.parse(grant.scopeJson));
  for (const sibling of await ctx.db.query("usageGrants").withIndex("by_source", q => q.eq("sourceId", grant.sourceId)).collect()) await ctx.db.patch(sibling._id, { state: "revoked" });
  if (!scope.retainOnDisconnect) {
    await ctx.db.patch(grant.sourceId, { erasing: true });
    await ctx.scheduler.runAfter(0, eraseRef, { sourceId: grant.sourceId });
  }
  return { retained: scope.retainOnDisconnect };
} });

// Bounded deletion may be repeated after disconnect until done. Revocation is immediate.
export const erase = mutation({ args: { grantId: v.id("usageGrants") }, handler: async (ctx, args) => {
  const owner = await requireUser(ctx), grant = await ctx.db.get(args.grantId);
  if (!grant || grant.userId !== owner._id || grant.state !== "revoked") throw new Error("Disconnect before erasing history.");
  const siblings = await ctx.db.query("usageGrants").withIndex("by_source", q => q.eq("sourceId", grant.sourceId)).collect();
  if (siblings.some(item => item.state !== "revoked")) throw new Error("Disconnect current access before erasing history.");
  await ctx.db.patch(grant.sourceId, { erasing: true });
  const rows = await ctx.db.query("usageEvidence").withIndex("by_source", q => q.eq("sourceId", grant.sourceId)).take(200);
  for (const row of rows) await ctx.db.delete(row._id);
  await ctx.scheduler.runAfter(0, eraseRef, { sourceId: grant.sourceId });
  return { done: rows.length < 200 };
} });

export const eraseRevoked = internalMutation({ args: { sourceId: v.id("usageSources") }, handler: async (ctx, args) => {
  const source = await ctx.db.get(args.sourceId);
  if (!source?.erasing) return;
  const grants = await ctx.db.query("usageGrants").withIndex("by_source", q => q.eq("sourceId", source._id)).collect();
  if (grants.some(grant => grant.state !== "revoked")) throw new Error("Cannot erase an active source.");
  const rows = await ctx.db.query("usageEvidence").withIndex("by_source", q => q.eq("sourceId", source._id)).take(200);
  for (const row of rows) await ctx.db.delete(row._id);
  if (rows.length === 200) { await ctx.scheduler.runAfter(0, eraseRef, { sourceId: source._id }); return; }
  for (const grant of grants) {
    const receipts = await ctx.db.query("usageReceipts").withIndex("by_grant_sequence", q => q.eq("grantId", grant._id)).take(200);
    for (const receipt of receipts) await ctx.db.delete(receipt._id);
    if (receipts.length === 200) { await ctx.scheduler.runAfter(0, eraseRef, { sourceId: source._id }); return; }
  }
  await ctx.db.patch(source._id, { erasing: false });
} });

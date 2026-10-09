import { mutation, query, internalMutation } from "./_generated/server";
import { makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";
import { requireUser } from "./authHelpers";
import { canonicalJson } from "../src/domain/canonical-json";
import { digest, digestSchema, secretSchema, grantScopeSchema, usagePacketSchema, packetId, evidenceKey, numericEvidenceSchema } from "../src/domain/usage-sync";
import { deviceDigest, devicePublicKeySchema, verifyDeviceProof, type DeviceProof, type DeviceMessage } from "../src/domain/device-proof";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
const eraseRef = makeFunctionReference<"mutation">("usageConnections:eraseRevoked");
function developmentOnly() {
  if (process.env.CONVEX_CLOUD_URL !== "https://utmost-mongoose-374.convex.cloud") throw new ConvexError({ code: "CODEX_ACCESS_UNAVAILABLE", message: "Development connection unavailable." });
}
const accessUnavailable = () => new ConvexError({ code: "CODEX_ACCESS_UNAVAILABLE", message: "Connection unavailable." });

async function activeGrant(ctx: QueryCtx, grantId: Id<"usageGrants">, proof: DeviceProof, message: DeviceMessage) {
  developmentOnly();
  const grant = await ctx.db.get(grantId);
  if (!grant || grant.state !== "active" || grant.expiresAt <= Date.now() || !grant.publicKeyJson) throw accessUnavailable();
  try { await verifyDeviceProof({ key: devicePublicKeySchema.parse(JSON.parse(grant.publicKeyJson)), proof, message }); }
  catch { throw new ConvexError({ code: "CODEX_DEVICE_PROOF_INVALID", message: "Device proof unavailable." }); }
  const owner = await ctx.db.get(grant.userId), source = await ctx.db.get(grant.sourceId);
  if (!owner || !source || source.userId !== owner._id || source.erasing || source.currentGrantId !== grant._id || grant.expiresAt <= Date.now()) throw accessUnavailable();
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
  if (prior && (prior.context !== scope.context || prior.deviceDigest !== scope.deviceDigest)) throw new Error("Use a separate source for another device or work and personal history.");
  const sourceId = prior?._id ?? await ctx.db.insert("usageSources", { userId: owner._id, sourceKey: scope.sourceKey, deviceDigest: scope.deviceDigest,
    context: scope.context, retainOnDisconnect: scope.retainOnDisconnect });
  // Re-pairing revokes previous capabilities without removing authorized evidence.
  if (prior?.currentGrantId) await ctx.db.patch(prior.currentGrantId, { state: "revoked" });
  const grantId = await ctx.db.insert("usageGrants", { userId: owner._id, sourceId, scopeJson: canonicalJson(scope), codeDigest: args.codeDigest,
    deviceDigest: scope.deviceDigest, pairExpiresAt: Date.now() + 300_000, expiresAt: Date.parse(scope.expiresAt), state: "pending", sequence: 0 });
  await ctx.db.patch(sourceId, { currentGrantId: grantId, retainOnDisconnect: scope.retainOnDisconnect, snapshotRevision: (prior?.snapshotRevision ?? 0) + 1 });
  return grantId;
} });

export const exchange = mutation({ args: { code: v.string(), publicKeyJson: v.string(), issuedAt: v.string(), signature: v.string() }, handler: async (ctx, args) => {
  developmentOnly();
  secretSchema.parse(args.code);
  if (args.publicKeyJson.length > 1024) throw new Error("Pairing unavailable.");
  const key = devicePublicKeySchema.parse(JSON.parse(args.publicKeyJson));
  const grant = await ctx.db.query("usageGrants").withIndex("by_code", q => q.eq("codeDigest", digest(args.code))).unique();
  if (!grant || grant.state === "revoked" || grant.pairExpiresAt <= Date.now() || grant.expiresAt <= Date.now() || grant.deviceDigest !== deviceDigest(key)) throw new Error("Pairing unavailable.");
  await verifyDeviceProof({ key, proof: args, message: { operation: "pair", code: args.code } });
  const owner = await ctx.db.get(grant.userId), source = await ctx.db.get(grant.sourceId);
  if (!owner || !source || source.userId !== owner._id || source.erasing || source.currentGrantId !== grant._id
    || grant.pairExpiresAt <= Date.now() || grant.expiresAt <= Date.now()) throw new Error("Pairing unavailable.");
  if (grant.state === "pending") await ctx.db.patch(grant._id, { state: "active", publicKeyJson: canonicalJson(key) });
  else if (grant.publicKeyJson !== canonicalJson(key)) throw new Error("Pairing unavailable.");
  return { grantId: grant._id, scope: grantScopeSchema.parse(JSON.parse(grant.scopeJson)), sequence: grant.sequence };
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
    const prior = await ctx.db.query("usageEvidence").withIndex("by_source_key_fingerprint", q => q.eq("sourceId", grant.sourceId).eq("key", key).eq("fingerprint", fingerprint)).unique();
    if (!prior) await ctx.db.insert("usageEvidence", { sourceId: grant.sourceId, key, fingerprint, rowJson });
  }
  if (grant.expiresAt <= Date.now()) throw new Error("Connection unavailable.");
  const acceptedAt = new Date().toISOString();
  await ctx.db.insert("usageReceipts", { sourceId: grant.sourceId, grantId: grant._id, sequence: packet.sequence, packetId: id, acceptedAt });
  await ctx.db.patch(grant._id, { sequence: packet.sequence, lastSyncedAt: acceptedAt });
  const source = await ctx.db.get(grant.sourceId);
  await ctx.db.patch(grant.sourceId, { snapshotRevision: (source?.snapshotRevision ?? 0) + 1 });
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
  const source = await ctx.db.get(grant.sourceId);
  if (!source || source.userId !== owner._id) throw new Error("Connection unavailable.");
  if (source.currentGrantId) await ctx.db.patch(source.currentGrantId, { state: "revoked" });
  await ctx.db.patch(source._id, { currentGrantId: undefined, snapshotRevision: (source.snapshotRevision ?? 0) + 1 });
  if (!source.retainOnDisconnect) {
    await ctx.db.patch(grant.sourceId, { erasing: true });
    await ctx.scheduler.runAfter(0, eraseRef, { sourceId: grant.sourceId });
  }
  return { retained: source.retainOnDisconnect };
} });

// Bounded deletion may be repeated after disconnect until done. Revocation is immediate.
export const erase = mutation({ args: { grantId: v.id("usageGrants") }, handler: async (ctx, args) => {
  const owner = await requireUser(ctx), grant = await ctx.db.get(args.grantId);
  if (!grant || grant.userId !== owner._id || grant.state !== "revoked") throw new Error("Disconnect before erasing history.");
  const source = await ctx.db.get(grant.sourceId);
  if (!source || source.userId !== owner._id || source.currentGrantId) throw new Error("Disconnect current access before erasing history.");
  if (!source.erasing) await ctx.db.patch(grant.sourceId, { erasing: true, snapshotRevision: (source.snapshotRevision ?? 0) + 1 });
  const done = await eraseSourceBatch(ctx, source);
  if (!done) await ctx.scheduler.runAfter(0, eraseRef, { sourceId: source._id });
  return { done };
} });

async function eraseSourceBatch(ctx: MutationCtx, source: Doc<"usageSources">) {
  const rows = await ctx.db.query("usageEvidence").withIndex("by_source", q => q.eq("sourceId", source._id)).take(200);
  for (const row of rows) await ctx.db.delete(row._id);
  if (rows.length === 200) return false;
  const receipts = await ctx.db.query("usageReceipts").withIndex("by_source", q => q.eq("sourceId", source._id)).take(200);
  for (const receipt of receipts) await ctx.db.delete(receipt._id);
  if (receipts.length === 200) return false;
  // Retained private projections are copies of this source's counters. Leave
  // tombstones for replay protection, but remove their values and approvals.
  // Deliberately published snapshots have a separate owner unpublish boundary.
  const snapshots = await ctx.db.query("rawEvidence").withIndex("by_usage_source_deleted", q => q.eq("usageSourceId", source._id).eq("deletedAt", undefined)).take(200);
  for (const snapshot of snapshots) await ctx.db.patch(snapshot._id, { payload: undefined, measurementReview: undefined, deletedAt: new Date().toISOString() });
  if (snapshots.length === 200) return false;
  await ctx.db.patch(source._id, { erasing: false });
  return true;
}

export const eraseRevoked = internalMutation({ args: { sourceId: v.id("usageSources") }, handler: async (ctx, args) => {
  const source = await ctx.db.get(args.sourceId);
  if (!source?.erasing) return;
  if (source.currentGrantId) throw new Error("Cannot erase an active source.");
  if (!await eraseSourceBatch(ctx, source)) await ctx.scheduler.runAfter(0, eraseRef, { sourceId: source._id });
} });

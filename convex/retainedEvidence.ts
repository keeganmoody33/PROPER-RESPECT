import { v } from "convex/values";
import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { addManualProductHandler } from "./manualProducts";
import { sha256 } from "../src/domain/product-knowledge";
import { MEASUREMENT_LIMITS, measurementDigest, parseMeasurementImport, projectMeasurement, reviewMeasurementImports, type PublicMeasurement } from "../src/domain/measurements";
import { requireUser } from "./authHelpers";
import { ingestSignalsForOwner } from "./discovery";
import { verifyRetainedProductEvidence } from "../src/domain/retained-product-evidence";

/** Authenticated upload of retained originals, never a live provider connection. */
export const importPacket = mutation({
  args: { packet: v.any() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const packet = await verifyRetainedProductEvidence(args.packet);
    await ingestSignalsForOwner(ctx, {
      ownerId: user._id, sourceType: packet.sourceType,
      sourceKey: packet.sourceKey, sourceLabel: packet.sourceLabel,
      signals: [packet.signal],
    });
    const source = await ctx.db.query("evidenceSources").withIndex("by_user_type_sourceKey", q => q.eq("userId", user._id).eq("type", packet.sourceType).eq("sourceKey", packet.sourceKey)).unique();
    if (!source) throw new Error("Retained source unavailable.");
    const dedupKey = JSON.stringify(["source-v1", source._id, ["record", packet.signal.sourceRecordId]]);
    const raw = await ctx.db.query("rawEvidence").withIndex("by_dedup_key", q => q.eq("dedupKey", dedupKey)).unique();
    if (!raw || raw.userId !== user._id) throw new Error("Retained original unavailable.");
    const rawEvidenceId = raw._id;
    const duplicate = raw.retainedArtifact !== undefined;
    if (raw.deletedAt) throw new Error("This original was removed and cannot be restored by replay.");
    if (duplicate) {
      const original = raw.retainedArtifact!;
      // Preparing the same bytes again does not change the original receipt.
      if (original.sha256 !== packet.artifact.sha256 || original.kind !== packet.artifact.kind ||
          original.sourceCapturedDate !== packet.artifact.sourceCapturedDate || original.adapterVersion !== packet.artifact.adapterVersion) {
        throw new Error("Retained artifact provenance conflict.");
      }
    } else {
      await ctx.db.patch(rawEvidenceId, {
        retainedArtifact: packet.artifact, contentHash: packet.artifact.sha256,
        filename: packet.artifact.sourceFile, byteSize: packet.artifact.byteLength,
        suggestedActivity: packet.activity, limitations: packet.limitations,
      });
    }
    const draft = await ctx.db.query("draftImports").withIndex("by_user_slug", q => q.eq("userId", user._id).eq("suggestedProductSlug", packet.productSlug)).first();
    return { rawEvidenceId, propId: draft?.resultPropId ?? null, duplicate };
  },
});

// R27 shares the existing source, retained-original and relationship boundaries.
// Only the new exact measurement review is separate from old numeric claims.
async function ownedMeasurementProp(ctx: QueryCtx | MutationCtx, propId: Id<"props">) {
  const user = await requireUser(ctx);
  const prop = await ctx.db.get(propId);
  if (!prop || prop.userId !== user._id) throw new Error("Relationship unavailable.");
  return { user, prop };
}
async function measurementHistory(ctx: QueryCtx | MutationCtx, userId: Id<"users">, propId: Id<"props">) {
  const rows = await ctx.db.query("rawEvidence").withIndex("by_measurement_prop", q => q.eq("measurementPropId", propId)).take(MEASUREMENT_LIMITS.captures + 1);
  if (rows.length > MEASUREMENT_LIMITS.captures || rows.some(row => row.userId !== userId)) throw new Error("Measurement history unavailable.");
  return rows;
}
function measurementEntries(rows: Doc<"rawEvidence">[]) {
  const groups = new Map<string, Doc<"rawEvidence">[]>();
  for (const row of rows) {
    if (!row.measurementImport) continue;
    const key = `${row.measurementImport.adapter}:${row.measurementImport.sourceKey}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return [...groups.values()].flatMap(history => {
    const active = history.filter(row => !row.deletedAt && row.payload);
    const head = active.at(-1);
    if (!head) return [];
    const imports = active.map(row => {
      const parsed = parseMeasurementImport(row.payload!);
      if (parsed.digest !== row.measurementImport?.digest) throw new Error("Retained measurement integrity conflict.");
      return parsed;
    });
    const first = imports[0];
    const digest = measurementDigest(history.map(row => ({ id: row._id, digest: row.measurementImport?.digest, deletedAt: row.deletedAt })));
    const currentReview = head.measurementReview?.digest === digest ? head.measurementReview : undefined;
    return [{ rawEvidenceId: head._id, digest, capturedAt: imports.at(-1)!.capturedAt,
      adapter: first.adapter, source: first.source, measurements: reviewMeasurementImports(imports),
      reviewedMeasurementIds: currentReview?.measurementIds ?? [], reviewVersion: head.measurementReview?.version ?? 0,
      captureCount: active.length }];
  });
}

export const importMeasurements = mutation({
  args: {
    propId: v.optional(v.id("props")), text: v.string(), productName: v.optional(v.string()), website: v.optional(v.string()),
    expectedSource: v.optional(v.union(v.literal("claude-code"), v.literal("codex"), v.literal("metric-packet"))),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const parsed = parseMeasurementImport(args.text);
    if (args.expectedSource && args.expectedSource !== parsed.adapter) throw new Error("This file belongs to a different measurement source. Choose its matching import option.");
    // Validate before creating the first relationship. Convex commits this whole
    // mutation atomically, including replay and history-bound checks below.
    const name = parsed.adapter === "claude-code" ? "Claude Code" : parsed.adapter === "codex" ? "Codex" : args.productName;
    if (!args.propId && !name) throw new Error("Name the product these measurements support.");
    const propId = args.propId ?? await addManualProductHandler(ctx, {
      name: name!, ...(parsed.adapter === "metric-packet" && args.website ? { website: args.website } : {}),
      operationId: `measurement:${measurementDigest([name, args.website ?? null, parsed.sourceKey])}`,
    });
    const { prop } = await ownedMeasurementProp(ctx, propId);
    const product = await ctx.db.get(prop.productId);
    if (!product) throw new Error("Product unavailable.");
    if ((parsed.adapter === "claude-code" && product.slug !== "claude-code") || (parsed.adapter === "codex" && product.slug !== "codex")) throw new Error("Attach this native capture to its matching product.");
    const dedupKey = canonicalMeasurementIdentity(user._id, propId, parsed.adapter, parsed.sourceKey, parsed.captureId);
    const previous = await ctx.db.query("rawEvidence").withIndex("by_dedup_key", q => q.eq("dedupKey", dedupKey)).unique();
    if (previous) {
      if (previous.userId !== user._id || previous.measurementPropId !== propId) throw new Error("Measurement unavailable.");
      if (previous.deletedAt) throw new Error("This original was removed and cannot be restored by replay.");
      if (previous.measurementImport?.digest !== parsed.digest) throw new Error("Measurement capture identity conflict; the original is unchanged.");
      return { propId, rawEvidenceId: previous._id, duplicate: true };
    }
    const history = await measurementHistory(ctx, user._id, propId);
    const totalBytes = history.reduce((sum, row) => sum + new TextEncoder().encode(row.payload ?? "").length, new TextEncoder().encode(args.text).length);
    if (history.length >= MEASUREMENT_LIMITS.captures || totalBytes > MEASUREMENT_LIMITS.retainedBytes) throw new Error("This relationship has reached the bounded measurement history limit. Existing originals remain available.");
    // Reconciliation checks the full source history before any write. Conflicting
    // Claude streams remain reviewable as quarantined rows, never publishable.
    reviewMeasurementImports([...history.filter(row => !row.deletedAt && row.payload && row.measurementImport?.adapter === parsed.adapter && row.measurementImport.sourceKey === parsed.sourceKey).map(row => parseMeasurementImport(row.payload!)), parsed]);
    const sourceKey = `measurement:${propId}:${parsed.sourceKey}`;
    const source = await ctx.db.query("evidenceSources").withIndex("by_user_type_sourceKey", q => q.eq("userId", user._id).eq("type", "FILE_UPLOAD").eq("sourceKey", sourceKey)).unique();
    const now = new Date().toISOString();
    const evidenceSourceId = source?._id ?? await ctx.db.insert("evidenceSources", {
      userId: user._id, type: "FILE_UPLOAD", sourceKey, provider: "SANITIZED_MEASUREMENTS",
      label: `${parsed.source.namespace} · owner-supplied sanitized measurements`, connectedAt: now,
    });
    const contentHash = await sha256(args.text);
    const rawEvidenceId = await ctx.db.insert("rawEvidence", {
      userId: user._id, evidenceSourceId, measurementPropId: propId, payload: args.text, contentHash,
      capturedAt: parsed.capturedAt, dedupKey, sourceRecordId: parsed.captureId, mimeType: "application/json", byteSize: new TextEncoder().encode(args.text).length,
      measurementImport: { adapter: parsed.adapter, sourceKey: parsed.sourceKey, captureId: parsed.captureId, digest: parsed.digest },
      captureProvenance: { version: 1, route: "UPLOAD", adapter: { id: "sanitized-measurements", version: "1" },
        origin: { issuer: "OWNER_SUPPLIED_SANITIZED_EXPORT", recordId: parsed.captureId, artifactRef: `sha256:${contentHash}` },
        collector: { kind: "UNKNOWN" }, activityActor: { kind: "UNKNOWN" } },
      limitations: ["Owner-supplied source aliases do not authenticate an account or establish human activity.", "Exact source units and periods are retained. Unknown values are not zero; overlapping views are not added."],
    });
    await ctx.db.insert("proofs", { propId, type: "FILE_UPLOAD", rawEvidenceId, label: "Sanitized exact measurements" });
    return { propId, rawEvidenceId, duplicate: false };
  },
});
function canonicalMeasurementIdentity(userId: Id<"users">, propId: Id<"props">, adapter: string, sourceKey: string, captureId: string) {
  return `measurement-v1:${measurementDigest([userId, propId, adapter, sourceKey, captureId])}`;
}

export const measurements = query({
  args: { propId: v.id("props") },
  handler: async (ctx, { propId }) => {
    const { user } = await ownedMeasurementProp(ctx, propId);
    return measurementEntries(await measurementHistory(ctx, user._id, propId));
  },
});

export const reviewMeasurements = mutation({
  args: { propId: v.id("props"), rawEvidenceId: v.id("rawEvidence"), expectedDigest: v.string(), expectedReviewVersion: v.number(), measurementIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const { user } = await ownedMeasurementProp(ctx, args.propId);
    if (!Number.isSafeInteger(args.expectedReviewVersion) || args.expectedReviewVersion < 0 || args.measurementIds.length > MEASUREMENT_LIMITS.publicRows || new Set(args.measurementIds).size !== args.measurementIds.length) throw new Error("Review at most 24 distinct measurement rows.");
    const entry = measurementEntries(await measurementHistory(ctx, user._id, args.propId)).find(item => item.rawEvidenceId === args.rawEvidenceId);
    if (!entry) throw new Error("Measurement unavailable.");
    if (entry.digest !== args.expectedDigest) throw new Error("These measurements changed. Open a fresh review.");
    const ids = [...args.measurementIds].sort();
    const allowed = new Set(entry.measurements.filter(row => row.status !== "conflict").map(row => row.id));
    if (ids.some(id => !allowed.has(id))) throw new Error("Review only available non-conflicting measurements.");
    if (entry.reviewVersion === args.expectedReviewVersion + 1 && measurementDigest(entry.reviewedMeasurementIds) === measurementDigest(ids)) return { version: entry.reviewVersion, duplicate: true };
    if (entry.reviewVersion !== args.expectedReviewVersion) throw new Error("This measurement review changed. Reload before reviewing again.");
    const version = entry.reviewVersion + 1;
    await ctx.db.patch(entry.rawEvidenceId, { measurementReview: { digest: entry.digest, measurementIds: ids, version } });
    await ctx.db.insert("measurementReviews", { userId: user._id, propId: args.propId, rawEvidenceId: entry.rawEvidenceId, digest: entry.digest, measurementIds: ids, version, reviewedAt: new Date().toISOString() });
    // Reviewing is private. Only the existing preview-and-publish mutation writes public snapshots.
    return { version, duplicate: false };
  },
});

/** Used by both publication preview and commit, never trusting client projections. */
export async function reviewedMeasurementsForPublication(ctx: QueryCtx | MutationCtx, userId: Id<"users">, propId: Id<"props">, evidenceIds: Id<"rawEvidence">[]): Promise<{ measurements: PublicMeasurement[]; approvalDigest: string } | undefined> {
  if (!evidenceIds.length) return undefined;
  if (evidenceIds.length > MEASUREMENT_LIMITS.publicSources || new Set(evidenceIds).size !== evidenceIds.length) throw new Error("Choose at most eight distinct reviewed measurement sources.");
  const entries = measurementEntries(await measurementHistory(ctx, userId, propId));
  const approvals: { id: Id<"rawEvidence">; digest: string; reviewVersion: number }[] = [];
  const projected = evidenceIds.flatMap(id => {
    const entry = entries.find(item => item.rawEvidenceId === id);
    if (!entry || !entry.reviewedMeasurementIds.length) throw new Error("Open a current measurement review before sharing this source.");
    approvals.push({ id, digest: entry.digest, reviewVersion: entry.reviewVersion });
    const reviewed = new Set(entry.reviewedMeasurementIds);
    return entry.measurements.filter(row => reviewed.has(row.id)).map(projectMeasurement);
  });
  if (projected.length > MEASUREMENT_LIMITS.publicRows) throw new Error("Share at most 24 measurement rows on a card.");
  return { measurements: projected, approvalDigest: measurementDigest(approvals) };
}

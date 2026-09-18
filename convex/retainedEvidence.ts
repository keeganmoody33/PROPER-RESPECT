import { v } from "convex/values";
import { mutation } from "./_generated/server";
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

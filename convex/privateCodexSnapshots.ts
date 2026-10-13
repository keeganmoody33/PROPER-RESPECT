import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./authHelpers";
import { privateCodexSnapshotSchema, retainPrivateCodexSnapshot } from "../src/domain/private-codex-snapshot";

const count = v.union(v.string(), v.null());
const keptValidator = v.object({
  snapshotId: v.id("rawEvidence"),
  visibility: v.literal("private"),
  replayed: v.boolean(),
});
const readValidator = v.object({
  visibility: v.literal("private"),
  format: v.literal("codex-history-window-v1"),
  totalTokens: v.string(),
  start: v.string(),
  end: v.string(),
});

/** Keeps one derived Codex window for the signed-in owner. This does not publish or read a provider. */
export const keep = mutation({
  args: {
    sourceKey: v.string(),
    context: v.union(v.literal("personal"), v.literal("work"), v.literal("unclassified")),
    capturedAt: v.string(),
    start: v.string(),
    end: v.string(),
    rows: v.array(v.object({
      kind: v.literal("response"),
      thread: v.string(),
      response: v.string(),
      at: v.string(),
      status: v.union(v.literal("measured"), v.literal("conflict")),
      counts: v.object({
        input_tokens: count,
        cached_input_tokens: count,
        output_tokens: count,
        reasoning_output_tokens: count,
        total_tokens: count,
        cache_write_input_tokens: count,
      }),
    })),
  },
  returns: keptValidator,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const snapshot = retainPrivateCodexSnapshot({ ownerId: user._id, ...args });
    const dedupKey = `private-codex-snapshot-v1:${snapshot.identity}`;
    const previous = await ctx.db.query("rawEvidence").withIndex("by_dedup_key", (q) => q.eq("dedupKey", dedupKey)).unique();
    if (previous) {
      if (previous.userId !== user._id || !previous.payload) throw new Error("Snapshot unavailable.");
      if (previous.deletedAt) throw new Error("This original was removed and cannot be restored by replay.");
      return { snapshotId: previous._id, visibility: "private" as const, replayed: true };
    }
    const sourceKey = `codex-private-snapshot:${args.sourceKey}`;
    const source = await ctx.db.query("evidenceSources").withIndex("by_user_type_sourceKey", (q) => q.eq("userId", user._id).eq("type", "FILE_UPLOAD").eq("sourceKey", sourceKey)).unique();
    const evidenceSourceId = source?._id ?? await ctx.db.insert("evidenceSources", {
      userId: user._id,
      type: "FILE_UPLOAD",
      sourceKey,
      provider: "CODEX_PRIVATE_SNAPSHOT",
      label: "Private Codex usage snapshot",
      connectedAt: snapshot.start,
    });
    const payload = JSON.stringify({
      format: snapshot.format,
      visibility: snapshot.visibility,
      start: snapshot.start,
      end: snapshot.end,
      totalTokens: snapshot.totalTokens,
      responseCount: snapshot.responseCount,
    });
    const snapshotId = await ctx.db.insert("rawEvidence", {
      userId: user._id,
      evidenceSourceId,
      payload,
      capturedAt: args.capturedAt,
      dedupKey,
      contentHash: snapshot.identity,
      mimeType: "application/json",
      byteSize: new TextEncoder().encode(payload).length,
      limitations: ["This Codex usage snapshot stays private until a separate publication. It is not a provider read."],
    });
    return { snapshotId, visibility: "private" as const, replayed: false };
  },
});

export const read = query({
  args: { snapshotId: v.id("rawEvidence") },
  returns: readValidator,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const row = await ctx.db.get(args.snapshotId);
    if (!row || row.userId !== user._id || !row.payload || row.deletedAt || !row.dedupKey.startsWith("private-codex-snapshot-v1:")) {
      throw new Error("Snapshot unavailable.");
    }
    const snapshot = privateCodexSnapshotSchema.parse(JSON.parse(row.payload));
    return {
      visibility: snapshot.visibility,
      format: snapshot.format,
      totalTokens: snapshot.totalTokens,
      start: snapshot.start,
      end: snapshot.end,
    };
  },
});

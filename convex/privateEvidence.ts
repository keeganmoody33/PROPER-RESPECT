import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireUser } from "./authHelpers";
import { evidenceObservationValidator } from "./validators";
import {
  canonicalPrivateEvidence,
  parsePrivateEvidence,
  privateEvidenceIdentity,
} from "../src/domain/private-evidence";

async function ownedProp(ctx: QueryCtx, propId: Id<"props">) {
  const user = await requireUser(ctx);
  const prop = await ctx.db.get(propId);
  if (!prop || prop.userId !== user._id)
    throw new Error("Evidence unavailable.");
  return { user, prop };
}
async function ownedEvidence(
  ctx: QueryCtx,
  propId: Id<"props">,
  rawEvidenceId: Id<"rawEvidence">,
) {
  const { user } = await ownedProp(ctx, propId);
  const raw = await ctx.db.get(rawEvidenceId);
  const proof = await ctx.db
    .query("proofs")
    .withIndex("by_propId_and_rawEvidenceId", (q) =>
      q.eq("propId", propId).eq("rawEvidenceId", rawEvidenceId),
    )
    .first();
  if (!raw || raw.userId !== user._id || raw.deletedAt || !proof)
    throw new Error("Evidence unavailable.");
  return raw;
}
export const submit = mutation({
  args: {
    propId: v.id("props"),
    payload: v.string(),
    sourceUrl: v.optional(v.string()),
    observations: v.array(evidenceObservationValidator),
  },
  handler: async (ctx, { propId, ...input }) => {
    const { user } = await ownedProp(ctx, propId);
    const parsed = parsePrivateEvidence(input);
    const contentHash = privateEvidenceIdentity(parsed);
    const dedupKey = `owner-evidence:${user._id}:${propId}:${contentHash}`;
    const existing = await ctx.db
      .query("rawEvidence")
      .withIndex("by_dedup_key", (q) => q.eq("dedupKey", dedupKey))
      .unique();
    if (existing) {
      if (existing.deletedAt)
        throw new Error(
          "This evidence was deleted. Supply a new original to create new evidence.",
        );
      const original = {
        payload: existing.payload ?? "",
        sourceUrl: existing.sourceUrl,
        observations: existing.observations ?? [],
      };
      if (
        existing.userId !== user._id ||
        canonicalPrivateEvidence(original) !== canonicalPrivateEvidence(parsed)
      )
        throw new Error("Evidence identity collision; original preserved.");
      await ownedEvidence(ctx, propId, existing._id);
      return { rawEvidenceId: existing._id, duplicate: true };
    }
    const capturedAt = new Date().toISOString();
    const source = await ctx.db
      .query("evidenceSources")
      .withIndex("by_user_type", (q) =>
        q.eq("userId", user._id).eq("type", "MANUAL"),
      )
      .filter((q) => q.eq(q.field("provider"), "OWNER_SELECTED_TEXT"))
      .first();
    const evidenceSourceId =
      source?._id ??
      (await ctx.db.insert("evidenceSources", {
        userId: user._id,
        type: "MANUAL",
        provider: "OWNER_SELECTED_TEXT",
        label: "Owner-selected copied text or manual transcription",
        connectedAt: capturedAt,
      }));
    const rawEvidenceId = await ctx.db.insert("rawEvidence", {
      userId: user._id,
      evidenceSourceId,
      ...parsed,
      contentHash,
      capturedAt,
      dedupKey,
    });
    await ctx.db.insert("proofs", {
      propId,
      type: "NOTE",
      rawEvidenceId,
      label: "Private owner-supplied text evidence",
    });
    return { rawEvidenceId, duplicate: false };
  },
});

export const listForProp = query({
  args: { propId: v.id("props"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { propId, paginationOpts }) => {
    const { user } = await ownedProp(ctx, propId);
    const result = await ctx.db
      .query("proofs")
      .withIndex("by_prop", (q) => q.eq("propId", propId))
      .order("desc")
      .paginate(paginationOpts);
    const page = await Promise.all(
      result.page.map(async (proof) => {
        if (!proof.rawEvidenceId) return null;
        const raw = await ctx.db.get(proof.rawEvidenceId);
        if (!raw || raw.userId !== user._id || raw.deletedAt) return null;
        const source = await ctx.db.get(raw.evidenceSourceId);
        const claims = await Promise.all(
          (raw.observations ?? []).map(
            async (observation, observationIndex) => {
              const review = await ctx.db
                .query("claimReviews")
                .withIndex(
                  "by_prop_and_rawEvidenceId_and_observationIndex",
                  (q) =>
                    q
                      .eq("propId", propId)
                      .eq("rawEvidenceId", raw._id)
                      .eq("observationIndex", observationIndex),
                )
                .order("desc")
                .first();
              return {
                rawEvidenceId: raw._id,
                observationIndex,
                observation,
                review: review?.userId === user._id ? review : null,
              };
            },
          ),
        );
        return {
          raw,
          source: source?.userId === user._id ? source : null,
          claims,
        };
      }),
    );
    return { ...result, page: page.filter((row) => row !== null) };
  },
});

export const history = query({
  args: {
    propId: v.id("props"),
    rawEvidenceId: v.id("rawEvidence"),
    observationIndex: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (
    ctx,
    { propId, rawEvidenceId, observationIndex, paginationOpts },
  ) => {
    const raw = await ownedEvidence(ctx, propId, rawEvidenceId);
    if (
      !Number.isInteger(observationIndex) ||
      observationIndex < 0 ||
      !raw.observations?.[observationIndex]
    )
      throw new Error("Evidence unavailable.");
    return await ctx.db
      .query("claimReviews")
      .withIndex("by_prop_and_rawEvidenceId_and_observationIndex", (q) =>
        q
          .eq("propId", propId)
          .eq("rawEvidenceId", rawEvidenceId)
          .eq("observationIndex", observationIndex),
      )
      .order("desc")
      .paginate(paginationOpts);
  },
});

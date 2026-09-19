import { paginationOptsValidator, type PaginationOptions } from "convex/server";
import { v } from "convex/values";
import { query, mutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireUser } from "./authHelpers";
import { PROOF_TYPE_BY_SOURCE } from "./discovery";
import { canonicalJson } from "../src/domain/canonical-json";
import { sha256 } from "../src/domain/product-knowledge";
import { isRelationshipConfirmed } from "../src/domain/inventory";

type Context = QueryCtx | MutationCtx;
const chunkSize = 100;

function pageOptions(options: PaginationOptions) {
  if (!Number.isSafeInteger(options.numItems) || options.numItems < 1) throw new Error("Invalid page size.");
  return { ...options, numItems: Math.min(options.numItems, 10), maximumRowsRead: 25 };
}

function inProgress(draft: Doc<"draftImports">) {
  return Boolean(draft.evidenceResolution && draft.evidenceResolution.nextOffset < draft.evidenceResolution.rawEvidenceIds.length);
}

async function ownedDraft(ctx: Context, draftId: Id<"draftImports">) {
  const user = await requireUser(ctx);
  const draft = await ctx.db.get(draftId);
  if (!draft || draft.userId !== user._id || ["REJECTED", "SUPERSEDED"].includes(draft.status)) throw new Error("Discovery unavailable.");
  if (!draft.evidenceResolution && (draft.status !== "PENDING" || draft.resultPropId)) throw new Error("Discovery unavailable.");
  const product = await ctx.db.query("products").withIndex("by_slug", q => q.eq("slug", draft.suggestedProductSlug)).unique();
  if (!product || product.domain.trim().toLowerCase() !== draft.suggestedDomain.trim().toLowerCase()) throw new Error("Discovery product identity changed.");
  const resolution = draft.evidenceResolution;
  if (resolution && (draft.resultPropId !== resolution.targetPropId || !Number.isSafeInteger(resolution.nextOffset) || resolution.nextOffset < 0 || resolution.nextOffset > resolution.rawEvidenceIds.length)) throw new Error("Discovery resolution unavailable.");
  return { user, draft, product };
}

async function candidate(ctx: Context, draft: Doc<"draftImports">, product: Doc<"products">, propId: Id<"props">) {
  const prop = await ctx.db.get(propId);
  if (!prop || prop.userId !== draft.userId || prop.productId !== product._id) throw new Error("Relationship unavailable.");
  return prop;
}

async function evidenceChunk(ctx: Context, draft: Doc<"draftImports">) {
  const ids = draft.evidenceResolution?.rawEvidenceIds ?? [...new Set(draft.rawEvidenceIds)];
  const offset = draft.evidenceResolution?.nextOffset ?? 0;
  const entries = [];
  for (const id of ids.slice(offset, offset + chunkSize)) {
    const raw = await ctx.db.get(id);
    if (!raw || raw.userId !== draft.userId) throw new Error("Evidence unavailable.");
    const source = await ctx.db.get(raw.evidenceSourceId);
    if (!source || source.userId !== draft.userId) throw new Error("Evidence unavailable.");
    entries.push({ raw, source });
  }
  return { ids, offset, entries };
}

type Chunk = Awaited<ReturnType<typeof evidenceChunk>>;

async function expectation(draft: Doc<"draftImports">, product: Doc<"products">, prop: Doc<"props">, chunk: Chunk) {
  return sha256(canonicalJson({
    draftId: draft._id, ownerId: draft.userId, status: draft.status,
    product: { id: product._id, slug: product.slug, domain: product.domain },
    prop, ids: chunk.ids, offset: chunk.offset,
    sources: chunk.entries.map(({ raw, source }) => ({
      id: raw._id, sourceId: source._id, ownerId: raw.userId, sourceOwnerId: source.userId,
      sourceType: source.type, sourceLabel: source.label, capturedAt: raw.capturedAt, deletedAt: raw.deletedAt,
    })),
  }));
}

function relationship(prop: Doc<"props">) {
  return { id: prop._id, headline: prop.headline, note: prop.note, status: prop.status, confirmed: isRelationshipConfirmed(prop), goTo: prop.goTo ?? false };
}

function progress(draft: Doc<"draftImports">) {
  const resolution = draft.evidenceResolution;
  return resolution ? { processed: resolution.nextOffset, total: resolution.rawEvidenceIds.length, skippedDeleted: resolution.skippedDeleted } : undefined;
}

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const user = await requireUser(ctx);
    const result = await ctx.db.query("draftImports").withIndex("by_user_slug", q => q.eq("userId", user._id)).paginate(pageOptions(paginationOpts));
    const page = [];
    for (const draft of result.page) {
      if (["REJECTED", "SUPERSEDED"].includes(draft.status)) continue;
      if (!inProgress(draft) && !(draft.status === "PENDING" && !draft.resultPropId)) continue;
      const product = await ctx.db.query("products").withIndex("by_slug", q => q.eq("slug", draft.suggestedProductSlug)).unique();
      const identityIssue = !product || product.domain.trim().toLowerCase() !== draft.suggestedDomain.trim().toLowerCase()
        ? "The canonical product identity is unavailable or changed. Resolve the product identity before attaching originals." : undefined;
      page.push({ id: draft._id, name: draft.suggestedProductName, slug: draft.suggestedProductSlug, domain: draft.suggestedDomain, evidenceCount: new Set(draft.rawEvidenceIds).size, progress: progress(draft), identityIssue });
    }
    return { ...result, page };
  },
});

export const candidates = query({
  args: { draftId: v.id("draftImports"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { draftId, paginationOpts }) => {
    const { user, draft, product } = await ownedDraft(ctx, draftId);
    if (draft.evidenceResolution) return { page: [], isDone: true, continueCursor: "" };
    const chunk = await evidenceChunk(ctx, draft);
    const result = await ctx.db.query("props").withIndex("by_user_product", q => q.eq("userId", user._id).eq("productId", product._id)).paginate(pageOptions(paginationOpts));
    return { ...result, page: await Promise.all(result.page.map(async prop => ({ ...relationship(prop), expectedHash: await expectation(draft, product, prop, chunk) }))) };
  },
});

export const details = query({
  args: { draftId: v.id("draftImports") },
  handler: async (ctx, { draftId }) => {
    const { draft, product } = await ownedDraft(ctx, draftId);
    const chunk = await evidenceChunk(ctx, draft);
    const prop = draft.evidenceResolution ? await candidate(ctx, draft, product, draft.evidenceResolution.targetPropId) : null;
    return {
      id: draft._id, name: draft.suggestedProductName,
      sources: chunk.entries.map(({ raw, source }) => ({ id: raw._id, sourceType: source.type, ...(source.label ? { sourceLabel: source.label } : {}), capturedAt: raw.capturedAt, deleted: Boolean(raw.deletedAt) })),
      batch: { offset: chunk.offset, end: chunk.offset + chunk.entries.length, total: chunk.ids.length, skippedDeleted: draft.evidenceResolution?.skippedDeleted ?? 0 },
      target: prop ? relationship(prop) : null,
      expectedHash: prop ? await expectation(draft, product, prop, chunk) : undefined,
    };
  },
});

export const attach = mutation({
  args: { draftId: v.id("draftImports"), propId: v.id("props"), expectedHash: v.string() },
  handler: async (ctx, { draftId, propId, expectedHash }) => {
    const { draft, product } = await ownedDraft(ctx, draftId);
    const existing = draft.evidenceResolution;
    if (existing && existing.targetPropId !== propId) throw new Error("This discovery was already assigned to a different relationship.");
    const prop = await candidate(ctx, draft, product, propId);
    if (existing?.appliedHashes.includes(expectedHash)) return { duplicate: true, ...progress(draft)! };
    const chunk = await evidenceChunk(ctx, draft);
    if (existing && chunk.offset === chunk.ids.length) throw new Error("This evidence attachment is already complete.");
    if (expectedHash !== await expectation(draft, product, prop, chunk)) throw new Error("This discovery or relationship changed. Review the current information before attaching.");
    let skippedDeleted = existing?.skippedDeleted ?? 0;
    for (const { raw, source } of chunk.entries) {
      if (raw.deletedAt) { skippedDeleted++; continue; }
      const proof = await ctx.db.query("proofs").withIndex("by_propId_and_rawEvidenceId", q => q.eq("propId", propId).eq("rawEvidenceId", raw._id)).first();
      const type = PROOF_TYPE_BY_SOURCE[source.type];
      if (!type) throw new Error("Evidence source type unavailable.");
      if (!proof) await ctx.db.insert("proofs", { propId, rawEvidenceId: raw._id, type });
    }
    const nextOffset = chunk.offset + chunk.entries.length;
    await ctx.db.patch(draftId, { resultPropId: propId, evidenceResolution: {
      targetPropId: propId, rawEvidenceIds: chunk.ids, nextOffset, skippedDeleted,
      startedAt: existing?.startedAt ?? new Date().toISOString(),
      appliedHashes: [...(existing?.appliedHashes ?? []), expectedHash],
    } });
    return { duplicate: false, processed: nextOffset, total: chunk.ids.length, skippedDeleted };
  },
});

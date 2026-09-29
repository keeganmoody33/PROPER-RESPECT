import { relationshipLinks } from "./relationshipLinks";
import { uploadAttributionStatus } from "../src/domain/evidence-upload";
import { paginationOptsValidator, type PaginationOptions } from "convex/server";
import { v } from "convex/values";
import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireUser } from "./authHelpers";
import { retainedProductBrand } from "./productBrands";
import { readPublishedProfile } from "./publicProfiles";
import { statusValidator } from "./validators";
import { isRelationshipConfirmed, relationshipEditSchema } from "../src/domain/inventory";
import { associatedAccountEvidenceForProp, rankAccountEvidence } from "./associatedAccountEvidence";
import { privateCardPrimaryLink } from "../src/domain/product-destination";
import type { RankedAccountEvidence } from "../src/domain/account-evidence";

async function ownedProp(ctx: QueryCtx | MutationCtx, propId: Id<"props">) {
  const user = await requireUser(ctx);
  const prop = await ctx.db.get(propId);
  if (!prop || prop.userId !== user._id) throw new Error("Relationship unavailable.");
  return { user, prop };
}
function relationshipState(prop: Doc<"props">) {
  return { status: prop.status, goTo: prop.goTo ?? false,
    confirmed: isRelationshipConfirmed(prop),
    headline: prop.headline, note: prop.note, startedAt: prop.startedAt,
    supportingUrl: prop.supportingUrl, activityEvidenceId: prop.activityEvidenceId };
}

function boundedPage(options: PaginationOptions, maximum: number) {
  if (!Number.isSafeInteger(options.numItems) || options.numItems < 1) throw new Error("Invalid page size.");
  return { ...options, numItems: Math.min(options.numItems, maximum), maximumRowsRead: maximum };
}

async function evidenceEntry(ctx: QueryCtx, userId: Id<"users">, rawEvidenceId: Id<"rawEvidence">) {
  const raw = await ctx.db.get(rawEvidenceId);
  if (!raw || raw.userId !== userId || raw.deletedAt) return null;
  const source = await ctx.db.get(raw.evidenceSourceId);
  if (!source || source.userId !== userId) return null;
  const ownerReview = raw.retainedArtifact?.kind === "WISPR_OWNER_REVIEW" && raw.payload
    ? JSON.parse(raw.payload) as { answer?: string; question?: string } : undefined;
  return { id: raw._id, capturedAt: raw.capturedAt, sourceType: source.type,
    sourceLabel: source.label ?? source.type, captureProvenance: raw.captureProvenance,
    artifact: raw.retainedArtifact, limitations: raw.limitations ?? [],
    suggestedActivity: raw.suggestedActivity, ownerStatement: ownerReview?.answer,
    ownerStatementQuestion: ownerReview?.question, observationCount: raw.observations?.length ?? 0,
    originalText: raw.payload,
    ...(raw.storageId ? { uploadedFile: { attribution: uploadAttributionStatus(raw.uploadAttribution), filename: raw.filename, mimeType: raw.mimeType, byteSize: raw.byteSize } } : {}) };
}

export const save = mutation({
  args: {
    propId: v.id("props"), operationId: v.string(), expectedVersion: v.number(),
    status: statusValidator, goTo: v.boolean(), headline: v.string(), note: v.string(),
    startedAt: v.optional(v.string()), supportingUrl: v.optional(v.string()),
    activityEvidenceId: v.optional(v.id("rawEvidence")),
    clearActivity: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { user, prop } = await ownedProp(ctx, args.propId);
    if (!args.operationId.trim() || args.operationId.length > 128 || !Number.isSafeInteger(args.expectedVersion) || args.expectedVersion < 0) throw new Error("Invalid save operation.");
    if (args.clearActivity && args.activityEvidenceId) throw new Error("Choose a supporting snapshot or remove it, not both.");
    const edit = relationshipEditSchema.parse(args);
    const requestJson = JSON.stringify({ ...edit, expectedVersion: args.expectedVersion, activityEvidenceId: args.activityEvidenceId, ...(args.clearActivity ? { clearActivity: true } : {}) });
    const previous = await ctx.db.query("relationshipEvents")
      .withIndex("by_prop_operation", q => q.eq("propId", prop._id).eq("operationId", args.operationId)).unique();
    if (previous) {
      if (previous.requestJson !== requestJson) throw new Error("This save operation was already used with different decisions.");
      return { version: previous.version, duplicate: true };
    }
    if ((prop.relationshipVersion ?? 0) !== args.expectedVersion) throw new Error("This relationship changed. Reload its saved decisions before trying again.");
    let activity = args.clearActivity ? undefined : prop.activity;
    if (args.activityEvidenceId) {
      const raw = await ctx.db.get(args.activityEvidenceId);
      const proof = await ctx.db.query("proofs").withIndex("by_propId_and_rawEvidenceId", q => q.eq("propId", prop._id).eq("rawEvidenceId", args.activityEvidenceId)).first();
      if (!raw || raw.userId !== user._id || raw.deletedAt || !proof || !raw.suggestedActivity) throw new Error("Supporting activity unavailable.");
      activity = raw.suggestedActivity;
    }
    const now = new Date().toISOString();
    const version = (prop.relationshipVersion ?? 0) + 1;
    const activityEvidenceId = args.clearActivity ? undefined : args.activityEvidenceId ?? prop.activityEvidenceId;
    await ctx.db.insert("relationshipEvents", {
      userId: user._id, propId: prop._id, operationId: args.operationId, requestJson, version,
      recordedAt: now, basis: "OWNER_ASSERTED", before: relationshipState(prop),
      after: { ...edit, confirmed: true, activityEvidenceId },
    });
    await ctx.db.patch(prop._id, {
      ...edit, activity, activityEvidenceId, relationshipVersion: version,
      startedAt: edit.startedAt, supportingUrl: edit.supportingUrl,
      startedAtSource: edit.startedAt ? (edit.startedAt === prop.startedAt ? prop.startedAtSource ?? "USER_CONFIRMED" : "USER_CONFIRMED") : undefined,
      confirmedAt: prop.confirmedAt ?? now,
      visibility: prop.visibility === "DRAFT" ? "PRIVATE" : prop.visibility,
    });
    const product = await ctx.db.get(prop.productId);
    if (product) {
      const drafts = await ctx.db.query("draftImports").withIndex("by_user_slug", q => q.eq("userId", user._id).eq("suggestedProductSlug", product.slug)).collect();
      for (const draft of drafts) if (draft.resultPropId === prop._id && draft.status === "PENDING") await ctx.db.patch(draft._id, { status: "APPROVED" });
    }
    // Private saving never writes a published projection or enables collection.
    return { version, duplicate: false };
  },
});

export const list = query({
  args: { paginationOpts: paginationOptsValidator, includeAccountEvidence: v.optional(v.boolean()) },
  handler: async (ctx, { paginationOpts, includeAccountEvidence }) => {
    const user = await requireUser(ctx);
    const result = await ctx.db.query("props").withIndex("by_user", q => q.eq("userId", user._id)).paginate(boundedPage(paginationOpts, 25));
    const page = await Promise.all(result.page.map(async prop => {
      const product = await ctx.db.get(prop.productId);
      if (!product) throw new Error("Product unavailable.");
      const brand = await retainedProductBrand(ctx, product);
      const links = await relationshipLinks(ctx, prop._id);
      const latestEvent = await ctx.db.query("relationshipEvents").withIndex("by_prop", q => q.eq("propId", prop._id)).order("desc").first();
      const associatedAccountEvidence = includeAccountEvidence === false ? [] : await associatedAccountEvidenceForProp(ctx, user._id, prop._id, product.slug);
      return { prop, product: { ...product, brand }, links, associatedAccountEvidence,
        // Only the immediately preceding decision is needed by the History view.
        // Full append-only history is read separately when the card is opened.
        previousStatuses: latestEvent?.before.confirmed ? [latestEvent.before.status] : [],
      };
    }));
    return { ...result, page };
  },
});

function locatorRow(prop: Doc<"props">, product: Doc<"products">) {
  return { propId: prop._id, productId: product._id, name: product.name, domain: product.domain,
    status: prop.status, confirmed: isRelationshipConfirmed(prop), goTo: prop.goTo ?? false,
    headline: prop.headline };
}

export const locator = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const user = await requireUser(ctx);
    const result = await ctx.db.query("props").withIndex("by_user", q => q.eq("userId", user._id))
      .paginate(boundedPage(paginationOpts, 25));
    const page = await Promise.all(result.page.map(async prop => {
      const product = await ctx.db.get(prop.productId);
      return product ? locatorRow(prop, product) : null;
    }));
    return { ...result, page: page.filter(row => row !== null) };
  },
});

export const detail = query({
  args: { propId: v.string() },
  handler: async (ctx, { propId }) => {
    const user = await requireUser(ctx);
    const id = ctx.db.normalizeId("props", propId);
    const prop = id ? await ctx.db.get(id) : null;
    if (!prop || prop.userId !== user._id) return null;
    const product = await ctx.db.get(prop.productId);
    if (!product) return null;
    const brand = await retainedProductBrand(ctx, product);
    const links = await relationshipLinks(ctx, prop._id);
    return { prop, product: { ...product, brand }, links, associatedAccountEvidence: [], previousStatuses: [] };
  },
});

export const related = query({
  args: { propId: v.id("props"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { propId, paginationOpts }) => {
    const { user, prop } = await ownedProp(ctx, propId);
    const product = await ctx.db.get(prop.productId);
    const result = await ctx.db.query("props").withIndex("by_user_product", q => q.eq("userId", user._id).eq("productId", prop.productId))
      .paginate(boundedPage(paginationOpts, 25));
    return { ...result, page: product ? result.page.map(row => locatorRow(row, product)) : [] };
  },
});

export const accountEvidencePage = query({
  args: { propId: v.id("props"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { propId, paginationOpts }) => {
    const options = boundedPage(paginationOpts, 3);
    const { user, prop } = await ownedProp(ctx, propId);
    const product = await ctx.db.get(prop.productId);
    type Row = { candidate: RankedAccountEvidence | null; connected: boolean };
    if (!product || product.slug !== "github") return { page: [] as Row[], isDone: true, continueCursor: "" };
    const connector = await ctx.db.query("connectorAccounts")
      .withIndex("by_user_provider", q => q.eq("userId", user._id).eq("provider", "GITHUB")).unique();
    const login = connector?.status === "CONNECTED"
      ? connector.accountLabel.match(/^(?:https:\/\/)?github\.com\/([^/]+)$/i)?.[1] : undefined;
    if (login) {
      const evidence = { relationshipOwnerId: user._id, evidenceOwnerId: user._id, productSlug: product.slug, accountId: login, url: `https://github.com/${login}` };
      const destination = privateCardPrimaryLink({ product, links: [], associatedEvidence: [evidence] });
      if (destination && destination.url !== `https://${product.domain}`) {
        return { page: [{ connected: true, candidate: { sourceDay: "", accountKey: "", evidence } }] as Row[], isDone: true, continueCursor: "" };
      }
    }
    const result = await ctx.db.query("proofs").withIndex("by_prop", q => q.eq("propId", propId))
      .order("desc").paginate(options);
    const page: Row[] = [];
    for (const proof of result.page) {
      let candidate: RankedAccountEvidence | null = null;
      const raw = proof.rawEvidenceId ? await ctx.db.get(proof.rawEvidenceId) : null;
      if (raw && raw.userId === user._id && !raw.deletedAt && raw.captureProvenance?.origin.issuer === "GITHUB") {
        const source = await ctx.db.get(raw.evidenceSourceId);
        if (source?.userId === user._id && source.type === "GITHUB") candidate = rankAccountEvidence(raw, user._id, product.slug);
      }
      page.push({ candidate, connected: false });
    }
    return { ...result, page };
  },
});

export const evidence = query({
  args: { propId: v.id("props"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { propId, paginationOpts }) => {
    const { user } = await ownedProp(ctx, propId);
    const result = await ctx.db.query("proofs").withIndex("by_prop", q => q.eq("propId", propId)).order("desc").paginate(boundedPage(paginationOpts, 10));
    const seen = new Set<string>();
    const entries = await Promise.all(result.page.map(async proof => {
      if (!proof.rawEvidenceId || seen.has(proof.rawEvidenceId)) return null;
      seen.add(proof.rawEvidenceId);
      return evidenceEntry(ctx, user._id, proof.rawEvidenceId);
    }));
    return { ...result, page: entries.filter(entry => entry !== null) };
  },
});

export const selectedActivity = query({
  args: { propId: v.id("props") },
  handler: async (ctx, { propId }) => {
    const { user, prop } = await ownedProp(ctx, propId);
    if (!prop.activityEvidenceId) return null;
    const proof = await ctx.db.query("proofs").withIndex("by_propId_and_rawEvidenceId", q => q.eq("propId", propId).eq("rawEvidenceId", prop.activityEvidenceId)).first();
    return proof ? evidenceEntry(ctx, user._id, prop.activityEvidenceId) : null;
  },
});

export const history = query({
  args: { propId: v.id("props"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { propId, paginationOpts }) => {
    await ownedProp(ctx, propId);
    return ctx.db.query("relationshipEvents").withIndex("by_prop", q => q.eq("propId", propId)).order("desc").paginate(boundedPage(paginationOpts, 25));
  },
});

// Self-service export (R15). Owner-only, and each record comes from an explicit
// allowlist so nothing secret is copied by accident: no retained original text,
// storage references, upload tokens, connector credentials or raw requests.
// Relationships and evidence are paged so a large history stays within
// Convex's per-function read limits; the client assembles the pages.

const EXPORT_HISTORY_LIMIT = 1000;
const EXPORT_LINK_LIMIT = 100;

export const exportProfile = query({
  args: {},
  handler: async ctx => {
    const user = await requireUser(ctx);
    const published = user.handle
      ? await ctx.db.query("publishedProfiles").withIndex("by_handle", q => q.eq("handle", user.handle)).unique()
      : null;
    return {
      handle: user.handle, displayName: user.displayName, bio: user.bio, avatarUrl: user.avatarUrl,
      profileLinks: user.profileLinks, preferredLinkUrl: user.preferredLinkUrl,
      onboardingStatus: user.onboardingStatus, createdAt: user.createdAt, updatedAt: user.updatedAt,
      // The page as visitors see it: the public read drops old unsafe links, and a taken-down page shows nothing.
      publicPage: published ? {
        revision: published.revision, publishedAt: published.publishedAt, takenDown: Boolean(published.takenDownAt),
        profile: published.takenDownAt ? null : await readPublishedProfile(ctx, published.handle),
      } : null,
    };
  },
});

export const exportRelationships = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const options = boundedPage(paginationOpts, 10);
    const user = await requireUser(ctx);
    const result = await ctx.db.query("props").withIndex("by_user", q => q.eq("userId", user._id)).paginate(options);
    const page = await Promise.all(result.page.map(async prop => {
      const product = await ctx.db.get(prop.productId);
      // One extra row shows whether anything was left out.
      const links = await ctx.db.query("links").withIndex("by_prop", q => q.eq("propId", prop._id)).take(EXPORT_LINK_LIMIT + 1);
      const events = await ctx.db.query("relationshipEvents").withIndex("by_prop", q => q.eq("propId", prop._id)).take(EXPORT_HISTORY_LIMIT + 1);
      return {
        id: prop._id,
        product: product ? { name: product.name, slug: product.slug, domain: product.domain } : null,
        status: prop.status, visibility: prop.visibility, goTo: prop.goTo ?? false,
        headline: prop.headline, note: prop.note, confirmedAt: prop.confirmedAt,
        relationshipVersion: prop.relationshipVersion ?? 0, startedAt: prop.startedAt, startedAtSource: prop.startedAtSource,
        supportingUrl: prop.supportingUrl, activityEvidenceId: prop.activityEvidenceId,
        activity: prop.activity, cost: prop.cost, costVisibility: prop.costVisibility,
        links: links.slice(0, EXPORT_LINK_LIMIT).map(link => ({ type: link.type, url: link.url, label: link.label, isPrimary: link.isPrimary })),
        linksComplete: links.length <= EXPORT_LINK_LIMIT,
        history: events.slice(0, EXPORT_HISTORY_LIMIT).map(event => ({ version: event.version, recordedAt: event.recordedAt, basis: event.basis, before: event.before, after: event.after })),
        historyComplete: events.length <= EXPORT_HISTORY_LIMIT,
      };
    }));
    return { ...result, page };
  },
});

// origin.artifactRef holds a storage id or content hash, which only locates files inside Proper Respect.
function exportedProvenance(provenance: Doc<"rawEvidence">["captureProvenance"]) {
  if (!provenance) return undefined;
  const { issuer, accountId, recordId } = provenance.origin;
  return { ...provenance, origin: { issuer, accountId, recordId } };
}

export const exportEvidence = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    // Reading a row reads its retained original too, so pages stay small to
    // keep large mailbox captures within the per-function read limit.
    const options = boundedPage(paginationOpts, 10);
    const user = await requireUser(ctx);
    const result = await ctx.db.query("rawEvidence").withIndex("by_user", q => q.eq("userId", user._id)).paginate(options);
    const page = await Promise.all(result.page.map(async raw => {
      const source = await ctx.db.get(raw.evidenceSourceId);
      const identity = {
        id: raw._id,
        sourceType: source?.userId === user._id ? source.type : undefined,
        sourceLabel: source?.userId === user._id ? source.label ?? source.type : undefined,
        capturedAt: raw.capturedAt,
      };
      // A deleted original exports only that it existed and when it was deleted;
      // its file details, links and extracted text go with it.
      if (raw.deletedAt !== undefined) return { ...identity, deletedAt: raw.deletedAt };
      return {
        ...identity, sourceUrl: raw.sourceUrl, captureProvenance: exportedProvenance(raw.captureProvenance),
        filename: raw.filename, mimeType: raw.mimeType, byteSize: raw.byteSize,
        detectedVendor: raw.detectedVendor, detectedUrl: raw.detectedUrl,
        // Everything but the file's content hash.
        retainedArtifact: raw.retainedArtifact ? {
          kind: raw.retainedArtifact.kind, sourceFile: raw.retainedArtifact.sourceFile, byteLength: raw.retainedArtifact.byteLength,
          sourceCapturedDate: raw.retainedArtifact.sourceCapturedDate, sourceCaptureBasis: raw.retainedArtifact.sourceCaptureBasis,
          preparedAt: raw.retainedArtifact.preparedAt, adapterVersion: raw.retainedArtifact.adapterVersion,
        } : undefined,
        limitations: raw.limitations ?? [],
        suggestedActivity: raw.suggestedActivity,
        observations: raw.observations ?? [],
      };
    }));
    return { ...result, page };
  },
});

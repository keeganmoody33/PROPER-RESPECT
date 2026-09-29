import { isHttpUrl, validateProfileLinks } from "../src/domain/profile-links";
import { mailboxTesterAllowed } from "../src/domain/mailbox-testers";
import { uploadAttributionStatus } from "../src/domain/evidence-upload";
import { addManualProductArgs, addManualProductHandler } from "./manualProducts";
import { ensureProductBrand, retainedProductBrand } from "./productBrands";
import { v, type Infer } from "convex/values";
import { mutation, query, internalMutation, internalQuery, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { consumeWriteLimit, requireIdentity, requireUser } from "./authHelpers";
import { claimableHandleSchema } from "../src/domain/onboarding";
import { projectPublicProfile, publicProfileSchema } from "../src/domain/public-profile";
import { classifyEvidenceUpload, normalizeUploadMime } from "../src/domain/evidence-upload";
import { resolveProduct } from "../src/domain/discovery";
import { costSchema } from "../src/domain/cost";
import { DEFAULT_USAGE_LINK_LABEL, usageLinkUrlSchema } from "../src/domain/usage-links";
import { BIO_MAX, DISPLAY_NAME_MAX, LINK_LABEL_MAX, PUBLISHED_URL_MAX, trimToLength } from "../src/domain/published-text-limits";
import { canonicalJson } from "../src/domain/canonical-json";
import { sha256 } from "../src/domain/product-knowledge";
import { resolvePublishedCardPropIds } from "./publication";
import { associatedAccountEvidenceForProp } from "./associatedAccountEvidence";
import {
  profileLinkValidator,
  activityModuleValidator,
  linkTypeValidator,
  statusValidator,
  costValidator,
  costVisibilityValidator,
  claimVerdictValidator,
  usageLinkLabelValidator,
} from "./validators";

function pendingHandle(subject: string) {
  const suffix = subject.toLowerCase().replace(/[^a-z0-9]/g, "").slice(-24);
  return `pending-${suffix || "account"}`;
}

async function ownersForHandle(ctx: QueryCtx | MutationCtx, handle: string) {
  return ctx.db.query("users").withIndex("by_handle", q => q.eq("handle", handle)).take(2);
}

async function availablePendingHandle(ctx: MutationCtx, subject: string) {
  const base = pendingHandle(subject);
  for (let attempt = 0; attempt < 100; attempt++) {
    const handle = attempt === 0 ? base : `${base}-${attempt}`;
    const owners = await ownersForHandle(ctx, handle);
    if (owners.length > 0) continue;
    if (await ctx.db.query("publicProfileAliases").withIndex("by_handle", q => q.eq("handle", handle)).first()) continue;
    const publication = await ctx.db.query("publishedProfiles")
      .withIndex("by_handle", q => q.eq("handle", handle)).first();
    if (!publication) return handle;
  }
  throw new Error("An available account handle could not be reserved. No account was created.");
}

export const ensureAccount = mutation({
  args: {
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const existing = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) =>
        q.eq("authSubject", identity.subject),
      )
      .unique();
    if (existing) return existing._id;

    const handle = await availablePendingHandle(ctx, identity.subject);
    const now = new Date().toISOString();
    const displayName = [args.displayName, identity.name, identity.email]
      .map(name => trimToLength(name ?? "", DISPLAY_NAME_MAX)).find(Boolean) ?? "New linker";
    return await ctx.db.insert("users", {
      authSubject: identity.subject,
      handle,
      displayName,
      bio: "",
      avatarUrl: args.avatarUrl !== undefined && isHttpUrl(args.avatarUrl) && args.avatarUrl.length <= PUBLISHED_URL_MAX ? args.avatarUrl : undefined,
      onboardingStatus: "PROFILE",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const claimHandle = mutation({
  args: {
    handle: v.string(),
    displayName: v.string(),
    bio: v.string(),
    profileLinks: v.optional(v.array(profileLinkValidator)),
    preferredLinkUrl: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const handle = claimableHandleSchema.parse(args.handle);
    await consumeWriteLimit(ctx, user._id, "claimHandle");
    const displayName = args.displayName.trim(), bio = args.bio.trim();
    if (displayName.length > DISPLAY_NAME_MAX) throw new Error("Use a display name of 80 characters or fewer.");
    if (bio.length > BIO_MAX) throw new Error("Use a bio of 500 characters or fewer.");
    if (await ctx.db.query("publicProfileAliases").withIndex("by_handle", q => q.eq("handle", handle)).first()) {
      throw new Error("That handle is reserved by an existing public profile.");
    }
    const linkFields = args.profileLinks !== undefined || args.preferredLinkUrl !== undefined
      ? validateProfileLinks(args.profileLinks ?? user.profileLinks ?? [], args.preferredLinkUrl === null ? undefined : args.preferredLinkUrl ?? user.preferredLinkUrl)
      : {};
    const owners = await ownersForHandle(ctx, handle);
    if (owners.some(owner => owner._id !== user._id)) {
      throw new Error("That handle is already claimed.");
    }

    if (handle !== user.handle) {
      const currentPublication = await ctx.db.query("publishedProfiles")
        .withIndex("by_handle", q => q.eq("handle", user.handle)).unique();
      if (currentPublication) throw new Error("A published handle cannot be changed here. Its public identity requires a separate owner-verified migration.");
      const targetPublication = await ctx.db.query("publishedProfiles")
        .withIndex("by_handle", q => q.eq("handle", handle)).unique();
      if (targetPublication) throw new Error("That handle already has a published profile and cannot be claimed here.");
    }

    const now = new Date().toISOString();
    await ctx.db.patch(user._id, {
      handle,
      ...linkFields,
      displayName,
      bio,
      onboardingStatus: "IMPORT",
      updatedAt: now,
    });

    const site = await ctx.db
      .query("sites")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .unique();
    if (site) {
      await ctx.db.patch(site._id, { handle });
    } else {
      await ctx.db.insert("sites", {
        ownerId: user._id,
        handle,
        status: "DRAFT",
      });
    }

    return { handle };
  },
});

export const getState = query({
  args: { includeClaims: v.optional(v.boolean()), includeLegacyCollections: v.optional(v.boolean()), includeAccountEvidence: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) =>
        q.eq("authSubject", identity.subject),
      )
      .unique();
    if (!user) return null;
    const [props, drafts, connectors, evidence, published, site] = await Promise.all([
      ctx.db
        .query("props")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect(),
      args.includeLegacyCollections === false ? [] : ctx.db
        .query("draftImports")
        .filter((q) => q.eq(q.field("userId"), user._id))
        .collect(),
      ctx.db
        .query("connectorAccounts")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect(),
      args.includeLegacyCollections === false ? [] : ctx.db
        .query("rawEvidence")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect(),
      ctx.db
        .query("publishedProfiles")
        .withIndex("by_handle", (q) => q.eq("handle", user.handle))
        .unique(),
      ctx.db
        .query("sites")
        .withIndex("by_owner", q => q.eq("ownerId", user._id))
        .unique(),
    ]);
    const publishedPropIds = published
      ? await resolvePublishedCardPropIds(ctx, published, user._id, props)
      : [];

    const cards = await Promise.all(
      props.map(async (prop) => {
        const product = await ctx.db.get(prop.productId);
        const links = await ctx.db
          .query("links")
          .withIndex("by_prop", (q) => q.eq("propId", prop._id))
          .collect();
        const proofs = args.includeClaims === false ? [] : await ctx.db.query("proofs").withIndex("by_prop", q => q.eq("propId", prop._id)).take(100);
        const claims = [];
        for (const evidenceId of new Set(proofs.flatMap(proof => proof.rawEvidenceId ? [proof.rawEvidenceId] : []))) {
          const raw = await ctx.db.get(evidenceId);
          if (!raw || raw.userId !== user._id || raw.deletedAt) continue;
          const source = await ctx.db.get(raw.evidenceSourceId);
          for (const [index, observation] of (raw.observations ?? []).entries()) {
            const review = await ctx.db.query("claimReviews")
              .withIndex("by_prop_and_rawEvidenceId_and_observationIndex", q =>
                q.eq("propId", prop._id).eq("rawEvidenceId", raw._id).eq("observationIndex", index))
              .order("desc").first();
            claims.push({
              rawEvidenceId: raw._id, observationIndex: index, observation,
              sourceLabel: source?.label ?? source?.type ?? "Evidence",
              capturedAt: raw.capturedAt,
              sourceUrl: raw.sourceUrl,
              review,
            });
          }
        }
        const brand = product ? await retainedProductBrand(ctx, product) : undefined;
        const approvedCards = published?.profile.cards.filter((_, index) => publishedPropIds[index] === prop._id) ?? [];
        const publishedActivity = approvedCards.length > 0 && approvedCards.every(card =>
          canonicalJson(card.activity) === canonicalJson(approvedCards[0].activity))
          ? approvedCards[0].activity : undefined;
        const publishedUsageLink = approvedCards.length > 0 && approvedCards.every(card =>
          canonicalJson(card.usageLink) === canonicalJson(approvedCards[0].usageLink))
          ? approvedCards[0].usageLink : undefined;
        const associatedAccountEvidence = product && args.includeAccountEvidence !== false
          ? await associatedAccountEvidenceForProp(ctx, user._id, prop._id, product.slug)
          : [];
        const refreshApproved = await hasActiveGithubRefresh(ctx, user._id, prop._id);
        return { prop, product: product && brand ? { ...product, brand } : product, links, claims, refreshApproved,
          isPublishedAtCurrentHandle: approvedCards.length > 0, publishedActivity, publishedUsageLink, associatedAccountEvidence };
      }),
    );

    return {
      user,
      cards,
      hasPublicationAtCurrentHandle: published !== null,
      hasClaimedPublicIdentity: site?.handle === user.handle,
      brandEnrichmentAvailable: true,
      privateInventoryAvailable: true,
      mailboxAvailable: mailboxTesterAllowed(identity.email, process.env.MAILBOX_GOOGLE_TEST_EMAILS),
      drafts,
      connectors: connectors.map((connector) => ({
        _id: connector._id,
        _creationTime: connector._creationTime,
        userId: connector.userId,
        provider: connector.provider,
        status: connector.status,
        accountLabel: connector.accountLabel,
        attributionScope: connector.attributionScope,
        connectedAt: connector.connectedAt,
        lastSyncedAt: connector.lastSyncedAt,
        lastError: connector.lastError,
      })),
      evidence: evidence.map((item) => ({
        _id: item._id,
        _creationTime: item._creationTime,
        evidenceSourceId: item.evidenceSourceId,
        userId: item.userId,
        storageId: item.storageId,
        uploadAttribution: item.storageId ? uploadAttributionStatus(item.uploadAttribution) : undefined,
        filename: item.filename,
        mimeType: item.mimeType,
        byteSize: item.byteSize,
        detectedVendor: item.detectedVendor,
        capturedAt: item.capturedAt,
        deletedAt: item.deletedAt,
      })),
    };
  },
});

export const reviewClaim = mutation({
  args: {
    propId: v.id("props"), rawEvidenceId: v.id("rawEvidence"),
    observationIndex: v.number(), verdict: claimVerdictValidator,
    correction: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const prop = await ctx.db.get(args.propId);
    const raw = await ctx.db.get(args.rawEvidenceId);
    if (!prop || prop.userId !== user._id || !raw || raw.userId !== user._id || raw.deletedAt) throw new Error("Evidence unavailable.");
    if (!Number.isInteger(args.observationIndex) || args.observationIndex < 0 || !raw.observations?.[args.observationIndex]) throw new Error("Unknown observation.");
    const proof = await ctx.db.query("proofs").withIndex("by_prop", q => q.eq("propId", prop._id)).filter(q => q.eq(q.field("rawEvidenceId"), raw._id)).first();
    if (!proof) throw new Error("Evidence does not support this card.");
    if ((args.correction?.length ?? 0) > 4000) throw new Error("Correction is too long.");
    return await ctx.db.insert("claimReviews", { ...args, userId: user._id, reviewedAt: new Date().toISOString() });
  },
});

// Old clients must reload instead of creating new storage objects with no owner binding.
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    throw new Error("Reload the application to use authenticated file uploads.");
  },
});

export const beginUpload = mutation({
  args: { filename: v.string(), mimeType: v.string(), byteSize: v.number(), vendor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const identity = await requireIdentity(ctx);
    await consumeWriteLimit(ctx, user._id, "beginUpload");
    const { mimeType } = classifyEvidenceUpload(args);
    if ((args.vendor?.length ?? 0) > 200) throw new Error("Invalid product name.");
    const site = process.env.CONVEX_SITE_URL;
    if (!site) throw new Error("Authenticated upload endpoint is not configured.");
    const id = await ctx.db.insert("uploadTickets", {
      ...args, mimeType, userId: user._id, tokenIdentifier: identity.tokenIdentifier,
      createdAt: Date.now(), expiresAt: Date.now() + 10 * 60 * 1000,
    });
    const url = new URL("/evidence-upload", site);
    url.searchParams.set("ticket", id);
    return { ticketId: id, uploadUrl: url.toString() };
  },
});

async function assertRetainableExistingUpload(
  ctx: MutationCtx,
  existing: Doc<"rawEvidence">,
  user: Doc<"users">,
) {
  if (existing.userId !== user._id || existing.deletedAt) throw new Error("Upload unavailable.");
  if (!existing.uploadAttribution) return;
  const identity = await requireIdentity(ctx);
  if (existing.uploadAttribution.tokenIdentifier !== identity.tokenIdentifier) {
    throw new Error("Upload unavailable.");
  }
}

async function ownedUploadTicket(ctx: QueryCtx | MutationCtx, ticketId: Id<"uploadTickets">) {
  const user = await requireUser(ctx);
  const identity = await requireIdentity(ctx);
  const ticket = await ctx.db.get(ticketId);
  if (!ticket || ticket.userId !== user._id || ticket.tokenIdentifier !== identity.tokenIdentifier)
    throw new Error("Upload unavailable.");
  if (ticket.expiresAt <= Date.now() && !ticket.evidenceId) throw new Error("Upload expired. Choose the file again.");
  if (ticket.evidenceId) {
    const evidence = await ctx.db.get(ticket.evidenceId);
    if (!evidence || evidence.deletedAt) throw new Error("Upload unavailable.");
  }
  return ticket;
}

export const uploadTicket = internalQuery({
  args: { ticketId: v.id("uploadTickets") },
  handler: (ctx, args) => ownedUploadTicket(ctx, args.ticketId),
});

// Only the HTTP byte-receiving handler calls this; a client cannot bind a supplied ID.
export const bindUploadedFile = internalMutation({
  args: { ticketId: v.id("uploadTickets"), storageId: v.id("_storage"), sha256: v.string() },
  handler: async (ctx, args) => {
    const ticket = await ownedUploadTicket(ctx, args.ticketId);
    if (ticket.storageId) {
      if (ticket.sha256 !== args.sha256) throw new Error("Upload already used for different bytes.");
      return ticket.storageId;
    }
    const file = await ctx.db.system.get(args.storageId);
    if (!file || file.size !== ticket.byteSize || normalizeUploadMime(file.contentType ?? "") !== ticket.mimeType)
      throw new Error("Stored file metadata does not match this upload.");
    await ctx.db.patch(ticket._id, { storageId: args.storageId, sha256: args.sha256, receivedAt: new Date().toISOString() });
    return args.storageId;
  },
});

export const retainUpload = mutation({
  args: {
    storageId: v.id("_storage"),
    filename: v.string(),
    mimeType: v.string(),
    byteSize: v.number(),
    sourceType: v.union(v.literal("SCREENSHOT"), v.literal("CSV"), v.literal("FILE_UPLOAD")),
    vendor: v.optional(v.string()),
    activity: v.optional(activityModuleValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (args.activity) throw new Error("Upload retention cannot add measurements. Review selected observations separately.");
    const storage = await ctx.db.system.get(args.storageId);
    if (!storage || storage.size !== args.byteSize || normalizeUploadMime(storage.contentType ?? "") !== normalizeUploadMime(args.mimeType)) {
      throw new Error("Stored file metadata does not match this upload.");
    }
    const existing = await ctx.db.query("rawEvidence").withIndex("by_storage", q => q.eq("storageId", args.storageId)).first();
    if (existing) {
      await assertRetainableExistingUpload(ctx, existing, user);
      if (existing.filename !== args.filename || existing.mimeType !== args.mimeType || existing.byteSize !== args.byteSize || existing.detectedVendor !== args.vendor) {
        throw new Error("This upload was already retained with different metadata.");
      }
      return existing._id;
    }
    const { sourceType } = classifyEvidenceUpload(args);
    const ticket = await ctx.db.query("uploadTickets").withIndex("by_storage", q => q.eq("storageId", args.storageId)).unique();
    if (!ticket) throw new Error("Upload unavailable. Choose the file again through authenticated upload.");
    await ownedUploadTicket(ctx, ticket._id);
    if (ticket.evidenceId || !ticket.sha256 || !ticket.receivedAt) throw new Error("Upload unavailable.");
    if (ticket.filename !== args.filename || ticket.mimeType !== normalizeUploadMime(args.mimeType) || ticket.byteSize !== args.byteSize || ticket.vendor !== args.vendor)
      throw new Error("Upload metadata differs from the authenticated upload.");
    const now = new Date().toISOString();
    let source = await ctx.db
      .query("evidenceSources")
      .withIndex("by_user_type_sourceKey", (q) =>
        q.eq("userId", user._id).eq("type", sourceType).eq("sourceKey", undefined),
      )
      .first();
    if (!source) {
      const sourceId = await ctx.db.insert("evidenceSources", {
        userId: user._id,
        type: sourceType,
        label: `${sourceType.toLowerCase()} uploads`,
        connectedAt: now,
        lastSyncedAt: now,
      });
      source = (await ctx.db.get(sourceId))!;
    }

    const evidenceId = await ctx.db.insert("rawEvidence", {
      evidenceSourceId: source._id,
      userId: user._id,
      storageId: args.storageId,
      uploadAttribution: {
        status: "VERIFIED_OWNER_SESSION", userId: user._id,
        tokenIdentifier: ticket.tokenIdentifier, ticketId: ticket._id,
        receivedAt: ticket.receivedAt, sha256: ticket.sha256,
      },
      filename: args.filename,
      mimeType: args.mimeType,
      byteSize: args.byteSize,
      detectedVendor: args.vendor,
      capturedAt: now,
      dedupKey: `${user._id}:${args.storageId}`,
      captureProvenance: {
        version: 1, route: "UPLOAD", adapter: { id: "evidence-upload", version: "2" },
        origin: { issuer: "OWNER_SUPPLIED_FILE", artifactRef: args.storageId },
        collector: { kind: "UNKNOWN" }, activityActor: { kind: "UNKNOWN" },
      },
      limitations: ["Retained original only. File contents and publisher authenticity have not been verified; no usage has been extracted."],
    });

    if (args.vendor) {
      const proposed = resolveProduct({
        sourceType,
        vendor: args.vendor,
        capturedAt: now,
        payload: "",
      });
      if (proposed) {
        let product = await ctx.db
          .query("products")
          .withIndex("by_slug", (q) => q.eq("slug", proposed.slug))
          .unique();
        if (!product) {
          const productId = await ctx.db.insert("products", {
            ...proposed,
            logoUrl: `https://${proposed.domain}/favicon.ico`,
          });
          product = (await ctx.db.get(productId))!;
        }
        const existingProps = await ctx.db
          .query("props")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect();
        let prop = existingProps.find(
          (candidate) => candidate.productId === product._id,
        );
        if (!prop) {
          const propId = await ctx.db.insert("props", {
            userId: user._id,
            productId: product._id,
            status: "TESTING",
            visibility: "DRAFT",
            headline: `${product.name}: uploaded evidence to review.`,
            note: "This file has not been interpreted as product use. Review it before describing your relationship.",
          });
          prop = (await ctx.db.get(propId))!;
          await ctx.db.insert("links", {
            propId,
            type: "CANONICAL",
            url: `https://${product.domain}`,
            label: `Open ${product.name}`,
            isPrimary: true,
          });
        }
        await ctx.db.insert("proofs", {
          propId: prop._id, rawEvidenceId: evidenceId,
          type: sourceType === "SCREENSHOT" ? "SCREENSHOT" : "FILE_UPLOAD",
          label: "Private uploaded original", text: "Original retained without extracting usage.",
        });
        await ensureProductBrand(ctx, product);
        const draft = await ctx.db
          .query("draftImports")
          .withIndex("by_user_slug", (q) =>
            q
              .eq("userId", user._id)
              .eq("suggestedProductSlug", product.slug),
          )
          .first();
        if (draft) {
          await ctx.db.patch(draft._id, {
            resultPropId: prop._id,
            rawEvidenceIds: [
              ...new Set([...draft.rawEvidenceIds, evidenceId]),
            ],
          });
        } else {
          await ctx.db.insert("draftImports", {
            userId: user._id,
            status: "PENDING",
            suggestedProductSlug: product.slug,
            suggestedProductName: product.name,
            suggestedDomain: product.domain,
            suggestedDescription: product.description,
            suggestedUrl: `https://${product.domain}`,
            rawEvidenceIds: [evidenceId],
            resultPropId: prop._id,
          });
        }
      }
    }

    await ctx.db.patch(ticket._id, { evidenceId });
    await ctx.db.patch(user._id, {
      onboardingStatus: "REVIEW",
      updatedAt: now,
    });
    return evidenceId;
  },
});

export const deleteEvidence = mutation({
  args: { evidenceId: v.id("rawEvidence") },
  handler: async (ctx, { evidenceId }) => {
    const user = await requireUser(ctx);
    const evidence = await ctx.db.get(evidenceId);
    if (!evidence || evidence.userId !== user._id) {
      throw new Error("Evidence not found.");
    }
    if (evidence.storageId) {
      await ctx.storage.delete(evidence.storageId);
    }
    await ctx.db.patch(evidenceId, {
      storageId: undefined,
      payload: undefined,
      deletedAt: new Date().toISOString(),
    });
  },
});

export const addManualProduct = mutation({
  args: addManualProductArgs, handler: addManualProductHandler,
});

const selectionValidator = v.object({
  propId: v.id("props"),
  expectedRelationshipVersion: v.optional(v.number()),
  publish: v.boolean(),
  status: statusValidator,
  headline: v.string(),
  note: v.string(),
  startedAt: v.optional(v.string()),
  startedAtSource: v.optional(
    v.union(v.literal("AUTHORITATIVE"), v.literal("USER_CONFIRMED")),
  ),
  primaryLink: v.optional(v.object({
    type: linkTypeValidator,
    url: v.string(),
    label: v.string(),
  })),
  activity: v.optional(activityModuleValidator),
  autoRefresh: v.boolean(),
  cost: v.optional(costValidator),
  costVisibility: v.optional(costVisibilityValidator),
  connectorId: v.optional(v.id("connectorAccounts")),
  metricKey: v.optional(v.string()),
  // The saved work-sample link, sent only when the owner chose to show it on
  // the card. It must equal what's saved, so a preview can't drift.
  usageLinkUrl: v.optional(v.string()),
  usageLinkLabel: v.optional(usageLinkLabelValidator),
});

type PublicationSelection = Infer<typeof selectionValidator>;

/** Both preview and commit use this projection, before any write occurs. */
// The metrics a public card may refresh, and the connector provider each needs (R09).
const REFRESH_METRIC_PROVIDERS: Record<string, "GITHUB" | "DEVIN" | undefined> = {
  "github.contributions": "GITHUB",
  "devin.sessions": "DEVIN",
};

async function hasActiveGithubRefresh(ctx: QueryCtx | MutationCtx, userId: Id<"users">, propId: Id<"props">) {
  const subscriptions = await ctx.db.query("metricSubscriptions")
    .withIndex("by_prop_metric", q => q.eq("propId", propId).eq("metricKey", "github.contributions")).collect();
  return subscriptions.some(subscription => subscription.userId === userId && !subscription.revokedAt);
}

// Remove-all runs as one transaction, so its writes stay far inside Convex's
// per-mutation limits. Bigger accounts unpublish in batches of 100 instead.
const REMOVE_ALL_MAX_WRITES = 1000;

// removeAllCards (R15, "Unpublish all cards"): the server drops every published
// card itself, including older cards that can't be matched to a relationship,
// in one step with no selection limit. The profile fields are not cards and
// stay public. It can't be combined with other changes.
async function preparePublication(ctx: QueryCtx | MutationCtx, user: Doc<"users">, selections: PublicationSelection[], removeAllCards = false) {
  const owners = await ownersForHandle(ctx, user.handle);
  if (owners.length !== 1 || owners[0]._id !== user._id) throw new Error("Publication requires the unique owner of this handle. Resolve account ownership before sharing.");
  // Older rows were saved before these caps, so every publish checks them.
  if (user.displayName.length > DISPLAY_NAME_MAX) throw new Error("Shorten your display name to 80 characters or fewer before sharing.");
  if (user.bio.length > BIO_MAX) throw new Error("Shorten your bio to 500 characters or fewer before sharing.");
  if (removeAllCards && selections.length > 0) throw new Error("Remove all cards on its own, without other card changes.");
  if (selections.length > 100) throw new Error("Select at most 100 relationships to change.");
  const selectedIds = new Set(selections.map(selection => selection.propId));
  if (selectedIds.size !== selections.length) throw new Error("Select each relationship only once.");
  const allProps = await ctx.db.query("props").withIndex("by_user", q => q.eq("userId", user._id)).collect();
  const propsById = new Map(allProps.map(prop => [prop._id, prop]));
  if (removeAllCards) {
    // The same count the commit writes: every public relationship and active refresh.
    const subscriptions = await ctx.db.query("metricSubscriptions").withIndex("by_user", q => q.eq("userId", user._id)).collect();
    const writes = allProps.filter(prop => prop.visibility === "PUBLIC").length + subscriptions.filter(subscription => !subscription.revokedAt).length;
    if (writes > REMOVE_ALL_MAX_WRITES) {
      throw new Error("Unpublish all handles up to 1,000 public cards and daily refreshes at once. Remove cards 100 at a time in Choose what to share, then try again, or ask through the contact page.");
    }
  }
  const published = await ctx.db.query("publishedProfiles").withIndex("by_handle", q => q.eq("handle", user.handle)).unique();
  if (removeAllCards) {
    // Remove-all only takes cards down; it must never create a first publication.
    if (!published) throw new Error("There is no published page to remove cards from.");
    // Publishing is refused during a takedown, so say so before the owner approves.
    if (published.takenDownAt) throw new Error("This profile is under review. Contact 33@lecturesfrom.com.");
  }
  const previousPropIds = published ? await resolvePublishedCardPropIds(ctx, published, user._id, allProps) : [];
  for (const selection of selections) {
    const prop = propsById.get(selection.propId);
    if (!prop) throw new Error("Cannot publish another user's product.");
    if (selection.publish || prop.visibility === "PUBLIC") {
      if ((selection.expectedRelationshipVersion ?? 0) !== (prop.relationshipVersion ?? 0)) throw new Error("This relationship changed. Reload before changing publication.");
    }
    if (!selection.publish) continue;
    if (prop.visibility === "DRAFT") throw new Error("Confirm and save this relationship privately before publishing.");
    if (selection.primaryLink && !isHttpUrl(selection.primaryLink.url)) throw new Error("Use an http or https link without embedded credentials.");
    if (selection.primaryLink && selection.primaryLink.label.length > LINK_LABEL_MAX) throw new Error("Use a link label of 200 characters or fewer.");
    if (selection.primaryLink && selection.primaryLink.url.length > PUBLISHED_URL_MAX) throw new Error("Use a link of 2,048 characters or fewer.");
    if (selection.status !== prop.status || selection.headline.trim() !== prop.headline ||
        selection.note.trim() !== prop.note || selection.startedAt !== prop.startedAt) {
      throw new Error("Save relationship changes privately before publishing.");
    }
    if (selection.activity && canonicalJson(selection.activity) !== canonicalJson(prop.activity)) {
      // A refresh updates only the public card of a privately saved relationship,
      // so a republish that keeps the refresh on may keep that newer public calendar (R09).
      const activity = selection.activity;
      const carriesRefreshedCalendar = selection.autoRefresh && selection.metricKey === "github.contributions" &&
        activity.kind === "contributionCalendar" && activity.attributionScope === "PERSONAL" &&
        await hasActiveGithubRefresh(ctx, user._id, prop._id) &&
        (published?.profile.cards ?? []).some((card, index) =>
          previousPropIds[index] === prop._id && canonicalJson(card.activity) === canonicalJson(activity));
      if (!carriesRefreshedCalendar) throw new Error("Publish only the supporting activity already saved on this relationship.");
    }
    if (selection.usageLinkUrl !== undefined) {
      if (selection.usageLinkUrl !== prop.supportingUrl) throw new Error("Save the link privately before publishing it.");
      if (!usageLinkUrlSchema.safeParse(selection.usageLinkUrl).success) throw new Error("Use an https link without embedded credentials.");
    }
    // A checked refresh for published activity must name its connection and metric.
    // Withholding the activity instead stops the refresh, as unchecking does.
    if (selection.autoRefresh && selection.activity && (!selection.connectorId || !selection.metricKey)) {
      throw new Error("A refresh needs its connected account and measurement. Reload and review this card again.");
    }
    if (selection.autoRefresh && selection.connectorId && selection.metricKey && selection.activity) {
      const provider = REFRESH_METRIC_PROVIDERS[selection.metricKey];
      if (!provider) throw new Error("This measurement can't refresh automatically.");
      const connector = await ctx.db.get(selection.connectorId);
      if (!connector || connector.userId !== user._id || connector.status === "REVOKED" || connector.provider !== provider) {
        throw new Error("A connected account is required for refresh.");
      }
      // The same connector states the scheduled GitHub refresh accepts (convex/connectors.ts).
      const product = provider === "GITHUB" ? await ctx.db.get(prop.productId) : null;
      if (provider === "GITHUB" && (product?.slug !== "github" || connector.attributionScope !== "PERSONAL" ||
          !["CONNECTED", "ERROR"].includes(connector.status) ||
          selection.activity.kind !== "contributionCalendar" || selection.activity.attributionScope !== "PERSONAL")) {
        throw new Error("A daily GitHub refresh needs your personal GitHub connection and its personal contribution calendar.");
      }
      // A refresh changes only the public card, so an older review can hold an older
      // calendar. Keeping the refresh on must never roll that public calendar back.
      if (provider === "GITHUB" && await hasActiveGithubRefresh(ctx, user._id, prop._id)) {
        const submitted = Date.parse(selection.activity.capturedAt);
        const newerPublic = (published?.profile.cards ?? []).some((card, index) => previousPropIds[index] === prop._id &&
          card.activity?.kind === "contributionCalendar" && Date.parse(card.activity.capturedAt) > submitted);
        if (newerPublic) throw new Error("This card's public GitHub calendar refreshed since you reviewed it. Reload to publish the newer calendar.");
      }
    }
  }
  const products = await Promise.all([...new Set(allProps.map(prop => prop.productId))].map(id => ctx.db.get(id)));
  const productById = new Map(products.flatMap(product => product ? [[product._id, product] as const] : []));
  const selectedProducts = new Set(allProps.filter(prop => selectedIds.has(prop._id)).map(prop => productById.get(prop.productId)?.slug));
  const preserved = removeAllCards ? [] : (published?.profile.cards ?? []).flatMap<{
    card: Doc<"publishedProfiles">["profile"]["cards"][number]; propId: Id<"props"> | null;
  }>((card, index) => {
    const propId = previousPropIds[index];
    if (propId) return selectedIds.has(propId) ? [] : [{ card, propId }];
    if (selectedProducts.has(card.product.slug)) {
      const sameProductProps = allProps.filter(prop => productById.get(prop.productId)?.slug === card.product.slug);
      if (!sameProductProps.every(prop => selectedIds.has(prop._id))) throw new Error(`This older publication cannot distinguish the relationships for ${card.product.name}. Select all of its relationships together to replace or remove those cards.`);
      return [];
    }
    return [{ card, propId: null }];
  });
  // Unchanged cards are copied as they are, so one saved before these rules is checked here too.
  for (const { card } of preserved) {
    const link = card.primaryLink;
    if (link && !isHttpUrl(link.url)) {
      throw new Error(`The shared ${card.product.name} card links somewhere other than a plain http or https address. Include it in this change to update or remove it.`);
    }
    if (link && (link.label.length > LINK_LABEL_MAX || link.url.length > PUBLISHED_URL_MAX)) {
      throw new Error(`The shared ${card.product.name} card has a link over the length limit. Include it in this change to update or remove it.`);
    }
  }
  // There's no avatar editor, so a stored avatar that isn't http or https, or is over-long, is left off rather than blocking every publish.
  const avatarUrl = user.avatarUrl !== undefined && isHttpUrl(user.avatarUrl) && user.avatarUrl.length <= PUBLISHED_URL_MAX ? user.avatarUrl : undefined;
  // Profile links saved before the http(s) rule are left off the same way; the preview shows it.
  const profileLinks = user.profileLinks?.filter(link => isHttpUrl(link.url));
  const preferredLinkUrl = profileLinks?.some(link => link.url === user.preferredLinkUrl) ? user.preferredLinkUrl : undefined;
  const profileUser = { handle: user.handle, displayName: user.displayName, bio: user.bio, avatarUrl, profileLinks, preferredLinkUrl };
  const replacements = selections.filter(selection => selection.publish).flatMap(selection => {
    const prop = propsById.get(selection.propId)!;
    const product = productById.get(prop.productId);
    if (!product) throw new Error("The product for this relationship is unavailable.");
    const cards = projectPublicProfile({ user: profileUser, props: [{
      visibility: "PUBLIC", status: prop.status, goTo: prop.goTo, headline: prop.headline, note: prop.note,
      startedAt: prop.startedAt, activity: selection.activity,
      cost: selection.costVisibility !== undefined ? (selection.cost === undefined ? undefined : costSchema.parse(selection.cost)) : prop.cost,
      costVisibility: selection.costVisibility ?? prop.costVisibility,
      product: { name: product.name, slug: product.slug, domain: product.domain, description: product.description, logoUrl: product.logoUrl },
      links: selection.primaryLink ? [{ ...selection.primaryLink, isPrimary: true }] : [],
      usageLink: selection.usageLinkUrl === undefined ? undefined
        : { url: selection.usageLinkUrl, label: selection.usageLinkLabel ?? DEFAULT_USAGE_LINK_LABEL },
    }] }).cards;
    return cards.map(card => ({ card, propId: prop._id }));
  });
  // Omitted cards retain their exact approved stored projection.
  const cardsWithIdentity = [...preserved, ...replacements];
  const profile = publicProfileSchema.parse({ ...profileUser, cards: cardsWithIdentity.map(entry => entry.card) });
  // Match public reading's current retained presentation, independently of evidence.
  const displayCards = await Promise.all(profile.cards.map(async card => {
    const product = await ctx.db.query("products").withIndex("by_slug", q => q.eq("slug", card.product.slug)).unique();
    if (!product || product.domain !== card.product.domain) return card;
    const brand = await retainedProductBrand(ctx, product);
    return brand ? { ...card, product: { ...card.product, brand } } : card;
  }));
  const displayProfile = publicProfileSchema.parse({ ...profile, cards: displayCards });
  const revision = published?.revision ?? 0;
  // The flag is part of what the owner approved, so a remove-all preview can't approve another publish.
  const previewHash = await sha256(canonicalJson({ profile: displayProfile, revision, selections, userId: user._id, ...(removeAllCards ? { removeAllCards: true } : {}) }));
  return { profile, displayProfile, previewHash, revision, published, propsById, productById,
    cardPropIds: cardsWithIdentity.map(entry => entry.propId) };
}

export const previewPublication = query({
  args: { selections: v.array(selectionValidator), removeAllCards: v.optional(v.boolean()) },
  handler: async (ctx, { selections, removeAllCards }) => {
    const preview = await preparePublication(ctx, await requireUser(ctx), selections, removeAllCards === true);
    return { profile: preview.displayProfile, revision: preview.revision, previewHash: preview.previewHash };
  },
});

export const publishSelected = mutation({
  args: { selections: v.array(selectionValidator), expectedPublicationRevision: v.number(), expectedPreviewHash: v.string(), removeAllCards: v.optional(v.boolean()) },
  handler: async (ctx, { selections, expectedPublicationRevision, expectedPreviewHash, removeAllCards }) => {
    const user = await requireUser(ctx);
    await consumeWriteLimit(ctx, user._id, "publishSelected");
    const prepared = await preparePublication(ctx, user, selections, removeAllCards === true);
    // A republish replaces the snapshot, so it must never lift an operator takedown.
    if (prepared.published?.takenDownAt) throw new Error("This profile is under review. Contact 33@lecturesfrom.com.");
    if (expectedPublicationRevision !== prepared.revision) throw new Error("Your publication changed. Open a fresh preview before publishing.");
    if (expectedPreviewHash !== prepared.previewHash) throw new Error("The sharing preview changed. Open a fresh preview before publishing.");
    const now = new Date().toISOString();
    if (removeAllCards === true) {
      // Every public relationship goes private and stops refreshing, as each
      // one would if unpublished on its own.
      for (const prop of prepared.propsById.values()) {
        if (prop.visibility === "PUBLIC") await ctx.db.patch(prop._id, { visibility: "PRIVATE" });
      }
      const subscriptions = await ctx.db.query("metricSubscriptions").withIndex("by_user", q => q.eq("userId", user._id)).collect();
      for (const subscription of subscriptions) if (!subscription.revokedAt) await ctx.db.patch(subscription._id, { revokedAt: now });
    }
    const brandProductIds = new Set<Id<"products">>();
    for (const selection of selections) {
      const prop = prepared.propsById.get(selection.propId)!;
      const refresh = selection.publish && selection.autoRefresh && selection.connectorId && selection.metricKey && selection.activity
        ? { userId: user._id, propId: prop._id, connectorId: selection.connectorId,
          metricKey: selection.metricKey, attributionScope: selection.activity.attributionScope,
          refreshCadence: "DAILY" as const, approvedAt: now, revokedAt: undefined }
        : undefined;
      const subscriptions = await ctx.db.query("metricSubscriptions")
        .withIndex("by_prop_metric", q => q.eq("propId", prop._id)).collect();
      const existingRefresh = refresh ? subscriptions.find(subscription => subscription.userId === user._id && subscription.metricKey === refresh.metricKey) : undefined;
      // A new selection replaces this relationship's public refresh permission.
      // Omitted relationships keep their previously approved subscriptions.
      for (const subscription of subscriptions) {
        if (subscription.userId === user._id && !subscription.revokedAt && subscription._id !== existingRefresh?._id) {
          await ctx.db.patch(subscription._id, { revokedAt: now });
        }
      }
      if (refresh) {
        if (existingRefresh) await ctx.db.patch(existingRefresh._id, refresh);
        else await ctx.db.insert("metricSubscriptions", refresh);
      }
      if (!selection.publish) {
        if (prop.visibility === "PUBLIC") await ctx.db.patch(prop._id, { visibility: "PRIVATE" });
        continue;
      }
      await ctx.db.patch(prop._id, {
        ...(selection.costVisibility !== undefined ? { cost: selection.cost === undefined ? undefined : costSchema.parse(selection.cost), costVisibility: selection.costVisibility } : {}),
        visibility: "PUBLIC",
      });
      const links = await ctx.db.query("links").withIndex("by_prop", q => q.eq("propId", prop._id)).collect();
      const sameLink = links.find(link => selection.primaryLink && link.type === selection.primaryLink.type && link.url === selection.primaryLink.url && link.label === selection.primaryLink.label);
      for (const link of links) if (link.isPrimary !== (link._id === sameLink?._id)) await ctx.db.patch(link._id, { isPrimary: link._id === sameLink?._id });
      if (selection.primaryLink && !sameLink) await ctx.db.insert("links", { propId: prop._id, ...selection.primaryLink, isPrimary: true });
      const product = prepared.productById.get(prop.productId)!;
      const drafts = await ctx.db.query("draftImports").withIndex("by_user_slug", q => q.eq("userId", user._id).eq("suggestedProductSlug", product.slug)).collect();
      for (const draft of drafts) if (draft.resultPropId === prop._id) await ctx.db.patch(draft._id, { status: "MERGED" });
      if (!brandProductIds.has(product._id)) {
        brandProductIds.add(product._id);
        await ensureProductBrand(ctx, product);
      }
    }
    const value = { handle: user.handle, revision: prepared.revision + 1, publishedAt: now,
      profile: prepared.profile, cardPropIds: prepared.cardPropIds };
    if (prepared.published) await ctx.db.replace(prepared.published._id, value);
    else await ctx.db.insert("publishedProfiles", value);
    const site = await ctx.db.query("sites").withIndex("by_owner", q => q.eq("ownerId", user._id)).unique();
    if (site) await ctx.db.patch(site._id, { handle: user.handle, status: "ACTIVE" });
    await ctx.db.patch(user._id, { onboardingStatus: "PUBLISHED", updatedAt: now });
    return { handle: user.handle, cards: prepared.profile.cards.length };
  },
});

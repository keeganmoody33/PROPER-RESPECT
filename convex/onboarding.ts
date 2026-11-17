import { reviewedMeasurementsForPublication } from "./retainedEvidence";
import { sameGithubRefreshBinding, validGithubRefreshBinding, type GithubRefreshBinding } from "./githubRefreshIdentity";
import { relationshipLinks } from "./relationshipLinks";
import { isHttpUrl } from "../src/domain/http-url";
import { validateProfileLinks } from "../src/domain/profile-links";
import { mailboxTesterAllowed } from "../src/domain/mailbox-testers";
import { uploadAttributionStatus } from "../src/domain/evidence-upload";
import { addManualProductArgs, addManualProductHandler } from "./manualProducts";
import { ensureProductBrand, retainedProductBrand } from "./productBrands";
import { v, type Infer } from "convex/values";
import { paginationOptsValidator, type PaginationOptions } from "convex/server";
import { mutation, query, internalMutation, internalQuery, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { consumeWriteLimit, requireIdentity, requireUser } from "./authHelpers";
import { claimableHandleSchema } from "../src/domain/onboarding";
import { handleSchema } from "../src/domain/handle";
import { projectPublishedMeasurements } from "../src/domain/measurements";
import { projectPublicProfile, publicProfileSchema, withHttpArtifacts } from "../src/domain/public-profile";
import { classifyEvidenceUpload, normalizeUploadMime } from "../src/domain/evidence-upload";
import { resolveProduct } from "../src/domain/discovery";
import { costSchema } from "../src/domain/cost";
import { DEFAULT_USAGE_LINK_LABEL, usageLinkUrlSchema } from "../src/domain/usage-links";
import { BIO_MAX, DISPLAY_NAME_MAX, LINK_LABEL_MAX, PUBLISHED_URL_MAX, trimToLength } from "../src/domain/published-text-limits";
import { canonicalJson } from "../src/domain/canonical-json";
import { sha256 } from "../src/domain/product-knowledge";
import { resolvePublishedCardPropIds } from "./publication";
import { shareAllSelections } from "../src/domain/share-all";
import { listedUses } from "../src/domain/product-uses";
import { CREDIT_PLATFORMS, listedCredit, type PropsCredit } from "../src/domain/props-credit";
import { publicPublication } from "./publicProfiles";
import { associatedAccountEvidenceForProp } from "./associatedAccountEvidence";
import {
  profileLinkValidator,
  activityModuleValidator,
  linkTypeValidator,
  statusValidator,
  relationshipLevelValidator,
  costValidator,
  costVisibilityValidator,
  claimVerdictValidator,
  usageLinkLabelValidator,
} from "./validators";
import { parseOrUserError, userError } from "../src/domain/user-error";

const HANDLE_RULE = "Use up to 39 lowercase letters, numbers and hyphens, starting and ending with a letter or number.";
const COST_RULE = "Check the cost's amount, currency and date, then preview again.";

function pendingHandle(subject: string) {
  const suffix = subject.toLowerCase().replace(/[^a-z0-9]/g, "").slice(-24);
  return `pending-${suffix || "account"}`;
}

// claimHandle writes the site's handle, so a placeholder from ensureAccount never matches,
// while an explicitly claimed handle does even when it starts with "pending-".
function hasClaimedPublicIdentity(site: Doc<"sites"> | null, user: Doc<"users">) {
  return site?.handle === user.handle;
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
  throw userError("An available account handle could not be reserved. No account was created.");
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
    // An account that already holds a handle keeps it when it saves its identity again, even one reserved since.
    const kept = args.handle.trim().toLowerCase() === user.handle;
    const handle = kept ? handleSchema.parse(user.handle) : parseOrUserError(claimableHandleSchema, args.handle, HANDLE_RULE);
    await consumeWriteLimit(ctx, user._id, "claimHandle");
    const displayName = args.displayName.trim(), bio = args.bio.trim();
    if (!displayName) throw userError("Enter a display name before saving your public identity.");
    if (displayName.length > DISPLAY_NAME_MAX) throw userError("Use a display name of 80 characters or fewer.");
    if (bio.length > BIO_MAX) throw userError("Use a bio of 500 characters or fewer.");
    if (await ctx.db.query("publicProfileAliases").withIndex("by_handle", q => q.eq("handle", handle)).first()) {
      throw userError("That handle is reserved by an existing public profile.");
    }
    const linkFields = args.profileLinks !== undefined || args.preferredLinkUrl !== undefined
      ? validateProfileLinks(args.profileLinks ?? user.profileLinks ?? [], args.preferredLinkUrl === null ? undefined : args.preferredLinkUrl ?? user.preferredLinkUrl)
      : {};
    const owners = await ownersForHandle(ctx, handle);
    if (owners.some(owner => owner._id !== user._id)) {
      throw userError("That handle is already claimed.");
    }

    if (handle !== user.handle) {
      const currentPublication = await ctx.db.query("publishedProfiles")
        .withIndex("by_handle", q => q.eq("handle", user.handle)).unique();
      if (currentPublication) throw userError("A published handle cannot be changed here. Its public identity requires a separate owner-verified migration.");
      const targetPublication = await ctx.db.query("publishedProfiles")
        .withIndex("by_handle", q => q.eq("handle", handle)).unique();
      if (targetPublication) throw userError("That handle already has a published profile and cannot be claimed here.");
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

async function getStateHandler(ctx: QueryCtx, args: {
  includeCards?: boolean; includeClaims?: boolean; includeLegacyCollections?: boolean; includeAccountEvidence?: boolean;
  paginationOpts?: PaginationOptions;
}) {
    const identity = await requireIdentity(ctx);
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) =>
        q.eq("authSubject", identity.subject),
      )
      .unique();
    if (!user) return null;
    const propQuery = ctx.db.query("props").withIndex("by_user", q => q.eq("userId", user._id));
    const propPage = args.paginationOpts
      ? await propQuery.paginate({ ...args.paginationOpts, numItems: Math.min(args.paginationOpts.numItems, 25), maximumRowsRead: 25 })
      : null;
    const [props, drafts, connectors, evidence, published, site] = await Promise.all([
      args.includeCards === false ? [] : propPage ? propPage.page : propQuery.collect(),
      args.includeLegacyCollections === false ? [] : ctx.db
        .query("draftImports")
        .withIndex("by_user_slug", (q) => q.eq("userId", user._id))
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
    const publishedPropIds = published && props.length > 0
      ? await resolvePublishedCardPropIds(ctx, published, user._id, propPage ? undefined : props, propPage ? props : undefined)
      : [];

    const cards = await Promise.all(
      props.map(async (prop) => {
        const product = await ctx.db.get(prop.productId);
        const links = await relationshipLinks(ctx, prop._id);
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
      isDone: propPage?.isDone ?? true,
      continueCursor: propPage?.continueCursor ?? "",
      hasPublicationAtCurrentHandle: published !== null,
      hasClaimedPublicIdentity: hasClaimedPublicIdentity(site, user),
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
}

export const getState = query({
  args: { includeCards: v.optional(v.boolean()), includeClaims: v.optional(v.boolean()), includeLegacyCollections: v.optional(v.boolean()), includeAccountEvidence: v.optional(v.boolean()) },
  handler: getStateHandler,
});

export const sharingCards = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    if (!Number.isSafeInteger(args.paginationOpts.numItems) || args.paginationOpts.numItems < 1) throw new Error("Invalid page size.");
    const state = await getStateHandler(ctx, { ...args, includeClaims: false, includeLegacyCollections: false, includeAccountEvidence: false });
    return { page: state?.cards ?? [], isDone: state?.isDone ?? true, continueCursor: state?.continueCursor ?? "" };
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
    if (!prop || prop.userId !== user._id || !raw || raw.userId !== user._id || raw.deletedAt) throw userError("Evidence unavailable.");
    if (!Number.isInteger(args.observationIndex) || args.observationIndex < 0 || !raw.observations?.[args.observationIndex]) throw new Error("Unknown observation.");
    const proof = await ctx.db.query("proofs").withIndex("by_propId_and_rawEvidenceId", q => q.eq("propId", prop._id).eq("rawEvidenceId", raw._id)).first();
    if (!proof) throw userError("Evidence does not support this card.");
    if ((args.correction?.length ?? 0) > 4000) throw userError("Correction is too long.");
    return await ctx.db.insert("claimReviews", { ...args, userId: user._id, reviewedAt: new Date().toISOString() });
  },
});

// Old clients must reload instead of creating new storage objects with no owner binding.
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    throw userError("Reload the application to use authenticated file uploads.");
  },
});

export const beginUpload = mutation({
  args: { filename: v.string(), mimeType: v.string(), byteSize: v.number(), vendor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const identity = await requireIdentity(ctx);
    await consumeWriteLimit(ctx, user._id, "beginUpload");
    const { mimeType } = classifyEvidenceUpload(args);
    if ((args.vendor?.length ?? 0) > 200) throw userError("Invalid product name.");
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
  if (existing.userId !== user._id || existing.deletedAt) throw userError("Upload unavailable.");
  if (!existing.uploadAttribution) return;
  const identity = await requireIdentity(ctx);
  if (existing.uploadAttribution.tokenIdentifier !== identity.tokenIdentifier) {
    throw userError("Upload unavailable.");
  }
}

async function ownedUploadTicket(ctx: QueryCtx | MutationCtx, ticketId: Id<"uploadTickets">) {
  const user = await requireUser(ctx);
  const identity = await requireIdentity(ctx);
  const ticket = await ctx.db.get(ticketId);
  if (!ticket || ticket.userId !== user._id || ticket.tokenIdentifier !== identity.tokenIdentifier)
    throw userError("Upload unavailable.");
  if (ticket.expiresAt <= Date.now() && !ticket.evidenceId) throw userError("Upload expired. Choose the file again.");
  if (ticket.evidenceId) {
    const evidence = await ctx.db.get(ticket.evidenceId);
    if (!evidence || evidence.deletedAt) throw userError("Upload unavailable.");
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
    if (args.activity) throw userError("Upload retention cannot add measurements. Review selected observations separately.");
    const storage = await ctx.db.system.get(args.storageId);
    if (!storage || storage.size !== args.byteSize || normalizeUploadMime(storage.contentType ?? "") !== normalizeUploadMime(args.mimeType)) {
      throw new Error("Stored file metadata does not match this upload.");
    }
    const existing = await ctx.db.query("rawEvidence").withIndex("by_storage", q => q.eq("storageId", args.storageId)).first();
    if (existing) {
      await assertRetainableExistingUpload(ctx, existing, user);
      if (existing.filename !== args.filename || existing.mimeType !== args.mimeType || existing.byteSize !== args.byteSize || existing.detectedVendor !== args.vendor) {
        throw userError("This upload was already retained with different metadata.");
      }
      return existing._id;
    }
    const { sourceType } = classifyEvidenceUpload(args);
    const ticket = await ctx.db.query("uploadTickets").withIndex("by_storage", q => q.eq("storageId", args.storageId)).unique();
    if (!ticket) throw userError("Upload unavailable. Choose the file again through authenticated upload.");
    await ownedUploadTicket(ctx, ticket._id);
    if (ticket.evidenceId || !ticket.sha256 || !ticket.receivedAt) throw userError("Upload unavailable.");
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
            // The owner writes the card's line; an upload writes none for them.
            headline: "",
            note: "",
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
      throw userError("Evidence not found.");
    }
    if (evidence.storageId) {
      await ctx.storage.delete(evidence.storageId);
    }
    await ctx.db.patch(evidenceId, {
      storageId: undefined,
      payload: undefined,
      measurementReview: undefined,
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
  level: v.optional(relationshipLevelValidator),
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
  measurementEvidenceIds: v.optional(v.array(v.id("rawEvidence"))),
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

// One publication request is exactly one of these. shareAllConfirmed and
// removeAllCards are server-derived, so neither mixes with picked selections.
type PublicationChange =
  | { kind: "SELECTED"; selections: PublicationSelection[] }
  | { kind: "REMOVE_ALL" }
  | { kind: "SHARE_ALL_CONFIRMED" };

function parsePublicationChange(args: { selections: PublicationSelection[]; removeAllCards?: boolean; shareAllConfirmed?: boolean }): PublicationChange {
  if (args.shareAllConfirmed === true) {
    if (args.selections.length > 0 || args.removeAllCards === true) throw userError("Share all confirmed cards on its own, without other card changes.");
    return { kind: "SHARE_ALL_CONFIRMED" };
  }
  if (args.removeAllCards === true) {
    if (args.selections.length > 0) throw userError("Remove all cards on its own, without other card changes.");
    return { kind: "REMOVE_ALL" };
  }
  return { kind: "SELECTED", selections: args.selections };
}

/** Both preview and commit use this projection, before any write occurs. */
// The metrics a public card may refresh, and the connector provider each needs (R09).
const REFRESH_METRIC_PROVIDERS: Record<string, "GITHUB" | "DEVIN" | undefined> = {
  "github.contributions": "GITHUB",
  "devin.sessions": "DEVIN",
};

async function hasActiveGithubRefresh(ctx: QueryCtx | MutationCtx, userId: Id<"users">, propId: Id<"props">) {
  const subscriptions = await ctx.db.query("metricSubscriptions")
    .withIndex("by_prop_metric", q => q.eq("propId", propId).eq("metricKey", "github.contributions")).collect();
  for (const subscription of subscriptions) {
    if (subscription.userId !== userId || subscription.revokedAt !== undefined) continue;
    const connector = await ctx.db.get(subscription.connectorId);
    if (connector?.userId === userId && connector.provider === "GITHUB" &&
        ["CONNECTED", "ERROR"].includes(connector.status) && sameGithubRefreshBinding(subscription.githubBinding, connector.githubBinding)) return true;
  }
  return false;
}

// Remove-all runs as one transaction, so its writes stay far inside Convex's
// per-mutation limits. Bigger accounts unpublish in batches of 100 instead.
const REMOVE_ALL_MAX_WRITES = 1000;

// Convex stores a document of at most 1 MiB. The budget leaves room for the
// row's other fields and for Convex's own encoding being larger than JSON.
const PUBLISHED_PROFILE_MAX_BYTES = 900_000;

// removeAllCards (R15, "Unpublish all cards"): the server drops every published
// card itself, including older cards that can't be matched to a relationship,
// in one step with no selection limit. The profile fields are not cards and
// stay public. It can't be combined with other changes.
async function preparePublication(ctx: QueryCtx | MutationCtx, user: Doc<"users">, change: PublicationChange) {
  const owners = await ownersForHandle(ctx, user.handle);
  if (owners.length !== 1 || owners[0]._id !== user._id) throw userError("Publication requires the unique owner of this handle. Resolve account ownership before sharing.");
  // Older rows were saved before these caps, so every publish checks them.
  if (user.displayName.length > DISPLAY_NAME_MAX) throw userError("Shorten your display name to 80 characters or fewer before sharing.");
  if (user.bio.length > BIO_MAX) throw userError("Shorten your bio to 500 characters or fewer before sharing.");
  if (change.kind === "SHARE_ALL_CONFIRMED" &&
    !hasClaimedPublicIdentity(await ctx.db.query("sites").withIndex("by_owner", q => q.eq("ownerId", user._id)).unique(), user)) {
    throw userError("Claim your public handle before sharing your stack.");
  }
  const removeAllCards = change.kind === "REMOVE_ALL";
  const allProps = await ctx.db.query("props").withIndex("by_user", q => q.eq("userId", user._id)).collect();
  const propsById = new Map(allProps.map(prop => [prop._id, prop]));
  if (removeAllCards) {
    // The same count the commit writes: every public relationship and active refresh.
    const subscriptions = await ctx.db.query("metricSubscriptions").withIndex("by_user", q => q.eq("userId", user._id)).collect();
    const writes = allProps.filter(prop => prop.visibility === "PUBLIC").length + subscriptions.filter(subscription => !subscription.revokedAt).length;
    if (writes > REMOVE_ALL_MAX_WRITES) {
      throw userError("Unpublish all handles up to 1,000 public cards and daily refreshes at once. Remove cards 100 at a time in Choose what to share, then try again, or ask through the contact page.");
    }
  }
  const published = await ctx.db.query("publishedProfiles").withIndex("by_handle", q => q.eq("handle", user.handle)).unique();
  if (removeAllCards) {
    // Remove-all only takes cards down; it must never create a first publication.
    if (!published) throw userError("There is no published page to remove cards from.");
    // Publishing is refused during a takedown, so say so before the owner approves.
    if (published.takenDownAt) throw userError("This profile is under review. Contact 33@lecturesfrom.com.");
  }
  const previousPropIds = published ? await resolvePublishedCardPropIds(ctx, published, user._id, allProps) : [];
  const products = await Promise.all([...new Set(allProps.map(prop => prop.productId))].map(id => ctx.db.get(id)));
  const productById = new Map(products.flatMap(product => product ? [[product._id, product] as const] : []));
  const unresolvedSlugs = new Set((published?.profile.cards ?? []).flatMap((card, index) => previousPropIds[index] ? [] : [card.product.slug]));
  const shareAll = change.kind === "SHARE_ALL_CONFIRMED"
    ? await shareAllFromSavedState(ctx, allProps, productById, new Set(previousPropIds), unresolvedSlugs) : null;
  const selections: PublicationSelection[] = change.kind === "SELECTED" ? change.selections : shareAll?.selections ?? [];
  if (selections.length > 100) throw userError("Select at most 100 relationships to change.");
  const selectedIds = new Set(selections.map(selection => selection.propId));
  if (selectedIds.size !== selections.length) throw userError("Select each relationship only once.");
  const refreshAccounts: (GithubRefreshBinding & { connectorId: Id<"connectorAccounts">; accountLabel: string })[] = [];
  for (const selection of selections) {
    const prop = propsById.get(selection.propId);
    if (!prop) throw userError("Cannot publish another user's product.");
    if (selection.publish || prop.visibility === "PUBLIC") {
      if ((selection.expectedRelationshipVersion ?? 0) !== (prop.relationshipVersion ?? 0)) throw userError("This relationship changed. Reload before changing publication.");
    }
    if (!selection.publish) continue;
    if (prop.visibility === "DRAFT") throw userError("Confirm and save this relationship privately before publishing.");
    if (selection.primaryLink && !isHttpUrl(selection.primaryLink.url)) throw userError("Use an http or https link without embedded credentials.");
    if (selection.primaryLink && selection.primaryLink.label.length > LINK_LABEL_MAX) throw userError("Use a link label of 200 characters or fewer.");
    if (selection.primaryLink && selection.primaryLink.url.length > PUBLISHED_URL_MAX) throw userError("Use a link of 2,048 characters or fewer.");
    if (selection.status !== prop.status || selection.level !== prop.level || selection.headline.trim() !== prop.headline ||
        selection.note.trim() !== prop.note || selection.startedAt !== prop.startedAt) {
      throw userError("Save relationship changes privately before publishing.");
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
      if (!carriesRefreshedCalendar) throw userError("Publish only the supporting activity already saved on this relationship.");
    }
    if (selection.usageLinkUrl !== undefined) {
      if (selection.usageLinkUrl !== prop.supportingUrl) throw userError("Save the link privately before publishing it.");
      if (!usageLinkUrlSchema.safeParse(selection.usageLinkUrl).success) throw userError("Use an https link without embedded credentials.");
    }
    // A checked refresh for published activity must name its connection and metric.
    // Withholding the activity instead stops the refresh, as unchecking does.
    if (selection.autoRefresh && selection.activity && (!selection.connectorId || !selection.metricKey)) {
      throw userError("A refresh needs its connected account and measurement. Reload and review this card again.");
    }
    if (selection.autoRefresh && selection.connectorId && selection.metricKey && selection.activity) {
      const provider = REFRESH_METRIC_PROVIDERS[selection.metricKey];
      if (!provider) throw userError("This measurement can't refresh automatically.");
      const connector = await ctx.db.get(selection.connectorId);
      if (!connector || connector.userId !== user._id || connector.status === "REVOKED" || connector.provider !== provider) {
        throw userError("A connected account is required for refresh.");
      }
      // The same connector states the scheduled GitHub refresh accepts (convex/connectors.ts).
      const product = provider === "GITHUB" ? await ctx.db.get(prop.productId) : null;
      if (provider === "GITHUB" && (product?.slug !== "github" || connector.attributionScope !== "PERSONAL" ||
          !["CONNECTED", "ERROR"].includes(connector.status) ||
          selection.activity.kind !== "contributionCalendar" || selection.activity.attributionScope !== "PERSONAL")) {
        throw userError("A daily GitHub refresh needs your personal GitHub connection and its personal contribution calendar.");
      }
      if (provider === "GITHUB") {
        if (!validGithubRefreshBinding(connector.githubBinding)) {
          throw userError("Reconnect GitHub before approving a daily refresh, then open a fresh sharing preview.");
        }
        refreshAccounts.push({ connectorId: connector._id, accountLabel: connector.accountLabel, ...connector.githubBinding });
      }
      // A refresh changes only the public card, so an older review can hold an older
      // calendar. Keeping the refresh on must never roll that public calendar back.
      if (provider === "GITHUB" && await hasActiveGithubRefresh(ctx, user._id, prop._id)) {
        const submitted = Date.parse(selection.activity.capturedAt);
        const newerPublic = (published?.profile.cards ?? []).some((card, index) => previousPropIds[index] === prop._id &&
          card.activity?.kind === "contributionCalendar" && Date.parse(card.activity.capturedAt) > submitted);
        if (newerPublic) throw userError("This card's public GitHub calendar refreshed since you reviewed it. Reload to publish the newer calendar.");
      }
    }
  }
  const selectedProducts = new Set(allProps.filter(prop => selectedIds.has(prop._id)).map(prop => productById.get(prop.productId)?.slug));
  const preserved = removeAllCards ? [] : (published?.profile.cards ?? []).flatMap<{
    card: Doc<"publishedProfiles">["profile"]["cards"][number]; propId: Id<"props"> | null;
  }>((card, index) => {
    const propId = previousPropIds[index];
    if (propId) return selectedIds.has(propId) ? [] : [{ card, propId }];
    if (selectedProducts.has(card.product.slug)) {
      const sameProductProps = allProps.filter(prop => productById.get(prop.productId)?.slug === card.product.slug);
      if (!sameProductProps.every(prop => selectedIds.has(prop._id))) throw userError(`This older publication cannot distinguish the relationships for ${card.product.name}. Select all of its relationships together to replace or remove those cards.`);
      return [];
    }
    return [{ card, propId: null }];
  });
  // Unchanged cards are copied as they are, so one saved before these rules is checked here too.
  // Artifact links that aren't http(s) are evidence the owner can't edit, so they're left off instead.
  for (const entry of preserved) {
    const activity = withHttpArtifacts(entry.card.activity);
    if (activity !== entry.card.activity) entry.card = { ...entry.card, activity };
  }
  for (const { card } of preserved) {
    const link = card.primaryLink;
    if (link && !isHttpUrl(link.url)) {
      throw userError(`The shared ${card.product.name} card links somewhere other than a plain http or https address. Include it in this change to update or remove it.`);
    }
    if (link && (link.label.length > LINK_LABEL_MAX || link.url.length > PUBLISHED_URL_MAX)) {
      throw userError(`The shared ${card.product.name} card has a link over the length limit. Include it in this change to update or remove it.`);
    }
  }
  // There's no avatar editor, so a stored avatar that isn't http or https, or is over-long, is left off rather than blocking every publish.
  const avatarUrl = user.avatarUrl !== undefined && isHttpUrl(user.avatarUrl) && user.avatarUrl.length <= PUBLISHED_URL_MAX ? user.avatarUrl : undefined;
  // Profile links saved before the http(s) rule are left off the same way; the preview shows it.
  const profileLinks = user.profileLinks?.filter(link => isHttpUrl(link.url));
  const preferredLinkUrl = profileLinks?.some(link => link.url === user.preferredLinkUrl) ? user.preferredLinkUrl : undefined;
  const profileUser = { handle: user.handle, displayName: user.displayName, bio: user.bio, avatarUrl, profileLinks, preferredLinkUrl };
  const measurementProjection = new Map<Id<"props">, Awaited<ReturnType<typeof reviewedMeasurementsForPublication>>>();
  for (const selection of selections) if (selection.publish && selection.measurementEvidenceIds?.length) {
    measurementProjection.set(selection.propId, await reviewedMeasurementsForPublication(ctx, user._id, selection.propId, selection.measurementEvidenceIds));
  }
  // Each credited Proper Respect handle is looked up once, however many cards credit it.
  const creditedHandles = new Map<string, Promise<string | undefined>>();
  const publishedHandle = (handle: string) => {
    const known = creditedHandles.get(handle);
    if (known) return known;
    const found = publicPublication(ctx, handle).then(publication => publication?.profile.handle);
    creditedHandles.set(handle, found);
    return found;
  };
  const credits = new Map(await Promise.all(selections.filter(selection => selection.publish).map(async selection => {
    const prop = propsById.get(selection.propId)!;
    return [prop._id, await publishedCredit(prop.credit, productById.get(prop.productId)?.name ?? "this product", publishedHandle)] as const;
  })));
  const replacements = selections.filter(selection => selection.publish).flatMap(selection => {
    const prop = propsById.get(selection.propId)!;
    const product = productById.get(prop.productId);
    if (!product) throw userError("The product for this relationship is unavailable.");
    const projection = measurementProjection.get(prop._id);
    const measurements = projection
      ? projectPublishedMeasurements(selection.publish ? "PUBLIC" : "PRIVATE", projection.retained, projection.publishedIds)
      : undefined;
    const cards = projectPublicProfile({ user: profileUser, props: [{
      visibility: "PUBLIC", status: prop.status, level: prop.level, goTo: prop.goTo, headline: prop.headline, uses: prop.uses, credit: credits.get(prop._id), note: prop.note,
      startedAt: prop.startedAt, activity: selection.activity, measurements,
      cost: selection.costVisibility !== undefined ? (selection.cost === undefined ? undefined : parseOrUserError(costSchema, selection.cost, COST_RULE)) : prop.cost,
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
  const checked = publicProfileSchema.parse({ ...profileUser, cards: cardsWithIdentity.map(entry => entry.card) });
  // The schema reads a level the registry no longer knows as none, and drops uses and a credit it can't accept. That is
  // for display: an omitted card is stored with the level, uses and credit it was published with.
  const profile = { ...checked, cards: checked.cards.map((card, index) => {
    if (index >= preserved.length) return card;
    const { level, uses, credit } = preserved[index].card;
    return { ...card, ...(level !== undefined ? { level } : {}), ...(uses !== undefined ? { uses } : {}), ...(credit !== undefined ? { credit } : {}) };
  }) };
  const cardPropIds = cardsWithIdentity.map(entry => entry.propId);
  if (new TextEncoder().encode(JSON.stringify({ profile, cardPropIds })).length > PUBLISHED_PROFILE_MAX_BYTES) {
    throw userError("This page is too large to publish. Share fewer cards or shorten long notes, then preview again.");
  }
  // Match public reading's current retained presentation, independently of evidence.
  const displayCards = await Promise.all(profile.cards.map(async ({ uses: storedUses, credit: storedCredit, ...rest }) => {
    // Shown as the public reader shows them: a left-out card keeps its stored uses and credit, and only what still fits displays.
    const uses = listedUses(rest.product.slug, storedUses);
    const credit = listedCredit(storedCredit);
    const card = { ...rest, ...(uses ? { uses } : {}), ...(credit ? { credit } : {}) };
    const product = await ctx.db.query("products").withIndex("by_slug", q => q.eq("slug", card.product.slug)).unique();
    if (!product || product.domain !== card.product.domain) return card;
    const brand = await retainedProductBrand(ctx, product);
    return brand ? { ...card, product: { ...card.product, brand } } : card;
  }));
  const displayProfile = publicProfileSchema.parse({ ...profile, cards: displayCards });
  const revision = published?.revision ?? 0;
  // The flag is part of what the owner approved, so a remove-all or share-all preview can't approve another publish.
  const previewHash = await sha256(canonicalJson({ profile: displayProfile, revision, selections, refreshAccounts, userId: user._id, measurementApprovals: [...measurementProjection].map(([propId, projection]) => [propId, projection?.approvalDigest]),
    ...(removeAllCards ? { removeAllCards: true } : {}),
    ...(shareAll ? { shareAllConfirmed: true, remainingCount: shareAll.remainingCount, skipped: shareAll.skipped } : {}) }));
  return { profile, displayProfile, previewHash, revision, published, propsById, productById, refreshAccounts, cardPropIds, selections, shareAll };
}

// The owner chose this credit, so one that no longer fits its platform's rule stops the publish rather than vanishing.
// A Proper Respect handle links only when it names a published profile now; the card keeps that answer as published.
// Only the credited profile's handle is read, never its cards, so many credits stay within one transaction's limits.
async function publishedCredit(stored: Doc<"props">["credit"], productName: string,
  publishedHandle: (handle: string) => Promise<string | undefined>): Promise<PropsCredit | undefined> {
  if (!stored) return undefined;
  // A link is decided here, never carried over from what was saved.
  const saved = { platform: stored.platform, handle: stored.handle, platformName: stored.platformName };
  const credit = listedCredit(saved);
  if (!credit) {
    const platform = CREDIT_PLATFORMS.find(option => option.id === saved.platform)?.label ?? "its platform";
    throw userError(`Who put you on ${productName} no longer fits ${platform}'s handle rule. Edit it in your collection, then preview again.`);
  }
  if (credit.platform !== "PROPER_RESPECT") return credit;
  const handle = await publishedHandle(credit.handle);
  return handle ? { ...credit, handle, linked: true } : credit;
}

async function shareAllFromSavedState(ctx: QueryCtx | MutationCtx, allProps: Doc<"props">[],
  productById: Map<Id<"products">, Doc<"products">>, onPage: Set<Id<"props"> | null>, unresolvedSlugs: Set<string>) {
  const candidates = await Promise.all(allProps.map(async prop => {
    const product = productById.get(prop.productId);
    if (!product) return [];
    // The same primary link relationshipLinks puts first for the review.
    const primaryLink = prop.visibility === "PRIVATE" ? await ctx.db.query("links")
      .withIndex("by_prop_primary", q => q.eq("propId", prop._id).eq("isPrimary", true)).order("desc").first() : null;
    return [{
      propId: prop._id, visibility: prop.visibility, onPublishedPage: onPage.has(prop._id),
      matchesUnresolvedPublishedCard: unresolvedSlugs.has(product.slug), relationshipVersion: prop.relationshipVersion,
      status: prop.status, level: prop.level, headline: prop.headline, note: prop.note, startedAt: prop.startedAt, startedAtSource: prop.startedAtSource,
      cost: prop.cost, product: { name: product.name, domain: product.domain }, primaryLink: primaryLink ?? undefined,
    }];
  }));
  return shareAllSelections(candidates.flat());
}

export const previewPublication = query({
  args: { selections: v.array(selectionValidator), removeAllCards: v.optional(v.boolean()), shareAllConfirmed: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const change = parsePublicationChange(args);
    const preview = await preparePublication(ctx, await requireUser(ctx), change);
    const shareAll = preview.shareAll && { sharedCount: preview.shareAll.selections.length,
      remainingCount: preview.shareAll.remainingCount, skipped: preview.shareAll.skipped };
    return { profile: preview.displayProfile, revision: preview.revision, previewHash: preview.previewHash, refreshAccounts: preview.refreshAccounts, ...shareAll };
  },
});

export const publishSelected = mutation({
  args: { selections: v.array(selectionValidator), expectedPublicationRevision: v.number(), expectedPreviewHash: v.string(), removeAllCards: v.optional(v.boolean()), shareAllConfirmed: v.optional(v.boolean()) },
  handler: async (ctx, { expectedPublicationRevision, expectedPreviewHash, ...args }) => {
    const change = parsePublicationChange(args);
    const user = await requireUser(ctx);
    await consumeWriteLimit(ctx, user._id, "publishSelected");
    const prepared = await preparePublication(ctx, user, change);
    // A republish replaces the snapshot, so it must never lift an operator takedown.
    if (prepared.published?.takenDownAt) throw userError("This profile is under review. Contact 33@lecturesfrom.com.");
    if (expectedPublicationRevision !== prepared.revision) throw userError("Your publication changed. Open a fresh preview before publishing.");
    if (expectedPreviewHash !== prepared.previewHash) throw userError("The sharing preview changed. Open a fresh preview before publishing.");
    if (change.kind === "SHARE_ALL_CONFIRMED" && prepared.selections.length === 0) throw userError("There are no confirmed cards left to share.");
    const now = new Date().toISOString();
    if (change.kind === "REMOVE_ALL") {
      // Every public relationship goes private and stops refreshing, as each
      // one would if unpublished on its own.
      for (const prop of prepared.propsById.values()) {
        if (prop.visibility === "PUBLIC") await ctx.db.patch(prop._id, { visibility: "PRIVATE" });
      }
      const subscriptions = await ctx.db.query("metricSubscriptions").withIndex("by_user", q => q.eq("userId", user._id)).collect();
      for (const subscription of subscriptions) if (!subscription.revokedAt) await ctx.db.patch(subscription._id, { revokedAt: now });
    }
    const brandProductIds = new Set<Id<"products">>();
    // Share-all derives its selections on the server, so commit what was prepared.
    for (const selection of prepared.selections) {
      const prop = prepared.propsById.get(selection.propId)!;
      const account = prepared.refreshAccounts.find(account => account.connectorId === selection.connectorId);
      const refresh = selection.publish && selection.autoRefresh && selection.connectorId && selection.metricKey && selection.activity
        ? { userId: user._id, propId: prop._id, connectorId: selection.connectorId,
          metricKey: selection.metricKey, attributionScope: selection.activity.attributionScope,
          githubBinding: account ? { providerAccountId: account.providerAccountId, generation: account.generation } : undefined,
          refreshCadence: "DAILY" as const, approvedAt: now, revokedAt: undefined }
        : undefined;
      const subscriptions = await ctx.db.query("metricSubscriptions")
        .withIndex("by_prop_metric", q => q.eq("propId", prop._id)).collect();
      const existingRefresh = refresh ? subscriptions.find(subscription => subscription.userId === user._id && subscription.metricKey === refresh.metricKey &&
        (refresh.metricKey !== "github.contributions" || (subscription.revokedAt === undefined && sameGithubRefreshBinding(subscription.githubBinding, refresh.githubBinding)))) : undefined;
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
        ...(selection.costVisibility !== undefined ? { cost: selection.cost === undefined ? undefined : parseOrUserError(costSchema, selection.cost, COST_RULE), costVisibility: selection.costVisibility } : {}),
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

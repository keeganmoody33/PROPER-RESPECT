import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireIdentity, requireUser } from "./authHelpers";
import { claimableHandleSchema } from "../src/domain/onboarding";
import { projectPublicProfile } from "../src/domain/public-profile";
import { resolveProduct } from "../src/domain/discovery";
import {
  activityModuleValidator,
  linkTypeValidator,
  statusValidator,
} from "./validators";

function pendingHandle(subject: string) {
  const suffix = subject.toLowerCase().replace(/[^a-z0-9]/g, "").slice(-24);
  return `pending-${suffix || "account"}`;
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

    const now = new Date().toISOString();
    return await ctx.db.insert("users", {
      authSubject: identity.subject,
      handle: pendingHandle(identity.subject),
      displayName:
        args.displayName ?? identity.name ?? identity.email ?? "New linker",
      bio: "",
      avatarUrl: args.avatarUrl,
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
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const handle = claimableHandleSchema.parse(args.handle);
    const owner = await ctx.db
      .query("users")
      .withIndex("by_handle", (q) => q.eq("handle", handle))
      .unique();
    if (owner && owner._id !== user._id) {
      throw new Error("That handle is already claimed.");
    }

    const now = new Date().toISOString();
    await ctx.db.patch(user._id, {
      handle,
      displayName: args.displayName.trim(),
      bio: args.bio.trim(),
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
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) =>
        q.eq("authSubject", identity.subject),
      )
      .unique();
    if (!user) return null;
    const [props, drafts, connectors, evidence] = await Promise.all([
      ctx.db
        .query("props")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect(),
      ctx.db
        .query("draftImports")
        .filter((q) => q.eq(q.field("userId"), user._id))
        .collect(),
      ctx.db
        .query("connectorAccounts")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect(),
      ctx.db
        .query("rawEvidence")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect(),
    ]);

    const cards = await Promise.all(
      props.map(async (prop) => {
        const product = await ctx.db.get(prop.productId);
        const links = await ctx.db
          .query("links")
          .withIndex("by_prop", (q) => q.eq("propId", prop._id))
          .collect();
        return { prop, product, links };
      }),
    );

    return {
      user,
      cards,
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

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const retainUpload = mutation({
  args: {
    storageId: v.id("_storage"),
    filename: v.string(),
    mimeType: v.string(),
    byteSize: v.number(),
    sourceType: v.union(v.literal("SCREENSHOT"), v.literal("CSV")),
    vendor: v.optional(v.string()),
    activity: v.optional(activityModuleValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = new Date().toISOString();
    let source = await ctx.db
      .query("evidenceSources")
      .withIndex("by_user_type", (q) =>
        q.eq("userId", user._id).eq("type", args.sourceType),
      )
      .first();
    if (!source) {
      const sourceId = await ctx.db.insert("evidenceSources", {
        userId: user._id,
        type: args.sourceType,
        label: `${args.sourceType.toLowerCase()} uploads`,
        connectedAt: now,
        lastSyncedAt: now,
      });
      source = (await ctx.db.get(sourceId))!;
    }

    const evidenceId = await ctx.db.insert("rawEvidence", {
      evidenceSourceId: source._id,
      userId: user._id,
      storageId: args.storageId,
      filename: args.filename,
      mimeType: args.mimeType,
      byteSize: args.byteSize,
      detectedVendor: args.vendor,
      capturedAt: now,
      dedupKey: `${user._id}:${args.storageId}`,
    });

    if (args.vendor) {
      const proposed = resolveProduct({
        sourceType: args.sourceType,
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
            headline: `${product.name} is in my stack.`,
            note: "Imported evidence is private until I approve this card.",
            activity: args.activity,
          });
          prop = (await ctx.db.get(propId))!;
          await ctx.db.insert("links", {
            propId,
            type: "CANONICAL",
            url: `https://${product.domain}`,
            label: `Open ${product.name}`,
            isPrimary: true,
          });
        } else if (prop.visibility === "DRAFT" && args.activity) {
          await ctx.db.patch(prop._id, { activity: args.activity });
        }
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
            status: "PENDING",
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
  args: {
    name: v.string(),
    slug: v.string(),
    domain: v.string(),
    description: v.string(),
    logoUrl: v.optional(v.string()),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const slug = claimableHandleSchema.parse(args.slug);
    let product = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!product) {
      const productId = await ctx.db.insert("products", {
        name: args.name.trim(),
        slug,
        domain: args.domain.trim().toLowerCase(),
        description: args.description.trim(),
        logoUrl: args.logoUrl,
      });
      product = (await ctx.db.get(productId))!;
    }

    const propId = await ctx.db.insert("props", {
      userId: user._id,
      productId: product._id,
      status: "TESTING",
      visibility: "DRAFT",
      headline: `${product.name} is in my stack.`,
      note: "",
    });
    await ctx.db.insert("links", {
      propId,
      type: "CANONICAL",
      url: args.url,
      label: `Open ${product.name}`,
      isPrimary: true,
    });
    await ctx.db.insert("draftImports", {
      userId: user._id,
      status: "PENDING",
      suggestedProductSlug: product.slug,
      suggestedProductName: product.name,
      suggestedDomain: product.domain,
      suggestedDescription: product.description,
      suggestedUrl: args.url,
      rawEvidenceIds: [],
      resultPropId: propId,
    });
    await ctx.db.patch(user._id, {
      onboardingStatus: "REVIEW",
      updatedAt: new Date().toISOString(),
    });
    return propId;
  },
});

const selectionValidator = v.object({
  propId: v.id("props"),
  publish: v.boolean(),
  status: statusValidator,
  headline: v.string(),
  note: v.string(),
  startedAt: v.optional(v.string()),
  startedAtSource: v.optional(
    v.union(v.literal("AUTHORITATIVE"), v.literal("USER_CONFIRMED")),
  ),
  primaryLink: v.object({
    type: linkTypeValidator,
    url: v.string(),
    label: v.string(),
  }),
  activity: v.optional(activityModuleValidator),
  autoRefresh: v.boolean(),
  connectorId: v.optional(v.id("connectorAccounts")),
  metricKey: v.optional(v.string()),
});

export const publishSelected = mutation({
  args: { selections: v.array(selectionValidator) },
  handler: async (ctx, { selections }) => {
    const user = await requireUser(ctx);
    const now = new Date().toISOString();

    for (const selection of selections) {
      const prop = await ctx.db.get(selection.propId);
      if (!prop || prop.userId !== user._id) {
        throw new Error("Cannot publish another user's product.");
      }

      await ctx.db.patch(prop._id, {
        visibility: selection.publish ? "PUBLIC" : "DRAFT",
        status: selection.status,
        headline: selection.headline.trim(),
        note: selection.note.trim(),
        startedAt: selection.startedAt,
        startedAtSource: selection.startedAtSource,
        activity: selection.publish ? selection.activity : undefined,
      });

      const links = await ctx.db
        .query("links")
        .withIndex("by_prop", (q) => q.eq("propId", prop._id))
        .collect();
      for (const link of links) {
        await ctx.db.patch(link._id, { isPrimary: false });
      }
      await ctx.db.insert("links", {
        propId: prop._id,
        ...selection.primaryLink,
        isPrimary: true,
      });

      const product = await ctx.db.get(prop.productId);
      if (product) {
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
            status: selection.publish ? "MERGED" : "PENDING",
            resultPropId: prop._id,
          });
        }
      }

      if (
        selection.publish &&
        selection.autoRefresh &&
        selection.connectorId &&
        selection.metricKey &&
        selection.activity
      ) {
        const connector = await ctx.db.get(selection.connectorId);
        if (
          !connector ||
          connector.userId !== user._id ||
          connector.status === "REVOKED"
        ) {
          throw new Error("A connected account is required for refresh.");
        }
        const existing = await ctx.db
          .query("metricSubscriptions")
          .withIndex("by_prop_metric", (q) =>
            q
              .eq("propId", prop._id)
              .eq("metricKey", selection.metricKey!),
          )
          .first();
        const subscription = {
          userId: user._id,
          propId: prop._id,
          connectorId: connector._id,
          metricKey: selection.metricKey,
          attributionScope: selection.activity.attributionScope,
          refreshCadence: "DAILY" as const,
          approvedAt: now,
          revokedAt: undefined,
        };
        if (existing) {
          await ctx.db.patch(existing._id, subscription);
        } else {
          await ctx.db.insert("metricSubscriptions", subscription);
        }
      }
    }

    const allProps = await ctx.db
      .query("props")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const projectedProps = await Promise.all(
      allProps.map(async (prop) => {
        const product = (await ctx.db.get(prop.productId))!;
        const links = await ctx.db
          .query("links")
          .withIndex("by_prop", (q) => q.eq("propId", prop._id))
          .collect();
        return {
          visibility: prop.visibility,
          status: prop.status,
          headline: prop.headline,
          note: prop.note,
          startedAt: prop.startedAt,
          activity: prop.activity,
          product: {
            name: product.name,
            slug: product.slug,
            domain: product.domain,
            description: product.description,
            logoUrl: product.logoUrl,
          },
          links: links.map((link) => ({
            type: link.type,
            url: link.url,
            label: link.label,
            isPrimary: link.isPrimary,
          })),
        };
      }),
    );
    const profile = projectPublicProfile({
      user: {
        handle: user.handle,
        displayName: user.displayName,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
      },
      props: projectedProps,
    });

    const published = await ctx.db
      .query("publishedProfiles")
      .withIndex("by_handle", (q) => q.eq("handle", user.handle))
      .unique();
    const value = {
      handle: user.handle,
      revision: (published?.revision ?? 0) + 1,
      publishedAt: now,
      profile,
    };
    if (published) {
      await ctx.db.replace(published._id, value);
    } else {
      await ctx.db.insert("publishedProfiles", value);
    }

    const site = await ctx.db
      .query("sites")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .unique();
    if (site) {
      await ctx.db.patch(site._id, {
        handle: user.handle,
        status: "ACTIVE",
      });
    }
    await ctx.db.patch(user._id, {
      onboardingStatus: "PUBLISHED",
      updatedAt: now,
    });
    return { handle: user.handle, cards: profile.cards.length };
  },
});

import { v } from "convex/values";
import { ensureProductBrand } from "./productBrands";
import { evidenceSourceTypeValidator, rawSignalValidator } from "./validators";
import { internalAction, internalMutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { canonicalPrivateEvidence } from "../src/domain/private-evidence";
import {
  prepareImportedProp,
  proposeDrafts,
  rawSignalSchema,
  type RawSignal,
} from "../src/domain/discovery";

type ProofType = Doc<"proofs">["type"];

const PROOF_TYPE_BY_SOURCE: Record<RawSignal["sourceType"], ProofType> = {
  MANUAL: "NOTE",
  PUBLIC_PROFILE: "NOTE",
  GITHUB: "GITHUB_REPO",
  BILLING: "RECEIPT",
  BROWSER_HISTORY: "BROWSER_HISTORY_EXPORT",
  SCREEN_TIME: "SCREENSHOT",
  SOCIAL_MESSAGES: "NOTE",
  GMAIL: "EMAIL_EVIDENCE",
  MICROSOFT_MAIL: "EMAIL_EVIDENCE",
  SCREENSHOT: "SCREENSHOT",
  CSV: "BROWSER_HISTORY_EXPORT",
  FILE_UPLOAD: "FILE_UPLOAD",
  URL_IMPORT: "NOTE",
  DEVIN: "API_OAUTH",
  DEVIN_DESKTOP: "SCREENSHOT",
  WINDSURF: "SCREENSHOT",
  WISPR_FLOW: "SCREENSHOT",
  NOTEBOOKLM: "SCREENSHOT",
  GREPTILE: "BROWSER_HISTORY_EXPORT",
};

// Plain helper: mailbox validation, evidence retention and cursor advancement
// share one mutation transaction. New workers never resolve a mutable handle.
export async function ingestSignalsForOwner(ctx: MutationCtx, args: {
  ownerId: Id<"users">;
  sourceType: RawSignal["sourceType"];
  sourceLabel?: string;
  sourceKey?: string;
  evidenceSourceId?: Id<"evidenceSources">;
  signals: RawSignal[];
  // Later catalog recognition describes a linked proposal, not a new capture.
  catalogClassifications?: ReadonlyMap<number, { vendor: string; url: string }>;
}) {
  if (args.sourceKey !== undefined && (!args.sourceKey.trim() || args.sourceKey.length > 512)) {
    throw new Error("A stable source account key is required and must fit within 512 characters.");
  }
  for (const signal of args.signals) {
    rawSignalSchema.parse(signal);
    if (signal.sourceType !== args.sourceType) throw new Error("Signal type must match its evidence source.");
    if (signal.sourceRecordId !== undefined && (!args.sourceKey || !signal.sourceRecordId.trim() || signal.sourceRecordId.length > 512)) {
      throw new Error("A source record ID requires a stable source account key and must fit within 512 characters.");
    }
    for (const observation of signal.observations ?? []) {
      if (!signal.payload.includes(observation.excerpt)) {
        throw new Error("Observation excerpt must occur verbatim in the retained payload.");
      }
    }
  }
  const user = await ctx.db.get(args.ownerId);
  if (!user) throw new Error("Evidence owner unavailable.");

  const now = new Date().toISOString();

  let source = args.evidenceSourceId ? await ctx.db.get(args.evidenceSourceId) : await ctx.db
    .query("evidenceSources")
    .withIndex("by_user_type_sourceKey", (q) =>
      q.eq("userId", user._id).eq("type", args.sourceType).eq("sourceKey", args.sourceKey),
    )
    // Owner-selected text is a separate acquisition route, even though both
    // routes retain MANUAL as their source type.
    .filter((q) => q.neq(q.field("provider"), "OWNER_SELECTED_TEXT"))
    .unique();
  if (args.evidenceSourceId && !source) throw new Error("Evidence source unavailable.");
  if (source) {
    if (source.userId !== user._id || source.type !== args.sourceType || source.sourceKey !== args.sourceKey) {
      throw new Error("Evidence source identity mismatch.");
    }
    await ctx.db.patch(source._id, { lastSyncedAt: now });
  } else {
    const sourceId = await ctx.db.insert("evidenceSources", {
      userId: user._id,
      type: args.sourceType,
      sourceKey: args.sourceKey,
      label: args.sourceLabel,
      connectedAt: now,
      lastSyncedAt: now,
    });
    source = (await ctx.db.get(sourceId))!;
  }

  const evidenceIds: Array<Doc<"rawEvidence">["_id"]> = [];
  // Sequential reads observe earlier inserts in this transaction, so repeated
  // provider records in one batch cannot race past the deduplication lookup.
  for (const signal of args.signals) {
    // Provider message IDs are unique within one mailbox, not across all of
    // a person's mailboxes. Keep the old key for legacy import replay.
    const dedupKey = args.sourceKey === undefined
      ? `${user._id}:${signal.sourceType}:${signal.vendor ?? ""}:${signal.url ?? ""}:${signal.capturedAt}`
      : JSON.stringify(["source-v1", source._id, signal.sourceRecordId === undefined
        ? ["capture", signal.vendor ?? "", signal.url ?? "", signal.capturedAt]
        : ["record", signal.sourceRecordId]]);
    const existing = await ctx.db
      .query("rawEvidence")
      .withIndex("by_dedup_key", (q) => q.eq("dedupKey", dedupKey))
      .unique();
    if (existing) {
      if (canonicalPrivateEvidence({ payload: existing.payload ?? "", observations: existing.observations ?? [] }) !== canonicalPrivateEvidence({ payload: signal.payload, observations: signal.observations ?? [] }) ||
        (args.sourceKey !== undefined && (existing.detectedVendor !== signal.vendor || existing.detectedUrl !== signal.url))) {
        throw new Error("Evidence identity collision: changed extraction requires a linked versioned capture; never overwrite the original.");
      }
      // Re-collection is not independent corroboration. Preserve the first
      // collector/route/time, but reject a changed origin or activity actor.
      const original = existing.captureProvenance;
      const incoming = signal.captureProvenance;
      if (original && incoming && (
        original.origin.issuer !== incoming.origin.issuer ||
        original.origin.accountId !== incoming.origin.accountId ||
        original.origin.recordId !== incoming.origin.recordId ||
        original.origin.artifactRef !== incoming.origin.artifactRef ||
        original.activityActor.kind !== incoming.activityActor.kind ||
        original.activityActor.id !== incoming.activityActor.id
      )) throw new Error("Evidence identity collision: original origin and activity attribution are immutable.");
      evidenceIds.push(existing._id);
      continue;
    }
    const evidenceId = await ctx.db.insert("rawEvidence", {
      evidenceSourceId: source._id,
      userId: user._id,
      payload: signal.payload,
      observations: signal.observations,
      captureProvenance: signal.captureProvenance,
      detectedVendor: signal.vendor,
      detectedUrl: signal.url,
      capturedAt: signal.capturedAt,
      dedupKey,
      sourceRecordId: signal.sourceRecordId,
    });
    evidenceIds.push(evidenceId);
  }

  const proposalSignals = args.signals.map((signal, index) => {
    const classification = args.catalogClassifications?.get(index);
    return classification ? { ...signal, ...classification } : signal;
  });
  const proposals = proposeDrafts(proposalSignals);
  const createdDrafts: string[] = [];

  for (const proposal of proposals) {
    const rawEvidenceIds = proposal.signalIndexes.map(
      (index) => evidenceIds[index],
    );

    let draft = await ctx.db
      .query("draftImports")
      .withIndex("by_user_slug", (q) =>
        q
          .eq("userId", user._id)
          .eq("suggestedProductSlug", proposal.product.slug),
      )
      .first();

    if (!draft) {
      const draftId = await ctx.db.insert("draftImports", {
        userId: user._id,
        status: "PENDING",
        suggestedProductSlug: proposal.product.slug,
        suggestedProductName: proposal.product.name,
        suggestedDomain: proposal.product.domain,
        suggestedDescription: proposal.product.description,
        suggestedUrl: proposal.canonicalUrl,
        rawEvidenceIds,
      });
      draft = (await ctx.db.get(draftId))!;
    }

    // New evidence may update the review inbox for an existing relationship.
    // It never reopens a rejected discovery or changes an owner's decisions.
    if (!["PENDING", "APPROVED", "MERGED"].includes(draft.status)) continue;
    if (draft.status !== "PENDING" && !draft.resultPropId) throw new Error("Reviewed discovery has no relationship.");

    const importedProp = prepareImportedProp(proposal, args.sourceType);

    // Manual and upload relationships need not have seed keys. Resolve the
    // owner's recorded relationship before looking up the shared catalog.
    let prop = draft.resultPropId ? await ctx.db.get(draft.resultPropId) : null;
    if (draft.resultPropId && (!prop || prop.userId !== user._id)) {
      throw new Error("Draft relationship ownership mismatch.");
    }
    const productSeedKey = proposal.product.slug;
    let product = prop ? await ctx.db.get(prop.productId) : await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", proposal.product.slug))
      .unique();
    if ((prop && !product) || (product && (
      product.slug !== proposal.product.slug ||
      product.domain.trim().toLowerCase() !== proposal.product.domain.trim().toLowerCase()
    ))) throw new Error("Draft relationship product mismatch.");
    if (!product) {
      const productId = await ctx.db.insert("products", {
        seedKey: productSeedKey,
        name: proposal.product.name,
        slug: proposal.product.slug,
        domain: proposal.product.domain,
        description: proposal.product.description,
      });
      product = (await ctx.db.get(productId))!;
    }

    // A handle can be renamed or reassigned. Follow the owner's existing
    // draft relationship, and key any new relationship by immutable owner ID.
    const newPropSeedKey = JSON.stringify(["owner-import-v1", user._id, proposal.product.slug]);
    if (!prop) {
      prop = await ctx.db.query("props")
        .withIndex("by_seed_key", (q) => q.eq("seedKey", newPropSeedKey)).unique();
    }
    if (prop && (prop.userId !== user._id || prop.productId !== product._id)) {
      throw new Error("Relationship owner or product mismatch.");
    }
    const propSeedKey = prop?.seedKey ?? newPropSeedKey;
    if (!prop) {
      const propId = await ctx.db.insert("props", {
        seedKey: propSeedKey,
        userId: user._id,
        productId: product._id,
        status: importedProp.status,
        visibility: importedProp.visibility,
        headline: importedProp.headline,
        note: importedProp.note,
      });
      prop = (await ctx.db.get(propId))!;
      createdDrafts.push(propSeedKey);
    }

    await ensureProductBrand(ctx, product);
    const linkSeedKey = `${propSeedKey}-primary`;
    const existingLink = await ctx.db
      .query("links")
      .withIndex("by_prop", (q) => q.eq("propId", prop._id))
      .filter((q) => q.eq(q.field("isPrimary"), true))
      .first();
    if (!existingLink) {
      await ctx.db.insert("links", {
        seedKey: linkSeedKey,
        propId: prop._id,
        type: "CANONICAL",
        url: proposal.canonicalUrl,
        label: `Check out ${proposal.product.name}`,
        isPrimary: true,
      });
    }

    const existingProofs = await ctx.db
      .query("proofs")
      .withIndex("by_prop", (q) => q.eq("propId", prop._id))
      .collect();
    const proofEvidenceIds = new Set(existingProofs.map(proof => proof.rawEvidenceId));
    for (const index of proposal.signalIndexes) {
      const signal = proposalSignals[index];
      const rawEvidenceId = evidenceIds[index];
      if (proofEvidenceIds.has(rawEvidenceId)) {
        continue;
      }
      await ctx.db.insert("proofs", {
        propId: prop._id,
        type: PROOF_TYPE_BY_SOURCE[signal.sourceType],
        url: signal.url,
        label: signal.vendor,
        rawEvidenceId,
      });
      proofEvidenceIds.add(rawEvidenceId);
    }

    await ctx.db.patch(draft._id, {
      resultPropId: prop._id,
      rawEvidenceIds: [
        ...new Set([...draft.rawEvidenceIds, ...rawEvidenceIds]),
      ],
    });
  }

  return {
    ingestedSignals: args.signals.length,
    proposals: proposals.length,
    createdDrafts,
  };
}

// Compatibility entry point for existing imports. Mailbox workers use the
// immutable-owner helper only, after validating their persisted account/job.
export const ingestSignals = internalMutation({
  args: {
    handle: v.string(),
    sourceType: evidenceSourceTypeValidator,
    sourceLabel: v.optional(v.string()),
    sourceKey: v.optional(v.string()),
    signals: v.array(rawSignalValidator),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users")
      .withIndex("by_handle", (q) => q.eq("handle", args.handle)).unique();
    if (!user) throw new Error(`Unknown user handle: ${args.handle}`);
    return await ingestSignalsForOwner(ctx, { ...args, ownerId: user._id });
  },
});

type GithubRepo = {
  full_name: string;
  html_url: string;
  pushed_at: string;
  fork: boolean;
};

type IngestResult = {
  ingestedSignals: number;
  proposals: number;
  createdDrafts: string[];
};

export const syncGithub = internalAction({
  args: {
    handle: v.string(),
    githubLogin: v.string(),
  },
  handler: async (ctx, args): Promise<IngestResult> => {
    const response = await fetch(
      `https://api.github.com/users/${args.githubLogin}/repos?sort=pushed&per_page=25`,
      { headers: { Accept: "application/vnd.github+json" } },
    );
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    const repos = (await response.json()) as GithubRepo[];

    const signals = repos
      .filter((repo) => !repo.fork)
      .map((repo) => ({
        sourceType: "GITHUB" as const,
        vendor: "GitHub",
        url: repo.html_url,
        capturedAt: repo.pushed_at ?? new Date().toISOString(),
        payload: JSON.stringify({ repo: repo.full_name }),
      }));

    return await ctx.runMutation(internal.discovery.ingestSignals, {
      handle: args.handle,
      sourceType: "GITHUB",
      sourceLabel: `github.com/${args.githubLogin}`,
      signals,
    });
  },
});

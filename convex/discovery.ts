import { v } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  prepareImportedProp,
  proposeDrafts,
  type RawSignal,
} from "../src/domain/discovery";

const evidenceSourceType = v.union(
  v.literal("MANUAL"),
  v.literal("PUBLIC_PROFILE"),
  v.literal("GITHUB"),
  v.literal("BILLING"),
  v.literal("BROWSER_HISTORY"),
  v.literal("SCREEN_TIME"),
  v.literal("SOCIAL_MESSAGES"),
  v.literal("GMAIL"),
  v.literal("SCREENSHOT"),
  v.literal("CSV"),
  v.literal("URL_IMPORT"),
  v.literal("DEVIN"),
  v.literal("DEVIN_DESKTOP"),
  v.literal("WINDSURF"),
  v.literal("WISPR_FLOW"),
  v.literal("NOTEBOOKLM"),
  v.literal("GREPTILE"),
);

const signalValidator = v.object({
  sourceType: evidenceSourceType,
  vendor: v.optional(v.string()),
  url: v.optional(v.string()),
  capturedAt: v.string(),
  payload: v.string(),
});

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
  SCREENSHOT: "SCREENSHOT",
  CSV: "BROWSER_HISTORY_EXPORT",
  URL_IMPORT: "NOTE",
  DEVIN: "API_OAUTH",
  DEVIN_DESKTOP: "SCREENSHOT",
  WINDSURF: "SCREENSHOT",
  WISPR_FLOW: "SCREENSHOT",
  NOTEBOOKLM: "SCREENSHOT",
  GREPTILE: "BROWSER_HISTORY_EXPORT",
};

export const ingestSignals = internalMutation({
  args: {
    handle: v.string(),
    sourceType: evidenceSourceType,
    sourceLabel: v.optional(v.string()),
    signals: v.array(signalValidator),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_handle", (q) => q.eq("handle", args.handle))
      .unique();
    if (!user) throw new Error(`Unknown user handle: ${args.handle}`);

    const now = new Date().toISOString();

    let source = await ctx.db
      .query("evidenceSources")
      .withIndex("by_user_type", (q) =>
        q.eq("userId", user._id).eq("type", args.sourceType),
      )
      .unique();
    if (source) {
      await ctx.db.patch(source._id, { lastSyncedAt: now });
    } else {
      const sourceId = await ctx.db.insert("evidenceSources", {
        userId: user._id,
        type: args.sourceType,
        label: args.sourceLabel,
        connectedAt: now,
        lastSyncedAt: now,
      });
      source = (await ctx.db.get(sourceId))!;
    }

    const evidenceIds = await Promise.all(
      args.signals.map(async (signal) => {
        const dedupKey = `${user._id}:${signal.sourceType}:${signal.vendor ?? ""}:${signal.url ?? ""}:${signal.capturedAt}`;
        const existing = await ctx.db
          .query("rawEvidence")
          .withIndex("by_dedup_key", (q) => q.eq("dedupKey", dedupKey))
          .unique();
        if (existing) return existing._id;
        return await ctx.db.insert("rawEvidence", {
          evidenceSourceId: source._id,
          userId: user._id,
          payload: signal.payload,
          detectedVendor: signal.vendor,
          detectedUrl: signal.url,
          capturedAt: signal.capturedAt,
          dedupKey,
        });
      }),
    );

    const proposals = proposeDrafts(args.signals);
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

      if (draft.status !== "PENDING") continue;

      const importedProp = prepareImportedProp(proposal, args.sourceType);

      const productSeedKey = proposal.product.slug;
      let product = await ctx.db
        .query("products")
        .withIndex("by_seed_key", (q) => q.eq("seedKey", productSeedKey))
        .unique();
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

      const propSeedKey = `${args.handle}-${proposal.product.slug}-import`;
      let prop = await ctx.db
        .query("props")
        .withIndex("by_seed_key", (q) => q.eq("seedKey", propSeedKey))
        .unique();
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

      const linkSeedKey = `${propSeedKey}-primary`;
      const existingLink = await ctx.db
        .query("links")
        .withIndex("by_seed_key", (q) => q.eq("seedKey", linkSeedKey))
        .unique();
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

      for (const index of proposal.signalIndexes) {
        const signal = args.signals[index];
        const rawEvidenceId = evidenceIds[index];
        const existingProofs = await ctx.db
          .query("proofs")
          .withIndex("by_prop", (q) => q.eq("propId", prop._id))
          .collect();
        if (existingProofs.some((p) => p.rawEvidenceId === rawEvidenceId)) {
          continue;
        }
        await ctx.db.insert("proofs", {
          propId: prop._id,
          type: PROOF_TYPE_BY_SOURCE[signal.sourceType],
          url: signal.url,
          label: signal.vendor,
          rawEvidenceId,
        });
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

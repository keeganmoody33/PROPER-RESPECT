import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { requireUser } from "./authHelpers";
import { offeringFactsValidator } from "./productKnowledgeTables";
import {
  definitionsForProduct,
  fetchOfficialSource,
  parseOfficialSource,
  semanticKey,
  sha256,
  sourceDefinitions,
  sourceParserVersion,
} from "../src/domain/product-knowledge";
const DAY = 86_400_000;
const MAX_BATCH = 5;
async function ownerProduct(ctx: QueryCtx | MutationCtx, propId: Id<"props">) {
  const user = await requireUser(ctx),
    prop = await ctx.db.get(propId);
  if (!prop || prop.userId !== user._id)
    throw new Error("Evidence unavailable.");
  const product = await ctx.db.get(prop.productId);
  if (!product) throw new Error("Product unavailable.");
  return { user, product };
}
async function register(ctx: MutationCtx, product: Doc<"products">) {
  const ids: Id<"productSources">[] = [];
  for (const def of definitionsForProduct(product)) {
    let source = await ctx.db
      .query("productSources")
      .withIndex("by_key", (q) => q.eq("key", def.key))
      .unique();
    if (!source) {
      const id = await ctx.db.insert("productSources", {
        key: def.key,
        provider: def.provider,
        label: def.label,
        canonicalUrl: def.canonicalUrl,
        enabled: false,
        nextRefreshAt: 0,
      });
      source = await ctx.db.get(id);
    }
    ids.push(source!._id);
  }
  return ids;
}
export async function registerProductSources(
  ctx: MutationCtx,
  product: Doc<"products">,
): Promise<void> {
  for (const sourceId of await register(ctx, product))
    await ctx.scheduler.runAfter(0, internal.productKnowledge.refreshSource, {
      sourceId,
    });
}
export const discover = mutation({
  args: { propId: v.id("props") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { product } = await ownerProduct(ctx, args.propId);
    await registerProductSources(ctx, product);
    return null;
  },
});
export const setRefresh = mutation({
  args: { propId: v.id("props"), enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, product } = await ownerProduct(ctx, args.propId);
    for (const sourceId of await register(ctx, product)) {
      const watch = await ctx.db
        .query("productWatches")
        .withIndex("by_userId_and_sourceId", (q) =>
          q.eq("userId", user._id).eq("sourceId", sourceId),
        )
        .unique();
      if (watch) {
        if (watch.enabled !== args.enabled)
          await ctx.db.patch(watch._id, { enabled: args.enabled });
      } else
        await ctx.db.insert("productWatches", {
          userId: user._id,
          sourceId,
          enabled: args.enabled,
        });
      const enabled = !!(await ctx.db
        .query("productWatches")
        .withIndex("by_sourceId_and_enabled", (q) =>
          q.eq("sourceId", sourceId).eq("enabled", true),
        )
        .first());
      const source = await ctx.db.get(sourceId);
      if (source?.enabled !== enabled)
        await ctx.db.patch(sourceId, { enabled });
    }
    return null;
  },
});
export const getForProduct = query({
  args: { propId: v.id("props") },
  handler: async (ctx, args) => {
    const { user, product } = await ownerProduct(ctx, args.propId),
      definitions = definitionsForProduct(product);
    const sources = [];
    for (const def of definitions) {
      const source = await ctx.db
        .query("productSources")
        .withIndex("by_key", (q) => q.eq("key", def.key))
        .unique();
      if (!source) continue;
      const watch = await ctx.db
        .query("productWatches")
        .withIndex("by_userId_and_sourceId", (q) =>
          q.eq("userId", user._id).eq("sourceId", source._id),
        )
        .unique();
      const latestObservation = source.latestObservationId
        ? await ctx.db.get(source.latestObservationId)
        : null;
      const run = source.latestRunId
        ? await ctx.db.get(source.latestRunId)
        : null;
      const latestRun = run
        ? {
            _id: run._id,
            status: run.status,
            capturedAt: run.capturedAt,
            parserVersion: run.parserVersion,
            message: run.message ?? null,
            rawHash: run.rawHash ?? null,
            finalUrl: run.finalUrl ?? null,
            normalizedText: run.normalizedText ?? null,
          }
        : null;
      const history = await ctx.db
        .query("productObservations")
        .withIndex("by_sourceId", (q) => q.eq("sourceId", source._id))
        .order("desc")
        .take(10);
      sources.push({
        source,
        watchEnabled: watch?.enabled ?? false,
        latestObservation,
        latestRun,
        history,
      });
    }
    return { supported: definitions.length > 0, sources };
  },
});
export const claim = internalMutation({
  args: {
    sourceId: v.id("productSources"),
    token: v.string(),
    recurring: v.boolean(),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId),
      now = Date.now();
    if (
      !source ||
      !sourceDefinitions.some(
        (d) => d.key === source.key && d.canonicalUrl === source.canonicalUrl,
      )
    )
      return null;
    if (args.recurring && (!source.enabled || source.nextRefreshAt > now))
      return null;
    if (source.leaseUntil && source.leaseUntil > now) return null;
    // Bound repeated checks after every outcome, including failed or incomplete captures.
    if (
      source.lastCompletedAt !== undefined &&
      now - source.lastCompletedAt < 60_000
    )
      return null;
    await ctx.db.patch(source._id, {
      leaseToken: args.token,
      leaseUntil: now + 60_000,
    });
    return { source, startedAt: now };
  },
});
export const due = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, args) =>
    ctx.db
      .query("productSources")
      .withIndex("by_enabled_and_nextRefreshAt", (q) =>
        q.eq("enabled", true).lte("nextRefreshAt", args.now),
      )
      .take(MAX_BATCH),
});
export const persist = internalMutation({
  args: {
    sourceId: v.id("productSources"),
    token: v.string(),
    startedAt: v.number(),
    capturedAt: v.string(),
    parserVersion: v.string(),
    rawStorageId: v.optional(v.id("_storage")),
    rawHash: v.optional(v.string()),
    normalizedText: v.optional(v.string()),
    finalUrl: v.optional(v.string()),
    facts: v.optional(offeringFactsValidator),
    complete: v.boolean(),
    message: v.optional(v.string()),
    error: v.boolean(),
  },
  returns: v.id("productRefreshRuns"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("productRefreshRuns")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (existing) {
      if (
        existing.sourceId !== args.sourceId ||
        existing.rawHash !== args.rawHash ||
        existing.capturedAt !== args.capturedAt ||
        existing.parserVersion !== args.parserVersion ||
        existing.rawStorageId !== args.rawStorageId
      )
        throw new Error("Public capture identity collision.");
      return existing._id;
    }
    const source = await ctx.db.get(args.sourceId);
    if (!source) throw new Error("Source unavailable.");
    const current =
      source.leaseToken === args.token &&
      args.startedAt >= (source.lastCompletedAt ?? 0);
    if (args.complete && !args.error) {
      if (
        !args.facts ||
        !args.rawStorageId ||
        !args.rawHash ||
        !args.normalizedText
      )
        throw new Error("Complete capture requires original source evidence.");
      const excerpts = [
        ...args.facts.tiers.flatMap((t) => [
          t.excerpt,
          ...t.features,
          ...t.prices.map((p) => p.excerpt),
          ...t.allowances.map((a) => a.excerpt),
        ]),
        ...args.facts.documentation.map((d) => d.excerpt),
      ];
      if (
        excerpts.some(
          (excerpt) => !excerpt || !args.normalizedText!.includes(excerpt),
        )
      )
        throw new Error("Public excerpts must match normalized capture.");
    }
    const prior = source.latestObservationId
      ? await ctx.db.get(source.latestObservationId)
      : null;
    const key = args.facts ? semanticKey(args.facts) : null;
    let status: Doc<"productRefreshRuns">["status"] = "ERROR";
    if (!args.error)
      status =
        !args.complete || !args.facts
          ? "INCOMPLETE"
          : !prior
            ? "BASELINE"
            : prior.parserVersion !== args.parserVersion
              ? "REPARSED"
              : prior.semanticKey === key
                ? "UNCHANGED"
                : "CHANGED";
    if (!current && !args.error) status = "INCOMPLETE";
    const {
      complete: _complete,
      facts: _facts,
      error: _error,
      ...capture
    } = args;
    void _complete;
    void _facts;
    void _error;
    const runId = await ctx.db.insert("productRefreshRuns", {
      ...capture,
      status,
      ...(!current
        ? {
            message:
              "Obsolete refresh completion retained; latest observation preserved.",
          }
        : {}),
    });
    let observationId = prior?._id;
    if (
      current &&
      args.facts &&
      ["BASELINE", "CHANGED", "REPARSED"].includes(status)
    ) {
      observationId = await ctx.db.insert("productObservations", {
        sourceId: args.sourceId,
        runId,
        capturedAt: args.capturedAt,
        parserVersion: args.parserVersion,
        semanticKey: key!,
        facts: args.facts,
        rawHash: args.rawHash!,
      });
    }
    if (observationId) await ctx.db.patch(runId, { observationId });
    if (current)
      await ctx.db.patch(source._id, {
        latestRunId: runId,
        ...(observationId ? { latestObservationId: observationId } : {}),
        lastCompletedAt: Date.now(),
        nextRefreshAt: Date.now() + DAY,
        leaseToken: undefined,
        leaseUntil: undefined,
      });
    return runId;
  },
});
async function refresh(
  ctx: ActionCtx,
  sourceId: Id<"productSources">,
  recurring: boolean,
): Promise<void> {
  const token = crypto.randomUUID();
  const claimed: { source: Doc<"productSources">; startedAt: number } | null =
    await ctx.runMutation(internal.productKnowledge.claim, {
      sourceId,
      token,
      recurring,
    });
  if (!claimed) return;
  const base = {
    sourceId,
    token,
    startedAt: claimed.startedAt,
    capturedAt: new Date().toISOString(),
    parserVersion: sourceParserVersion(claimed.source.key),
  };
  let rawStorageId: Id<"_storage"> | undefined;
  let captured:
    | {
        rawHash: string;
        normalizedText: string;
        finalUrl: string;
        parserVersion: string;
      }
    | undefined;
  try {
    const definition = sourceDefinitions.find(
      (d) => d.key === claimed.source.key,
    )!;
    const { html, rawBytes, finalUrl } = await fetchOfficialSource(definition);
    base.capturedAt = new Date().toISOString();
    // Store every successful fetch, including unchanged and incomplete responses.
    rawStorageId = await ctx.storage.store(
      new Blob([rawBytes], { type: "text/html" }),
    );
    const rawHash = await sha256(rawBytes);
    captured = {
      rawHash,
      normalizedText: "",
      finalUrl,
      parserVersion: base.parserVersion,
    };
    const parsed = parseOfficialSource(definition.key, html);
    captured = {
      rawHash,
      normalizedText: parsed.normalizedText,
      finalUrl,
      parserVersion: parsed.parserVersion,
    };
    await ctx.runMutation(internal.productKnowledge.persist, {
      ...base,
      ...captured,
      rawStorageId,
      facts: parsed.facts,
      complete: parsed.complete,
      error: false,
      ...(parsed.message ? { message: parsed.message } : {}),
    });
  } catch (error) {
    await ctx.runMutation(internal.productKnowledge.persist, {
      ...base,
      ...captured,
      ...(rawStorageId ? { rawStorageId } : {}),
      complete: false,
      error: true,
      message: (error instanceof Error
        ? error.message
        : "Official retrieval failed."
      ).slice(0, 500),
    });
  }
}
export const refreshSource = internalAction({
  args: { sourceId: v.id("productSources") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await refresh(ctx, args.sourceId, false);
    return null;
  },
});
export const refreshDue = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const sources: Doc<"productSources">[] = await ctx.runQuery(
      internal.productKnowledge.due,
      { now: Date.now() },
    );
    for (const source of sources) {
      try {
        await refresh(ctx, source._id, true);
      } catch {
        // A failed terminal write leaves this source due after its lease expires.
        // Continue the batch so one unavailable source cannot block the others.
        console.error(
          "Official refresh could not persist its result",
          source._id,
        );
      }
    }
    return null;
  },
});

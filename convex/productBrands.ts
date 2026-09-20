import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { internalAction, internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireUser } from "./authHelpers";
import { canonicalCatalogProduct, resolveCatalogProduct } from "../src/domain/discovery";
import { productBrandSnapshotSchema, type ProductBrandSnapshot } from "../src/domain/product-brand";
import { productBrandSnapshotValidator } from "./productBrandTables";
import { retrieveProductBrand } from "../src/server/context-brand";
import { internal } from "./_generated/api";

const REFRESH_COOLDOWN_MS = 60_000;
const refreshReference = makeFunctionReference<"action">("productBrands:refresh");
const PREPARATION_BATCH_SIZE = 25;

type BrandProductIdentity = Pick<Doc<"products">, "slug" | "name" | "domain">;

function catalogIdentity(product: BrandProductIdentity) {
  return canonicalCatalogProduct(product.slug) ?? (product.slug.startsWith("manual-")
    ? resolveCatalogProduct({ vendor: product.name })?.product : undefined);
}

export function productBrandEligibility(product: BrandProductIdentity) {
  const canonical = catalogIdentity(product);
  if (!canonical || canonical.domain !== product.domain) return "UNVERIFIED_DOMAIN" as const;
  // Verified 2026-09-19: this subdomain's provider result carries Google branding.
  // An exact domain match cannot establish NotebookLM's product-specific identity.
  if (canonical.slug === "notebooklm") return "PRODUCT_IDENTITY_REQUIRED" as const;
  // Root-domain retrieval cannot distinguish a catalog subproduct from its parent.
  const domainProduct = resolveCatalogProduct({ url: `https://${canonical.domain}` })?.product;
  if (domainProduct?.slug !== canonical.slug) return "PRODUCT_IDENTITY_REQUIRED" as const;
  return null;
}

function verifiedDomain(product: Doc<"products">): string | null {
  // Older manual entries keep their identity and relationship history. A later
  // catalog verification can authorize presentation without rewriting evidence.
  return productBrandEligibility(product) === null ? product.domain : null;
}

async function ownedProduct(ctx: QueryCtx | MutationCtx, propId: Id<"props">) {
  const user = await requireUser(ctx);
  const prop = await ctx.db.get(propId);
  if (!prop || prop.userId !== user._id) throw new Error("Product unavailable.");
  const product = await ctx.db.get(prop.productId);
  if (!product) throw new Error("Product unavailable.");
  return product;
}

/** Product presentation only. Call when a relationship becomes displayable. */
export async function ensureProductBrand(ctx: MutationCtx, product: Doc<"products">, refresh = false, retryFailed = false) {
  const canonicalDomain = verifiedDomain(product);
  if (!canonicalDomain) return { status: productBrandEligibility(product)! };
  const existing = await ctx.db.query("productBrandJobs")
    .withIndex("by_product", q => q.eq("productId", product._id)).unique();
  const now = Date.now();
  if (existing && existing.canonicalDomain === canonicalDomain) {
    if (existing.status === "FAILED" && !refresh && !retryFailed) return { status: existing.status };
    const pending = (existing.status === "PENDING" && now - existing.requestedAt < 180_000) || (existing.status === "RUNNING" && (existing.leaseUntil ?? 0) > now);
    const retained = existing.status === "READY" && !refresh && Boolean(await retainedProductBrand(ctx, product, existing));
    if (pending || retained || now - (existing.completedAt ?? existing.requestedAt) < REFRESH_COOLDOWN_MS) {
      return { status: existing.status };
    }
  }
  const generation = (existing?.generation ?? 0) + 1;
  const fields = { productId: product._id, canonicalDomain, generation, status: "PENDING" as const, requestedAt: now,
    completedAt: undefined, leaseUntil: undefined, lastError: undefined };
  if (existing) await ctx.db.patch(existing._id, fields);
  else await ctx.db.insert("productBrandJobs", fields);
  await ctx.scheduler.runAfter(0, refreshReference, { productId: product._id, generation });
  return { status: "PENDING" as const };
}

export const requestForProp = mutation({
  args: { propId: v.id("props"), refresh: v.optional(v.boolean()) },
  handler: async (ctx, args) => ensureProductBrand(ctx, await ownedProduct(ctx, args.propId), args.refresh, true),
});

async function ownedProducts(ctx: QueryCtx | MutationCtx, propIds: Id<"props">[]) {
  const user = await requireUser(ctx);
  if (propIds.length > PREPARATION_BATCH_SIZE) throw new Error("Prepare at most 25 products at a time.");
  const products = [];
  for (const propId of new Set(propIds)) {
    const prop = await ctx.db.get(propId);
    if (!prop || prop.userId !== user._id) throw new Error("Product unavailable.");
    const product = await ctx.db.get(prop.productId);
    if (!product) throw new Error("Product unavailable.");
    products.push({ propId, product });
  }
  return products;
}

/** One bounded enrollment operation for existing displayable owner relationships. */
export const prepareForProps = mutation({
  args: { propIds: v.array(v.id("props")), retryFailed: v.optional(v.boolean()) },
  handler: async (ctx, { propIds, retryFailed }) => {
    const products = await ownedProducts(ctx, propIds);
    const seen = new Set<Id<"products">>();
    for (const { product } of products) {
      if (seen.has(product._id)) continue;
      seen.add(product._id);
      await ensureProductBrand(ctx, product, false, retryFailed);
    }
    return { prepared: seen.size };
  },
});

export const getPreparationForProps = query({
  args: { propIds: v.array(v.id("props")) },
  handler: async (ctx, { propIds }) => Promise.all((await ownedProducts(ctx, propIds)).map(async ({ propId, product }) => {
    const reason = productBrandEligibility(product);
    if (reason) return { propId, status: reason };
    const job = await ctx.db.query("productBrandJobs").withIndex("by_product", q => q.eq("productId", product._id)).unique();
    const status = job?.status === "READY" && !(await retainedProductBrand(ctx, product, job)) ? "FAILED" : job?.status ?? "NOT_REQUESTED";
    return { propId, status } as const;
  })),
});

export async function retainedProductBrand(ctx: QueryCtx | MutationCtx, product: Doc<"products">, knownJob?: Doc<"productBrandJobs"> | null): Promise<ProductBrandSnapshot | undefined> {
  const domain = verifiedDomain(product);
  if (!domain) return undefined;
  const job = knownJob === undefined ? await ctx.db.query("productBrandJobs").withIndex("by_product", q => q.eq("productId", product._id)).unique() : knownJob;
  if (!job?.currentSnapshotId || job.canonicalDomain !== domain) return undefined;
  const record = await ctx.db.get(job.currentSnapshotId);
  if (!record || record.productId !== product._id || record.snapshot.canonicalDomain !== domain || record.snapshot.productSlug !== product.slug) return undefined;
  const parsed = productBrandSnapshotSchema.safeParse(record.snapshot);
  return parsed.success ? parsed.data : undefined;
}

export const getForProp = query({
  args: { propId: v.id("props") },
  handler: async (ctx, { propId }) => {
    const product = await ownedProduct(ctx, propId);
    const job = await ctx.db.query("productBrandJobs").withIndex("by_product", q => q.eq("productId", product._id)).unique();
    return { status: productBrandEligibility(product) ?? job?.status ?? "NOT_REQUESTED",
      current: (await retainedProductBrand(ctx, product, job)) ?? null, lastError: job?.lastError ?? null };
  },
});

export const historyForProp = query({
  args: { propId: v.id("props") },
  handler: async (ctx, { propId }) => {
    const product = await ownedProduct(ctx, propId);
    const history = await ctx.db.query("productBrandSnapshots").withIndex("by_product", q => q.eq("productId", product._id)).order("desc").take(20);
    return history.map(record => record.snapshot);
  },
});

export const claim = internalMutation({
  args: { productId: v.id("products"), generation: v.number() },
  handler: async (ctx, { productId, generation }) => {
    const product = await ctx.db.get(productId);
    const job = await ctx.db.query("productBrandJobs").withIndex("by_product", q => q.eq("productId", productId)).unique();
    if (!product || !job || job.generation !== generation || job.status !== "PENDING" || verifiedDomain(product) !== job.canonicalDomain) return null;
    const relationship = await ctx.db.query("props").withIndex("by_product", q => q.eq("productId", productId)).first();
    if (!relationship) return null;
    await ctx.db.patch(job._id, { status: "RUNNING", leaseUntil: Date.now() + 180_000 });
    return { productSlug: product.slug, canonicalDomain: job.canonicalDomain, retrievalId: `${productId}_${generation}` };
  },
});

export const retain = internalMutation({
  args: { productId: v.id("products"), generation: v.number(), snapshot: productBrandSnapshotValidator, responseJson: v.string() },
  handler: async (ctx, args) => {
    const snapshot = productBrandSnapshotSchema.parse(args.snapshot);
    const product = await ctx.db.get(args.productId);
    const job = await ctx.db.query("productBrandJobs").withIndex("by_product", q => q.eq("productId", args.productId)).unique();
    if (!product || !job || verifiedDomain(product) !== snapshot.canonicalDomain || product.slug !== snapshot.productSlug || args.generation > job.generation || args.generation < 1) throw new Error("Brand identity or generation mismatch.");
    const bytes = new TextEncoder().encode(args.responseJson);
    if (bytes.length > 262_144) throw new Error("Brand response too large.");
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), x => x.toString(16).padStart(2, "0")).join("");
    if (hash !== snapshot.responseHash) throw new Error("Brand response hash mismatch.");
    const existing = await ctx.db.query("productBrandSnapshots").withIndex("by_retrieval", q => q.eq("snapshot.retrievalId", snapshot.retrievalId)).unique();
    if (existing) {
      if (existing.productId !== args.productId || existing.generation !== args.generation || JSON.stringify(productBrandSnapshotSchema.parse(existing.snapshot)) !== JSON.stringify(snapshot) || existing.responseJson !== args.responseJson) throw new Error("Brand retrieval identity collision.");
      return existing._id;
    }
    const id = await ctx.db.insert("productBrandSnapshots", { ...args, snapshot });
    // Old completions remain inspectable, but cannot replace a newer selection.
    if (job.generation === args.generation && job.status === "RUNNING" && job.canonicalDomain === snapshot.canonicalDomain) {
      await ctx.db.patch(job._id, { status: "READY", currentSnapshotId: id, completedAt: Date.now(), leaseUntil: undefined, lastError: undefined });
    }
    return id;
  },
});

export const fail = internalMutation({
  args: { productId: v.id("products"), generation: v.number(), reason: v.union(v.literal("NOT_CONFIGURED"), v.literal("RETRIEVAL_FAILED")) },
  handler: async (ctx, args) => {
    const job = await ctx.db.query("productBrandJobs").withIndex("by_product", q => q.eq("productId", args.productId)).unique();
    if (job?.generation === args.generation && job.status === "RUNNING") {
      // Preserve the last retained selection on failure; no provider error bodies.
      await ctx.db.patch(job._id, { status: "FAILED", completedAt: Date.now(), leaseUntil: undefined, lastError: args.reason });
    }
  },
});

export const refresh = internalAction({
  args: { productId: v.id("products"), generation: v.number() },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.runMutation(internal.productBrands.claim, args);
    if (!identity) return;
    const apiKey = process.env.CONTEXT_DEV_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.productBrands.fail, { ...args, reason: "NOT_CONFIGURED" });
      return;
    }
    try {
      const { snapshot, response } = await retrieveProductBrand(identity, { apiKey });
      await ctx.runMutation(internal.productBrands.retain, { ...args, snapshot, responseJson: JSON.stringify(response) });
    } catch {
      await ctx.runMutation(internal.productBrands.fail, { ...args, reason: "RETRIEVAL_FAILED" });
    }
  },
});

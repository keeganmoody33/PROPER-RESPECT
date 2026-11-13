import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { internalAction, internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireUser } from "./authHelpers";
import { resolveCatalogProduct } from "../src/domain/discovery";
import { directoryDomainOwner, directoryEntry, extractDomain } from "../src/domain/product-directory";
import { DIRECTORY_ENTRIES } from "../src/domain/product-directory-entries";
import { brandNameKey, canonicalBrandDomainSchema, CONTEXT_BRAND_ADAPTER_VERSION, productBrandSnapshotSchema, type ProductBrandSnapshot } from "../src/domain/product-brand";
import { productBrandSnapshotValidator } from "./productBrandTables";
import { retrieveProductBrand } from "../src/server/context-brand";
import { internal } from "./_generated/api";

const REFRESH_COOLDOWN_MS = 60_000;
const DAY_MS = 86_400_000;
/** A stored brand is fetched again after this long, so a rebrand reaches the cards. */
const BRAND_MAX_AGE_MS = 30 * DAY_MS;
const FAILED_RETRY_MS = 7 * DAY_MS;
/** An attempt still unfinished after this long was interrupted, and is started again. */
const ABANDONED_MS = DAY_MS;
const REFRESH_DUE_BATCH = 10;
const DUE = [
  { status: "READY", age: BRAND_MAX_AGE_MS }, { status: "FAILED", age: FAILED_RETRY_MS },
  { status: "PENDING", age: ABANDONED_MS }, { status: "RUNNING", age: ABANDONED_MS },
] as const;
const refreshReference = makeFunctionReference<"action">("productBrands:refresh");
const PREPARATION_BATCH_SIZE = 25;

type BrandProductIdentity = Pick<Doc<"products">, "slug" | "name" | "domain">;
type ListedIdentity = Readonly<{ slug: string; domain: string; names: readonly string[]; handChecked: boolean }>;

/** Each listed product's domain and the host of its website: "x.ai" and "docs.x.ai" for Grok Bot. */
const listedHosts = (entry: (typeof DIRECTORY_ENTRIES)[number]) => [entry.domain, extractDomain(entry.website)];
const LISTED_HOSTS = new Set(DIRECTORY_ENTRIES.flatMap(listedHosts));

const asIdentity = (entry: (typeof DIRECTORY_ENTRIES)[number]): ListedIdentity =>
  ({ slug: entry.slug, domain: entry.domain, names: [entry.name, ...entry.aliases], handChecked: entry.evidence !== undefined });

/**
 * The directory product this row is: by its slug; for an older typed row, by a hand-checked
 * product's name; or for any typed or discovered row, by a listed product's website and whole name.
 */
function listedIdentity(product: BrandProductIdentity): ListedIdentity | null {
  const entry = directoryEntry(product.slug);
  if (entry) return asIdentity(entry);
  const named = product.slug.startsWith("manual-") ? resolveCatalogProduct({ vendor: product.name })?.product : undefined;
  if (named) return { slug: named.slug, domain: named.domain, names: [named.name], handChecked: true };
  const name = brandNameKey(product.name);
  const match = name ? DIRECTORY_ENTRIES.find(candidate => listedHosts(candidate).includes(product.domain) &&
    [candidate.name, ...candidate.aliases].some(known => brandNameKey(known) === name)) : undefined;
  return match ? asIdentity(match) : null;
}

/**
 * Any product with its own website can have its brand fetched. A listed product keeps its
 * listed website; a product nobody listed uses the website on its row, unless a listed product owns it.
 */
export function productBrandEligibility(product: BrandProductIdentity) {
  const identity = listedIdentity(product);
  if (!identity) {
    // A listed product's website, root or not, is never an unlisted product's own.
    const ownWebsite = canonicalBrandDomainSchema.safeParse(product.domain).success && !LISTED_HOSTS.has(product.domain);
    return ownWebsite ? null : "UNVERIFIED_DOMAIN" as const;
  }
  if (identity.domain !== product.domain) return "UNVERIFIED_DOMAIN" as const;
  // Verified 2026-09-19: this subdomain's provider result carries Google branding.
  // An exact domain match cannot establish NotebookLM's product-specific identity.
  if (identity.slug === "notebooklm") return "PRODUCT_IDENTITY_REQUIRED" as const;
  // Root-domain retrieval cannot distinguish a product inside another product's site from its parent.
  if (directoryDomainOwner(identity.domain)?.slug !== identity.slug) return "PRODUCT_IDENTITY_REQUIRED" as const;
  return null;
}

/**
 * The names a fetched brand must carry. The hand-checked products were each verified against
 * their provider result, so they need no check; every other product is checked on each fetch.
 */
function expectedBrandNames(product: BrandProductIdentity): readonly string[] | undefined {
  const identity = listedIdentity(product);
  if (identity?.handChecked) return undefined;
  return identity ? identity.names : [product.name];
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
    // A brand an older adapter stored lacks what cards now read, so it counts as missing and is fetched again.
    const retained = existing.status === "READY" && !refresh && (await retainedProductBrand(ctx, product, existing))?.adapterVersion === CONTEXT_BRAND_ADAPTER_VERSION;
    if (pending || retained || now - (existing.completedAt ?? existing.requestedAt) < REFRESH_COOLDOWN_MS) {
      return { status: existing.status };
    }
  }
  await queueRetrieval(ctx, product._id, canonicalDomain, existing);
  return { status: "PENDING" as const };
}

async function queueRetrieval(ctx: MutationCtx, productId: Id<"products">, canonicalDomain: string, existing: Doc<"productBrandJobs"> | null) {
  const generation = (existing?.generation ?? 0) + 1;
  const fields = { productId, canonicalDomain, generation, status: "PENDING" as const, requestedAt: Date.now(),
    completedAt: undefined, leaseUntil: undefined, lastError: undefined };
  if (existing) await ctx.db.patch(existing._id, fields);
  else await ctx.db.insert("productBrandJobs", fields);
  await ctx.scheduler.runAfter(0, refreshReference, { productId, generation });
}

/**
 * Hourly: fetch again the oldest stored brands that are over thirty days old, retry week-old
 * failures, and restart attempts abandoned a day ago. A failed fetch leaves the stored brand in place.
 */
export const refreshDue = internalMutation({
  args: {},
  handler: async ctx => {
    const now = Date.now();
    let queued = 0;
    for (const { status, age } of DUE) {
      // A finished job is aged from when it finished; an unfinished one from when it was requested.
      const finished = status === "READY" || status === "FAILED";
      const due = await (finished
        ? ctx.db.query("productBrandJobs").withIndex("by_status_completed", q => q.eq("status", status).lt("completedAt", now - age))
        : ctx.db.query("productBrandJobs").withIndex("by_status_requested", q => q.eq("status", status).lt("requestedAt", now - age))
      ).take(REFRESH_DUE_BATCH);
      for (const job of due) {
        if (status === "RUNNING" && (job.leaseUntil ?? 0) > now) continue;
        const product = await ctx.db.get(job.productId);
        const used = product && await ctx.db.query("props").withIndex("by_product", q => q.eq("productId", job.productId)).first();
        if (!product || !used || verifiedDomain(product) !== job.canonicalDomain) {
          // Nothing to fetch for a product nobody has or one that lost its website. Look again
          // after the same wait, so it does not hold up the products that are in use.
          await ctx.db.patch(job._id, finished ? { completedAt: now } : { requestedAt: now });
          continue;
        }
        await queueRetrieval(ctx, job.productId, job.canonicalDomain, job);
        queued += 1;
      }
    }
    // A brand stored by an older adapter lacks what the current one keeps, so it is fetched once more.
    // Each job records the adapter it was last weighed against, and only jobs behind the current one are
    // read, so brands that are already current never hold an outdated one back. A product nobody uses is
    // marked as weighed without a fetch; ensureProductBrand fetches it when someone starts using it.
    const behind = await ctx.db.query("productBrandJobs")
      .withIndex("by_status_adapter_seen", q => q.eq("status", "READY").lt("adapterSeen", CONTEXT_BRAND_ADAPTER_VERSION)).take(REFRESH_DUE_BATCH);
    for (const job of behind) {
      const stored = job.currentSnapshotId && await ctx.db.get(job.currentSnapshotId);
      const product = await ctx.db.get(job.productId);
      const used = product && await ctx.db.query("props").withIndex("by_product", q => q.eq("productId", job.productId)).first();
      if (!stored || stored.snapshot.adapterVersion === CONTEXT_BRAND_ADAPTER_VERSION || !product || !used || verifiedDomain(product) !== job.canonicalDomain) {
        await ctx.db.patch(job._id, { adapterSeen: CONTEXT_BRAND_ADAPTER_VERSION });
        continue;
      }
      await queueRetrieval(ctx, job.productId, job.canonicalDomain, job);
      await ctx.db.patch(job._id, { adapterSeen: CONTEXT_BRAND_ADAPTER_VERSION });
      queued += 1;
    }
    return { queued };
  },
});

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
    const expectedNames = expectedBrandNames(product);
    return { productSlug: product.slug, canonicalDomain: job.canonicalDomain, retrievalId: `${productId}_${generation}`, ...(expectedNames ? { expectedNames: [...expectedNames] } : {}) };
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
      await ctx.db.patch(job._id, { status: "READY", currentSnapshotId: id, completedAt: Date.now(), leaseUntil: undefined, lastError: undefined, adapterSeen: snapshot.adapterVersion });
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
      const { expectedNames, ...product } = identity;
      const { snapshot, response } = await retrieveProductBrand(product, { apiKey, expectedNames });
      await ctx.runMutation(internal.productBrands.retain, { ...args, snapshot, responseJson: JSON.stringify(response) });
    } catch {
      await ctx.runMutation(internal.productBrands.fail, { ...args, reason: "RETRIEVAL_FAILED" });
    }
  },
});

import { v, type ObjectType } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireUser } from "./authHelpers";
import { registerProductSources } from "./productKnowledge";
import { ensureProductBrand } from "./productBrands";
import {
  extractDomain,
  resolveCatalogProduct,
  resolveCatalogProductWebsite,
  type DraftProposal,
} from "../src/domain/discovery";
import { sha256 } from "../src/domain/product-knowledge";

export const addManualProductArgs = {
  name: v.string(),
  website: v.optional(v.string()),
  description: v.optional(v.string()),
  operationId: v.optional(v.string()),
  // Older callers may still send these fields. Identity is resolved here, never
  // selected by a caller's global slug or unverified logo.
  slug: v.optional(v.string()),
  domain: v.optional(v.string()),
  url: v.optional(v.string()),
  logoUrl: v.optional(v.string()),
};
type ManualProductArgs = ObjectType<typeof addManualProductArgs>;

function normalizeWebsite(input: string | undefined): string | undefined {
  const value = input?.trim();
  if (!value) return undefined;
  if (value.length > 2048) throw new Error("The product website is too long.");
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  let url: URL;
  try { url = new URL(candidate); } catch { throw new Error("Use a public HTTP or HTTPS product website, or leave it blank."); }
  if (!extractDomain(candidate) || !/^https?:$/.test(url.protocol) || url.username || url.password || url.port) {
    throw new Error("Use a public HTTP or HTTPS product website without credentials, or leave it blank.");
  }
  url.hash = "";
  return url.href;
}

function resolveCatalog(name: string, website: string | undefined): Pick<DraftProposal, "product" | "canonicalUrl"> | undefined {
  const named = resolveCatalogProduct({ vendor: name });
  const byWebsite = website ? resolveCatalogProductWebsite(website) : undefined;
  if (named && website) {
    const websiteFamily = byWebsite ?? resolveCatalogProduct({ url: website });
    const specificProductConflict = byWebsite && byWebsite.product.slug !== named.product.slug && new URL(website).pathname.replace(/\/+$/, "") !== "";
    // A named subproduct may use its company's root website. An explicitly
    // cataloged destination for a different product must not override the name.
    if (!websiteFamily || websiteFamily.product.domain !== named.product.domain || specificProductConflict) {
      throw new Error("That website does not match the named catalog product. Correct the name or website.");
    }
  }
  return named ?? byWebsite ?? undefined;
}

export async function addManualProductHandler(ctx: MutationCtx, args: ManualProductArgs) {
  const user = await requireUser(ctx);
  const name = args.name.trim().replace(/\s+/g, " ");
  const note = (args.description ?? "").trim();
  if (!name || name.length > 160) throw new Error("Enter a product name of 160 characters or fewer.");
  if (note.length > 4000) throw new Error("Keep your explanation to 4,000 characters or fewer.");
  const website = normalizeWebsite(args.website ?? args.url ?? args.domain);
  const requestJson = JSON.stringify({ version: 1, name, website: website ?? null, note });
  const operationId = args.operationId === undefined ? `legacy:${await sha256(requestJson)}` : args.operationId.trim();
  if (!operationId || operationId.length > 128) throw new Error("Invalid add-product operation.");
  const previous = await ctx.db.query("manualProductIntakes")
    .withIndex("by_user_operation", q => q.eq("userId", user._id).eq("operationId", operationId)).unique();
  if (previous) {
    if (previous.requestJson !== requestJson) throw new Error("This add-product operation was already used with different details.");
    const prop = await ctx.db.get(previous.propId);
    if (!prop || prop.userId !== user._id) throw new Error("The previously added relationship is unavailable.");
    return prop._id;
  }

  const catalog = resolveCatalog(name, website);
  const domain = website ? extractDomain(website)! : "";
  const identityHash = await sha256(JSON.stringify([user._id, name.toLowerCase(), domain]));
  const namePrefix = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 8).replace(/-$/g, "") || "product";
  const identity = catalog?.product ?? {
    name,
    slug: `manual-${namePrefix}-${identityHash.slice(0, 22)}`,
    domain,
    // Personal explanations never enter shared presentation metadata.
    description: "",
  };
  let product = await ctx.db.query("products").withIndex("by_slug", q => q.eq("slug", identity.slug)).unique();
  if (product && (product.domain !== identity.domain || product.name.toLowerCase() !== identity.name.toLowerCase())) {
    throw new Error("The stored product identity conflicts with this product. It needs review before adding.");
  }
  if (!product) {
    const productId = await ctx.db.insert("products", identity);
    product = (await ctx.db.get(productId)) as Doc<"products">;
  }
  const existing = await ctx.db.query("props").withIndex("by_user_product", q => q.eq("userId", user._id).eq("productId", product._id)).first();
  const now = new Date().toISOString();
  let propId = existing?._id;
  if (!propId) {
    propId = await ctx.db.insert("props", {
      userId: user._id, productId: product._id, status: "TESTING", visibility: "DRAFT",
      // TESTING is the legacy pending-row placeholder, not a confirmed status.
      headline: "", note, ownerEntered: true,
    });
    const primaryUrl = catalog?.canonicalUrl ?? website;
    if (primaryUrl) await ctx.db.insert("links", {
      propId, type: "CANONICAL", url: primaryUrl, label: `Open ${product.name}`, isPrimary: true,
    });
    await ctx.db.insert("draftImports", {
      userId: user._id, status: "PENDING", suggestedProductSlug: product.slug,
      suggestedProductName: product.name, suggestedDomain: product.domain,
      suggestedDescription: product.description, suggestedUrl: primaryUrl ?? "",
      rawEvidenceIds: [], resultPropId: propId,
    });
    // Adding a private draft must not reset an already published account's state.
    if (user.onboardingStatus !== "PUBLISHED") await ctx.db.patch(user._id, { onboardingStatus: "REVIEW", updatedAt: now });
    if (catalog) {
      await registerProductSources(ctx, product);
      await ensureProductBrand(ctx, product);
    }
  }
  await ctx.db.insert("manualProductIntakes", { userId: user._id, operationId, requestJson, propId, createdAt: now });
  return propId;
}
